"""
Tedarikçi Uzlaşma API

TEMEL KURAL:
  Müşteri işlemi ve tedarikçi uzlaşması TAMAMEN AYRIDIR.
  Bu endpoint müşteri kurunu asla kabul etmez, kullanmaz, dönmez.

UZLAŞMA MANTIĞI:
  Yön: source_currency → dest_currency (işlemden alınır)
  
  Case A — dest=USD (müşteri USD alıyor, örn: SAR→USD):
    Tedarikçi source lokasyondan receivable: settlement_usd × supplier_rate [sourceCur]
    Tedarikçi dest lokasyona payable: settlement_usd [USD]

  Case B — source=USD (müşteri SAR alıyor, örn: USD→SAR):
    Tedarikçi source lokasyondan receivable: settlement_usd [USD]
    Tedarikçi dest lokasyona payable: settlement_usd × supplier_rate [destCur]
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from decimal import Decimal
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.transaction import Transaction, TransactionLeg, SupplierSettlement, SupplierSettlementType, LegType
from app.models.master import Account, Counterparty, Location
from app.schemas.schemas import SupplierSettlementCreate, SupplierSettlementOut

router = APIRouter(prefix="/api/transactions", tags=["supplier-settlement"])


def _require(user: User, *roles: UserRole):
    if user.role not in roles:
        raise HTTPException(403, "Yetkisiz işlem")


def _calculate_settlement(
    source_currency: str,
    dest_currency: str,
    settlement_usd: Decimal,
    supplier_rate: Decimal,
) -> dict:
    """
    Tedarikçi uzlaşma tutarlarını hesapla.
    Müşteri kuru ASLA bu fonksiyona girmez.

    Returns:
      receivable_amount:  tedarikçi bize borçlu olan miktar
      receivable_currency
      payable_amount:     biz tedarikçiye borçlu olan miktar
      payable_currency
    """
    zero = Decimal("0")

    if not supplier_rate or supplier_rate <= 0:
        return {
            "receivable_amount": zero,
            "receivable_currency": source_currency,
            "payable_amount": zero,
            "payable_currency": dest_currency,
        }

    if dest_currency == "USD":
        # Case A: SAR → USD
        # Tedarikçi source (SAR) tarafında receivable: usd × rate [SAR]
        # Tedarikçi dest (USD) tarafında payable: usd [USD]
        return {
            "receivable_amount":   (settlement_usd * supplier_rate).quantize(Decimal("0.0001")),
            "receivable_currency": source_currency,
            "payable_amount":      settlement_usd.quantize(Decimal("0.0001")),
            "payable_currency":    dest_currency,
        }

    if source_currency == "USD":
        # Case B: USD → SAR
        # Tedarikçi source (USD) tarafında receivable: usd [USD]
        # Tedarikçi dest (SAR) tarafında payable: usd × rate [SAR]
        return {
            "receivable_amount":   settlement_usd.quantize(Decimal("0.0001")),
            "receivable_currency": source_currency,
            "payable_amount":      (settlement_usd * supplier_rate).quantize(Decimal("0.0001")),
            "payable_currency":    dest_currency,
        }

    # Cross-currency: her ikisi de non-USD
    # source taraf: usd × supplier_rate_source [sourceCur] — ancak burada tek rate var
    # Pratik: source receivable = usd × rate, dest payable = usd × rate
    return {
        "receivable_amount":   (settlement_usd * supplier_rate).quantize(Decimal("0.0001")),
        "receivable_currency": source_currency,
        "payable_amount":      (settlement_usd * supplier_rate).quantize(Decimal("0.0001")),
        "payable_currency":    dest_currency,
    }


@router.get("/{txn_id}/supplier-settlement", response_model=SupplierSettlementOut)
def get_supplier_settlement(
    txn_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    ss = (db.query(SupplierSettlement)
          .options(
              joinedload(SupplierSettlement.counterparty),
              joinedload(SupplierSettlement.receivable_location),
              joinedload(SupplierSettlement.payable_location),
          )
          .filter(SupplierSettlement.transaction_id == txn_id)
          .first())
    if not ss:
        raise HTTPException(404, "Tedarikçi uzlaşması bulunamadı")
    return ss


@router.post("/{txn_id}/supplier-settlement", response_model=SupplierSettlementOut)
def create_supplier_settlement(
    txn_id: UUID,
    data: SupplierSettlementCreate,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    _require(cu, UserRole.admin, UserRole.accounting)

    # İşlemi al
    txn = (db.query(Transaction)
           .options(
               joinedload(Transaction.legs).joinedload(TransactionLeg.account).joinedload(Account.location),
               joinedload(Transaction.legs).joinedload(TransactionLeg.account).joinedload(Account.currency),
               joinedload(Transaction.legs).joinedload(TransactionLeg.currency),
               joinedload(Transaction.pnl),
           )
           .filter(Transaction.id == txn_id).first())
    if not txn:
        raise HTTPException(404, "İşlem bulunamadı")

    # Zaten uzlaşma varsa güncelle (upsert mantığı)
    existing = db.query(SupplierSettlement).filter(SupplierSettlement.transaction_id == txn_id).first()
    if existing:
        db.delete(existing)
        db.flush()

    # Yön bilgisini işlemden al — müşteri verisi değil, sadece yön
    out_legs = [l for l in txn.legs if l.leg_type == LegType.outgoing]
    in_legs  = [l for l in txn.legs if l.leg_type == LegType.incoming]

    source_currency = txn.pnl.source_currency if txn.pnl else (out_legs[0].currency.code if out_legs else None)
    dest_currency   = txn.pnl.dest_currency   if txn.pnl else (in_legs[0].currency.code  if in_legs  else None)
    settlement_usd  = data.settlement_amount_usd or (txn.pnl.usd_amount if txn.pnl else Decimal("0"))

    # Lokasyonları işlemden al
    source_location_id = out_legs[0].account.location_id if out_legs else None
    dest_location_id   = in_legs[0].account.location_id  if in_legs  else None

    # Validasyon
    if data.settlement_type == SupplierSettlementType.registered:
        if not data.counterparty_id:
            raise HTTPException(400, "Kayıtlı tedarikçi için counterparty_id zorunlu")
        cp = db.query(Counterparty).filter(Counterparty.id == data.counterparty_id).first()
        if not cp:
            raise HTTPException(404, "Tedarikçi bulunamadı")

    if data.settlement_type == SupplierSettlementType.external:
        if not data.external_name:
            raise HTTPException(400, "Harici tedarikçi için isim zorunlu")

    # Tedarikçi ile uzlaşmada hesap yap
    amounts = {"receivable_amount": None, "receivable_currency": None,
               "payable_amount": None, "payable_currency": None}

    if data.settlement_type != SupplierSettlementType.internal and data.supplier_rate and settlement_usd:
        amounts = _calculate_settlement(
            source_currency=source_currency or "USD",
            dest_currency=dest_currency or "USD",
            settlement_usd=settlement_usd,
            supplier_rate=data.supplier_rate,
        )

    ss = SupplierSettlement(
        transaction_id=txn_id,
        settlement_type=data.settlement_type,
        counterparty_id=data.counterparty_id if data.settlement_type == SupplierSettlementType.registered else None,
        external_name=data.external_name if data.settlement_type == SupplierSettlementType.external else None,
        source_currency=source_currency,
        dest_currency=dest_currency,
        supplier_rate=data.supplier_rate,
        settlement_amount_usd=settlement_usd,
        receivable_amount=amounts["receivable_amount"],
        receivable_currency=amounts["receivable_currency"],
        payable_amount=amounts["payable_amount"],
        payable_currency=amounts["payable_currency"],
        receivable_location_id=source_location_id,
        payable_location_id=dest_location_id,
        notes=data.notes,
        created_by=cu.id,
    )
    db.add(ss)
    db.commit()

    # Tek seferlik, joinedload ile ilişkileri yükle — manuel ORM override yok
    ss = (db.query(SupplierSettlement)
          .options(
              joinedload(SupplierSettlement.counterparty),
              joinedload(SupplierSettlement.receivable_location),
              joinedload(SupplierSettlement.payable_location),
          )
          .filter(SupplierSettlement.transaction_id == txn_id)
          .first())

    return ss


@router.delete("/{txn_id}/supplier-settlement")
def delete_supplier_settlement(
    txn_id: UUID,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    _require(cu, UserRole.admin)
    ss = db.query(SupplierSettlement).filter(SupplierSettlement.transaction_id == txn_id).first()
    if not ss:
        raise HTTPException(404, "Tedarikçi uzlaşması bulunamadı")
    db.delete(ss)
    db.commit()
    return {"ok": True}
