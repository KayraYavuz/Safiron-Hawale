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
