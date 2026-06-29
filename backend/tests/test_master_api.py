"""Tenant-isolation regression tests for master data API (locations, accounts, counterparties)."""
import uuid
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
from app.models.master import Company, Location, Currency, Account, AccountType, Counterparty
from app.api.master import router as master_router


@pytest.fixture
def env():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    # Two companies
    c1, c2 = uuid.uuid4(), uuid.uuid4()
    s.add_all([Company(id=c1, name="A", code="A"), Company(id=c2, name="B", code="B")])
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    s.add(usd)
    loc2 = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=c2)
    s.add(loc2)
    admin1 = User(id=uuid.uuid4(), name="A1", email="a1@a.co", hashed_password="x", role=UserRole.admin, company_id=c1)
    s.add(admin1); s.commit()
    app = FastAPI()
    app.include_router(master_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin1
    client = TestClient(app)
    client.c1, client.c2, client.usd_id, client.loc2_id = str(c1), str(c2), str(usd.id), str(loc2.id)
    yield client, s
    s.close()


def test_location_code_unique_per_company_not_global(env):
    client, s = env
    # Company B already uses "IST"; company A's admin must still be able to use "IST".
    r = client.post("/api/locations", json={"code": "IST", "name_tr": "Istanbul"})
    assert r.status_code == 200, r.text
    assert r.json()["code"] == "IST"


def test_create_account_rejects_other_company_location(env):
    client, s = env
    # loc2 belongs to company B; company A's admin cannot attach an account to it.
    r = client.post("/api/accounts", json={
        "location_id": client.loc2_id, "currency_id": client.usd_id,
        "account_type": "cash", "name": "Hack",
    })
    assert r.status_code == 400


def test_account_balance_tenant_isolated(env):
    client, s = env
    # An account in company B is invisible to company A's balance endpoint.
    accB = Account(id=uuid.uuid4(), location_id=uuid.UUID(client.loc2_id),
                   currency_id=uuid.UUID(client.usd_id), account_type=AccountType.cash,
                   name="B Kasa", company_id=uuid.UUID(client.c2))
    s.add(accB); s.commit()
    r = client.get(f"/api/accounts/{accB.id}/balance")
    assert r.status_code == 404


def test_counterparty_code_is_per_company(env):
    client, s = env
    # Pre-seed many counterparties in company B; company A's first code should be ...00001.
    for i in range(3):
        s.add(Counterparty(id=uuid.uuid4(), code=f"CP-2026-{i:05d}", name=f"B{i}", company_id=uuid.UUID(client.c2)))
    s.commit()
    r = client.post("/api/counterparties", json={"name": "First A", "type": "supplier"})
    assert r.status_code == 200, r.text
    assert r.json()["code"].endswith("00001")
