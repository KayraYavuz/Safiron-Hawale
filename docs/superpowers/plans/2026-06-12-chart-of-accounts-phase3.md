# Chart of Accounts — Phase 3 (Backfill) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** A one-time, idempotent, re-runnable command that posts every historical **completed** transaction into the GL, so the Trial Balance / Balance Sheet / Income Statement are correct from day one.

**Architecture:** Reuse the Phase 2 posting engine (`post_transaction` is already idempotent per source). A `backfill_gl(db, company_id=None, default_scheme)` service iterates companies, ensures a chart is initialised (seeds `default_scheme` if none), then posts each completed transaction. A thin CLI (`backend/backfill_gl.py`) drives it.

**Scope note:** Backfill posts **transactions only**. The transaction posting already books the counterparty receivable/payable via the balancing plug, so separately posting `SupplierSettlement` records would double-count supplier exposure. Settlement-specific posting is intentionally out of scope here.

**Tech Stack:** SQLAlchemy, pytest (in-memory SQLite).

---

## Task 1: Backfill service

**Files:**
- Create: `backend/app/services/backfill.py`
- Test: `backend/tests/test_backfill.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_backfill.py`:

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
from app.models.accounting import JournalEntry, JournalStatus
from app.services.backfill import backfill_gl


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def _company_with_txns(db, n_completed=3, n_pending=1):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    db.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    db.add(loc); db.commit()
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="Kasa", company_id=cid)
    db.add(acc); db.commit()
    def mk(status):
        t = Transaction(id=uuid.uuid4(), txn_number=f"T-{uuid.uuid4().hex[:6]}", txn_date=date.today(),
                        value_date=date.today(), txn_type=TxnType.deposit, status=status,
                        created_by=uuid.uuid4(), company_id=cid)
        db.add(t); db.flush()
        db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=acc.id,
                              currency_id=usd.id, amount=Decimal("100"), amount_usd=Decimal("100"), rate_usd=Decimal("1")))
        db.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"), commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
        db.commit()
    for _ in range(n_completed):
        mk(TxnStatus.completed)
    for _ in range(n_pending):
        mk(TxnStatus.pending)
    return cid


def test_backfill_posts_completed_only(db):
    cid = _company_with_txns(db, n_completed=3, n_pending=2)
    summary = backfill_gl(db, default_scheme="thp")
    posted = db.query(JournalEntry).filter(JournalEntry.company_id == cid, JournalEntry.status == JournalStatus.posted).count()
    assert posted == 3
    assert summary[str(cid)]["posted"] == 3


def test_backfill_is_idempotent(db):
    cid = _company_with_txns(db, n_completed=3, n_pending=0)
    backfill_gl(db, default_scheme="thp")
    first = db.query(JournalEntry).filter(JournalEntry.company_id == cid).count()
    backfill_gl(db, default_scheme="thp")
    second = db.query(JournalEntry).filter(JournalEntry.company_id == cid).count()
    assert first == second == 3


def test_backfill_seeds_chart_if_missing(db):
    cid = _company_with_txns(db, n_completed=1, n_pending=0)
    from app.models.accounting import ChartOfAccount
    assert db.query(ChartOfAccount).filter(ChartOfAccount.company_id == cid).count() == 0
    backfill_gl(db, default_scheme="intl")
    assert db.query(ChartOfAccount).filter(ChartOfAccount.company_id == cid).count() > 0
    co = db.query(Company).filter(Company.id == cid).first()
    assert co.accounting_scheme == "intl"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_backfill.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.backfill'`

- [ ] **Step 3: Write the service**

Create `backend/app/services/backfill.py`:

