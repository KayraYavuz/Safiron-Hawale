"""
Dual-scheme (THP ⇄ IFRS) reporting crosswalk.

The posting engine is role-based, so the ledger is scheme-neutral. To render the
statements under a *different* chart of accounts than the company's own, we pivot
every posted line on its role and re-key it onto the target scheme's account —
purely at presentation time, no schema change and no second chart in the DB.

Account metadata for the target scheme comes from the static seed templates
(`app/data/coa_{thp,intl}.json`), which carry both the role→code map
(`default_mappings`) and the account definitions.
"""
import os
import json
from decimal import Decimal

from app.models.accounting import AccountMapping, AccountType

ZERO = Decimal("0")
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
_FILES = {"thp": "coa_thp.json", "intl": "coa_intl.json"}

# Synthetic account for posted lines whose account has no role mapping. Keeps the
# crosswalked statement balanced instead of silently dropping the amount.
UNMAPPED = {
    "code": "—",
    "name_tr": "Eşlenmemiş", "name_en": "Unmapped", "name_ar": "غير مطابق",
    "account_type": "asset", "thp_class": None,
}

_index_cache: dict[str, dict] = {}


def _flatten(nodes: list) -> dict:
    """code -> account definition, walking the children tree."""
    out = {}
    for n in nodes:
        out[n["code"]] = n
        out.update(_flatten(n.get("children", [])))
    return out


def scheme_index(scheme: str) -> dict:
    """role -> {code, name_tr, name_en, name_ar, account_type, thp_class} for a scheme."""
    if scheme in _index_cache:
        return _index_cache[scheme]
    if scheme not in _FILES:
        raise ValueError(f"unknown scheme: {scheme}")
    with open(os.path.join(_DATA_DIR, _FILES[scheme]), encoding="utf-8") as f:
        template = json.load(f)
    by_code = _flatten(template["accounts"])
    index = {}
    for role, code in template["default_mappings"].items():
        acc = by_code[code]
        index[role] = {
            "code": acc["code"],
            "name_tr": acc["name_tr"], "name_en": acc["name_en"], "name_ar": acc["name_ar"],
            "account_type": acc["account_type"], "thp_class": acc.get("thp_class"),
        }
    _index_cache[scheme] = index
    return index


class _TargetAccount:
    """Duck-types the ChartOfAccount attributes the statements service reads, so the
    crosswalked rows flow through the existing row-building / grouping logic."""
    def __init__(self, key: str, meta: dict):
        self.id = key
        self.code = meta["code"]
        self.name_tr = meta["name_tr"]
        self.name_en = meta["name_en"]
        self.name_ar = meta["name_ar"]
        self.account_type = AccountType(meta["account_type"])


def reverse_roles(db, company_id) -> dict:
    """{coa_account_id (str): role} from the company's account_mappings rows."""
    rows = db.query(AccountMapping).filter(AccountMapping.company_id == company_id).all()
    return {str(m.coa_account_id): m.role.value for m in rows}


def remap(agg: dict, reverse: dict, target_index: dict):
    """Pivot a {account_id: (dr, cr)} aggregation onto the target scheme via role.

    Returns (agg2, accs2) in the same shape the statements service expects from
    `_agg` / `_accounts`, keyed by role (or "UNMAPPED" for role-less lines)."""
    agg2: dict = {}
    accs2: dict = {}
    for aid, (dr, cr) in agg.items():
        role = reverse.get(aid)
        meta = target_index.get(role) if role else None
        if meta is None:
            key, meta = "UNMAPPED", UNMAPPED
        else:
            key = role
        pdr, pcr = agg2.get(key, (ZERO, ZERO))
        agg2[key] = (pdr + dr, pcr + cr)
        if key not in accs2:
            accs2[key] = _TargetAccount(key, meta)
    return agg2, accs2
