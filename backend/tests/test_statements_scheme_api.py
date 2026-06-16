"""API-level tests for the ?scheme= dual-reporting param on statement endpoints."""
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
    ChartOfAccount, AccountMapping, AccountType, AccountScheme, AccountRole,
    JournalEntry, JournalLine, JournalSourceType, JournalStatus,
)
from app.api.statements import router

ZERO = Decimal("0")


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO", accounting_scheme="thp"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    cash = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="100", name_tr="Kasa", name_ar="x",
                          name_en="Cash", account_type=AccountType.asset, is_postable=True, scheme=AccountScheme.thp)
    comm = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="602", name_tr="Komisyon", name_ar="x",
                          name_en="Commission", account_type=AccountType.revenue, is_postable=True, scheme=AccountScheme.thp)
    db.add_all([usd, cash, comm])
    db.add(AccountMapping(id=uuid.uuid4(), company_id=cid, role=AccountRole.cash, coa_account_id=cash.id))
    db.add(AccountMapping(id=uuid.uuid4(), company_id=cid, role=AccountRole.commission_income, coa_account_id=comm.id))
    e = JournalEntry(id=uuid.uuid4(), company_id=cid, entry_number="JE-1", entry_date=date.today(),
                     source_type=JournalSourceType.transaction, status=JournalStatus.posted)
    db.add(e); db.flush()
    db.add(JournalLine(id=uuid.uuid4(), entry_id=e.id, coa_account_id=cash.id, debit=Decimal("1000"),
                       credit=ZERO, currency_id=usd.id, rate_usd=Decimal("1"), debit_usd=Decimal("1000"), credit_usd=ZERO))
    db.add(JournalLine(id=uuid.uuid4(), entry_id=e.id, coa_account_id=comm.id, debit=ZERO,
                       credit=Decimal("1000"), currency_id=usd.id, rate_usd=Decimal("1"), debit_usd=ZERO, credit_usd=Decimal("1000")))
    db.commit()

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(company_id=cid)
    yield TestClient(app)
    db.close()


def test_trial_balance_native_scheme(client):
    r = client.get("/api/accounting/trial-balance")
    assert r.status_code == 200
    assert {row["code"] for row in r.json()["rows"]} == {"100", "602"}


def test_trial_balance_intl_scheme(client):
    r = client.get("/api/accounting/trial-balance?scheme=intl")
    assert r.status_code == 200
    assert {row["code"] for row in r.json()["rows"]} == {"1010", "4020"}


def test_invalid_scheme_returns_400(client):
    r = client.get("/api/accounting/trial-balance?scheme=xxx")
    assert r.status_code == 400


def test_balance_sheet_and_income_accept_scheme(client):
    bs = client.get("/api/accounting/balance-sheet?scheme=intl")
    assert bs.status_code == 200
    assert {row["code"] for row in bs.json()["assets"]} == {"1010"}
    inc = client.get("/api/accounting/income-statement-gl?start=2000-01-01&end=2100-01-01&scheme=intl")
    assert inc.status_code == 200
    assert {row["code"] for row in inc.json()["revenue"]} == {"4020"}
