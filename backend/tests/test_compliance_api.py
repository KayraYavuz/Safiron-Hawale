"""API + enforcement tests for the AML/compliance layer."""
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
from app.models.master import Company, Location, Currency, Account, AccountType, Counterparty, CounterpartyType
from app.services.accounting_seed import initialize_chart
from app.models.compliance import ComplianceFlag, ComplianceStatus
from app.api.transactions import router as txn_router
from app.api.compliance import router as compliance_router


class _Ctx:
    user = None  # mutable current user for dependency override


@pytest.fixture
def env():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO", aml_threshold_usd=Decimal("10000"),
                  aml_structuring_window_days=1))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    s.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    s.add(loc)
    admin = User(id=uuid.uuid4(), name="Adm", email="adm@a.co", hashed_password="x", role=UserRole.admin, company_id=cid)
    manager = User(id=uuid.uuid4(), name="Mgr", email="mgr@a.co", hashed_password="x", role=UserRole.manager, company_id=cid)
    acct = User(id=uuid.uuid4(), name="Acc", email="acc@a.co", hashed_password="x", role=UserRole.accounting, company_id=cid)
    s.add_all([admin, manager, acct]); s.commit()
    initialize_chart(s, cid, "thp")
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="Kasa", company_id=cid)
    cp = Counterparty(id=uuid.uuid4(), code="CP1", name="Big Spender", type=CounterpartyType.customer, company_id=cid)
    s.add_all([acc, cp]); s.commit()

    ctx = _Ctx()
    ctx.user = admin
    app = FastAPI()
    app.include_router(txn_router)
    app.include_router(compliance_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: ctx.user
    client = TestClient(app)
    client.s, client.ctx = s, ctx
    client.usd_id, client.acc_id, client.cp_id = str(usd.id), str(acc.id), str(cp.id)
    client.users = {"admin": admin, "manager": manager, "acct": acct}
    yield client
    s.close()


def _create_large_txn(client):
    r = client.post("/api/transactions", json={
        "txn_date": str(date.today()), "value_date": str(date.today()),
        "txn_type": "deposit", "counterparty_id": client.cp_id,
        "legs": [{"leg_type": "in", "account_id": client.acc_id,
                  "currency_id": client.usd_id, "amount": 15000}],
    })
    assert r.status_code == 200, r.text
    return r.json()


def test_large_txn_is_flagged(env):
    client = env
    txn = _create_large_txn(client)
    assert txn["compliance_flagged"] is True
    flags = client.get("/api/compliance/flags").json()
    assert any(f["transaction_id"] == txn["id"] and f["rule"] == "amount" for f in flags)


def test_accounting_cannot_approve_flagged(env):
    client = env
    txn = _create_large_txn(client)
    client.ctx.user = client.users["acct"]
    r = client.patch(f"/api/transactions/{txn['id']}/approve")
    assert r.status_code == 403


def test_manager_approves_and_clears_flag(env):
    client = env
    txn = _create_large_txn(client)
    client.ctx.user = client.users["manager"]
    r = client.patch(f"/api/transactions/{txn['id']}/approve")
    assert r.status_code == 200, r.text
    # flag now cleared
    open_flags = client.get("/api/compliance/flags", params={"status": "open"}).json()
    assert all(f["transaction_id"] != txn["id"] for f in open_flags)


def test_watchlist_crud_and_settings(env):
    client = env
    # add
    r = client.post("/api/compliance/watchlist", json={"name": "Bad Actor", "reason": "OFAC"})
    assert r.status_code == 200
    wl_id = r.json()["id"]
    assert any(w["id"] == wl_id for w in client.get("/api/compliance/watchlist").json())
    # delete
    assert client.delete(f"/api/compliance/watchlist/{wl_id}").status_code == 200
    assert all(w["id"] != wl_id for w in client.get("/api/compliance/watchlist").json())
    # settings
    r = client.put("/api/compliance/settings", json={"aml_threshold_usd": "5000", "aml_structuring_window_days": 3})
    assert r.status_code == 200
    s = client.get("/api/compliance/settings").json()
    assert s["aml_structuring_window_days"] == 3


def test_watchlist_admin_only(env):
    client = env
    client.ctx.user = client.users["acct"]
    r = client.post("/api/compliance/watchlist", json={"name": "X"})
    assert r.status_code == 403


def test_clear_flag_endpoint(env):
    client = env
    txn = _create_large_txn(client)
    flags = client.get("/api/compliance/flags").json()
    fid = next(f["id"] for f in flags if f["transaction_id"] == txn["id"])
    client.ctx.user = client.users["manager"]
    r = client.post(f"/api/compliance/flags/{fid}/clear", json={"note": "reviewed"})
    assert r.status_code == 200
    assert client.s.query(ComplianceFlag).get(uuid.UUID(fid)).status == ComplianceStatus.cleared
