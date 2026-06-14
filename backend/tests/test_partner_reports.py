import uuid
from decimal import Decimal
from datetime import date, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa
from app.models.master import Company, Currency, Counterparty, CounterpartyType
from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalSourceType, JournalStatus, AccountType, AccountScheme,
)
from app.services import partner_reports


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def _setup(db):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    db.add(usd)
    cp = Counterparty(id=uuid.uuid4(), code="C1", name="Ahmet Bey", type=CounterpartyType.customer, company_id=cid)
    db.add(cp)
    acc = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="120", name_tr="Alıcılar", name_ar="x", name_en="Receivables",
                         account_type=AccountType.asset, is_postable=True, scheme=AccountScheme.thp)
    db.add(acc)
    db.commit()
    return cid, usd, cp, acc


def _entry(db, cid, acc, cp, usd, d, debit, credit):
    e = JournalEntry(id=uuid.uuid4(), company_id=cid, entry_number=f"JE-{uuid.uuid4().hex[:6]}", entry_date=d,
                     source_type=JournalSourceType.transaction, status=JournalStatus.posted)
    db.add(e); db.flush()
    db.add(JournalLine(entry_id=e.id, coa_account_id=acc.id, debit=debit, credit=credit, currency_id=usd.id,
                       rate_usd=Decimal("1"), debit_usd=debit, credit_usd=credit, counterparty_id=cp.id))
    db.commit()
    return e


def test_partner_ledger_running_balance(db):
    cid, usd, cp, acc = _setup(db)
    today = date.today()
    _entry(db, cid, acc, cp, usd, today - timedelta(days=10), Decimal("1000"), Decimal("0"))
    _entry(db, cid, acc, cp, usd, today - timedelta(days=5), Decimal("0"), Decimal("400"))
    pl = partner_reports.partner_ledger(db, cid, cp.id, None, None)
    assert len(pl["lines"]) == 2
    assert pl["closing_usd"] == Decimal("600")  # 1000 debit - 400 credit
    # running balance progresses
    assert pl["lines"][-1]["running_usd"] == Decimal("600")


def test_partner_ledger_opening_balance(db):
    cid, usd, cp, acc = _setup(db)
    today = date.today()
    _entry(db, cid, acc, cp, usd, today - timedelta(days=40), Decimal("500"), Decimal("0"))
    _entry(db, cid, acc, cp, usd, today - timedelta(days=2), Decimal("200"), Decimal("0"))
    pl = partner_reports.partner_ledger(db, cid, cp.id, today - timedelta(days=10), today)
    assert pl["opening_usd"] == Decimal("500")   # the 40-day-old entry is opening
    assert len(pl["lines"]) == 1
    assert pl["closing_usd"] == Decimal("700")


def test_aged_balance_buckets(db):
    cid, usd, cp, acc = _setup(db)
    today = date.today()
    _entry(db, cid, acc, cp, usd, today - timedelta(days=5), Decimal("100"), Decimal("0"))    # current
    _entry(db, cid, acc, cp, usd, today - timedelta(days=45), Decimal("200"), Decimal("0"))   # 31-60
    _entry(db, cid, acc, cp, usd, today - timedelta(days=120), Decimal("300"), Decimal("0"))  # 90+
    aged = partner_reports.aged_balance(db, cid, today)
    row = next(r for r in aged["rows"] if str(r["counterparty_id"]) == str(cp.id))
    assert row["total"] == Decimal("600")
    assert row["current"] == Decimal("100")
    assert row["d31_60"] == Decimal("200")
    assert row["d90_plus"] == Decimal("300")
    assert aged["total"] == Decimal("600")
