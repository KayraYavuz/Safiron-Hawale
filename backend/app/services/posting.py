"""
Double-entry posting engine.

Speaks in logical roles (AccountMapping). Auto-posts completed transactions
into balanced journal entries. Every entry satisfies Σdebit_usd == Σcredit_usd.
Idempotent per (source_type, source_id). Reversal-on-void (never deletes).
"""
from decimal import Decimal
from datetime import date
from sqlalchemy.orm import Session

from app.models.master import Account, Currency, Company
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, TxnType, LegType
from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountRole,
    JournalEntry, JournalLine, JournalSequence, FiscalPeriod,
    JournalSourceType, JournalStatus, FiscalPeriodStatus,
)

ZERO = Decimal("0")
_TILL_ROLE = {"cash": AccountRole.cash, "bank": AccountRole.bank, "crypto": AccountRole.crypto, "itimad": AccountRole.itimad}


class PostingError(Exception):
    pass


def _q(v) -> Decimal:
    return Decimal(str(v or 0))


def _rate(amount, amount_usd) -> Decimal:
    """Real rate_per_usd for a line, derived from the amounts (the source leg's
    rate_usd is unreliable). USD value = amount / rate_per_usd, so rate = amount/usd."""
    a, u = _q(amount), _q(amount_usd)
    return (a / u) if u else Decimal("1")


def resolve_role(db: Session, company_id, role: AccountRole) -> ChartOfAccount:
    m = (db.query(AccountMapping)
           .filter(AccountMapping.company_id == company_id, AccountMapping.role == role)
           .first())
    if not m:
        raise PostingError(f"No account mapped for role {role.value}")
    acc = db.query(ChartOfAccount).filter(ChartOfAccount.id == m.coa_account_id).first()
    if not acc:
        raise PostingError(f"Mapped account missing for role {role.value}")
    return acc


def _usd_currency_id(db: Session):
    c = db.query(Currency).filter(Currency.code == "USD").first()
    return c.id if c else None


def get_or_create_gl_for_till(db: Session, account: Account):
    """Return the till's GL account id, lazily creating a postable leaf under
    the mapped cash/bank/crypto parent the first time."""
    if account.gl_account_id:
        return account.gl_account_id
    role = _TILL_ROLE.get(account.account_type.value, AccountRole.cash)
    parent = resolve_role(db, account.company_id, role)
    n = db.query(ChartOfAccount).filter(
        ChartOfAccount.company_id == account.company_id,
        ChartOfAccount.parent_id == parent.id,
    ).count()
    code = f"{parent.code}.{n + 1:02d}"
    ccy = db.query(Currency).filter(Currency.id == account.currency_id).first()
    label = f"{account.name} ({ccy.code})" if ccy else account.name
    leaf = ChartOfAccount(
        company_id=account.company_id, code=code,
        name_tr=label, name_ar=label, name_en=label,
        account_type=parent.account_type, thp_class=parent.thp_class,
        parent_id=parent.id, is_postable=True, currency_id=account.currency_id,
        scheme=parent.scheme,
    )
    db.add(leaf)
    db.flush()
    account.gl_account_id = leaf.id
    db.flush()
    return leaf.id


def period_is_closed(db: Session, company_id, on: date) -> bool:
    p = (db.query(FiscalPeriod)
           .filter(FiscalPeriod.company_id == company_id,
                   FiscalPeriod.status == FiscalPeriodStatus.closed,
                   FiscalPeriod.period_start <= on,
                   FiscalPeriod.period_end >= on)
           .first())
    return p is not None


def next_entry_number(db: Session, company_id, year: int) -> str:
    base = db.query(JournalSequence).filter(
        JournalSequence.company_id == company_id, JournalSequence.year == year)
    try:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            base = base.with_for_update(of=JournalSequence)
    except Exception:
        pass
    seq = base.first()
    if not seq:
        seq = JournalSequence(company_id=company_id, year=year, last_value=0)
        db.add(seq)
        db.flush()
    seq.last_value += 1
    db.flush()
    return f"JE-{year}-{seq.last_value:06d}"


