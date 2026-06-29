"""Multi-tenant WhatsApp webhook: resolve company by the receiving number."""
import uuid
from decimal import Decimal
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models  # noqa
from app.models.master import Company, Location, Currency, Account, AccountType
import app.api.whatsapp as wa
from app.api.whatsapp import router as whatsapp_router


@pytest.fixture
def env(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    s.add(usd)

    def _co(name, phone_id, opening):
        cid = uuid.uuid4()
        s.add(Company(id=cid, name=name, code=name[:6].upper(), whatsapp_phone_id=phone_id))
        loc = Location(id=uuid.uuid4(), code=name[:3].upper(), name_tr=name, name_ar="x", name_en="x", company_id=cid)
        s.add(loc)
        s.add(Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash,
                      name=f"{name} Kasa", company_id=cid, opening_balance=Decimal(opening)))
        return cid
    _co("Alpha", "PA", "100")
    _co("Beta", "PB", "999")
    s.commit()

    sent = []
    monkeypatch.setattr(wa, "is_allowed_number", lambda phone: True)
    monkeypatch.setattr(wa, "send_message", lambda to, text, phone_id=None, token=None: sent.append((to, text, phone_id)) or True)

    app = FastAPI()
    app.include_router(whatsapp_router)
    app.dependency_overrides[get_db] = lambda: s
    client = TestClient(app)
    client.sent = sent
    yield client
    s.close()


def _payload(phone_id, text):
    return {"entry": [{"changes": [{"value": {
        "metadata": {"phone_number_id": phone_id},
        "messages": [{"from": "905551112233", "type": "text", "text": {"body": text}}],
    }}]}]}


def test_webhook_routes_to_owning_company(env):
    r = env.post("/api/whatsapp/webhook", json=_payload("PA", "bakiye"))
    assert r.status_code == 200
    assert len(env.sent) == 1
    to, reply, phone_id = env.sent[0]
    assert phone_id == "PA"            # reply sent from Alpha's number
    assert "Alpha" in reply            # Alpha's data
    assert "Beta" not in reply         # no cross-tenant leak
    assert "999" not in reply


def test_webhook_unknown_number_ignored(env):
    r = env.post("/api/whatsapp/webhook", json=_payload("UNKNOWN", "bakiye"))
    assert r.status_code == 200
    assert env.sent == []              # nothing sent for an unregistered number
