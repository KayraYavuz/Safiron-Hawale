"""Tests for the AML screening service."""
import uuid
from decimal import Decimal
from datetime import date, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa
from app.models.master import Company, Location, Currency, Account, AccountType, Counterparty, CounterpartyType
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, TxnType, TxnStatus, LegType
from app.models.compliance import Watchlist, ComplianceFlag, ComplianceRule, ComplianceStatus
from app.services import compliance


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def _seed(db, threshold="10000", window=1):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO",
                   aml_threshold_usd=Decimal(threshold), aml_structuring_window_days=window))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    db.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    db.add(loc)
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id,
                  account_type=AccountType.cash, name="Kasa", company_id=cid)
    db.add(acc)
    db.commit()
    return cid, usd, acc


def _txn(db, cid, usd, acc, amount, cp_id=None, on=None):
    t = Transaction(id=uuid.uuid4(), txn_number=f"T-{uuid.uuid4().hex[:6]}",
                    txn_date=on or date.today(), value_date=on or date.today(),
                    txn_type=TxnType.deposit, status=TxnStatus.pending,
                    counterparty_id=cp_id, created_by=uuid.uuid4(), company_id=cid)
    db.add(t); db.flush()
    db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming,
                          account_id=acc.id, currency_id=usd.id, amount=Decimal(str(amount)),
                          amount_usd=Decimal(str(amount)), rate_usd=Decimal("1")))
    db.commit()
    return t


def test_amount_threshold_flags(db):
    cid, usd, acc = _seed(db, threshold="10000")
    t = _txn(db, cid, usd, acc, "12000")
    flags = compliance.evaluate_and_store(db, t); db.commit()
    assert {f.rule for f in flags} == {ComplianceRule.amount}


def test_amount_below_threshold_no_flag(db):
    cid, usd, acc = _seed(db, threshold="10000")
    t = _txn(db, cid, usd, acc, "9000")
    flags = compliance.evaluate_and_store(db, t); db.commit()
    assert flags == []


def test_threshold_zero_disables(db):
    cid, usd, acc = _seed(db, threshold="0")
    t = _txn(db, cid, usd, acc, "999999")
    assert compliance.evaluate_and_store(db, t) == []


def test_watchlist_fuzzy_match(db):
    cid, usd, acc = _seed(db, threshold="10000")
    cp = Counterparty(id=uuid.uuid4(), code="CP1", name="Ahmed Al-Rashidi",
                      type=CounterpartyType.customer, company_id=cid)
    db.add(cp)
    db.add(Watchlist(id=uuid.uuid4(), company_id=cid, name="Ahmad Alrashidi", reason="OFAC"))
    db.commit()
    t = _txn(db, cid, usd, acc, "500", cp_id=cp.id)
    flags = compliance.evaluate_and_store(db, t); db.commit()
    assert ComplianceRule.watchlist in {f.rule for f in flags}


def test_watchlist_no_match(db):
    cid, usd, acc = _seed(db, threshold="10000")
    cp = Counterparty(id=uuid.uuid4(), code="CP1", name="Mehmet Yilmaz",
                      type=CounterpartyType.customer, company_id=cid)
    db.add(cp)
    db.add(Watchlist(id=uuid.uuid4(), company_id=cid, name="Osama Different", reason="x"))
    db.commit()
    t = _txn(db, cid, usd, acc, "500", cp_id=cp.id)
    flags = compliance.evaluate_and_store(db, t); db.commit()
    assert flags == []


def test_structuring_flags_aggregate(db):
    cid, usd, acc = _seed(db, threshold="10000", window=1)
    cp = Counterparty(id=uuid.uuid4(), code="CP1", name="Split Guy",
                      type=CounterpartyType.customer, company_id=cid)
    db.add(cp); db.commit()
    # three sub-threshold deposits same day, same cp → 18000 ≥ 10000
    _txn(db, cid, usd, acc, "6000", cp_id=cp.id)
    _txn(db, cid, usd, acc, "6000", cp_id=cp.id)
    t3 = _txn(db, cid, usd, acc, "6000", cp_id=cp.id)
    flags = compliance.evaluate_and_store(db, t3); db.commit()
    assert ComplianceRule.structuring in {f.rule for f in flags}


def test_structuring_single_txn_no_flag(db):
    cid, usd, acc = _seed(db, threshold="10000", window=1)
    cp = Counterparty(id=uuid.uuid4(), code="CP1", name="Solo",
                      type=CounterpartyType.customer, company_id=cid)
    db.add(cp); db.commit()
    t = _txn(db, cid, usd, acc, "6000", cp_id=cp.id)
    flags = compliance.evaluate_and_store(db, t); db.commit()
    assert ComplianceRule.structuring not in {f.rule for f in flags}


def test_idempotent_rescreen(db):
    cid, usd, acc = _seed(db, threshold="10000")
    t = _txn(db, cid, usd, acc, "12000")
    compliance.evaluate_and_store(db, t); db.commit()
    compliance.evaluate_and_store(db, t); db.commit()
    count = db.query(ComplianceFlag).filter(ComplianceFlag.transaction_id == t.id).count()
    assert count == 1


def test_has_open_flags(db):
    cid, usd, acc = _seed(db, threshold="10000")
    t = _txn(db, cid, usd, acc, "12000")
    compliance.evaluate_and_store(db, t); db.commit()
    assert compliance.has_open_flags(db, t.id) is True
