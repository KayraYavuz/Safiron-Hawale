"""
Transaction API — iş kurallarına uygun yön ve kâr mantığı.

Direction:  fromAcc (source) → toAcc (destination)
            Müşteri source'da para verir, destination'da alır.
            outgoing leg = source (müşteri verir)
            incoming leg = destination (müşteri alır)

Kur:        1 USD = X {currency}  (daima, ters format yok)
Kâr:        pnl.calculate_pnl() — source/dest/usd_amount/customer_rate/supplier_rate ile
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from datetime import date
from decimal import Decimal
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.master import Account, Currency
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, SupplierSettlement, TxnType, TxnStatus, LegType
from app.schemas.schemas import TransactionCreate, TransactionOut
from app.services.pnl import calculate_pnl
from app.services.balance import get_usd_rate
from app.services.audit import log as audit_log

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _require(user: User, *roles: UserRole):
    if user.role not in roles:
        raise HTTPException(403, "Forbidden")


def _next_txn_number(db: Session) -> str:
    """MAX+1 tabanlı sıra numarası — race-condition safe, index kullanır."""
    import datetime
    year = datetime.date.today().year
    prefix = f"TXN-{year}-"
    last = (db.query(Transaction.txn_number)
              .filter(Transaction.txn_number.like(f"{prefix}%"))
              .order_by(Transaction.txn_number.desc())
              .first())
    seq = int(last[0].split("-")[-1]) + 1 if last else 1
    for _ in range(10):
        candidate = f"{prefix}{seq:04d}"
        if not db.query(Transaction.id).filter(Transaction.txn_number == candidate).first():
            return candidate
        seq += 1
    raise ValueError("İşlem numarası oluşturulamadı")


def _to_usd(amount: Decimal, currency_code: str, db: Session) -> Decimal:
    """Tutarı USD'ye çevir. Kur: 1 USD = rate → amount_usd = amount / rate."""
    if currency_code == "USD":
        return amount
    rate = get_usd_rate(db, currency_code)
    if not rate:
        return Decimal("0")
    return (amount / rate).quantize(Decimal("0.0001"))


