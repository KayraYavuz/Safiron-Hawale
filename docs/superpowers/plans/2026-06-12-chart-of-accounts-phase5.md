# Chart of Accounts — Phase 5 (Period Close) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Fiscal-period close/reopen with a year-end profit roll-up to retained earnings. The `fiscal_periods` table and the posting-engine lock guard (`period_is_closed`) already exist from Phase 2; this phase adds the workflow, API, and UI.

**Architecture:** A `period_close` service lists periods, closes a date range (posting a balanced **closing entry** that zeroes revenue/expense into `retained_earnings`), and reopens. Closing into an already-closed overlapping range is rejected. A read/action API under `/api/accounting/periods` and a "Periods" tab on the Financial Statements page.

**Closing entry (classic):** for each revenue account debit its balance, for each expense account credit its balance, and post the net to `retained_earnings` (credit if profit, debit if loss). This always balances and resets the income statement for the next period.

**Tech Stack:** SQLAlchemy, pytest, React.

---

## Task 1: Period-close service

**Files:**
- Create: `backend/app/services/period_close.py`
- Test: `backend/tests/test_period_close.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_period_close.py`:

```python
import uuid
from decimal import Decimal
from datetime import date
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa
from app.models.master import Company, Location, Currency, Account, AccountType
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, TxnType, TxnStatus, LegType
from app.models.accounting import FiscalPeriod, FiscalPeriodStatus, AccountMapping, AccountRole, JournalLine, JournalEntry
from app.services.accounting_seed import initialize_chart
from app.services import posting, statements, period_close


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def _seed_with_profit(db):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    trly = Currency(id=uuid.uuid4(), code="TRY", name_tr="l", name_ar="l", name_en="l")
    db.add_all([usd, trly])
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    db.add(loc); db.commit()
    initialize_chart(db, cid, "thp")
    a_usd = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="USD", company_id=cid)
    a_try = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=trly.id, account_type=AccountType.cash, name="TRY", company_id=cid)
    db.add_all([a_usd, a_try]); db.commit()
    t = Transaction(id=uuid.uuid4(), txn_number="T1", txn_date=date(2026, 3, 1), value_date=date(2026, 3, 1),
                    txn_type=TxnType.remittance, status=TxnStatus.completed, created_by=uuid.uuid4(), company_id=cid)
    db.add(t); db.flush()
    db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=a_usd.id,
                          currency_id=usd.id, amount=Decimal("1000"), amount_usd=Decimal("1000"), rate_usd=Decimal("1")))
    db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.outgoing, account_id=a_try.id,
                          currency_id=trly.id, amount=Decimal("900"), amount_usd=Decimal("900"), rate_usd=Decimal("1")))
    db.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("100"), commission_usd=Decimal("0"), net_pnl_usd=Decimal("100")))
    db.commit()
    posting.post_transaction(db, t); db.commit()
    return cid


def test_close_creates_period_and_rollup(db):
    cid = _seed_with_profit(db)
    period = period_close.close_period(db, cid, date(2026, 1, 1), date(2026, 12, 31), user_id=None)
    db.commit()
    assert period.status == FiscalPeriodStatus.closed
    # after close, income statement for the period nets to zero (revenue rolled into equity)
    inc = statements.income_statement(db, cid, date(2026, 1, 1), date(2026, 12, 31))
    assert inc["net"] == Decimal("0")
    # retained earnings now carries the 100 profit
    re = db.query(AccountMapping).filter(AccountMapping.company_id == cid, AccountMapping.role == AccountRole.retained_earnings).first()
    bs = statements.balance_sheet(db, cid)
    re_balance = next((r["balance_usd"] for r in bs["equity"] if r["account_id"] == str(re.coa_account_id)), Decimal("0"))
    assert re_balance == Decimal("100")


def test_posting_into_closed_period_is_blocked(db):
    cid = _seed_with_profit(db)
    period_close.close_period(db, cid, date(2026, 1, 1), date(2026, 12, 31), user_id=None)
    db.commit()
    # a new completed txn dated inside the closed period must refuse to post
    from app.models.master import Account
    acc = db.query(Account).filter(Account.company_id == cid).first()
    usd = db.query(Currency).filter(Currency.code == "USD").first()
    t = Transaction(id=uuid.uuid4(), txn_number="T2", txn_date=date(2026, 6, 1), value_date=date(2026, 6, 1),
                    txn_type=TxnType.deposit, status=TxnStatus.completed, created_by=uuid.uuid4(), company_id=cid)
    db.add(t); db.flush()
    db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=acc.id,
                          currency_id=usd.id, amount=Decimal("50"), amount_usd=Decimal("50"), rate_usd=Decimal("1")))
    db.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"), commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
    db.commit()
    with pytest.raises(posting.PostingError):
        posting.post_transaction(db, t)


def test_close_rejects_overlap(db):
    cid = _seed_with_profit(db)
    period_close.close_period(db, cid, date(2026, 1, 1), date(2026, 6, 30), user_id=None)
    db.commit()
    with pytest.raises(period_close.PeriodError):
        period_close.close_period(db, cid, date(2026, 6, 1), date(2026, 12, 31), user_id=None)


def test_reopen(db):
    cid = _seed_with_profit(db)
    p = period_close.close_period(db, cid, date(2026, 1, 1), date(2026, 12, 31), user_id=None)
    db.commit()
    period_close.reopen_period(db, cid, p.id)
    db.commit()
    db.refresh(p)
    assert p.status == FiscalPeriodStatus.open
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_period_close.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.period_close'`

