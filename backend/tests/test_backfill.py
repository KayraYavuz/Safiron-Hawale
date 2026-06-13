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
