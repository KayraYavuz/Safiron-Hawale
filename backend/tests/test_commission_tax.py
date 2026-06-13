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
from app.models.accounting import JournalLine, AccountMapping, AccountRole
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


def _seed(db, tax_rate=Decimal("0")):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO", commission_tax_rate=tax_rate))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    db.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    db.add(loc); db.commit()
    initialize_chart(db, cid, "thp")
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="Kasa", company_id=cid)
    db.add(acc); db.commit()
    return cid, usd, acc


def _remittance_with_commission(db, cid, usd, acc, commission):
    t = Transaction(id=uuid.uuid4(), txn_number=f"T{uuid.uuid4().hex[:5]}", txn_date=date.today(), value_date=date.today(),
                    txn_type=TxnType.remittance, status=TxnStatus.completed, created_by=uuid.uuid4(), company_id=cid)
    db.add(t); db.flush()
    db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=acc.id,
                          currency_id=usd.id, amount=Decimal("1000"), amount_usd=Decimal("1000"), rate_usd=Decimal("1")))
    db.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.outgoing, account_id=acc.id,
                          currency_id=usd.id, amount=Decimal("900"), amount_usd=Decimal("900"), rate_usd=Decimal("1")))
    db.add(TransactionPnL(transaction_id=t.id, profit_usd=commission, commission_usd=commission, net_pnl_usd=commission))
    db.commit()
    return t


def _balanced(db, entry):
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    dr = sum(Decimal(str(l.debit_usd)) for l in lines)
    cr = sum(Decimal(str(l.credit_usd)) for l in lines)
    assert dr == cr, f"dr={dr} cr={cr}"


def test_no_tax_when_rate_zero(db):
    cid, usd, acc = _seed(db, tax_rate=Decimal("0"))
    t = _remittance_with_commission(db, cid, usd, acc, Decimal("100"))
    entry = posting.post_transaction(db, t)
    _balanced(db, entry)
    tax_map = db.query(AccountMapping).filter(AccountMapping.company_id == cid, AccountMapping.role == AccountRole.tax_payable).first()
    tax_lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id, JournalLine.coa_account_id == tax_map.coa_account_id).all()
    assert tax_lines == []  # no tax posted


def test_tax_split_when_rate_set(db):
    cid, usd, acc = _seed(db, tax_rate=Decimal("0.20"))
    t = _remittance_with_commission(db, cid, usd, acc, Decimal("100"))
    entry = posting.post_transaction(db, t)
    _balanced(db, entry)
    tax_map = db.query(AccountMapping).filter(AccountMapping.company_id == cid, AccountRole.tax_payable == AccountMapping.role).first()
    tax_lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id, JournalLine.coa_account_id == tax_map.coa_account_id).all()
    assert len(tax_lines) == 1
    assert Decimal(str(tax_lines[0].credit_usd)) == Decimal("20.0000")