- [ ] **Step 3: Write the service**

Create `backend/app/services/period_close.py`:

```python
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
from app.services.posting import _persist_entry, resolve_role, _usd_currency_id, PostingError
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_period_close.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/period_close.py backend/tests/test_period_close.py
git commit -m "feat(gl): fiscal-period close with profit roll-up + reopen"
```

---

## Task 2: Periods API

**Files:**
- Create: `backend/app/api/periods.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_periods_api.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_periods_api.py`:

```python
import uuid
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
from app.services.accounting_seed import initialize_chart
from app.api.periods import router as periods_router


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
    app.include_router(periods_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    yield TestClient(app)
    s.close()


def test_close_list_reopen(client):
    r = client.post("/api/accounting/periods/close", json={"period_start": "2026-01-01", "period_end": "2026-12-31"})
    assert r.status_code == 200
    pid = r.json()["id"]
    lst = client.get("/api/accounting/periods").json()
    assert any(p["id"] == pid and p["status"] == "closed" for p in lst)
    r2 = client.post(f"/api/accounting/periods/{pid}/reopen")
    assert r2.status_code == 200
    assert r2.json()["status"] == "open"


def test_close_overlap_returns_400(client):
    client.post("/api/accounting/periods/close", json={"period_start": "2026-01-01", "period_end": "2026-06-30"})
    bad = client.post("/api/accounting/periods/close", json={"period_start": "2026-06-01", "period_end": "2026-12-31"})
    assert bad.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_periods_api.py -v`
Expected: FAIL — cannot import `app.api.periods`.

- [ ] **Step 3: Write the router (add schemas inline)**

Create `backend/app/api/periods.py`:

```python
"""Fiscal period close / reopen / list API."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.accounting import FiscalPeriod
from app.services import period_close

router = APIRouter(prefix="/api/accounting/periods", tags=["periods"])
_ADMIN = (UserRole.admin, UserRole.super_admin, UserRole.accounting)


class CloseRequest(BaseModel):
    period_start: date
    period_end: date


def _require(cu, *roles):
    if cu.role not in roles:
        raise HTTPException(403, "Forbidden")


def _out(p: FiscalPeriod) -> dict:
    return {"id": str(p.id), "period_start": str(p.period_start), "period_end": str(p.period_end),
            "status": p.status.value, "closed_at": str(p.closed_at) if p.closed_at else None}


@router.get("")
def list_periods(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return [_out(p) for p in period_close.list_periods(db, cu.company_id)]


@router.post("/close")
def close(data: CloseRequest, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    try:
        p = period_close.close_period(db, cu.company_id, data.period_start, data.period_end, user_id=cu.id)
    except period_close.PeriodError as e:
        raise HTTPException(400, str(e))
    db.commit()
    db.refresh(p)
    return _out(p)


@router.post("/{period_id}/reopen")
def reopen(period_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    # tenancy: ensure the period belongs to the company
    q = apply_company_filter(db.query(FiscalPeriod).filter(FiscalPeriod.id == period_id), FiscalPeriod, cu)
    if not q.first():
        raise HTTPException(404, "Period not found")
    try:
        p = period_close.reopen_period(db, cu.company_id, period_id)
    except period_close.PeriodError as e:
        raise HTTPException(400, str(e))
    db.commit()
    db.refresh(p)
    return _out(p)
```

