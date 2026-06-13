import uuid
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
from app.api.periods import router as periods_router


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
    app.include_router(periods_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    yield TestClient(app)
    s.close()


def test_close_list_reopen(client):
    r = client.post("/api/accounting/periods/close", json={"period_start": "2026-01-01", "period_end": "2026-12-31"})
    assert r.status_code == 200
    pid = r.json()["id"]
    lst = client.get("/api/accounting/periods").json()
    assert any(p["id"] == pid and p["status"] == "closed" for p in lst)
    r2 = client.post(f"/api/accounting/periods/{pid}/reopen")
    assert r2.status_code == 200
    assert r2.json()["status"] == "open"


def test_close_overlap_returns_400(client):
    client.post("/api/accounting/periods/close", json={"period_start": "2026-01-01", "period_end": "2026-06-30"})
    bad = client.post("/api/accounting/periods/close", json={"period_start": "2026-06-01", "period_end": "2026-12-31"})
    assert bad.status_code == 400
