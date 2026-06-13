"""
Fiscal-period close / reopen with year-end profit roll-up.

Closing posts a balanced closing entry that zeroes revenue/expense into
retained earnings, then records a closed FiscalPeriod (the posting engine's
period_is_closed guard then blocks further postings in that range).
"""
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.accounting import (
    ChartOfAccount, AccountType, AccountRole,
    FiscalPeriod, FiscalPeriodStatus, JournalSourceType,
)
from app.services.posting import _persist_entry, resolve_role, _usd_currency_id
from app.services.statements import _agg

ZERO = Decimal("0")


class PeriodError(Exception):
    pass


def list_periods(db: Session, company_id):
    return (db.query(FiscalPeriod)
              .filter(FiscalPeriod.company_id == company_id)
              .order_by(FiscalPeriod.period_start.desc())
              .all())


def _overlaps_closed(db: Session, company_id, start: date, end: date) -> bool:
    return (db.query(FiscalPeriod)
              .filter(FiscalPeriod.company_id == company_id,
                      FiscalPeriod.status == FiscalPeriodStatus.closed,
                      FiscalPeriod.period_start <= end,
                      FiscalPeriod.period_end >= start)
              .first()) is not None


def close_period(db: Session, company_id, start: date, end: date, user_id=None) -> FiscalPeriod:
    if start > end:
        raise PeriodError("Start date must be on or before end date")
    if _overlaps_closed(db, company_id, start, end):
        raise PeriodError("Overlaps an already-closed period")

    agg = _agg(db, company_id, start=start, end=end)
    accs = {str(a.id): a for a in db.query(ChartOfAccount)
            .filter(ChartOfAccount.company_id == company_id).all()}
    usd_id = _usd_currency_id(db)

    lines = []
    total_rev = total_exp = ZERO
    for aid, (dr, cr) in agg.items():
        a = accs.get(aid)
        if not a:
            continue
        if a.account_type == AccountType.revenue:
            bal = cr - dr  # normal credit balance
            if bal != ZERO:
                lines.append(_line(aid, debit=bal if bal > 0 else ZERO, credit=-bal if bal < 0 else ZERO, usd_id=usd_id))
                total_rev += bal
        elif a.account_type == AccountType.expense:
            bal = dr - cr  # normal debit balance
            if bal != ZERO:
                lines.append(_line(aid, debit=-bal if bal < 0 else ZERO, credit=bal if bal > 0 else ZERO, usd_id=usd_id))
                total_exp += bal

    net = total_rev - total_exp
    if net != ZERO:
        re = resolve_role(db, company_id, AccountRole.retained_earnings)
        if net > ZERO:
            lines.append(_line(str(re.id), debit=ZERO, credit=net, usd_id=usd_id))
        else:
            lines.append(_line(str(re.id), debit=-net, credit=ZERO, usd_id=usd_id))

    if lines:
        _persist_entry(db, company_id, end, None, JournalSourceType.manual, None,
                       f"CLOSING {start}..{end}", user_id, lines)

    period = FiscalPeriod(company_id=company_id, period_start=start, period_end=end,
                          status=FiscalPeriodStatus.closed, closed_by=user_id, closed_at=datetime.utcnow())
    db.add(period)
    db.flush()
    return period


def _line(coa_account_id, debit, credit, usd_id):
    return dict(coa_account_id=coa_account_id, debit=debit, credit=credit,
                currency_id=usd_id, rate_usd=Decimal("1"),
                debit_usd=debit, credit_usd=credit)


def reopen_period(db: Session, company_id, period_id) -> FiscalPeriod:
    p = (db.query(FiscalPeriod)
           .filter(FiscalPeriod.id == period_id, FiscalPeriod.company_id == company_id)
           .first())
    if not p:
        raise PeriodError("Period not found")
    p.status = FiscalPeriodStatus.open
    p.closed_by = None
    p.closed_at = None
    db.flush()
    return p
