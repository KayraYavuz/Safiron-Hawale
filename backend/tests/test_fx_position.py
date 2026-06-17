"""Tests for the FX position report (net monetary position per currency)."""
import uuid
from decimal import Decimal
from datetime import date
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa
from app.models.master import Company, Currency
from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalSourceType, JournalStatus,
    AccountType, AccountScheme,
)
from app.services import fx_position as fx

ZERO = Decimal("0")


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def _setup(db):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO"))
    cur = {}
    for code in ("USD", "TRY", "EUR", "GBP"):
        c = Currency(id=uuid.uuid4(), code=code, name_tr=code, name_ar=code, name_en=code)
        cur[code] = c
        db.add(c)
    accs = {}
    for code, atype, scheme_code in [("cash", AccountType.asset, "100"),
                                     ("payable", AccountType.liability, "335"),
                                     ("revenue", AccountType.revenue, "602")]:
        a = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code=scheme_code, name_tr=code,
                           name_ar=code, name_en=code, account_type=atype, is_postable=True,
                           scheme=AccountScheme.thp)
        accs[code] = a
        db.add(a)
    db.commit()
    return cid, cur, accs


def _line(db, cid, acc, ccy, debit, credit, debit_usd, credit_usd):
    e = JournalEntry(id=uuid.uuid4(), company_id=cid, entry_number=f"JE-{uuid.uuid4().hex[:6]}",
                     entry_date=date.today(), source_type=JournalSourceType.transaction,
                     status=JournalStatus.posted)
    db.add(e); db.flush()
    db.add(JournalLine(id=uuid.uuid4(), entry_id=e.id, coa_account_id=acc.id, currency_id=ccy.id,
                       debit=debit, credit=credit, rate_usd=Decimal("1"),
                       debit_usd=debit_usd, credit_usd=credit_usd))
    db.commit()


def test_net_position_booked_and_current_usd(db):
    cid, cur, accs = _setup(db)
    # hold 340,000 TRY cash (booked at 10,000 USD)
    _line(db, cid, accs["cash"], cur["TRY"], Decimal("340000"), ZERO, Decimal("10000"), ZERO)
    # owe 5,000 EUR (booked at 5,500 USD)
    _line(db, cid, accs["payable"], cur["EUR"], ZERO, Decimal("5000"), ZERO, Decimal("5500"))
    # revenue line in GBP must be EXCLUDED (not a position)
    _line(db, cid, accs["revenue"], cur["GBP"], ZERO, Decimal("800"), ZERO, Decimal("1000"))

    rates = {"USD": Decimal("1"), "TRY": Decimal("40"), "EUR": Decimal("0.90")}  # rate_per_usd
    out = fx.fx_position(db, cid, rates=rates)
    rows = {r["currency"]: r for r in out["rows"]}

    assert "GBP" not in rows                       # revenue excluded
    assert rows["TRY"]["net_position"] == Decimal("340000")
    assert rows["TRY"]["booked_usd"] == Decimal("10000")
    assert rows["TRY"]["current_usd"] == Decimal("8500")   # 340000 / 40
    assert rows["TRY"]["unrealized_fx"] == Decimal("-1500")  # 8500 - 10000
    assert rows["TRY"]["side"] == "long"

    assert rows["EUR"]["net_position"] == Decimal("-5000")
    assert rows["EUR"]["booked_usd"] == Decimal("-5500")
    assert rows["EUR"]["current_usd"] == Decimal("-5000") / Decimal("0.90")
    assert rows["EUR"]["side"] == "short"


def test_currency_without_rate_has_null_current(db):
    cid, cur, accs = _setup(db)
    _line(db, cid, accs["cash"], cur["TRY"], Decimal("100"), ZERO, Decimal("3"), ZERO)
    out = fx.fx_position(db, cid, rates={"USD": Decimal("1")})  # no TRY rate
    row = next(r for r in out["rows"] if r["currency"] == "TRY")
    assert row["has_rate"] is False
    assert row["current_usd"] is None and row["unrealized_fx"] is None
    # excluded from totals
    assert out["total_current_usd"] == ZERO


def test_zero_net_position_is_skipped(db):
    cid, cur, accs = _setup(db)
    _line(db, cid, accs["cash"], cur["TRY"], Decimal("100"), Decimal("100"), Decimal("3"), Decimal("3"))
    out = fx.fx_position(db, cid, rates={"TRY": Decimal("40")})
    assert all(r["currency"] != "TRY" for r in out["rows"])
