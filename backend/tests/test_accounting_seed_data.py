import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "data")
VALID_TYPES = {"asset", "liability", "equity", "revenue", "expense"}
REQUIRED_ROLES = {
    "cash", "bank", "crypto", "customer_receivable", "customer_payable",
    "supplier_receivable", "supplier_payable", "fx_profit", "fx_loss",
    "commission_income", "retained_earnings", "opening_balance_equity",
    "internal_transfer_clearing", "rounding",
}


def _load(name):
    with open(os.path.join(DATA_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def _flatten(nodes, out):
    for n in nodes:
        out.append(n)
        _flatten(n.get("children", []), out)
    return out


import pytest


@pytest.mark.parametrize("fname", ["coa_thp.json", "coa_intl.json"])
def test_seed_structure(fname):
    data = _load(fname)
    assert "scheme" in data and "accounts" in data and "default_mappings" in data

    accounts = _flatten(data["accounts"], [])
    codes = [a["code"] for a in accounts]
    # codes unique
    assert len(codes) == len(set(codes))
    # every account well-formed
    for a in accounts:
        assert a["account_type"] in VALID_TYPES
        for key in ("code", "name_tr", "name_ar", "name_en", "is_postable"):
            assert key in a

    # every required role mapped to a code that exists, and that code is postable
    code_to_postable = {a["code"]: a["is_postable"] for a in accounts}
    for role in REQUIRED_ROLES:
        assert role in data["default_mappings"], f"{fname} missing role {role}"
        mapped = data["default_mappings"][role]
        assert mapped in code_to_postable, f"{fname}: role {role} -> unknown code {mapped}"
        assert code_to_postable[mapped] is True, f"{fname}: role {role} -> non-postable {mapped}"
