# Chart of Accounts — Phase 4 (Financial Statements) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** GL-backed financial statements: **Trial Balance (Mizan)**, **Balance Sheet (Bilanço)**, **Income Statement (Gelir Tablosu)**, and **General Ledger / Defter-i Kebir** drill-down — plus a `FinancialStatements.jsx` UI.

**Architecture:** A pure aggregation service (`app/services/statements.py`) sums `journal_lines.debit_usd/credit_usd` (only `status=posted` entries), joined to `chart_of_accounts` for type/code/name and to `journal_entries` for date filtering. Normal-balance sign per account type. A read-only API under `/api/accounting` exposes the four reports; a React page renders them as tabs.

**Sign conventions (normal balance):**
- asset, expense → balance = Σdebit − Σcredit
- liability, equity, revenue → balance = Σcredit − Σdebit
- Income statement: revenue line = Σcredit − Σdebit; expense line = Σdebit − Σcredit; net = revenue − expense.
- Balance sheet identity: **Assets = Liabilities + Equity + NetIncome(period)** (revenue/expense not yet closed to retained earnings).

**Tech Stack:** SQLAlchemy aggregation, pytest, React.

---

## Task 1: Statements service

**Files:**
- Create: `backend/app/services/statements.py`
- Test: `backend/tests/test_statements.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_statements.py`:

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
from app.services.accounting_seed import initialize_chart
from app.services import posting, statements


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def _seed(db):
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
    # a remittance with 100 profit
    t = Transaction(id=uuid.uuid4(), txn_number="T1", txn_date=date.today(), value_date=date.today(),
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


def test_trial_balance_balances(db):
    cid = _seed(db)
    tb = statements.trial_balance(db, cid)
    total_dr = sum(r["debit_usd"] for r in tb["rows"])
    total_cr = sum(r["credit_usd"] for r in tb["rows"])
    assert total_dr == total_cr
    assert tb["total_debit"] == tb["total_credit"]


def test_income_statement_net_is_profit(db):
    cid = _seed(db)
    inc = statements.income_statement(db, cid, date(2000, 1, 1), date.today())
    assert inc["net"] == Decimal("100")
    assert inc["total_revenue"] == Decimal("100")


def test_balance_sheet_identity_holds(db):
    cid = _seed(db)
    bs = statements.balance_sheet(db, cid)
    assert bs["total_assets"] == bs["total_liabilities"] + bs["total_equity"] + bs["net_income"]


def test_general_ledger_returns_lines(db):
    cid = _seed(db)
    tb = statements.trial_balance(db, cid)
    acc_id = next(r["account_id"] for r in tb["rows"] if r["debit_usd"] > 0)
    gl = statements.general_ledger(db, cid, acc_id, date(2000, 1, 1), date.today())
    assert len(gl["lines"]) >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_statements.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.statements'`

- [ ] **Step 3: Write the service**

Create `backend/app/services/statements.py`:

```python
"""
GL-backed financial statements (pure aggregation over posted journal lines).

Mizan (trial balance), Bilanço (balance sheet), Gelir Tablosu (income statement),
Defter-i Kebir (general ledger). All amounts in USD.
"""
from decimal import Decimal
from datetime import date
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalStatus, AccountType,
)

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


def trial_balance(db: Session, company_id, as_of: date = None) -> dict:
    agg = _agg(db, company_id, end=as_of)
    accs = _accounts(db, company_id)
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


def income_statement(db: Session, company_id, start: date, end: date) -> dict:
    agg = _agg(db, company_id, start=start, end=end)
    accs = _accounts(db, company_id)
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


def balance_sheet(db: Session, company_id, as_of: date = None) -> dict:
    agg = _agg(db, company_id, end=as_of)
    accs = _accounts(db, company_id)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_statements.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/statements.py backend/tests/test_statements.py
git commit -m "feat(gl): statements service — trial balance, income statement, balance sheet, GL"
```

---

## Task 2: Statements API

**Files:**
- Create: `backend/app/api/statements.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_statements_api.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_statements_api.py`:

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
from app.services.accounting_seed import initialize_chart
from app.services import posting
from app.api.statements import router as statements_router


@pytest.fixture
def client():
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
    s.add(admin); s.commit()
    initialize_chart(s, cid, "thp")
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="Kasa", company_id=cid)
    s.add(acc); s.commit()
    t = Transaction(id=uuid.uuid4(), txn_number="T1", txn_date=date.today(), value_date=date.today(),
                    txn_type=TxnType.deposit, status=TxnStatus.completed, created_by=admin.id, company_id=cid)
    s.add(t); s.flush()
    s.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=acc.id,
                         currency_id=usd.id, amount=Decimal("500"), amount_usd=Decimal("500"), rate_usd=Decimal("1")))
    s.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"), commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
    s.commit()
    posting.post_transaction(s, t); s.commit()
    app = FastAPI()
    app.include_router(statements_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    yield TestClient(app)
    s.close()


def test_trial_balance_endpoint(client):
    r = client.get("/api/accounting/trial-balance")
    assert r.status_code == 200
    body = r.json()
    assert body["total_debit"] == body["total_credit"]


def test_balance_sheet_endpoint(client):
    r = client.get("/api/accounting/balance-sheet")
    assert r.status_code == 200
    assert "total_assets" in r.json()


def test_income_statement_endpoint(client):
    r = client.get("/api/accounting/income-statement-gl", params={"start": "2000-01-01", "end": str(date.today())})
    assert r.status_code == 200
    assert "net" in r.json()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_statements_api.py -v`
Expected: FAIL — cannot import `app.api.statements`.

- [ ] **Step 3: Write the router**

Create `backend/app/api/statements.py`:

```python
"""GL-backed financial statement endpoints (read-only)."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services import statements

router = APIRouter(prefix="/api/accounting", tags=["statements"])


@router.get("/trial-balance")
def trial_balance(as_of: Optional[date] = None, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return statements.trial_balance(db, cu.company_id, as_of=as_of)


@router.get("/balance-sheet")
def balance_sheet(as_of: Optional[date] = None, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return statements.balance_sheet(db, cu.company_id, as_of=as_of)


@router.get("/income-statement-gl")
def income_statement_gl(start: date, end: date, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return statements.income_statement(db, cu.company_id, start, end)


@router.get("/general-ledger/{account_id}")
def general_ledger(account_id: UUID, start: Optional[date] = None, end: Optional[date] = None,
                   db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return statements.general_ledger(db, cu.company_id, account_id, start, end)
```

- [ ] **Step 4: Register router in `main.py`**

Add with the other imports:

```python
from app.api.statements import router as statements_router
```

and with the other includes:

```python
app.include_router(statements_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_statements_api.py -v`
Expected: PASS (3 tests). Then run the full suite: `./venv/bin/python -m pytest tests/ -q`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/statements.py backend/app/main.py backend/tests/test_statements_api.py
git commit -m "feat(gl): financial-statement API — mizan, bilanço, gelir tablosu, defter-i kebir"
```

---

## Task 3: Frontend — Financial Statements page

**Files:**
- Create: `frontend/src/pages/FinancialStatements.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx`, `frontend/src/utils/api.js`, locales

- [ ] **Step 1: Add API helpers**

Extend `accountingApi` in `frontend/src/utils/api.js`:

```javascript
  trialBalance:    (params) => api.get('/api/accounting/trial-balance', { params }),
  balanceSheet:    (params) => api.get('/api/accounting/balance-sheet', { params }),
  incomeStatement: (params) => api.get('/api/accounting/income-statement-gl', { params }),
  generalLedger:   (id, params) => api.get(`/api/accounting/general-ledger/${id}`, { params }),
```

- [ ] **Step 2: Create `FinancialStatements.jsx`**

Mirror `Journal.jsx` patterns (UI components, `useLang`, `fmt`). Tabs:
1. **Mizan** — `trialBalance()`: table of code, name, debit_usd, credit_usd, balance_usd; footer shows total_debit == total_credit.
2. **Bilanço** — `balanceSheet()`: two columns — Assets vs (Liabilities + Equity + Net Income); show each group's rows + totals; assert the identity visually (Assets total == L+E+NI).
3. **Gelir Tablosu** — `incomeStatement({start,end})` with a date-range picker (default: year-to-date): Revenue rows + total, Expense rows + total, Net.
4. **Defter-i Kebir** — account picker (from trial-balance rows) + date range → `generalLedger(id,{start,end})` table with running balance.

Localized account name via `name_${lang}`. All strings via locale keys under `fs.*`.

- [ ] **Step 3: Add route + nav + locales**

- `App.jsx`: lazy import `FinancialStatements`, add `<Route path="/financial-statements" element={<Protected><FinancialStatements /></Protected>} />` after `/journal`.
- `Layout.jsx`: add `{ path: '/financial-statements', key: 'financialStatements', icon: 'reports' }` to `BASE_NAV` after the journal entry.
- Locales (tr/en/ar): `financialStatements` nav label + `fs.*` keys (tabs: trialBalance/balanceSheet/incomeStatement/generalLedger; labels: assets, liabilities, equity, netIncome, revenue, expense, total, balance, debit, credit, account, from, to, runningBalance, balanced, notBalanced).
  - tr: `financialStatements: 'Mali Tablolar'`, fsTrialBalance: 'Mizan', fsBalanceSheet: 'Bilanço', fsIncomeStatement: 'Gelir Tablosu', fsGeneralLedger: 'Defter-i Kebir', …
  - en: `financialStatements: 'Financial Statements'`, fsTrialBalance: 'Trial Balance', fsBalanceSheet: 'Balance Sheet', fsIncomeStatement: 'Income Statement', fsGeneralLedger: 'General Ledger', …
  - ar: `financialStatements: 'القوائم المالية'`, fsTrialBalance: 'ميزان المراجعة', fsBalanceSheet: 'الميزانية', fsIncomeStatement: 'قائمة الدخل', fsGeneralLedger: 'دفتر الأستاذ', …

- [ ] **Step 4: Build to verify**

Run: `cd frontend && npx vite build` (expect a `FinancialStatements-*.js` chunk), then `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/FinancialStatements.jsx frontend/src/App.jsx frontend/src/components/Layout.jsx frontend/src/utils/api.js frontend/src/locales
git commit -m "feat(gl): Financial Statements page — Mizan/Bilanço/Gelir Tablosu/Defter-i Kebir"
```

---

## Phase 4 Done — Verification Checklist

- [ ] `./venv/bin/python -m pytest tests/ -q` — all pass.
- [ ] Trial balance: Σdebit == Σcredit.
- [ ] Balance sheet identity: Assets == Liabilities + Equity + Net Income.
- [ ] Income statement net == period revenue − expense.
- [ ] General ledger drill-down returns lines with a running balance.
- [ ] Frontend builds; `/financial-statements` renders all four tabs.

**Next:** Phase 5 — `fiscal_periods` close/reopen UI + year-end profit roll-up to retained earnings (engine guard already in place).
```
