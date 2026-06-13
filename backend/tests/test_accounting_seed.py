from tests.conftest_db import db, company_id  # noqa: F401
from app.models.accounting import ChartOfAccount, AccountMapping, AccountRole
from app.services.accounting_seed import initialize_chart


def test_initialize_creates_tree_and_mappings(db, company_id):
    result = initialize_chart(db, company_id, "thp")
    accounts = db.query(ChartOfAccount).filter(ChartOfAccount.company_id == company_id).all()
    assert len(accounts) > 10
    # parents resolved
    children = [a for a in accounts if a.parent_id is not None]
    assert children, "expected child accounts with parent_id set"
    # all 14 roles mapped
    maps = db.query(AccountMapping).filter(AccountMapping.company_id == company_id).all()
    assert len(maps) == len(list(AccountRole))
    # company scheme set
    from app.models.master import Company
    co = db.query(Company).filter(Company.id == company_id).first()
    assert co.accounting_scheme == "thp"


def test_initialize_is_idempotent(db, company_id):
    initialize_chart(db, company_id, "thp")
    first = db.query(ChartOfAccount).filter(ChartOfAccount.company_id == company_id).count()
    # second call must not duplicate
    initialize_chart(db, company_id, "thp")
    second = db.query(ChartOfAccount).filter(ChartOfAccount.company_id == company_id).count()
    assert first == second


def test_mapping_points_to_postable_leaf(db, company_id):
    initialize_chart(db, company_id, "intl")
    maps = db.query(AccountMapping).filter(AccountMapping.company_id == company_id).all()
    for m in maps:
        acc = db.query(ChartOfAccount).filter(ChartOfAccount.id == m.coa_account_id).first()
        assert acc is not None
        assert acc.is_postable is True
