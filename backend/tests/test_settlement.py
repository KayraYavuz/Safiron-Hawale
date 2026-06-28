"""Tests for correspondent net positions and one-click settlement posting."""
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
from app.models.accounting import JournalEntry, JournalLine, JournalStatus, JournalSourceType
from app.services.accounting_seed import initialize_chart
from app.services import posting, partner_reports


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
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="Dolar", name_ar="USD", name_en="USD")
    db.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    db.add(loc)
    db.commit()
    initialize_chart(db, cid, "thp")
    till = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id,
                   account_type=AccountType.cash, name="USD Kasa", company_id=cid)
    cp = Counterparty(id=uuid.uuid4(), code="CP1", name="Dubai Muhabir",
                      type=CounterpartyType.supplier, company_id=cid)
    db.add_all([till, cp])
    db.commit()
    return cid, usd, till, cp


def _deposit(db, cid, usd, till, cp, amount):
    """Deposit with a counterparty → posts a counterparty payable plug (we owe them)."""
    t = Transaction(id=uuid.uuid4(), txn_number=f"T-{uuid.uuid4().hex[:6]}", txn_date=date.today(),
                    value_date=date.today(), txn_type=TxnType.deposit, status=TxnStatus.completed,
                    counterparty_id=cp.id, created_by=uuid.uuid4(), company_id=cid)
    db.add(t); db.flush()
    db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming,
                          account_id=till.id, currency_id=usd.id, amount=amount, amount_usd=amount,
                          rate_usd=Decimal("1")))
    db.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"),
                          commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
    db.commit()
    return posting.post_transaction(db, t)


def _withdrawal(db, cid, usd, till, cp, amount):
    """Withdrawal with a counterparty → posts a counterparty receivable plug (they owe us)."""
    t = Transaction(id=uuid.uuid4(), txn_number=f"T-{uuid.uuid4().hex[:6]}", txn_date=date.today(),
                    value_date=date.today(), txn_type=TxnType.withdrawal, status=TxnStatus.completed,
                    counterparty_id=cp.id, created_by=uuid.uuid4(), company_id=cid)
    db.add(t); db.flush()
    db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.outgoing,
                          account_id=till.id, currency_id=usd.id, amount=amount, amount_usd=amount,
                          rate_usd=Decimal("1")))
    db.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"),
                          commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
    db.commit()
    return posting.post_transaction(db, t)


def _net(db, cid, cp):
    pos = partner_reports.correspondent_positions(db, cid)
    row = next((r for r in pos["rows"] if r["counterparty_id"] == str(cp.id)), None)
    return row


def test_positions_payable(db):
    cid, usd, till, cp = _seed(db)
    _deposit(db, cid, usd, till, cp, Decimal("500"))
    row = _net(db, cid, cp)
    assert row is not None
    assert row["direction"] == "payable"
    assert Decimal(str(row["net_usd"])) == Decimal("-500")


def test_positions_receivable(db):
    cid, usd, till, cp = _seed(db)
    _withdrawal(db, cid, usd, till, cp, Decimal("300"))
    row = _net(db, cid, cp)
    assert row["direction"] == "receivable"
    assert Decimal(str(row["net_usd"])) == Decimal("300")


def test_positions_drops_zero(db):
    cid, usd, till, cp = _seed(db)
    _deposit(db, cid, usd, till, cp, Decimal("500"))
    _withdrawal(db, cid, usd, till, cp, Decimal("500"))  # nets to zero
    assert _net(db, cid, cp) is None


def _assert_balanced(db, entry):
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    dr = sum(Decimal(str(l.debit_usd)) for l in lines)
    cr = sum(Decimal(str(l.credit_usd)) for l in lines)
    assert dr == cr and len(lines) == 2


def test_settle_payable_full_zeroes_balance(db):
    cid, usd, till, cp = _seed(db)
    _deposit(db, cid, usd, till, cp, Decimal("500"))
    entry = posting.post_settlement(db, cid, cp, till, Decimal("500"), receivable=False)
    db.commit()
    _assert_balanced(db, entry)
    assert entry.source_type == JournalSourceType.settlement
    assert _net(db, cid, cp) is None  # fully settled

    # Cash went OUT: till credited
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    till_line = next(l for l in lines if l.account_id == till.id)
    assert Decimal(str(till_line.credit_usd)) == Decimal("500")


def test_settle_receivable_collects_cash(db):
    cid, usd, till, cp = _seed(db)
    _withdrawal(db, cid, usd, till, cp, Decimal("300"))
    entry = posting.post_settlement(db, cid, cp, till, Decimal("300"), receivable=True)
    db.commit()
    _assert_balanced(db, entry)
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    till_line = next(l for l in lines if l.account_id == till.id)
    assert Decimal(str(till_line.debit_usd)) == Decimal("300")  # cash IN
    assert _net(db, cid, cp) is None


def test_settle_partial_leaves_remainder(db):
    cid, usd, till, cp = _seed(db)
    _deposit(db, cid, usd, till, cp, Decimal("500"))
    posting.post_settlement(db, cid, cp, till, Decimal("200"), receivable=False)
    db.commit()
    row = _net(db, cid, cp)
    assert Decimal(str(row["net_usd"])) == Decimal("-300")  # 500 owed - 200 paid


def test_settle_rejects_nonpositive(db):
    cid, usd, till, cp = _seed(db)
    _deposit(db, cid, usd, till, cp, Decimal("500"))
    with pytest.raises(posting.PostingError):
        posting.post_settlement(db, cid, cp, till, Decimal("0"), receivable=False)
