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
from app.models.master import Company, Location, Currency, Account, AccountType
from app.models.transaction import Transaction, TransactionLeg, TransactionPnL, TxnType, TxnStatus, LegType
from app.services.accounting_seed import initialize_chart
from app.services import posting
from app.api.statements import router as statements_router


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    s.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    s.add(loc)
    admin = User(id=uuid.uuid4(), name="A", email="a@a.co", hashed_password="x", role=UserRole.admin, company_id=cid)
    s.add(admin); s.commit()
    initialize_chart(s, cid, "thp")
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="Kasa", company_id=cid)
    s.add(acc); s.commit()
    t = Transaction(id=uuid.uuid4(), txn_number="T1", txn_date=date.today(), value_date=date.today(),
                    txn_type=TxnType.deposit, status=TxnStatus.completed, created_by=admin.id, company_id=cid)
    s.add(t); s.flush()
    s.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=acc.id,
                         currency_id=usd.id, amount=Decimal("500"), amount_usd=Decimal("500"), rate_usd=Decimal("1")))
    s.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"), commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
    s.commit()
    posting.post_transaction(s, t); s.commit()
    app = FastAPI()
    app.include_router(statements_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    yield TestClient(app)
    s.close()


def test_trial_balance_endpoint(client):
    r = client.get("/api/accounting/trial-balance")
    assert r.status_code == 200
    body = r.json()
    assert body["total_debit"] == body["total_credit"]


def test_balance_sheet_endpoint(client):
    r = client.get("/api/accounting/balance-sheet")
    assert r.status_code == 200
    assert "total_assets" in r.json()


def test_income_statement_endpoint(client):
    r = client.get("/api/accounting/income-statement-gl", params={"start": "2000-01-01", "end": str(date.today())})
    assert r.status_code == 200
    assert "net" in r.json()


@pytest.fixture
def client_cp():
    """Client with a counterparty that has an open payable (deposit with counterparty)."""
    from app.models.master import Counterparty, CounterpartyType
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO"))
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    s.add(usd)
    loc = Location(id=uuid.uuid4(), code="IST", name_tr="x", name_ar="x", name_en="x", company_id=cid)
    s.add(loc)
    admin = User(id=uuid.uuid4(), name="A", email="a@a.co", hashed_password="x", role=UserRole.admin, company_id=cid)
    s.add(admin); s.commit()
    initialize_chart(s, cid, "thp")
    acc = Account(id=uuid.uuid4(), location_id=loc.id, currency_id=usd.id, account_type=AccountType.cash, name="Kasa", company_id=cid)
    cp = Counterparty(id=uuid.uuid4(), code="CP1", name="Dubai", type=CounterpartyType.supplier, company_id=cid)
    s.add_all([acc, cp]); s.commit()
    t = Transaction(id=uuid.uuid4(), txn_number="T1", txn_date=date.today(), value_date=date.today(),
                    txn_type=TxnType.deposit, status=TxnStatus.completed, counterparty_id=cp.id,
                    created_by=admin.id, company_id=cid)
    s.add(t); s.flush()
    s.add(TransactionLeg(id=uuid.uuid4(), transaction_id=t.id, leg_type=LegType.incoming, account_id=acc.id,
                         currency_id=usd.id, amount=Decimal("500"), amount_usd=Decimal("500"), rate_usd=Decimal("1")))
    s.add(TransactionPnL(transaction_id=t.id, profit_usd=Decimal("0"), commission_usd=Decimal("0"), net_pnl_usd=Decimal("0")))
    s.commit()
    posting.post_transaction(s, t); s.commit()
    app = FastAPI()
    app.include_router(statements_router)
    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app)
    client.cp_id = str(cp.id)
    client.acc_id = str(acc.id)
    yield client
    s.close()


def test_correspondent_positions_endpoint(client_cp):
    r = client_cp.get("/api/accounting/correspondent-positions")
    assert r.status_code == 200
    body = r.json()
    row = next(x for x in body["rows"] if x["counterparty_id"] == client_cp.cp_id)
    assert row["direction"] == "payable"
    assert float(row["net_usd"]) == -500


def test_settle_endpoint_full(client_cp):
    r = client_cp.post("/api/accounting/settle", json={
        "counterparty_id": client_cp.cp_id, "till_account_id": client_cp.acc_id,
    })
    assert r.status_code == 200, r.text
    assert r.json()["direction"] == "payable"
    # now fully settled → gone from positions
    pos = client_cp.get("/api/accounting/correspondent-positions").json()
    assert all(x["counterparty_id"] != client_cp.cp_id for x in pos["rows"])


def test_settle_endpoint_no_balance_400(client_cp):
    from app.models.master import Counterparty, CounterpartyType
    r = client_cp.post("/api/accounting/settle", json={
        "counterparty_id": str(uuid.uuid4()), "till_account_id": client_cp.acc_id,
    })
    assert r.status_code == 404  # unknown counterparty
