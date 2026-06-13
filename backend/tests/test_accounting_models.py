from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountType, AccountScheme, AccountRole,
)


def test_account_type_values():
    assert {t.value for t in AccountType} == {
        "asset", "liability", "equity", "revenue", "expense"
    }


def test_account_scheme_values():
    assert {s.value for s in AccountScheme} == {"thp", "intl"}


def test_account_role_has_core_roles():
    vals = {r.value for r in AccountRole}
    for required in (
        "cash", "bank", "crypto", "customer_receivable", "customer_payable",
        "supplier_receivable", "supplier_payable", "fx_profit", "fx_loss",
        "commission_income", "retained_earnings", "opening_balance_equity",
        "internal_transfer_clearing", "rounding",
    ):
        assert required in vals


def test_chart_of_account_table_columns():
    cols = ChartOfAccount.__table__.columns.keys()
    for c in ("id", "company_id", "code", "name_tr", "name_ar", "name_en",
              "account_type", "thp_class", "parent_id", "is_postable",
              "currency_id", "scheme", "is_active"):
        assert c in cols


def test_account_mapping_table_columns():
    cols = AccountMapping.__table__.columns.keys()
    for c in ("id", "company_id", "role", "coa_account_id"):
        assert c in cols