@router.get("", response_model=List[TransactionOut])
def list_transactions(
    status:          Optional[str]  = None,
    txn_type:        Optional[str]  = None,
    counterparty_id: Optional[UUID] = None,
    from_date:       Optional[date] = None,
    to_date:         Optional[date] = None,
    limit:  int = 200,  # default page size — prevents loading 10k rows at once
    offset: int = 0,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    # Cap limit to avoid accidental huge queries
    limit = min(limit, 500)
    q = db.query(Transaction).options(
        joinedload(Transaction.counterparty),
        joinedload(Transaction.legs).joinedload(TransactionLeg.account).joinedload(Account.location),
        joinedload(Transaction.legs).joinedload(TransactionLeg.account).joinedload(Account.currency),
        joinedload(Transaction.legs).joinedload(TransactionLeg.currency),
        joinedload(Transaction.pnl),
        joinedload(Transaction.supplier_settlement).joinedload(SupplierSettlement.counterparty),
    )
    q = apply_company_filter(q, Transaction, cu)
    if status:
        q = q.filter(Transaction.status == status)
    if txn_type:
        q = q.filter(Transaction.txn_type == txn_type)
    if counterparty_id:
        q = q.filter(Transaction.counterparty_id == counterparty_id)
    if from_date:
        q = q.filter(Transaction.txn_date >= from_date)
    if to_date:
        q = q.filter(Transaction.txn_date <= to_date)
    return q.order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()


@router.post("", response_model=TransactionOut)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    _require(cu, UserRole.admin, UserRole.super_admin, UserRole.accounting, UserRole.manager, UserRole.branch_manager, UserRole.data_entry)

    if not data.legs:
        raise HTTPException(400, "En az bir bacak gerekli")

    # Bacak validasyonu
    for leg in data.legs:
        acc = db.query(Account).filter(Account.id == leg.account_id).first()
        if not acc:
            raise HTTPException(404, f"Account not found: {leg.account_id}")
        if str(acc.currency_id) != str(leg.currency_id):
            raise HTTPException(400, f"Account '{acc.name}' only supports {acc.currency.code} transactions")

    # İşlem oluştur
    txn = Transaction(
        txn_number=_next_txn_number(db),
        txn_date=data.txn_date,
        value_date=data.value_date,
        txn_type=data.txn_type,
        counterparty_id=data.counterparty_id,
        counterparty_role=data.counterparty_role,
        notes=data.notes,
        created_by=cu.id,
        company_id=cu.company_id,
    )
    db.add(txn)
    db.flush()

    # Bacakları kaydet
    for leg_data in data.legs:
        acc = db.query(Account).filter(Account.id == leg_data.account_id).first()
        amount_usd = _to_usd(leg_data.amount, acc.currency.code, db)
        leg = TransactionLeg(
            transaction_id=txn.id,
            leg_type=leg_data.leg_type,
            account_id=leg_data.account_id,
            currency_id=leg_data.currency_id,
            amount=leg_data.amount,
            amount_usd=amount_usd,
            reference=leg_data.reference,
        )
        db.add(leg)

    db.flush()
    _calculate_and_save_pnl(txn, data, db)
    audit_log(db, "CREATE", user_id=cu.id, entity="Transaction",
              entity_id=txn.id, detail={"txn_number": txn.txn_number, "type": data.txn_type})
    db.commit()
    db.refresh(txn)
    return txn


def _calculate_and_save_pnl(txn: Transaction, data: TransactionCreate, db: Session):
    """
    İşlem kâr/zarar hesapla ve kaydet.

    Direction:  outgoing leg = source (müşteri veriyor)
                incoming leg = destination (müşteri alıyor)
    Kur:        1 USD = X {currency}
    customer_rate: operatörün müşteriye uyguladığı
    supplier_rate: operatörün piyasadan aldığı
    """
    zero = Decimal("0")

    # Basit işlemler — kâr yok
    if data.txn_type in (TxnType.deposit, TxnType.withdrawal, TxnType.internal_transfer):
        db.add(TransactionPnL(
            transaction_id=txn.id,
            gross_profit_quote=zero,
            gross_profit_quote_currency="USD",
            gross_profit_usd=zero,
            profit=zero,
            profit_usd=zero,
            commission_usd=zero,
            net_pnl_usd=zero,
        ))
        return

    # Bacakları çek
    out_legs = (db.query(TransactionLeg).join(Account).join(Currency)
                .filter(TransactionLeg.transaction_id == txn.id,
                        TransactionLeg.leg_type == LegType.outgoing).all())
    in_legs  = (db.query(TransactionLeg).join(Account).join(Currency)
                .filter(TransactionLeg.transaction_id == txn.id,
                        TransactionLeg.leg_type == LegType.incoming).all())

    # Kur girilmemişse — basit USD farkı
    if not data.customer_rate and not data.supplier_rate:
        out_usd = sum(l.amount_usd for l in out_legs) or zero
        in_usd  = sum(l.amount_usd for l in in_legs)  or zero
        net     = in_usd - out_usd
        comm    = data.commission_usd or zero
        db.add(TransactionPnL(
            transaction_id=txn.id,
            gross_profit_quote=net,
            gross_profit_quote_currency="USD",
            gross_profit_usd=net,
            profit=net,
            profit_currency="USD",
            profit_usd=net,
            commission_usd=comm,
            net_pnl_usd=net + comm,
        ))
        return

    if not out_legs or not in_legs:
        db.add(TransactionPnL(
            transaction_id=txn.id,
            gross_profit_quote=zero, gross_profit_quote_currency="USD",
            gross_profit_usd=zero, profit=zero, profit_usd=zero,
            commission_usd=zero, net_pnl_usd=zero,
        ))
        return

    # Direction: outgoing = source (müşteri veriyor), incoming = dest (müşteri alıyor)
    source_currency = out_legs[0].currency.code
    dest_currency   = in_legs[0].currency.code
    usd_amount      = data.usd_amount or zero
    customer_rate   = data.customer_rate or zero
    supplier_rate   = data.supplier_rate or zero
    commission_usd  = data.commission_usd or zero

    result = calculate_pnl(
        source_currency=source_currency,
        dest_currency=dest_currency,
        usd_amount=usd_amount,
        customer_rate=customer_rate,
        supplier_rate=supplier_rate,
        commission_usd=commission_usd,
    )

    db.add(TransactionPnL(
        transaction_id=txn.id,
        # Yön ve kurlar
        source_currency=result["source_currency"],
        dest_currency=result["dest_currency"],
        usd_amount=result["usd_amount"],
        customer_rate=result["customer_rate"],
        supplier_rate=result["supplier_rate"],
        # Müşteri
        customer_pays=result["customer_pays"],
        customer_pays_currency=result["customer_pays_currency"],
        customer_receives=result["customer_receives"],
        customer_receives_currency=result["customer_receives_currency"],
        # Tedarikçi
        supplier_settlement=result["supplier_settlement"],
        supplier_settlement_currency=result["supplier_settlement_currency"],
        # Kâr
        profit=result["profit"],
        profit_currency=result["profit_currency"],
        profit_usd=result["profit_usd"],
        # Net
        commission_usd=commission_usd,
        net_pnl_usd=result["net_pnl_usd"],
        # Geriye dönük uyumluluk
        gross_profit_quote=result["gross_profit_quote"],
        gross_profit_quote_currency=result["quote_cur"],
        gross_profit_usd=result["gross_profit_usd"],
    ))


@router.patch("/{txn_id}/approve", response_model=TransactionOut)
def approve(txn_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, UserRole.admin, UserRole.super_admin, UserRole.manager, UserRole.branch_manager, UserRole.accounting)
    q = db.query(Transaction).filter(Transaction.id == txn_id)
    q = apply_company_filter(q, Transaction, cu)
    txn = q.first()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    txn.status = TxnStatus.completed
    txn.approved_by = cu.id
    audit_log(db, "APPROVE", user_id=cu.id, entity="Transaction", entity_id=txn_id,
              detail={"txn_number": txn.txn_number})
    db.commit()
    db.refresh(txn)
    return txn


@router.post("/approve-all")
def approve_all(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    """Bekleyen tüm işlemleri tek seferde onayla."""
    _require(cu, UserRole.admin, UserRole.super_admin, UserRole.manager, UserRole.branch_manager, UserRole.accounting)
    q = db.query(Transaction).filter(Transaction.status == TxnStatus.pending)
    q = apply_company_filter(q, Transaction, cu)
    pending = q.all()
    if not pending:
        return {"approved": 0}
    for txn in pending:
        txn.status = TxnStatus.completed
        txn.approved_by = cu.id
        audit_log(db, "APPROVE", user_id=cu.id, entity="Transaction", entity_id=txn.id,
                  detail={"txn_number": txn.txn_number})
    db.commit()
    return {"approved": len(pending)}


@router.delete("/{txn_id}")
def delete_transaction(txn_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, UserRole.admin, UserRole.super_admin)
    q = db.query(Transaction).filter(Transaction.id == txn_id)
    q = apply_company_filter(q, Transaction, cu)
    txn = q.first()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    audit_log(db, "DELETE", user_id=cu.id, entity="Transaction",
              entity_id=txn_id, detail={"txn_number": txn.txn_number})
    db.delete(txn)
    db.commit()
    return {"ok": True}
