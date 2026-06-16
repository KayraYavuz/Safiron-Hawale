"""Tests for THP/IFRS dual-scheme reporting crosswalk."""
import uuid
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa
from app.models.master import Company
from datetime import date
from app.models.master import Currency
from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountType, AccountScheme, AccountRole,
    JournalEntry, JournalLine, JournalSourceType, JournalStatus,
)
from app.services import scheme_crosswalk as cw
from app.services import statements


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine)()
    try:
        yield s
    finally:
        s.close()


def test_scheme_index_loads_role_to_account():
    thp = cw.scheme_index("thp")
    intl = cw.scheme_index("intl")
    # cash role maps to 100 in THP and 1010 in INTL, with metadata from the chart
    assert thp["cash"]["code"] == "100"
    assert thp["cash"]["account_type"] == "asset"
    assert thp["cash"]["name_tr"] == "Kasa"
    assert intl["cash"]["code"] == "1010"
    assert intl["cash"]["account_type"] == "asset"
    # commission income lands on the revenue account in both schemes
    assert thp["commission_income"]["code"] == "602"
    assert intl["commission_income"]["code"] == "4020"


def _company_with_mappings(db):
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO"))
    a_cash = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="100", name_tr="Kasa",
                            name_ar="x", name_en="Cash", account_type=AccountType.asset,
                            is_postable=True, scheme=AccountScheme.thp)
    a_comm = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="602", name_tr="Komisyon",
                            name_ar="x", name_en="Commission", account_type=AccountType.revenue,
                            is_postable=True, scheme=AccountScheme.thp)
    db.add_all([a_cash, a_comm])
    db.add(AccountMapping(id=uuid.uuid4(), company_id=cid, role=AccountRole.cash, coa_account_id=a_cash.id))
    db.add(AccountMapping(id=uuid.uuid4(), company_id=cid, role=AccountRole.commission_income, coa_account_id=a_comm.id))
    db.commit()
    return cid, str(a_cash.id), str(a_comm.id)


def test_reverse_roles_inverts_account_mappings(db):
    cid, cash_id, comm_id = _company_with_mappings(db)
    rev = cw.reverse_roles(db, cid)
    assert rev[cash_id] == "cash"
    assert rev[comm_id] == "commission_income"


def test_reverse_roles_resolves_child_tills_to_parent_role(db):
    """Real postings hit per-till leaf accounts (100.01) under the role-mapped
    parent (100/cash); the leaf must inherit the parent's role."""
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO"))
    parent = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="100", name_tr="Kasa", name_ar="x",
                            name_en="Cash", account_type=AccountType.asset, is_postable=False, scheme=AccountScheme.thp)
    db.add(parent); db.flush()
    child = ChartOfAccount(id=uuid.uuid4(), company_id=cid, code="100.01", name_tr="Till", name_ar="x",
                           name_en="Till", account_type=AccountType.asset, is_postable=True,
                           scheme=AccountScheme.thp, parent_id=parent.id)
    db.add(child)
    db.add(AccountMapping(id=uuid.uuid4(), company_id=cid, role=AccountRole.cash, coa_account_id=parent.id))
    db.commit()
    rev = cw.reverse_roles(db, cid)
    assert rev[str(parent.id)] == "cash"
    assert rev[str(child.id)] == "cash"  # leaf inherits the parent's role


def test_reverse_roles_survives_a_parent_cycle(db):
    """A corrupt parent_id cycle must terminate (no hang) and leave the nodes
    unresolved (they fall to the UNMAPPED bucket downstream)."""
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Co", code="CO"))
    a_id, b_id = uuid.uuid4(), uuid.uuid4()
    a = ChartOfAccount(id=a_id, company_id=cid, code="A", name_tr="A", name_ar="A", name_en="A",
                       account_type=AccountType.asset, is_postable=True, scheme=AccountScheme.thp, parent_id=b_id)
    b = ChartOfAccount(id=b_id, company_id=cid, code="B", name_tr="B", name_ar="B", name_en="B",
                       account_type=AccountType.asset, is_postable=True, scheme=AccountScheme.thp, parent_id=a_id)
    db.add_all([a, b]); db.commit()
    rev = cw.reverse_roles(db, cid)  # must not hang
    assert str(a_id) not in rev and str(b_id) not in rev


