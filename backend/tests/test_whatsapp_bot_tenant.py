"""WhatsApp bot must scope data to a single company (one shared number)."""
import uuid
from decimal import Decimal
from datetime import date
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa
from app.models.master import Company, Location, Currency, Account, AccountType
from app.models.transaction import Transaction, TransactionLeg, TxnType, TxnStatus, LegType
from app.services import whatsapp_bot


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def _usd(db):
    c = db.query(Currency).filter(Currency.code == "USD").first()
    if not c:
        c = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
        db.add(c); db.commit()
    return c


def _company(db, name, code, opening=Decimal("0")):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name=name, code=code))
    usd = _usd(db)
    loc = Location(id=uuid.uuid4(), code=f"L{code[:3]}", name_tr=name, name_ar="x", name_en="x", company_id=cid)
    db.add(loc)
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id,
                  account_type=AccountType.cash, name=f"{name} Kasa", company_id=cid,
                  opening_balance=opening)
    db.add(acc); db.commit()
    return cid, acc


def test_company_id_prefers_safiron(db):
    _company(db, "Other", "OTHER")
    saf_cid, _ = _company(db, "Safiron Global", "SAFIRON")
    assert whatsapp_bot._company_id(db) == saf_cid


def test_bakiye_scoped_to_company(db):
    saf_cid, saf_acc = _company(db, "Safiron Global", "SAFIRON", opening=Decimal("100"))
    other_cid, other_acc = _company(db, "Other Co", "OTHER", opening=Decimal("999"))
    out = whatsapp_bot._bakiye(db, saf_cid)
    assert "Safiron Global" in out          # target company's location shown
    assert "Other Co" not in out            # no cross-tenant location
    assert "999" not in out                 # no cross-tenant balance leaked


def test_son_islemler_scoped(db):
    saf_cid, saf_acc = _company(db, "Safiron Global", "SAFIRON")
    other_cid, other_acc = _company(db, "Other Co", "OTHER")
    # an Other-company transaction must not appear for Safiron
    t = Transaction(id=uuid.uuid4(), txn_number="OTHER-1", txn_date=date.today(), value_date=date.today(),
                    txn_type=TxnType.deposit, status=TxnStatus.completed, created_by=uuid.uuid4(),
                    company_id=other_cid)
    db.add(t); db.commit()
    out = whatsapp_bot._son_islemler(db, company_id=saf_cid)
    assert "OTHER-1" not in out
