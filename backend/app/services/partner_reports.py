"""
Odoo-style partner reports over the GL:
  - partner_ledger: per counterparty statement (Cari Hesap Ekstresi) with running balance.
  - aged_balance: outstanding balances bucketed by age (Yaşlandırma / Aged Receivable-Payable).

Positive balance = receivable (they owe us); negative = payable (we owe them).
All amounts in USD, over posted journal entries only.
"""
from decimal import Decimal
from datetime import date
from sqlalchemy.orm import Session

from app.models.master import Counterparty
from app.models.accounting import ChartOfAccount, JournalEntry, JournalLine, JournalStatus

ZERO = Decimal("0")


def _q(v) -> Decimal:
    return Decimal(str(v or 0))


def partner_ledger(db: Session, company_id, counterparty_id, start: date, end: date) -> dict:
    base = (db.query(JournalLine, JournalEntry, ChartOfAccount)
              .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
              .join(ChartOfAccount, JournalLine.coa_account_id == ChartOfAccount.id)
              .filter(JournalEntry.company_id == company_id,
                      JournalEntry.status == JournalStatus.posted,
                      JournalLine.counterparty_id == counterparty_id))

    opening = ZERO
    if start:
        for line, _e, _a in base.filter(JournalEntry.entry_date < start).all():
            opening += _q(line.debit_usd) - _q(line.credit_usd)

    q = base
    if start:
        q = q.filter(JournalEntry.entry_date >= start)
    if end:
        q = q.filter(JournalEntry.entry_date <= end)
    q = q.order_by(JournalEntry.entry_date, JournalEntry.created_at)

    running = opening
    lines = []
    for line, entry, acc in q.all():
        dr, cr = _q(line.debit_usd), _q(line.credit_usd)
        running += dr - cr
        lines.append({
            "entry_number": entry.entry_number, "entry_date": str(entry.entry_date),
            "account_code": acc.code, "memo": entry.memo,
            "debit_usd": dr, "credit_usd": cr, "running_usd": running,
        })
    return {"opening_usd": opening, "lines": lines, "closing_usd": running}


_BUCKETS = ("current", "d31_60", "d61_90", "d90_plus")


def _bucket(age_days: int) -> str:
    if age_days <= 30:
        return "current"
    if age_days <= 60:
        return "d31_60"
    if age_days <= 90:
        return "d61_90"
    return "d90_plus"


def aged_balance(db: Session, company_id, as_of: date) -> dict:
    rows = (db.query(JournalLine, JournalEntry)
              .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
              .filter(JournalEntry.company_id == company_id,
                      JournalEntry.status == JournalStatus.posted,
                      JournalLine.counterparty_id.isnot(None),
                      JournalEntry.entry_date <= as_of)
              .all())

    names = {str(c.id): c.name for c in db.query(Counterparty).filter(Counterparty.company_id == company_id).all()}
    by_cp = {}
    for line, entry in rows:
        cid = str(line.counterparty_id)
        net = _q(line.debit_usd) - _q(line.credit_usd)
        if net == ZERO:
            continue
        agg = by_cp.setdefault(cid, {b: ZERO for b in _BUCKETS} | {"total": ZERO})
        b = _bucket((as_of - entry.entry_date).days)
        agg[b] += net
        agg["total"] += net

    result, totals = [], {b: ZERO for b in _BUCKETS} | {"total": ZERO}
    for cid, agg in by_cp.items():
        if agg["total"] == ZERO:
            continue
        result.append({"counterparty_id": cid, "name": names.get(cid, cid), **agg})
        for k in totals:
            totals[k] += agg[k]
    result.sort(key=lambda r: r["name"] or "")
    return {"rows": result, **totals}
