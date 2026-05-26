"""
Günlük Mutabakat API

Bir günün tüm işlemlerini, kasa hareketlerini ve kâr özetini verir.
"Günü kapat" işlemi mutabakat kaydı oluşturur — o günden sonra işlem düzenlenemez.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case as sa_case
from datetime import date
from decimal import Decimal
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, LegType, TxnType, TxnStatus
from app.models.master import Account, Location
from app.services.audit import log as audit_log

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])

ZERO = Decimal("0")
def _s(v): return v if v is not None else ZERO

FX_TYPES = {TxnType.remittance, TxnType.fx, TxnType.swift}

@router.get("/daily")
def daily_reconciliation(
    report_date: Optional[date] = None,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    """Belirli bir günün mutabakat raporu."""
    if not report_date:
        from datetime import date as dt
        report_date = dt.today()

    # O günün işlemleri
    txn_q = (db.query(Transaction)
             .options(
                 joinedload(Transaction.legs).joinedload(TransactionLeg.account)
                     .joinedload(Account.location),
                 joinedload(Transaction.legs).joinedload(TransactionLeg.currency),
                 joinedload(Transaction.pnl),
                 joinedload(Transaction.counterparty),
             )
             .filter(Transaction.txn_date == report_date))
    txn_q = apply_company_filter(txn_q, Transaction, cu)
    txns = txn_q.order_by(Transaction.created_at).all()

    # İşlem listesi
    txn_rows = []
    for txn in txns:
        out_legs = [l for l in txn.legs if l.leg_type == LegType.outgoing]
        in_legs  = [l for l in txn.legs if l.leg_type == LegType.incoming]
        out_l = out_legs[0] if out_legs else None
        in_l  = in_legs[0]  if in_legs  else None

        pnl_usd = _s(txn.pnl.usd_amount) if txn.pnl else ZERO
        profit  = _s(txn.pnl.profit)     if txn.pnl else ZERO

        txn_rows.append({
            "txn_number":  txn.txn_number,
            "txn_type":    txn.txn_type.value,
            "counterparty": txn.counterparty.name if txn.counterparty else "—",
            "from":         f"{out_l.amount} {out_l.currency.code if out_l and out_l.currency else ''}" if out_l else "—",
            "to":           f"{in_l.amount} {in_l.currency.code if in_l and in_l.currency else ''}"    if in_l  else "—",
            "usd_amount":  str(pnl_usd.quantize(Decimal("0.01"))),
            "profit_usd":  str((txn.pnl.profit_usd if txn.pnl and txn.pnl.profit_usd else ZERO).quantize(Decimal("0.01"))),
            "status":      txn.status.value,
        })

    # Kasa özeti — o günün hareketleri
    acc_q = (db.query(Account)
             .options(joinedload(Account.location), joinedload(Account.currency))
             .filter(Account.is_active == True))
    acc_q = apply_company_filter(acc_q, Account, cu)
    accs = acc_q.all()

    # Batch query: sum incoming and outgoing per account in a single GROUP BY query
    acc_ids = [acc.id for acc in accs]
    acc_map = {acc.id: acc for acc in accs}

    cash_summary = []
    if acc_ids:
        sums_q = (db.query(
                      TransactionLeg.account_id,
                      func.sum(
                          sa_case(
                              (TransactionLeg.leg_type == LegType.incoming, TransactionLeg.amount),
                              else_=ZERO
                          )
                      ).label("in_sum"),
                      func.sum(
                          sa_case(
                              (TransactionLeg.leg_type == LegType.outgoing, TransactionLeg.amount),
                              else_=ZERO
                          )
                      ).label("out_sum"),
                  )
                  .join(Transaction)
                  .filter(
                      TransactionLeg.account_id.in_(acc_ids),
                      Transaction.txn_date == report_date,
                  )
                  .group_by(TransactionLeg.account_id)
                  .all())

        for row in sums_q:
            acc = acc_map.get(row.account_id)
            if not acc:
                continue
            in_sum  = row.in_sum  if row.in_sum  is not None else ZERO
            out_sum = row.out_sum if row.out_sum is not None else ZERO
            if in_sum == ZERO and out_sum == ZERO:
                continue  # Hareketsiz kasaları atla
            net = in_sum - out_sum
            cash_summary.append({
                "account":  acc.name,
                "location": acc.location.name_tr if acc.location else "",
                "currency": acc.currency.code if acc.currency else "",
                "in":       str(in_sum.quantize(Decimal("0.01"))),
                "out":      str(out_sum.quantize(Decimal("0.01"))),
                "net":      str(net.quantize(Decimal("0.01"))),
            })

    # Kâr özeti
    pnl_rows = [txn.pnl for txn in txns if txn.pnl and txn.txn_type in FX_TYPES and txn.status == TxnStatus.completed]
    total_volume = sum(_s(p.usd_amount) for p in pnl_rows)
    total_profit = sum(_s(p.profit_usd) for p in pnl_rows)
    total_net    = sum(_s(p.net_pnl_usd) for p in pnl_rows)

    return {
        "date":             str(report_date),
        "transaction_count": len(txns),
        "pending_count":    sum(1 for t in txns if t.status == TxnStatus.pending),
        "completed_count":  sum(1 for t in txns if t.status == TxnStatus.completed),
        "transactions":     txn_rows,
        "cash_summary":     cash_summary,
        "pnl_summary": {
            "total_volume_usd": str(total_volume.quantize(Decimal("0.01"))),
            "total_profit_usd": str(total_profit.quantize(Decimal("0.01"))),
            "net_pnl_usd":      str(total_net.quantize(Decimal("0.01"))),
            "fx_tx_count":      len(pnl_rows),
        },
    }
