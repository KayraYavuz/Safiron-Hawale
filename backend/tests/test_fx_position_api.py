"""API tests for GET /api/accounting/fx-position."""
import uuid
from types import SimpleNamespace
from decimal import Decimal
from datetime import date
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
import app.models  # noqa
from app.models.master import Company, Currency
from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalSourceType, JournalStatus,
    AccountType, AccountScheme,
)
from app.api.statements import router

ZERO = Decimal("0")


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO", accounting_scheme="thp"))
    try_ = Currency(id=uuid.uuid4(), code="TRY", name_tr="TRY", name_ar="TRY", name_en="TRY")
    cash = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="100", name_tr="Kasa", name_ar="x",
                          name_en="Cash", account_type=AccountType.asset, is_postable=True, scheme=AccountScheme.thp)
    db.add_all([try_, cash])
    e = JournalEntry(id=uuid.uuid4(), company_id=cid, entry_number="JE-1", entry_date=date.today(),
                     source_type=JournalSourceType.transaction, status=JournalStatus.posted)
    db.add(e); db.flush()
    db.add(JournalLine(id=uuid.uuid4(), entry_id=e.id, coa_account_id=cash.id, currency_id=try_.id,
                       debit=Decimal("340000"), credit=ZERO, rate_usd=Decimal("1"),
                       debit_usd=Decimal("10000"), credit_usd=ZERO))
    db.commit()

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(company_id=cid)
    yield TestClient(app)
    db.close()


def test_fx_position_returns_rows(client):
    r = client.get("/api/accounting/fx-position")
    assert r.status_code == 200
    rows = r.json()["rows"]
    try_row = next(x for x in rows if x["currency"] == "TRY")
    assert Decimal(str(try_row["net_position"])) == Decimal("340000")
    assert try_row["side"] == "long"


def test_fx_position_csv(client):
    r = client.get("/api/accounting/fx-position?format=csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "TRY" in r.text
