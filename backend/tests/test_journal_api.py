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
from app.models.master import Company
from app.services.accounting_seed import initialize_chart
from app.api.journal import router as journal_router


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO"))
    admin = User(id=uuid.uuid4(), name="A", email="a@a.co", hashed_password="x", role=UserRole.admin, company_id=cid)
    s.add(admin); s.commit()
    initialize_chart(s, cid, "thp")
    app = FastAPI()
    app.include_router(journal_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    c = TestClient(app)
    yield c
    s.close()


def _two_postable(client):
    accs = client.get("/api/accounting/journal/postable-accounts").json()
    return accs[0]["id"], accs[1]["id"]


def test_manual_entry_must_balance(client):
    a, b = _two_postable(client)
    bad = client.post("/api/accounting/journal", json={
        "entry_date": str(date.today()), "memo": "x",
        "lines": [{"coa_account_id": a, "debit_usd": "100"},
                  {"coa_account_id": b, "credit_usd": "90"}]})
    assert bad.status_code == 400


def test_manual_entry_creates_balanced(client):
    a, b = _two_postable(client)
    ok = client.post("/api/accounting/journal", json={
        "entry_date": str(date.today()), "memo": "x",
        "lines": [{"coa_account_id": a, "debit_usd": "100"},
                  {"coa_account_id": b, "credit_usd": "100"}]})
    assert ok.status_code == 200
    eid = ok.json()["id"]
    lst = client.get("/api/accounting/journal").json()
    assert any(e["id"] == eid for e in lst)


def test_void_endpoint(client):
    a, b = _two_postable(client)
    eid = client.post("/api/accounting/journal", json={
        "entry_date": str(date.today()),
        "lines": [{"coa_account_id": a, "debit_usd": "50"},
                  {"coa_account_id": b, "credit_usd": "50"}]}).json()["id"]
    r = client.post(f"/api/accounting/journal/{eid}/void")
    assert r.status_code == 200