def existing_entry_for_source(db: Session, source_id):
    return (db.query(JournalEntry)
              .filter(JournalEntry.source_id == source_id,
                      JournalEntry.source_type == JournalSourceType.transaction,
                      JournalEntry.status == JournalStatus.posted)
              .first())


def post_transaction(db: Session, txn: Transaction, source_type=JournalSourceType.transaction):
    """Build + persist one balanced journal entry for a completed transaction.
    Idempotent: returns the existing posted entry if one already exists."""
    existing = existing_entry_for_source(db, txn.id)
    if existing:
        return existing
    if period_is_closed(db, txn.company_id, txn.txn_date):
        raise PostingError("Cannot post into a closed fiscal period")

    legs = db.query(TransactionLeg).filter(TransactionLeg.transaction_id == txn.id).all()
    pnl = db.query(TransactionPnL).filter(TransactionPnL.transaction_id == txn.id).first()
    usd_id = _usd_currency_id(db)

    lines = []

    # 1) till lines
    for leg in legs:
        acc = db.query(Account).filter(Account.id == leg.account_id).first()
        gl_id = get_or_create_gl_for_till(db, acc)
        amt_usd = _q(leg.amount_usd)
        rate = _rate(leg.amount, leg.amount_usd)
        if leg.leg_type == LegType.incoming:
            lines.append(dict(coa_account_id=gl_id, debit=_q(leg.amount), credit=ZERO,
                              currency_id=leg.currency_id, rate_usd=rate,
                              debit_usd=amt_usd, credit_usd=ZERO, account_id=acc.id))
        else:
            lines.append(dict(coa_account_id=gl_id, debit=ZERO, credit=_q(leg.amount),
                              currency_id=leg.currency_id, rate_usd=rate,
                              debit_usd=ZERO, credit_usd=amt_usd, account_id=acc.id))

    simple = txn.txn_type in (TxnType.deposit, TxnType.withdrawal, TxnType.internal_transfer)

    # 2) revenue recognition
    if not simple and pnl:
        comm = _q(pnl.commission_usd)
        fx = _q(pnl.net_pnl_usd) - comm
        if comm != ZERO:
            acc = resolve_role(db, txn.company_id, AccountRole.commission_income)
            if comm > ZERO:
                # Opt-in commission tax (KDV/BSMV): split the commission credit
                # between commission income and a tax-payable liability. Total
                # credit is unchanged, so the entry still balances.
                tax = _commission_tax(db, txn.company_id, comm)
                if tax > ZERO:
                    lines.append(_usd_line(acc.id, ZERO, comm - tax, usd_id))
                    tax_acc = resolve_role(db, txn.company_id, AccountRole.tax_payable)
                    lines.append(_usd_line(tax_acc.id, ZERO, tax, usd_id))
                else:
                    lines.append(_usd_line(acc.id, ZERO, comm, usd_id))
            else:
                lines.append(_usd_line(acc.id, -comm, ZERO, usd_id))
        if fx > ZERO:
            acc = resolve_role(db, txn.company_id, AccountRole.fx_profit)
            lines.append(_usd_line(acc.id, ZERO, fx, usd_id))
        elif fx < ZERO:
            acc = resolve_role(db, txn.company_id, AccountRole.fx_loss)
            lines.append(_usd_line(acc.id, -fx, ZERO, usd_id))

    # 3) counterparty plug to balance exactly
    dr = sum(l["debit_usd"] for l in lines)
    cr = sum(l["credit_usd"] for l in lines)
    imbalance = dr - cr
    if imbalance != ZERO:
        if txn.txn_type in (TxnType.deposit, TxnType.withdrawal):
            role = AccountRole.customer_payable
        elif (txn.counterparty_role or "").lower() == "supplier":
            role = AccountRole.supplier_payable if imbalance > ZERO else AccountRole.supplier_receivable
        else:
            role = AccountRole.customer_payable if imbalance > ZERO else AccountRole.customer_receivable
        acc = resolve_role(db, txn.company_id, role)
        line = (_usd_line(acc.id, ZERO, imbalance, usd_id) if imbalance > ZERO
                else _usd_line(acc.id, -imbalance, ZERO, usd_id))
        line["counterparty_id"] = txn.counterparty_id
        lines.append(line)

    return _persist_entry(db, txn.company_id, txn.txn_date, txn.value_date, source_type,
                          txn.id, f"{txn.txn_type.value} {txn.txn_number}", txn.created_by, lines,
                          journal_code=journal_for_transaction(db, txn))


