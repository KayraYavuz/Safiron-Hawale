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
from app.models.master import Company
from app.models.accounting import ChartOfAccount, AccountMapping, AccountRole
from app.api.users import companies_router


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    su = User(id=uuid.uuid4(), name="Root", email="root@x.co", hashed_password="x", role=UserRole.super_admin)
    s.add(su); s.commit()
    app = FastAPI()
    app.include_router(companies_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: su
    c = TestClient(app)
    c._s = s
    yield c
    s.close()


def test_create_company_auto_inits_chart(client):
    r = client.post("/api/companies", json={
        "name": "Yeni AŞ", "code": "YENI", "admin_name": "Ali",
        "admin_email": "ali@yeni.co", "admin_password": "secret1",
    })
    assert r.status_code == 200
    cid = r.json()["id"]
    s = client._s
    assert s.query(ChartOfAccount).filter(ChartOfAccount.company_id == cid).count() > 10
    assert s.query(AccountMapping).filter(AccountMapping.company_id == cid).count() == len(list(AccountRole))
    co = s.query(Company).filter(Company.id == cid).first()
    assert co.accounting_scheme == "thp"


def test_create_company_respects_scheme(client):
    r = client.post("/api/companies", json={
        "name": "Intl Co", "code": "INTLCO", "admin_name": "Bob",
        "admin_email": "bob@intl.co", "admin_password": "secret1", "accounting_scheme": "intl",
    })
    assert r.status_code == 200
    cid = r.json()["id"]
    co = client._s.query(Company).filter(Company.id == cid).first()
    assert co.accounting_scheme == "intl"
