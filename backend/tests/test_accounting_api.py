"""
Accounting API tests.

NOTE: We mount ONLY the accounting router on a throwaway FastAPI app instead of
importing app.main — app.main runs Base.metadata.create_all at import time against
the configured (production) DATABASE_URL, which a test must never touch.
"""
import uuid
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models  # noqa: F401  (registers all tables)
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.master import Company
from app.api.accounting import router as accounting_router


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    s = Session()

    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO"))
    admin = User(id=uuid.uuid4(), name="A", email="a@a.co", hashed_password="x",
                 role=UserRole.admin, company_id=cid)
    s.add(admin)
    s.commit()

    app = FastAPI()
    app.include_router(accounting_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    yield TestClient(app)
    s.close()


def test_initialize_then_list_chart(client):
    r = client.post("/api/accounting/initialize", json={"scheme": "thp"})
    assert r.status_code == 200
    r2 = client.get("/api/accounting/chart")
    assert r2.status_code == 200
    body = r2.json()
    assert len(body) > 10
    codes = {a["code"] for a in body}
    assert "100" in codes  # Kasa


def test_list_mappings_after_init(client):
    client.post("/api/accounting/initialize", json={"scheme": "intl"})
    r = client.get("/api/accounting/mappings")
    assert r.status_code == 200
    roles = {m["role"] for m in r.json()}
    assert "cash" in roles and "fx_profit" in roles


def test_create_custom_account(client):
    client.post("/api/accounting/initialize", json={"scheme": "thp"})
    # 199 is free in the seed (103/108 are now reserved by the default chart)
    r = client.post("/api/accounting/chart", json={
        "code": "199", "name_tr": "Diğer Dönen Varlıklar", "account_type": "asset", "is_postable": True
    })
    assert r.status_code == 200
    assert r.json()["code"] == "199"


def test_mapping_rejects_non_postable(client):
    client.post("/api/accounting/initialize", json={"scheme": "thp"})
    chart = client.get("/api/accounting/chart").json()
    header = next(a for a in chart if not a["is_postable"])
    r = client.put("/api/accounting/mappings", json={
        "role": "cash", "coa_account_id": header["id"]
    })
    assert r.status_code == 400
