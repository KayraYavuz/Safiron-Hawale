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
    t = _txn(db, cid, TxnType.internal_transfer,
             [(a_usd, usd, Decimal("100"), Decimal("100"), LegType.outgoing),
              (a_usd, usd, Decimal("100"), Decimal("100"), LegType.incoming)])
    entry = posting.post_transaction(db, t)
    assert entry is not None
    _assert_balanced(db, entry)


def test_remittance_with_profit_balances_and_books_revenue(db):
    cid, usd, trly, a_usd, a_try = _seed_company(db)
    t = _txn(db, cid, TxnType.remittance,
             [(a_usd, usd, Decimal("1000"), Decimal("1000"), LegType.incoming),
              (a_try, trly, Decimal("900"), Decimal("900"), LegType.outgoing)],
             profit_usd=Decimal("100"))
    entry = posting.post_transaction(db, t)
    _assert_balanced(db, entry)
    from app.models.accounting import AccountMapping, AccountRole
    fx = db.query(AccountMapping).filter(AccountMapping.company_id == cid, AccountMapping.role == AccountRole.fx_profit).first()
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    assert any(str(l.coa_account_id) == str(fx.coa_account_id) and Decimal(str(l.credit_usd)) == Decimal("100") for l in lines)


def test_post_is_idempotent(db):
    cid, usd, trly, a_usd, a_try = _seed_company(db)
    t = _txn(db, cid, TxnType.deposit,
             [(a_usd, usd, Decimal("500"), Decimal("500"), LegType.incoming)])
    e1 = posting.post_transaction(db, t)
    e2 = posting.post_transaction(db, t)
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
    orig = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    mirror = db.query(JournalLine).filter(JournalLine.entry_id == rev.id).all()
    assert sum(Decimal(str(l.debit_usd)) for l in orig) == sum(Decimal(str(l.credit_usd)) for l in mirror)
