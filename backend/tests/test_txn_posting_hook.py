import uuid
from decimal import Decimal
from datetime import date
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models  # noqa
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.master import Company, Location, Currency, Account, AccountType
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, TxnType, TxnStatus, LegType
from app.models.accounting import JournalEntry, JournalStatus
from app.services.accounting_seed import initialize_chart
from app.api.transactions import router as txn_router


@pytest.fixture
def ctx():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    s.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    s.add(loc)
    admin = User(id=uuid.uuid4(), name="A", email="a@a.co", hashed_password="x", role=UserRole.admin, company_id=cid)
    s.add(admin)
    s.commit()
    initialize_chart(s, cid, "thp")
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="Kasa", company_id=cid)
    s.add(acc)
    s.commit()
    t = Transaction(id=uuid.uuid4(), txn_number="T-1", txn_date=date.today(), value_date=date.today(),
                    txn_type=TxnType.deposit, status=TxnStatus.pending, created_by=admin.id, company_id=cid)
    s.add(t); s.flush()
    s.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=acc.id,
                         currency_id=usd.id, amount=Decimal("500"), amount_usd=Decimal("500"), rate_usd=Decimal("1")))
    s.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"), commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
    s.commit()

    app = FastAPI()
    app.include_router(txn_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    return TestClient(app), s, t


def test_approve_posts_entry(ctx):
    client, s, t = ctx
    r = client.patch(f"/api/transactions/{t.id}/approve")
    assert r.status_code == 200
    entry = s.query(JournalEntry).filter(JournalEntry.source_id == t.id, JournalEntry.status == JournalStatus.posted).first()
    assert entry is not None


def test_delete_voids_entry(ctx):
    client, s, t = ctx
    client.patch(f"/api/transactions/{t.id}/approve")
    r = client.delete(f"/api/transactions/{t.id}")
    assert r.status_code == 200
    # Reversal semantics: original entry flips to void, a reversal entry is
    # created (itself posted) — so exactly one void + one posted reversal.
    entries = s.query(JournalEntry).filter(JournalEntry.source_id == t.id).all()
    assert len(entries) == 2
    assert sorted(e.status.value for e in entries) == ["posted", "void"]
    original = next(e for e in entries if e.status == JournalStatus.void)
    assert original.reversed_by_id is not None
