# Chart of Accounts — Phase 2 (Journal + Posting Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add double-entry `journal_entries`/`journal_lines`, a role-based posting engine that auto-posts completed transactions to the ledger (recognizing revenue and balancing exactly via the counterparty), reversal-on-void, a period-lock guard, a read/manual/void Journal API, and a Journal UI.

**Architecture:** A posting engine (`app/services/posting.py`) speaks in logical roles resolved through Phase 1's `AccountMapping`. Each operational till (`Account`) gets a lazily-created GL sub-account (`gl_account_id`). Posting hooks into the existing transaction approve/delete lifecycle. Every entry is balanced on USD amounts (`Σ debit_usd == Σ credit_usd`) and carries original currency per line.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic v2, pytest (in-memory SQLite), React.

---

## Posting model (reference for all tasks)

Given a completed `Transaction` with legs + `TransactionPnL`:
1. **Till lines** — each incoming leg → **debit** the till's GL account by `leg.amount_usd`; each outgoing leg → **credit** by `leg.amount_usd`. Original currency/amount/rate copied from the leg.
2. **Revenue** (skip for deposit/withdrawal/internal_transfer) — split `pnl.net_pnl_usd`:
   - `comm = pnl.commission_usd`; `fx = pnl.net_pnl_usd - comm`.
   - `comm` → credit `commission_income` (debit if negative).
   - `fx` > 0 → credit `fx_profit`; `fx` < 0 → debit `fx_loss` by `|fx|`.
3. **Counterparty plug** — `imbalance = Σdebit_usd − Σcredit_usd` over lines so far. Add one counterparty line that makes the entry balance exactly:
   - `imbalance > 0` → **credit** a *payable* account by `imbalance`.
   - `imbalance < 0` → **debit** a *receivable* account by `|imbalance|`.
   - Role: deposit/withdrawal always use `customer_payable`; otherwise `supplier_*` when `counterparty_role == "supplier"`, else `customer_*`; receivable/payable chosen by side above.
   - Line carries `counterparty_id = txn.counterparty_id`.

This recognizes `net_pnl_usd` as revenue and **always balances to the cent**. Revenue/plug lines are USD-denominated (currency = USD, rate = 1).

---

## File Structure

- Modify: `backend/app/models/accounting.py` — add `JournalSourceType`, `JournalStatus`, `FiscalPeriodStatus` enums; `JournalEntry`, `JournalLine`, `JournalSequence`, `FiscalPeriod` models.
- Modify: `backend/app/models/master.py` — add `gl_account_id` to `Account`.
- Modify: `backend/app/models/__init__.py` — export new models.
- Create: `backend/app/services/posting.py` — the posting engine.
- Modify: `backend/app/api/transactions.py` — hook posting into approve / approve_all / delete.
- Create: `backend/app/api/journal.py` — journal read + manual entry + void.
- Modify: `backend/app/main.py` — register `journal_router`.
- Modify: `backend/app/schemas/schemas.py` — journal schemas.
- Modify: `backend/migrate.py` — create journal tables + `accounts.gl_account_id`.
- Create: `backend/tests/test_posting_engine.py`, `backend/tests/test_journal_api.py`.
- Create: `frontend/src/pages/Journal.jsx`; modify `App.jsx`, `Layout.jsx`, locales.

---

## Task 1: Journal + fiscal-period models

**Files:**
- Modify: `backend/app/models/accounting.py`
- Modify: `backend/app/models/master.py` (add `gl_account_id`)
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_journal_models.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_journal_models.py`:

```python
from app.models.accounting import (
    JournalEntry, JournalLine, JournalSequence, FiscalPeriod,
    JournalSourceType, JournalStatus, FiscalPeriodStatus,
)
from app.models.master import Account


def test_journal_source_types():
    assert {s.value for s in JournalSourceType} == {
        "transaction", "settlement", "manual", "opening", "backfill"
    }


def test_journal_status_values():
    assert {s.value for s in JournalStatus} == {"posted", "void"}


def test_fiscal_period_status_values():
    assert {s.value for s in FiscalPeriodStatus} == {"open", "closed"}


def test_journal_entry_columns():
    cols = JournalEntry.__table__.columns.keys()
    for c in ("id", "company_id", "entry_number", "entry_date", "value_date",
              "source_type", "source_id", "memo", "status", "reversed_by_id",
              "created_by", "created_at"):
        assert c in cols


def test_journal_line_columns():
    cols = JournalLine.__table__.columns.keys()
    for c in ("id", "entry_id", "coa_account_id", "debit", "credit",
              "currency_id", "rate_usd", "debit_usd", "credit_usd",
              "counterparty_id", "account_id"):
        assert c in cols


