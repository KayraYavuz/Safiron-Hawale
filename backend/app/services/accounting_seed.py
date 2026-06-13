"""
Chart of Accounts seeding — idempotent per company.

initialize_chart(db, company_id, scheme):
  - loads the scheme's JSON template
  - creates the account tree (parents before children) if not already present
  - creates the role -> account mappings
  - sets Company.accounting_scheme
Safe to re-run: if the company already has a chart, it is a no-op.
"""
import json
import os
from sqlalchemy.orm import Session

from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountScheme, AccountRole, AccountType,
)
from app.models.master import Company

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
_FILES = {"thp": "coa_thp.json", "intl": "coa_intl.json"}


def _load_template(scheme: str) -> dict:
    if scheme not in _FILES:
        raise ValueError(f"Unknown scheme: {scheme}")
    with open(os.path.join(_DATA_DIR, _FILES[scheme]), encoding="utf-8") as f:
        return json.load(f)


def _create_nodes(db, company_id, scheme_enum, nodes, parent_id, code_index):
    for node in nodes:
        acc = ChartOfAccount(
            company_id=company_id,
            code=node["code"],
            name_tr=node["name_tr"],
            name_ar=node["name_ar"],
            name_en=node["name_en"],
            account_type=AccountType(node["account_type"]),
            thp_class=node.get("thp_class"),
            parent_id=parent_id,
            is_postable=bool(node["is_postable"]),
            scheme=scheme_enum,
        )
        db.add(acc)
        db.flush()  # assign id for children + index
        code_index[node["code"]] = acc.id
        _create_nodes(db, company_id, scheme_enum, node.get("children", []), acc.id, code_index)


def initialize_chart(db: Session, company_id, scheme: str) -> dict:
    existing = (db.query(ChartOfAccount)
                  .filter(ChartOfAccount.company_id == company_id)
                  .first())
    if existing:
        return {"created": False, "reason": "already_initialised"}

    template = _load_template(scheme)
    scheme_enum = AccountScheme(scheme)
    code_index: dict = {}
    _create_nodes(db, company_id, scheme_enum, template["accounts"], None, code_index)

    # role mappings
    for role_str, code in template["default_mappings"].items():
        db.add(AccountMapping(
            company_id=company_id,
            role=AccountRole(role_str),
            coa_account_id=code_index[code],
        ))

    co = db.query(Company).filter(Company.id == company_id).first()
    if co:
        co.accounting_scheme = scheme

    db.commit()
    return {"created": True, "accounts": len(code_index)}
