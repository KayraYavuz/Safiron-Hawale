import uuid
from decimal import Decimal
from datetime import date
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa
from app.models.master import Company, Currency
from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalSourceType, JournalStatus, AccountType, AccountScheme,
)
from app.services import reconciliation_gl as recon


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
    acc = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="102", name_tr="Bankalar", name_ar="x", name_en="Banks",
                         account_type=AccountType.asset, is_postable=True, scheme=AccountScheme.thp)
    db.add(acc); db.commit()
    return cid, usd, acc


def _line(db, cid, acc, usd, debit, credit):
    e = JournalEntry(id=uuid.uuid4(), company_id=cid, entry_number=f"JE-{uuid.uuid4().hex[:6]}", entry_date=date.today(),
                     source_type=JournalSourceType.transaction, status=JournalStatus.posted)
    db.add(e); db.flush()
    ln = JournalLine(id=uuid.uuid4(), entry_id=e.id, coa_account_id=acc.id, debit=debit, credit=credit,
                     currency_id=usd.id, rate_usd=Decimal("1"), debit_usd=debit, credit_usd=credit)
    db.add(ln); db.commit()
    return ln


def test_view_balances(db):
    cid, usd, acc = _setup(db)
    _line(db, cid, acc, usd, Decimal("1000"), Decimal("0"))
    l2 = _line(db, cid, acc, usd, Decimal("0"), Decimal("300"))
    recon.toggle(db, cid, l2.id, True); db.commit()
    view = recon.reconcile_view(db, cid, acc.id)
    assert view["book_balance"] == Decimal("700")           # 1000 - 300
    assert view["reconciled_balance"] == Decimal("-300")    # only the reconciled credit line
    assert view["unreconciled_balance"] == Decimal("1000")
    assert len(view["lines"]) == 2


def test_toggle_sets_flag(db):
    cid, usd, acc = _setup(db)
    l1 = _line(db, cid, acc, usd, Decimal("500"), Decimal("0"))
    recon.toggle(db, cid, l1.id, True); db.commit()
    db.refresh(l1)
    assert l1.reconciled is True and l1.reconciled_at is not None
    recon.toggle(db, cid, l1.id, False); db.commit()
    db.refresh(l1)
    assert l1.reconciled is False and l1.reconciled_at is None
