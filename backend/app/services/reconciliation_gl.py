"""
Bank/Cash reconciliation over the GL (Odoo-style).

Mark journal lines on a cash/bank account as reconciled (cleared against the
real statement) and report book vs reconciled vs unreconciled balance.
"""
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.accounting import JournalEntry, JournalLine, JournalStatus
from app.core.timeutil import utcnow

ZERO = Decimal("0")


def _q(v) -> Decimal:
    return Decimal(str(v or 0))


def reconcile_view(db: Session, company_id, coa_account_id) -> dict:
    rows = (db.query(JournalLine, JournalEntry)
              .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
              .filter(JournalEntry.company_id == company_id,
                      JournalEntry.status == JournalStatus.posted,
                      JournalLine.coa_account_id == coa_account_id)
              .order_by(JournalEntry.entry_date, JournalEntry.created_at)
              .all())
    book = reconciled = ZERO
    lines = []
    for line, entry in rows:
        net = _q(line.debit_usd) - _q(line.credit_usd)
        book += net
        if line.reconciled:
            reconciled += net
        lines.append({
            "line_id": str(line.id), "entry_number": entry.entry_number,
            "entry_date": str(entry.entry_date), "memo": entry.memo,
            "debit_usd": _q(line.debit_usd), "credit_usd": _q(line.credit_usd),
            "reconciled": bool(line.reconciled),
        })
    return {
        "lines": lines,
        "book_balance": book,
        "reconciled_balance": reconciled,
        "unreconciled_balance": book - reconciled,
    }


def toggle(db: Session, company_id, line_id, value: bool):
    line = (db.query(JournalLine)
              .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
              .filter(JournalLine.id == line_id, JournalEntry.company_id == company_id)
              .first())
    if not line:
        raise ValueError("Line not found")
    line.reconciled = bool(value)
    line.reconciled_at = utcnow() if value else None
    db.flush()
    return line
