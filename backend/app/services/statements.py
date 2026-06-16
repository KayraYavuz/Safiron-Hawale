"""
GL-backed financial statements (pure aggregation over posted journal lines).

Mizan (trial balance), Bilanço (balance sheet), Gelir Tablosu (income statement),
Defter-i Kebir (general ledger). All amounts in USD.
"""
from decimal import Decimal
from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalStatus, AccountType,
)
from app.models.master import Company
from app.services import scheme_crosswalk

ZERO = Decimal("0")
_DEBIT_NORMAL = (AccountType.asset, AccountType.expense)


def _q(v) -> Decimal:
    return Decimal(str(v or 0))


def _agg(db: Session, company_id, *, start: date = None, end: date = None):
    """Return {account_id: (debit_usd, credit_usd)} over posted entries in range."""
    q = (db.query(
            JournalLine.coa_account_id.label("aid"),
            func.sum(JournalLine.debit_usd).label("dr"),
            func.sum(JournalLine.credit_usd).label("cr"),
         )
         .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
         .filter(JournalEntry.company_id == company_id,
                 JournalEntry.status == JournalStatus.posted))
    if start:
        q = q.filter(JournalEntry.entry_date >= start)
    if end:
        q = q.filter(JournalEntry.entry_date <= end)
    q = q.group_by(JournalLine.coa_account_id)
    return {str(r.aid): (_q(r.dr), _q(r.cr)) for r in q.all()}


def _accounts(db: Session, company_id):
    return {str(a.id): a for a in db.query(ChartOfAccount)
            .filter(ChartOfAccount.company_id == company_id).all()}


def _source(db: Session, company_id, target_scheme=None, *, start: date = None, end: date = None):
    """Return (agg, accs) for a company. When target_scheme differs from the company's
    own scheme, the aggregation is crosswalked onto the target chart via the role pivot
    (see scheme_crosswalk); otherwise the company's native accounts are used."""
    agg = _agg(db, company_id, start=start, end=end)
    accs = _accounts(db, company_id)
    if target_scheme:
        own = db.query(Company.accounting_scheme).filter(Company.id == company_id).scalar()
        if target_scheme != own:
            rev = scheme_crosswalk.reverse_roles(db, company_id)
            idx = scheme_crosswalk.scheme_index(target_scheme)
            agg, accs = scheme_crosswalk.remap(agg, rev, idx)
    return agg, accs


def trial_balance(db: Session, company_id, as_of: date = None, target_scheme=None) -> dict:
    agg, accs = _source(db, company_id, target_scheme, end=as_of)
    rows = []
    total_dr = total_cr = ZERO
    for aid, (dr, cr) in agg.items():
        a = accs.get(aid)
        if not a:
            continue
        rows.append({
            "account_id": aid, "code": a.code,
            "name_tr": a.name_tr, "name_en": a.name_en, "name_ar": a.name_ar,
            "account_type": a.account_type.value,
            "debit_usd": dr, "credit_usd": cr,
            "balance_usd": (dr - cr) if a.account_type in _DEBIT_NORMAL else (cr - dr),
        })
        total_dr += dr
        total_cr += cr
    rows.sort(key=lambda r: r["code"])
    return {"rows": rows, "total_debit": total_dr, "total_credit": total_cr}


def income_statement(db: Session, company_id, start: date, end: date, target_scheme=None) -> dict:
    agg, accs = _source(db, company_id, target_scheme, start=start, end=end)
    revenue, expense = [], []
    total_rev = total_exp = ZERO
    for aid, (dr, cr) in agg.items():
        a = accs.get(aid)
        if not a:
            continue
        if a.account_type == AccountType.revenue:
            amt = cr - dr
            revenue.append({"account_id": aid, "code": a.code, "name_tr": a.name_tr,
                            "name_en": a.name_en, "name_ar": a.name_ar, "amount_usd": amt})
            total_rev += amt
        elif a.account_type == AccountType.expense:
            amt = dr - cr
            expense.append({"account_id": aid, "code": a.code, "name_tr": a.name_tr,
                            "name_en": a.name_en, "name_ar": a.name_ar, "amount_usd": amt})
            total_exp += amt
    revenue.sort(key=lambda r: r["code"])
    expense.sort(key=lambda r: r["code"])
    return {"revenue": revenue, "expense": expense,
            "total_revenue": total_rev, "total_expense": total_exp,
            "net": total_rev - total_exp}


def balance_sheet(db: Session, company_id, as_of: date = None, target_scheme=None) -> dict:
    agg, accs = _source(db, company_id, target_scheme, end=as_of)
    groups = {"asset": [], "liability": [], "equity": []}
    totals = {"asset": ZERO, "liability": ZERO, "equity": ZERO}
    net_income = ZERO
    for aid, (dr, cr) in agg.items():
        a = accs.get(aid)
        if not a:
            continue
        ty = a.account_type
        if ty == AccountType.asset:
            bal = dr - cr
            groups["asset"].append(_bs_row(aid, a, bal)); totals["asset"] += bal
        elif ty == AccountType.liability:
            bal = cr - dr
            groups["liability"].append(_bs_row(aid, a, bal)); totals["liability"] += bal
        elif ty == AccountType.equity:
            bal = cr - dr
            groups["equity"].append(_bs_row(aid, a, bal)); totals["equity"] += bal
        elif ty == AccountType.revenue:
            net_income += (cr - dr)
        elif ty == AccountType.expense:
            net_income -= (dr - cr)
    for g in groups.values():
        g.sort(key=lambda r: r["code"])
    return {
        "assets": groups["asset"], "liabilities": groups["liability"], "equity": groups["equity"],
        "total_assets": totals["asset"], "total_liabilities": totals["liability"],
        "total_equity": totals["equity"], "net_income": net_income,
    }


def _bs_row(aid, a, bal):
    return {"account_id": aid, "code": a.code, "name_tr": a.name_tr,
            "name_en": a.name_en, "name_ar": a.name_ar, "balance_usd": bal}


def general_ledger(db: Session, company_id, account_id, start: date, end: date) -> dict:
    q = (db.query(JournalLine, JournalEntry)
           .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
           .filter(JournalEntry.company_id == company_id,
                   JournalEntry.status == JournalStatus.posted,
                   JournalLine.coa_account_id == account_id))
    if start:
        q = q.filter(JournalEntry.entry_date >= start)
    if end:
        q = q.filter(JournalEntry.entry_date <= end)
    q = q.order_by(JournalEntry.entry_date, JournalEntry.created_at)
    lines, running = [], ZERO
    for line, entry in q.all():
        dr, cr = _q(line.debit_usd), _q(line.credit_usd)
        running += dr - cr
        lines.append({
            "entry_number": entry.entry_number, "entry_date": str(entry.entry_date),
            "memo": entry.memo, "debit_usd": dr, "credit_usd": cr, "running_usd": running,
        })
    return {"account_id": str(account_id), "lines": lines, "closing_usd": running}