def test_account_has_gl_link():
    assert "gl_account_id" in Account.__table__.columns.keys()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_journal_models.py -v`
Expected: FAIL — `ImportError: cannot import name 'JournalEntry'`

- [ ] **Step 3: Append models to `accounting.py`**

Add to the imports at the top of `backend/app/models/accounting.py` (extend the existing `sqlalchemy` import line to include `Numeric`, `Date`, `Text`, `Index`):

```python
from sqlalchemy import (
    Column, String, Boolean, Enum, ForeignKey, DateTime, Integer, Numeric,
    Date, Text, UniqueConstraint, Index,
)
```

Append at the end of the file:

```python
class JournalSourceType(str, enum.Enum):
    transaction = "transaction"
    settlement = "settlement"
    manual = "manual"
    opening = "opening"
    backfill = "backfill"


class JournalStatus(str, enum.Enum):
    posted = "posted"
    void = "void"


class FiscalPeriodStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("company_id", "entry_number", name="uq_je_company_number"),
        Index("ix_je_company", "company_id"),
        Index("ix_je_source", "source_type", "source_id"),
        Index("ix_je_date", "entry_date"),
        Index("ix_je_status", "status"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    entry_number = Column(String(24), nullable=False)
    entry_date = Column(Date, nullable=False)
    value_date = Column(Date, nullable=True)
    source_type = Column(Enum(JournalSourceType), nullable=False)
    source_id = Column(GUID(), nullable=True)
    memo = Column(Text, nullable=True)
    status = Column(Enum(JournalStatus), default=JournalStatus.posted, nullable=False)
    reversed_by_id = Column(GUID(), ForeignKey("journal_entries.id"), nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lines = relationship("JournalLine", back_populates="entry", cascade="all, delete-orphan")


class JournalLine(Base):
    __tablename__ = "journal_lines"
    __table_args__ = (
        Index("ix_jl_entry", "entry_id"),
        Index("ix_jl_account", "coa_account_id"),
        Index("ix_jl_account_entry", "coa_account_id", "entry_id"),
        Index("ix_jl_counterparty", "counterparty_id"),
        Index("ix_jl_till", "account_id"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    entry_id = Column(GUID(), ForeignKey("journal_entries.id"), nullable=False)
    coa_account_id = Column(GUID(), ForeignKey("chart_of_accounts.id"), nullable=False)
    debit = Column(Numeric(18, 4), default=0)
    credit = Column(Numeric(18, 4), default=0)
    currency_id = Column(GUID(), ForeignKey("currencies.id"), nullable=True)
    rate_usd = Column(Numeric(18, 8), default=1)
    debit_usd = Column(Numeric(18, 4), default=0)
    credit_usd = Column(Numeric(18, 4), default=0)
    counterparty_id = Column(GUID(), ForeignKey("counterparties.id"), nullable=True)
    account_id = Column(GUID(), ForeignKey("accounts.id"), nullable=True)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccount")


class JournalSequence(Base):
    """Gap-free per-(company, year) journal numbering counter."""
    __tablename__ = "journal_sequences"
    __table_args__ = (
        UniqueConstraint("company_id", "year", name="uq_jseq_company_year"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    year = Column(Integer, nullable=False)
    last_value = Column(Integer, default=0, nullable=False)


class FiscalPeriod(Base):
    __tablename__ = "fiscal_periods"
    __table_args__ = (
        Index("ix_fp_company", "company_id"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    status = Column(Enum(FiscalPeriodStatus), default=FiscalPeriodStatus.open, nullable=False)
    closed_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 4: Add `gl_account_id` to `Account`**

In `backend/app/models/master.py`, inside `class Account`, after the `company_id` line, add:

```python
    gl_account_id = Column(GUID(), ForeignKey("chart_of_accounts.id"), nullable=True)
```

- [ ] **Step 5: Export new models**

In `backend/app/models/__init__.py`, extend the accounting import:

```python
from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountType as CoaAccountType,
    AccountScheme, AccountRole,
    JournalEntry, JournalLine, JournalSequence, FiscalPeriod,
    JournalSourceType, JournalStatus, FiscalPeriodStatus,
)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_journal_models.py -v`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/accounting.py backend/app/models/master.py backend/app/models/__init__.py backend/tests/test_journal_models.py
git commit -m "feat(gl): journal_entries/lines, sequence, fiscal_periods models + Account.gl_account_id"
```

---

## Task 2: Posting engine

**Files:**
- Create: `backend/app/services/posting.py`
- Test: `backend/tests/test_posting_engine.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_posting_engine.py`:

```python
import uuid
from decimal import Decimal
from datetime import date
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa: F401
from app.models.master import Company, Location, Currency, Account, AccountType, Counterparty, CounterpartyType
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, TxnType, TxnStatus, LegType
from app.models.accounting import JournalEntry, JournalLine, JournalStatus
from app.services.accounting_seed import initialize_chart
from app.services import posting


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def _seed_company(db):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="Dolar", name_ar="USD", name_en="USD")
    trly = Currency(id=uuid.uuid4(), code="TRY", name_tr="Lira", name_ar="TRY", name_en="TRY")
    db.add_all([usd, trly])
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    db.add(loc)
    db.commit()
    initialize_chart(db, cid, "thp")
    a_usd = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="USD Kasa", company_id=cid)
    a_try = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=trly.id, account_type=AccountType.cash, name="TRY Kasa", company_id=cid)
    db.add_all([a_usd, a_try])
    db.commit()
    return cid, usd, trly, a_usd, a_try


def _txn(db, cid, ttype, legs, profit_usd=Decimal("0"), commission_usd=Decimal("0")):
    t = Transaction(id=uuid.uuid4(), txn_number=f"T-{uuid.uuid4().hex[:6]}", txn_date=date.today(),
                    value_date=date.today(), txn_type=ttype, status=TxnStatus.completed,
                    created_by=uuid.uuid4(), company_id=cid)
    db.add(t); db.flush()
    for acc, ccy, amt, amt_usd, lt in legs:
        db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=lt, account_id=acc.id,
                              currency_id=ccy.id, amount=amt, amount_usd=amt_usd, rate_usd=Decimal("1")))
    db.add(TransactionPnL(transaction_id=t.id, profit_usd=profit_usd, commission_usd=commission_usd,
                          net_pnl_usd=profit_usd + commission_usd))
    db.commit()
    return t


def _assert_balanced(db, entry):
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    dr = sum(Decimal(str(l.debit_usd)) for l in lines)
    cr = sum(Decimal(str(l.credit_usd)) for l in lines)
    assert dr == cr, f"unbalanced: dr={dr} cr={cr}"
    assert len(lines) >= 2


def test_internal_transfer_balances(db):
    cid, usd, trly, a_usd, a_try = _seed_company(db)
    # move 100 USD out of a_usd into... another USD-equivalent; here in=100usd out=100usd
    t = _txn(db, cid, TxnType.internal_transfer,
             [(a_usd, usd, Decimal("100"), Decimal("100"), LegType.outgoing),
              (a_usd, usd, Decimal("100"), Decimal("100"), LegType.incoming)])
    entry = posting.post_transaction(db, t)
    assert entry is not None
    _assert_balanced(db, entry)


def test_remittance_with_profit_balances_and_books_revenue(db):
    cid, usd, trly, a_usd, a_try = _seed_company(db)
    # customer gives 1000 USD (incoming), we pay out 900 USD equivalent (outgoing), profit 100
    t = _txn(db, cid, TxnType.remittance,
             [(a_usd, usd, Decimal("1000"), Decimal("1000"), LegType.incoming),
              (a_try, trly, Decimal("900"), Decimal("900"), LegType.outgoing)],
             profit_usd=Decimal("100"))
    entry = posting.post_transaction(db, t)
    _assert_balanced(db, entry)
    # an fx_profit credit must exist
    from app.models.accounting import AccountMapping, AccountRole
    fx = db.query(AccountMapping).filter(AccountMapping.company_id == cid, AccountMapping.role == AccountRole.fx_profit).first()
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    assert any(str(l.coa_account_id) == str(fx.coa_account_id) and Decimal(str(l.credit_usd)) == Decimal("100") for l in lines)


def test_post_is_idempotent(db):
    cid, usd, trly, a_usd, a_try = _seed_company(db)
    t = _txn(db, cid, TxnType.deposit,
             [(a_usd, usd, Decimal("500"), Decimal("500"), LegType.incoming)])
    e1 = posting.post_transaction(db, t)
    e2 = posting.post_transaction(db, t)  # second call must not create a new entry
    assert str(e1.id) == str(e2.id)
    count = db.query(JournalEntry).filter(JournalEntry.source_id == t.id).count()
    assert count == 1


def test_gl_account_lazily_created_and_reused(db):
    cid, usd, trly, a_usd, a_try = _seed_company(db)
    assert a_usd.gl_account_id is None
    gl1 = posting.get_or_create_gl_for_till(db, a_usd)
    assert a_usd.gl_account_id is not None
    gl2 = posting.get_or_create_gl_for_till(db, a_usd)
    assert str(gl1) == str(gl2)


def test_void_creates_mirror(db):
    cid, usd, trly, a_usd, a_try = _seed_company(db)
    t = _txn(db, cid, TxnType.deposit,
             [(a_usd, usd, Decimal("500"), Decimal("500"), LegType.incoming)])
    entry = posting.post_transaction(db, t)
    rev = posting.void_for_source(db, t.id)
    assert rev is not None
    db.refresh(entry)
    assert entry.status == JournalStatus.void
    _assert_balanced(db, rev)
    # mirror swaps debits/credits
    orig = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    mirror = db.query(JournalLine).filter(JournalLine.entry_id == rev.id).all()
    assert sum(Decimal(str(l.debit_usd)) for l in orig) == sum(Decimal(str(l.credit_usd)) for l in mirror)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_posting_engine.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.posting'`

- [ ] **Step 3: Write the posting engine**

Create `backend/app/services/posting.py`:

```python
"""
Double-entry posting engine.

Speaks in logical roles (AccountMapping). Auto-posts completed transactions
into balanced journal entries. Every entry satisfies Σdebit_usd == Σcredit_usd.
Idempotent per (source_type, source_id). Reversal-on-void (never deletes).
"""
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy.orm import Session

from app.models.master import Account, Currency
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, TxnType, LegType
from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountRole,
    JournalEntry, JournalLine, JournalSequence, FiscalPeriod,
    JournalSourceType, JournalStatus, FiscalPeriodStatus,
)

ZERO = Decimal("0")
_TILL_ROLE = {"cash": AccountRole.cash, "bank": AccountRole.bank, "crypto": AccountRole.crypto}


class PostingError(Exception):
    pass


def _q(v) -> Decimal:
    return Decimal(str(v or 0))


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
    # unique child code: parent.code + "." + zero-padded count
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
    seq = (db.query(JournalSequence)
             .filter(JournalSequence.company_id == company_id, JournalSequence.year == year)
             .with_for_update(of=JournalSequence)
             .first()) if db.bind.dialect.name == "postgresql" else (
           db.query(JournalSequence)
             .filter(JournalSequence.company_id == company_id, JournalSequence.year == year)
             .first())
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

    lines = []  # dicts → JournalLine kwargs

    # 1) till lines
    for leg in legs:
        acc = db.query(Account).filter(Account.id == leg.account_id).first()
        gl_id = get_or_create_gl_for_till(db, acc)
        amt_usd = _q(leg.amount_usd)
        if leg.leg_type == LegType.incoming:
            lines.append(dict(coa_account_id=gl_id, debit=_q(leg.amount), credit=ZERO,
                              currency_id=leg.currency_id, rate_usd=_q(leg.rate_usd),
                              debit_usd=amt_usd, credit_usd=ZERO, account_id=acc.id))
        else:
            lines.append(dict(coa_account_id=gl_id, debit=ZERO, credit=_q(leg.amount),
                              currency_id=leg.currency_id, rate_usd=_q(leg.rate_usd),
                              debit_usd=ZERO, credit_usd=amt_usd, account_id=acc.id))

    simple = txn.txn_type in (TxnType.deposit, TxnType.withdrawal, TxnType.internal_transfer)

    # 2) revenue recognition (skip for simple types)
    if not simple and pnl:
        comm = _q(pnl.commission_usd)
        fx = _q(pnl.net_pnl_usd) - comm
        if comm != ZERO:
            acc = resolve_role(db, txn.company_id, AccountRole.commission_income)
            if comm > ZERO:
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
        if imbalance > ZERO:
            line = _usd_line(acc.id, ZERO, imbalance, usd_id)
        else:
            line = _usd_line(acc.id, -imbalance, ZERO, usd_id)
        line["counterparty_id"] = txn.counterparty_id
        lines.append(line)

    return _persist_entry(db, txn.company_id, txn.txn_date, txn.value_date, source_type,
                          txn.id, f"{txn.txn_type.value} {txn.txn_number}", txn.created_by, lines)


def _usd_line(coa_account_id, debit_usd, credit_usd, usd_id):
    return dict(coa_account_id=coa_account_id, debit=debit_usd, credit=credit_usd,
                currency_id=usd_id, rate_usd=Decimal("1"),
                debit_usd=debit_usd, credit_usd=credit_usd)


def _persist_entry(db, company_id, entry_date, value_date, source_type, source_id,
                   memo, created_by, line_dicts):
    dr = sum(l["debit_usd"] for l in line_dicts)
    cr = sum(l["credit_usd"] for l in line_dicts)
    if dr != cr:
        raise PostingError(f"Entry does not balance: dr={dr} cr={cr}")
    year = entry_date.year if entry_date else date.today().year
    entry = JournalEntry(
        company_id=company_id,
        entry_number=next_entry_number(db, company_id, year),
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
                         source_id, f"REVERSAL {entry.entry_number}", created_by, mirror)
    entry.status = JournalStatus.void
    entry.reversed_by_id = rev.id
    db.flush()
    return rev
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_posting_engine.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/posting.py backend/tests/test_posting_engine.py
git commit -m "feat(gl): role-based double-entry posting engine with reversal + period guard"
```

---

## Task 3: Hook posting into the transaction lifecycle

**Files:**
- Modify: `backend/app/api/transactions.py`
- Test: `backend/tests/test_txn_posting_hook.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_txn_posting_hook.py`:

```python
import uuid
from decimal import Decimal
from datetime import date
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models  # noqa
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.master import Company, Location, Currency, Account, AccountType
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, TxnType, TxnStatus, LegType
from app.models.accounting import JournalEntry, JournalStatus
from app.services.accounting_seed import initialize_chart
from app.api.transactions import router as txn_router


@pytest.fixture
def ctx():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    s.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    s.add(loc)
    admin = User(id=uuid.uuid4(), name="A", email="a@a.co", hashed_password="x", role=UserRole.admin, company_id=cid)
    s.add(admin)
    s.commit()
    initialize_chart(s, cid, "thp")
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="Kasa", company_id=cid)
    s.add(acc)
    s.commit()
    # a pending transaction with one incoming leg
    t = Transaction(id=uuid.uuid4(), txn_number="T-1", txn_date=date.today(), value_date=date.today(),
                    txn_type=TxnType.deposit, status=TxnStatus.pending, created_by=admin.id, company_id=cid)
    s.add(t); s.flush()
    s.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=acc.id,
                         currency_id=usd.id, amount=Decimal("500"), amount_usd=Decimal("500"), rate_usd=Decimal("1")))
    s.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"), commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
    s.commit()

    app = FastAPI()
    app.include_router(txn_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    return TestClient(app), s, t


def test_approve_posts_entry(ctx):
    client, s, t = ctx
    r = client.patch(f"/api/transactions/{t.id}/approve")
    assert r.status_code == 200
    entry = s.query(JournalEntry).filter(JournalEntry.source_id == t.id, JournalEntry.status == JournalStatus.posted).first()
    assert entry is not None


def test_delete_voids_entry(ctx):
    client, s, t = ctx
    client.patch(f"/api/transactions/{t.id}/approve")
    r = client.delete(f"/api/transactions/{t.id}")
    assert r.status_code == 200
    posted = s.query(JournalEntry).filter(JournalEntry.source_id == t.id, JournalEntry.status == JournalStatus.posted).count()
    void = s.query(JournalEntry).filter(JournalEntry.source_id == t.id, JournalEntry.status == JournalStatus.void).count()
    assert posted == 0 and void == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_txn_posting_hook.py -v`
Expected: FAIL — approve does not yet post (no JournalEntry created).

- [ ] **Step 3: Add a safe posting helper + hook calls**

In `backend/app/api/transactions.py`, after the existing `_notify` helper (around line 44), add:

```python
def _post_gl(db, txn) -> None:
    """Post a completed transaction to the GL. Never breaks the request:
    if the company has not initialised a chart, or any mapping is missing,
    posting is skipped silently (operational flow is unaffected)."""
    try:
        from app.services.posting import post_transaction, PostingError
        try:
            post_transaction(db, txn)
        except PostingError:
            pass  # mapping/period not ready → skip posting, keep txn state
    except Exception:
        pass


def _void_gl(db, source_id) -> None:
    try:
        from app.services.posting import void_for_source
        void_for_source(db, source_id)
    except Exception:
        pass
```

In `approve()` — after `txn.status = TxnStatus.completed` and before `db.commit()`:

```python
    _post_gl(db, txn)
```

In `approve_all()` — inside the loop, after `txn.status = TxnStatus.completed` / `txn.approved_by = cu.id`, before the loop continues, add:

```python
        _post_gl(db, txn)
```

In `delete_transaction()` — after fetching `txn` and before `db.delete(txn)`, add:

```python
    _void_gl(db, txn.id)
```

(Posting must run within the same transaction/commit as the approval so it commits atomically.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_txn_posting_hook.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full backend suite**

Run: `./venv/bin/python -m pytest tests/ -q`
Expected: all pass (no regressions).

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/transactions.py backend/tests/test_txn_posting_hook.py
git commit -m "feat(gl): auto-post on approve, reverse on delete (fail-safe, non-blocking)"
```

---

## Task 4: Journal API (read + manual entry + void)

**Files:**
- Create: `backend/app/api/journal.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas/schemas.py`
- Test: `backend/tests/test_journal_api.py`

- [ ] **Step 1: Add schemas**

Append to `backend/app/schemas/schemas.py`:

```python
# ── Journal ───────────────────────────────────────────────────────────────────
class JournalLineIn(BaseModel):
    coa_account_id: UUID
    debit_usd: Decimal = Decimal("0")
    credit_usd: Decimal = Decimal("0")
    counterparty_id: Optional[UUID] = None

class ManualJournalCreate(BaseModel):
    entry_date: date
    memo: Optional[str] = None
    lines: List[JournalLineIn]

class JournalLineOut(BaseModel):
    id: UUID
    coa_account_id: UUID
    debit: Decimal
    credit: Decimal
    debit_usd: Decimal
    credit_usd: Decimal
    counterparty_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    class Config:
        from_attributes = True

class JournalEntryOut(BaseModel):
    id: UUID
    entry_number: str
    entry_date: date
    source_type: str
    status: str
    memo: Optional[str] = None
    lines: List[JournalLineOut] = []
    class Config:
        from_attributes = True
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_journal_api.py`:

```python
import uuid
from decimal import Decimal
from datetime import date
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models  # noqa
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.master import Company
from app.models.accounting import ChartOfAccount
from app.services.accounting_seed import initialize_chart
from app.api.journal import router as journal_router


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO"))
    admin = User(id=uuid.uuid4(), name="A", email="a@a.co", hashed_password="x", role=UserRole.admin, company_id=cid)
    s.add(admin); s.commit()
    initialize_chart(s, cid, "thp")
    app = FastAPI()
    app.include_router(journal_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    c = TestClient(app)
    c._s, c._cid = s, cid
    yield c
    s.close()


def _two_postable(client):
    accs = client.get("/api/accounting/journal/postable-accounts").json()
    return accs[0]["id"], accs[1]["id"]


def test_manual_entry_must_balance(client):
    a, b = _two_postable(client)
    bad = client.post("/api/accounting/journal", json={
        "entry_date": str(date.today()), "memo": "x",
        "lines": [{"coa_account_id": a, "debit_usd": "100"},
                  {"coa_account_id": b, "credit_usd": "90"}]})
    assert bad.status_code == 400


def test_manual_entry_creates_balanced(client):
    a, b = _two_postable(client)
    ok = client.post("/api/accounting/journal", json={
        "entry_date": str(date.today()), "memo": "x",
        "lines": [{"coa_account_id": a, "debit_usd": "100"},
                  {"coa_account_id": b, "credit_usd": "100"}]})
    assert ok.status_code == 200
    eid = ok.json()["id"]
    lst = client.get("/api/accounting/journal").json()
    assert any(e["id"] == eid for e in lst)


def test_void_endpoint(client):
    a, b = _two_postable(client)
    eid = client.post("/api/accounting/journal", json={
        "entry_date": str(date.today()),
        "lines": [{"coa_account_id": a, "debit_usd": "50"},
                  {"coa_account_id": b, "credit_usd": "50"}]}).json()["id"]
    r = client.post(f"/api/accounting/journal/{eid}/void")
    assert r.status_code == 200
```

- [ ] **Step 3: Write the router**

Create `backend/app/api/journal.py`:

```python
"""Journal API — list/detail, manual balanced entry, void."""
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalSourceType, JournalStatus,
)
from app.schemas.schemas import ManualJournalCreate, JournalEntryOut, JournalLineOut
from app.services.posting import _persist_entry, void_for_source, period_is_closed, PostingError

router = APIRouter(prefix="/api/accounting/journal", tags=["journal"])
_ADMIN = (UserRole.admin, UserRole.super_admin, UserRole.accounting)


def _require(cu, *roles):
    if cu.role not in roles:
        raise HTTPException(403, "Forbidden")


@router.get("/postable-accounts")
def postable_accounts(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(ChartOfAccount).filter(ChartOfAccount.is_postable == True, ChartOfAccount.is_active == True)
    q = apply_company_filter(q, ChartOfAccount, cu)
    return [{"id": str(a.id), "code": a.code, "name": a.name_tr} for a in q.order_by(ChartOfAccount.code).all()]


@router.get("", response_model=List[JournalEntryOut])
def list_journal(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(JournalEntry).options(joinedload(JournalEntry.lines))
    q = apply_company_filter(q, JournalEntry, cu)
    return q.order_by(JournalEntry.created_at.desc()).offset(offset).limit(min(limit, 300)).all()


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_entry(entry_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(JournalEntry).options(joinedload(JournalEntry.lines)).filter(JournalEntry.id == entry_id)
    q = apply_company_filter(q, JournalEntry, cu)
    e = q.first()
    if not e:
        raise HTTPException(404, "Entry not found")
    return e


@router.post("", response_model=JournalEntryOut)
def create_manual(data: ManualJournalCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    if len(data.lines) < 2:
        raise HTTPException(400, "At least two lines required")
    if period_is_closed(db, cu.company_id, data.entry_date):
        raise HTTPException(400, "Period is closed")
    # validate accounts belong to company + postable
    line_dicts = []
    for ln in data.lines:
        acc = db.query(ChartOfAccount).filter(
            ChartOfAccount.id == ln.coa_account_id, ChartOfAccount.company_id == cu.company_id).first()
        if not acc:
            raise HTTPException(404, "Account not found")
        if not acc.is_postable:
            raise HTTPException(400, f"Account {acc.code} is not postable")
        d, c = Decimal(str(ln.debit_usd or 0)), Decimal(str(ln.credit_usd or 0))
        line_dicts.append(dict(coa_account_id=ln.coa_account_id, debit=d, credit=c,
                               currency_id=None, rate_usd=Decimal("1"),
                               debit_usd=d, credit_usd=c, counterparty_id=ln.counterparty_id))
    try:
        entry = _persist_entry(db, cu.company_id, data.entry_date, None,
                               JournalSourceType.manual, None, data.memo, cu.id, line_dicts)
    except PostingError as e:
        raise HTTPException(400, str(e))
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{entry_id}/void", response_model=JournalEntryOut)
def void_entry(entry_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    q = db.query(JournalEntry).filter(JournalEntry.id == entry_id, JournalEntry.status == JournalStatus.posted)
    q = apply_company_filter(q, JournalEntry, cu)
    entry = q.first()
    if not entry:
        raise HTTPException(404, "Posted entry not found")
    # reuse void_for_source when entry has a source; for manual entries reverse by id
    try:
        if entry.source_id:
            rev = void_for_source(db, entry.source_id, created_by=cu.id)
        else:
            rev = _reverse_manual(db, entry, cu.id)
    except PostingError as e:
        raise HTTPException(400, str(e))
    db.commit()
    db.refresh(rev)
    return rev


def _reverse_manual(db, entry, created_by):
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    mirror = [dict(coa_account_id=l.coa_account_id, debit=l.credit, credit=l.debit,
                   currency_id=l.currency_id, rate_usd=l.rate_usd,
                   debit_usd=l.credit_usd, credit_usd=l.debit_usd,
                   counterparty_id=l.counterparty_id, account_id=l.account_id) for l in lines]
    rev = _persist_entry(db, entry.company_id, date.today(), None, JournalSourceType.manual,
                         None, f"REVERSAL {entry.entry_number}", created_by, mirror)
    entry.status = JournalStatus.void
    entry.reversed_by_id = rev.id
    db.flush()
    return rev
```

Also include the accounting router's mount note: the journal router lives under `/api/accounting/journal`, so the Phase-1 `postable-accounts` reference in tests resolves here.

- [ ] **Step 4: Register the router in `main.py`**

After `app.include_router(accounting_router)` add:

```python
from app.api.journal import router as journal_router
app.include_router(journal_router)
```

(Place the import with the other imports at the top and the `include_router` with the others — matching the file's existing structure.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_journal_api.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/journal.py backend/app/main.py backend/app/schemas/schemas.py backend/tests/test_journal_api.py
git commit -m "feat(gl): journal API — list/detail, balanced manual entry, void"
```

---

## Task 5: migrate.py — journal tables + Account.gl_account_id

**Files:**
- Modify: `backend/migrate.py`

- [ ] **Step 1: Add creation logic**

In `backend/migrate.py`, after the chart_of_accounts/account_mappings loop, add:

```python
        # ── accounts.gl_account_id ───────────────────────────────────────────
        if 'accounts' in tables and not col_exists(insp, 'accounts', 'gl_account_id'):
            conn.execute(text("ALTER TABLE accounts ADD COLUMN gl_account_id UUID REFERENCES chart_of_accounts(id)"))
            print("  ✅ accounts.gl_account_id eklendi")
        elif 'accounts' in tables:
            print("  — accounts.gl_account_id zaten var")

        # ── journal tables ───────────────────────────────────────────────────
        from app.models.accounting import JournalEntry, JournalLine, JournalSequence, FiscalPeriod
        for model in (JournalEntry, JournalLine, JournalSequence, FiscalPeriod):
            if model.__tablename__ not in tables:
                model.__table__.create(bind=conn)
                print(f"  ✅ {model.__tablename__} tablosu oluşturuldu")
            else:
                print(f"  — {model.__tablename__} zaten var")
```

- [ ] **Step 2: Verify against an isolated temp SQLite DB**

Run (sets the real input var `DATABASE_URL`, NOT the computed property, so a fresh subprocess binds to sqlite and never touches production):

```bash
TMPDB="$(mktemp -t coamig2).db" && DATABASE_URL="sqlite:///$TMPDB" ./venv/bin/python -c "
import os; assert os.environ['DATABASE_URL'].startswith('sqlite')
from app.core.config import settings; assert settings.SQLALCHEMY_DATABASE_URL.startswith('sqlite')
from app.core.database import Base, engine
import app.models
from sqlalchemy import inspect, text
Base.metadata.create_all(engine)
with engine.begin() as c:
    for t in ('journal_lines','journal_entries','journal_sequences','fiscal_periods'):
        c.execute(text(f'DROP TABLE {t}'))
import migrate; migrate.run()
names = set(inspect(engine).get_table_names())
assert {'journal_entries','journal_lines','journal_sequences','fiscal_periods'} <= names, names
assert 'gl_account_id' in [c['name'] for c in inspect(engine).get_columns('accounts')]
migrate.run()
print('MIGRATE2 OK')
"; rm -f "$TMPDB"
```
Expected: prints `MIGRATE2 OK`.

- [ ] **Step 3: Commit**

```bash
git add backend/migrate.py
git commit -m "chore(gl): migrate.py creates journal tables + accounts.gl_account_id"
```

---

## Task 6: Frontend — Journal page

**Files:**
- Create: `frontend/src/pages/Journal.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx`, `frontend/src/utils/api.js`, locales

- [ ] **Step 1: Add API helpers**

In `frontend/src/utils/api.js`, extend `accountingApi` with:

```javascript
  journal:        (params) => api.get('/api/accounting/journal', { params }),
  journalEntry:   (id)     => api.get(`/api/accounting/journal/${id}`),
  postableAccounts: ()     => api.get('/api/accounting/journal/postable-accounts'),
  createJournal:  (data)   => api.post('/api/accounting/journal', data),
  voidJournal:    (id)     => api.post(`/api/accounting/journal/${id}/void`),
```

- [ ] **Step 2: Create `Journal.jsx`**

Mirror `ChartOfAccounts.jsx` structure (same imports/UI components/useLang). The page must:
1. `GET /api/accounting/journal` and render entries newest-first: entry_number, date, source_type badge, status badge, memo, and a per-entry line table (account code/name, debit_usd, credit_usd) with column totals showing Σdebit == Σcredit.
2. A "Manual entry" form (admin/accounting only): date, memo, and a dynamic line editor (each line = postable-account select + debit_usd + credit_usd). Show a live running total; disable submit until Σdebit_usd == Σcredit_usd and ≥2 lines. Submit via `createJournal`.
3. A "Void" action on each `posted` entry → `voidJournal`, with confirm.

Use the existing API helper (no hand-rolled fetch). All user-facing strings via locale keys under a `je.*` namespace.

- [ ] **Step 3: Add route + nav + locales**

- `App.jsx`: lazy import `Journal` and add `<Route path="/journal" element={<Protected><Journal /></Protected>} />` after the chart-of-accounts route.
- `Layout.jsx`: add `{ path: '/journal', key: 'journal', icon: 'reports' }` to `BASE_NAV` after the chart-of-accounts entry.
- Locales: add to tr/en/ar a `journal` nav label plus `je.*` strings used in Step 2:
  - tr: `journal: 'Yevmiye Defteri'`, en: `journal: 'Journal'`, ar: `journal: 'دفتر اليومية'`
  - `je*` keys: title, manualEntry, addLine, debit, credit, total, balanced, notBalanced, save, void, voidConfirm, account, source, status, posted, voided, memo, date, entryNo — translated in all three.

- [ ] **Step 4: Build to verify it compiles**

Run: `cd frontend && npx vite build`
Expected: build succeeds; a `Journal-*.js` chunk is emitted. Then run `npm run build` to confirm sitemap + prerender still pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Journal.jsx frontend/src/App.jsx frontend/src/components/Layout.jsx frontend/src/utils/api.js frontend/src/locales
git commit -m "feat(gl): Journal page — entries, balanced manual entry, void; nav + locales"
```

---

## Phase 2 Done — Verification Checklist

- [ ] `./venv/bin/python -m pytest tests/ -q` — all pass (posting, hook, journal API, models).
- [ ] Approving a transaction creates a balanced journal entry (Σdr_usd = Σcr_usd); deleting it voids + mirrors.
- [ ] Posting is idempotent (re-approve / double-post does not duplicate).
- [ ] Till GL sub-accounts are auto-created once and reused.
- [ ] Manual journal entry rejects unbalanced input; void reverses.
- [ ] If a company has no chart/mappings, approval still succeeds (posting skipped, non-blocking).
- [ ] `migrate.py` creates the four journal tables + `accounts.gl_account_id` on an existing DB.
- [ ] Frontend builds; `/journal` renders entries + manual-entry form.

**Next:** Phase 3 — idempotent backfill of historical transactions (and supplier settlements) into the GL.
```