def _commission_tax(db: Session, company_id, commission_usd: Decimal) -> Decimal:
    """Commission tax = commission × company.commission_tax_rate, but only when a
    rate is set AND a tax_payable account is mapped. Otherwise 0 (no split)."""
    co = db.query(Company).filter(Company.id == company_id).first()
    rate = _q(getattr(co, "commission_tax_rate", 0)) if co else ZERO
    if rate <= ZERO:
        return ZERO
    mapped = (db.query(AccountMapping)
                .filter(AccountMapping.company_id == company_id,
                        AccountMapping.role == AccountRole.tax_payable)
                .first())
    if not mapped:
        return ZERO
    return (commission_usd * rate).quantize(Decimal("0.0001"))


def _usd_line(coa_account_id, debit_usd, credit_usd, usd_id):
    return dict(coa_account_id=coa_account_id, debit=debit_usd, credit=credit_usd,
                currency_id=usd_id, rate_usd=Decimal("1"),
                debit_usd=debit_usd, credit_usd=credit_usd)


def journal_for_transaction(db: Session, txn) -> str:
    """Odoo-style journal classification for a transaction's entry."""
    tt = txn.txn_type.value if hasattr(txn.txn_type, "value") else str(txn.txn_type)
    if tt in ("remittance", "fx", "swift"):
        return "SAL"   # operations / sales journal
    if tt in ("deposit", "withdrawal"):
        leg = db.query(TransactionLeg).filter(TransactionLeg.transaction_id == txn.id).first()
        if leg:
            acc = db.query(Account).filter(Account.id == leg.account_id).first()
            if acc and acc.account_type.value == "bank":
                return "BNK"
        return "CASH"
    return "MISC"


def _persist_entry(db, company_id, entry_date, value_date, source_type, source_id,
                   memo, created_by, line_dicts, journal_code="MISC"):
    dr = sum(_q(l["debit_usd"]) for l in line_dicts)
    cr = sum(_q(l["credit_usd"]) for l in line_dicts)
    if dr != cr:
        raise PostingError(f"Entry does not balance: dr={dr} cr={cr}")
    year = entry_date.year if entry_date else date.today().year
    entry = JournalEntry(
        company_id=company_id,
        entry_number=next_entry_number(db, company_id, year),
        journal_code=journal_code,
        entry_date=entry_date or date.today(),
        value_date=value_date,
        source_type=source_type, source_id=source_id, memo=memo,
        status=JournalStatus.posted, created_by=created_by,
    )
    db.add(entry)
    db.flush()
    for d in line_dicts:
        db.add(JournalLine(entry_id=entry.id, **d))
    db.flush()
    return entry


def void_for_source(db: Session, source_id, created_by=None):
    """Reverse the posted entry for a source: create a mirror entry (debits<->credits),
    mark the original void. No-op if no posted entry exists."""
    entry = existing_entry_for_source(db, source_id)
    if not entry:
        return None
    if period_is_closed(db, entry.company_id, entry.entry_date):
        raise PostingError("Cannot void into a closed fiscal period")
    orig_lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    mirror = [dict(coa_account_id=l.coa_account_id, debit=_q(l.credit), credit=_q(l.debit),
                   currency_id=l.currency_id, rate_usd=_q(l.rate_usd),
                   debit_usd=_q(l.credit_usd), credit_usd=_q(l.debit_usd),
                   counterparty_id=l.counterparty_id, account_id=l.account_id)
              for l in orig_lines]
    rev = _persist_entry(db, entry.company_id, date.today(), None, entry.source_type,
                         source_id, f"REVERSAL {entry.entry_number}", created_by, mirror,
                         journal_code=entry.journal_code or "MISC")
    entry.status = JournalStatus.void
    entry.reversed_by_id = rev.id
    db.flush()
    return rev