def test_remap_pivots_on_role_into_target_scheme(db):
    cid, cash_id, comm_id = _company_with_mappings(db)
    rev = cw.reverse_roles(db, cid)
    target = cw.scheme_index("intl")
    agg = {
        cash_id: (Decimal("1000"), Decimal("0")),
        comm_id: (Decimal("0"), Decimal("200")),
        "unknown-acc": (Decimal("50"), Decimal("0")),  # no role → UNMAPPED
    }
    agg2, accs2 = cw.remap(agg, rev, target)
    # cash → INTL 1010
    assert agg2["cash"] == (Decimal("1000"), Decimal("0"))
    assert accs2["cash"].code == "1010"
    assert accs2["cash"].account_type == AccountType.asset
    # commission_income → INTL 4020
    assert agg2["commission_income"] == (Decimal("0"), Decimal("200"))
    assert accs2["commission_income"].code == "4020"
    # unmapped line preserved in UNMAPPED bucket (keeps statement balanced)
    assert agg2["UNMAPPED"] == (Decimal("50"), Decimal("0"))
    assert accs2["UNMAPPED"].code == "—"


def test_remap_sums_multiple_accounts_sharing_a_role(db):
    target = cw.scheme_index("intl")
    rev = {"a1": "cash", "a2": "cash"}
    agg = {"a1": (Decimal("100"), Decimal("0")), "a2": (Decimal("30"), Decimal("5"))}
    agg2, accs2 = cw.remap(agg, rev, target)
    assert agg2["cash"] == (Decimal("130"), Decimal("5"))


def _thp_company_with_entry(db):
    """A thp company with cash(100)/commission(602), mappings, and one posted entry:
    debit cash 1000, credit commission 1000."""
    cid, cash_id, comm_id = _company_with_mappings(db)
    # mark the company as thp so target_scheme='intl' triggers the crosswalk
    db.query(Company).filter(Company.id == cid).update({"accounting_scheme": "thp"})
    usd = Currency(id=uuid.uuid4(), code="USD", name_tr="d", name_ar="d", name_en="d")
    db.add(usd); db.commit()
    e = JournalEntry(id=uuid.uuid4(), company_id=cid, entry_number="JE-1", entry_date=date.today(),
                     source_type=JournalSourceType.transaction, status=JournalStatus.posted)
    db.add(e); db.flush()
    db.add(JournalLine(id=uuid.uuid4(), entry_id=e.id, coa_account_id=uuid.UUID(cash_id),
                       debit=Decimal("1000"), credit=ZERO, currency_id=usd.id, rate_usd=Decimal("1"),
                       debit_usd=Decimal("1000"), credit_usd=ZERO))
    db.add(JournalLine(id=uuid.uuid4(), entry_id=e.id, coa_account_id=uuid.UUID(comm_id),
                       debit=ZERO, credit=Decimal("1000"), currency_id=usd.id, rate_usd=Decimal("1"),
                       debit_usd=ZERO, credit_usd=Decimal("1000")))
    db.commit()
    return cid


ZERO = Decimal("0")


def test_trial_balance_target_scheme_renders_intl_codes(db):
    cid = _thp_company_with_entry(db)
    native = statements.trial_balance(db, cid)
    intl = statements.trial_balance(db, cid, target_scheme="intl")
    assert {r["code"] for r in native["rows"]} == {"100", "602"}
    assert {r["code"] for r in intl["rows"]} == {"1010", "4020"}
    # totals preserved across the crosswalk; still balanced
    assert intl["total_debit"] == native["total_debit"] == Decimal("1000")
    assert intl["total_credit"] == native["total_credit"] == Decimal("1000")


def test_target_scheme_equal_to_own_is_noop(db):
    cid = _thp_company_with_entry(db)
    a = statements.trial_balance(db, cid)
    b = statements.trial_balance(db, cid, target_scheme="thp")
    assert {r["code"] for r in a["rows"]} == {r["code"] for r in b["rows"]} == {"100", "602"}


def test_income_statement_target_scheme(db):
    cid = _thp_company_with_entry(db)
    intl = statements.income_statement(db, cid, date(2000, 1, 1), date(2100, 1, 1), target_scheme="intl")
    assert {r["code"] for r in intl["revenue"]} == {"4020"}
    assert intl["total_revenue"] == Decimal("1000")