```python
"""
One-time, idempotent GL backfill.

For each company (or one given), ensure a chart is initialised, then post every
COMPLETED transaction into the ledger. Re-runnable: post_transaction is idempotent
per source, so already-posted transactions are skipped.

Posts transactions only — the transaction posting already books the counterparty
side, so settlements are not posted separately (would double-count).
"""
from sqlalchemy.orm import Session

from app.models.master import Company
from app.models.transaction import Transaction, TxnStatus
from app.models.accounting import ChartOfAccount
from app.services.accounting_seed import initialize_chart
from app.services.posting import post_transaction, existing_entry_for_source, PostingError


def _ensure_chart(db: Session, company_id, default_scheme: str):
    has_chart = db.query(ChartOfAccount).filter(ChartOfAccount.company_id == company_id).first()
    if not has_chart:
        co = db.query(Company).filter(Company.id == company_id).first()
        scheme = (co.accounting_scheme if co and co.accounting_scheme else default_scheme)
        initialize_chart(db, company_id, scheme)


def backfill_gl(db: Session, company_id=None, default_scheme: str = "thp") -> dict:
    """Post all completed transactions for the given company (or all companies).
    Returns {company_id: {"posted": n, "skipped": m, "errors": k}}."""
    company_ids = ([company_id] if company_id else
                   [c.id for c in db.query(Company.id).all()])
    summary = {}
    for cid in company_ids:
        _ensure_chart(db, cid, default_scheme)
        posted = skipped = errors = 0
        txns = (db.query(Transaction)
                  .filter(Transaction.company_id == cid, Transaction.status == TxnStatus.completed)
                  .order_by(Transaction.txn_date, Transaction.created_at)
                  .all())
        for txn in txns:
            if existing_entry_for_source(db, txn.id):
                skipped += 1
                continue
            try:
                post_transaction(db, txn)
                posted += 1
            except PostingError:
                errors += 1
        db.commit()
        summary[str(cid)] = {"posted": posted, "skipped": skipped, "errors": errors}
    return summary
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_backfill.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/backfill.py backend/tests/test_backfill.py
git commit -m "feat(gl): idempotent historical backfill service (transactions)"
```

---

## Task 2: Backfill CLI

**Files:**
- Create: `backend/backfill_gl.py`

- [ ] **Step 1: Write the CLI**

Create `backend/backfill_gl.py`:

```python
"""
GL backfill CLI.

Usage (from backend/, with the project venv):
    ./venv/bin/python backfill_gl.py            # default scheme: thp
    ./venv/bin/python backfill_gl.py --scheme intl

Idempotent and re-runnable. Operates on the configured DATABASE_URL.
"""
import sys
import argparse
from app.core.database import SessionLocal
from app.services.backfill import backfill_gl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scheme", default="thp", choices=["thp", "intl"],
                    help="Chart scheme to seed for companies without one")
    args = ap.parse_args()
    db = SessionLocal()
    try:
        summary = backfill_gl(db, default_scheme=args.scheme)
    finally:
        db.close()
    total_posted = sum(v["posted"] for v in summary.values())
    total_skipped = sum(v["skipped"] for v in summary.values())
    total_errors = sum(v["errors"] for v in summary.values())
    for cid, v in summary.items():
        print(f"  {cid}: posted={v['posted']} skipped={v['skipped']} errors={v['errors']}")
    print(f"\n✅ Backfill done — posted {total_posted}, skipped {total_skipped}, errors {total_errors}")
    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Verify the CLI imports + runs against an isolated temp DB**

Run (isolated sqlite, never touches production):

```bash
TMPDB="$(mktemp -t coabf).db" && DATABASE_URL="sqlite:///$TMPDB" ./venv/bin/python -c "
import os; assert os.environ['DATABASE_URL'].startswith('sqlite')
from app.core.database import Base, engine
import app.models
Base.metadata.create_all(engine)
import backfill_gl
rc = backfill_gl.main()  # no companies → posts 0, exits 0
print('CLI rc', rc)
"; rm -f "$TMPDB"
```
Expected: prints the summary line and `CLI rc 0`.

- [ ] **Step 3: Commit**

```bash
git add backend/backfill_gl.py
git commit -m "feat(gl): backfill CLI (./venv/bin/python backfill_gl.py)"
```

---

## Phase 3 Done — Verification Checklist

- [ ] `./venv/bin/python -m pytest tests/ -q` — all pass.
- [ ] Backfill posts only completed transactions; pending are ignored.
- [ ] Re-running backfill creates no duplicates (idempotent).
- [ ] Companies without a chart get the default scheme seeded.
- [ ] CLI runs and reports a per-company summary.

**Next:** Phase 4 — GL-backed Trial Balance (Mizan), Balance Sheet (Bilanço), Income Statement (Gelir Tablosu), General Ledger drill-down + `FinancialStatements.jsx`.
```