- [ ] **Step 4: Register router in `main.py`**

Add with the other imports:

```python
from app.api.periods import router as periods_router
```

and with the includes:

```python
app.include_router(periods_router)
```

- [ ] **Step 5: Run tests + full suite**

Run: `./venv/bin/python -m pytest tests/test_periods_api.py -v` (PASS, 2 tests), then `./venv/bin/python -m pytest tests/ -q`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/periods.py backend/app/main.py backend/tests/test_periods_api.py
git commit -m "feat(gl): periods API — close, reopen, list"
```

---

## Task 3: Frontend — Periods tab on Financial Statements

**Files:**
- Modify: `frontend/src/utils/api.js`, `frontend/src/pages/FinancialStatements.jsx`, locales

- [ ] **Step 1: Add API helpers**

Extend `accountingApi`:

```javascript
  periods:       ()                 => api.get('/api/accounting/periods'),
  closePeriod:   (data)             => api.post('/api/accounting/periods/close', data),
  reopenPeriod:  (id)               => api.post(`/api/accounting/periods/${id}/reopen`),
```

- [ ] **Step 2: Add a "Periods" tab to `FinancialStatements.jsx`**

Add `'periods'` to the `TABS` array and a `fsPeriods` label. The tab content:
- A close form (admin/accounting): period_start + period_end date inputs + a "Close period" button → `closePeriod`. On success, invalidate and refetch.
- A table of existing periods (`periods()`): start, end, status badge, and a "Reopen" action on closed periods → `reopenPeriod`.
Use react-query mutations mirroring the Journal page; toast on success/error; all strings via `fs.*` locale keys (`fsPeriods`, `fsClosePeriod`, `fsReopen`, `fsPeriodStart`, `fsPeriodEnd`, `fsStatusOpen`, `fsStatusClosed`, `fsCloseConfirm`).

- [ ] **Step 3: Add locale keys (tr/en/ar)**

- tr: `fsPeriods: 'Dönemler'`, `fsClosePeriod: 'Dönemi Kapat'`, `fsReopen: 'Yeniden Aç'`, `fsPeriodStart: 'Dönem Başı'`, `fsPeriodEnd: 'Dönem Sonu'`, `fsStatusOpen: 'Açık'`, `fsStatusClosed: 'Kapalı'`, `fsCloseConfirm: 'Bu dönem kapatılsın mı? Kâr/zarar geçmiş yıllar kârına aktarılır.'`
- en: `fsPeriods: 'Periods'`, `fsClosePeriod: 'Close Period'`, `fsReopen: 'Reopen'`, `fsPeriodStart: 'Period Start'`, `fsPeriodEnd: 'Period End'`, `fsStatusOpen: 'Open'`, `fsStatusClosed: 'Closed'`, `fsCloseConfirm: 'Close this period? Profit/loss rolls into retained earnings.'`
- ar: `fsPeriods: 'الفترات'`, `fsClosePeriod: 'إغلاق الفترة'`, `fsReopen: 'إعادة فتح'`, `fsPeriodStart: 'بداية الفترة'`, `fsPeriodEnd: 'نهاية الفترة'`, `fsStatusOpen: 'مفتوحة'`, `fsStatusClosed: 'مغلقة'`, `fsCloseConfirm: 'هل تريد إغلاق هذه الفترة؟ سيتم ترحيل الربح/الخسارة إلى الأرباح المدورة.'`

- [ ] **Step 4: Build to verify**

Run: `cd frontend && npx vite build`, then `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/FinancialStatements.jsx frontend/src/utils/api.js frontend/src/locales
git commit -m "feat(gl): period close/reopen UI tab on Financial Statements"
```

---

## Phase 5 Done — Verification Checklist

- [ ] `./venv/bin/python -m pytest tests/ -q` — all pass.
- [ ] Closing a period posts a balanced roll-up; income statement for the period then nets to zero and retained earnings carries the profit.
- [ ] Posting/voiding into a closed period is blocked.
- [ ] Overlapping closes are rejected; reopen flips status back to open.
- [ ] Frontend builds; the Periods tab closes/reopens periods.

**GL feature complete (Phases 1–5).**
```
