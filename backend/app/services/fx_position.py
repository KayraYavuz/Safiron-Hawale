"""
Döviz Pozisyon Raporu — net monetary position per currency over the GL.

For an FX/remittance business the core risk question is: for each currency, what
is our net position (long = we hold, short = we owe), and what unrealized FX gain/
loss sits on it at today's rate? We net `debit-credit` (original currency) over the
monetary book (asset + liability accounts) per currency, compare the booked USD
(at posting rates) to the current USD (at today's rate), and surface the difference.
"""
from decimal import Decimal
from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalStatus, AccountType,
)
from app.models.master import Currency
from app.services.balance import get_all_usd_rates

ZERO = Decimal("0")
_MONETARY = (AccountType.asset, AccountType.liability)


def _q(v) -> Decimal:
    return Decimal(str(v or 0))


def fx_position(db: Session, company_id, as_of: date = None, rates: dict = None) -> dict:
    """Net monetary position per currency, with booked vs current USD and unrealized FX."""
    rates = rates if rates is not None else get_all_usd_rates(db)

    q = (db.query(
            JournalLine.currency_id.label("ccy"),
            func.sum(JournalLine.debit - JournalLine.credit).label("net_orig"),
            func.sum(JournalLine.debit_usd - JournalLine.credit_usd).label("net_usd"),
         )
         .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
         .join(ChartOfAccount, JournalLine.coa_account_id == ChartOfAccount.id)
         .filter(JournalEntry.company_id == company_id,
                 JournalEntry.status == JournalStatus.posted,
                 ChartOfAccount.account_type.in_(_MONETARY)))
    if as_of:
        q = q.filter(JournalEntry.entry_date <= as_of)
    q = q.group_by(JournalLine.currency_id)

    codes = {str(c.id): c.code for c in db.query(Currency).all()}

    rows = []
    total_booked = total_current = total_unrealized = ZERO
    for r in q.all():
        net_orig = _q(r.net_orig)
        if net_orig == ZERO:
            continue                                   # flat position — skip noise
        code = codes.get(str(r.ccy), "?")
        booked = _q(r.net_usd)
        rate = rates.get(code)
        has_rate = rate is not None and rate != ZERO
        current = (net_orig / rate) if has_rate else None
        unrealized = (current - booked) if current is not None else None
        rows.append({
            "currency": code,
            "net_position": net_orig,
            "booked_usd": booked,
            "current_usd": current,
            "unrealized_fx": unrealized,
            "rate_per_usd": rate if has_rate else None,
            "side": "long" if net_orig > ZERO else "short",
            "has_rate": has_rate,
        })
        total_booked += booked
        if current is not None:
            total_current += current
            total_unrealized += unrealized

    rows.sort(key=lambda x: abs(x["current_usd"] if x["current_usd"] is not None else x["booked_usd"]),
              reverse=True)
    return {
        "rows": rows,
        "total_booked_usd": total_booked,
        "total_current_usd": total_current,
        "total_unrealized_fx": total_unrealized,
    }
