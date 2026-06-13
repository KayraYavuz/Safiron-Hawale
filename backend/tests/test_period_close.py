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
    inc = statements.income_statement(db, cid, date(2026, 1, 1), date(2026, 12, 31))
    assert inc["net"] == Decimal("0")
    re = db.query(AccountMapping).filter(AccountMapping.company_id == cid, AccountMapping.role == AccountRole.retained_earnings).first()
    bs = statements.balance_sheet(db, cid)
    re_balance = next((r["balance_usd"] for r in bs["equity"] if r["account_id"] == str(re.coa_account_id)), Decimal("0"))
    assert re_balance == Decimal("100")


def test_posting_into_closed_period_is_blocked(db):
    cid = _seed_with_profit(db)
    period_close.close_period(db, cid, date(2026, 1, 1), date(2026, 12, 31), user_id=None)
    db.commit()
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
