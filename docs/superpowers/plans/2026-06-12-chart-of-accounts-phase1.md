# Chart of Accounts — Phase 1 (COA Master) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the per-company, hierarchical, coded Chart of Accounts master (THP + International schemes), a role→account mapping table, seed templates, an `initialize` action, CRUD API, and a management UI — with no ledger posting yet.

**Architecture:** New SQLAlchemy models scoped by `company_id` (mirrors `master.py`). Two JSON seed templates drive an idempotent `initialize` service that creates the account tree + default role mappings for a company. FastAPI router mirrors `app/api/master.py` patterns; React page mirrors existing protected pages.

**Tech Stack:** FastAPI, SQLAlchemy (GUID type, `Base.metadata.create_all`, `migrate.py` for existing DBs), Pydantic v2, pytest (SQLite in-memory for integration), React + react-router + i18n locales.

---

## File Structure

- Create: `backend/app/models/accounting.py` — `AccountType`, `AccountScheme`, `AccountRole` enums; `ChartOfAccount`, `AccountMapping` models.
- Modify: `backend/app/models/master.py` — add `accounting_scheme` column to `Company`.
- Modify: `backend/app/models/__init__.py` — export new models.
- Create: `backend/app/data/coa_thp.json`, `backend/app/data/coa_intl.json` — seed templates + default mappings.
- Create: `backend/app/services/accounting_seed.py` — `initialize_chart(db, company_id, scheme)`, idempotent.
- Create: `backend/app/api/accounting.py` — initialize, chart tree CRUD, mappings GET/PUT.
- Modify: `backend/app/schemas/schemas.py` — COA + mapping schemas.
- Modify: `backend/app/main.py` — register `accounting_router`.
- Modify: `backend/migrate.py` — create new tables + `companies.accounting_scheme` column on existing DBs.
- Create: `backend/tests/conftest_db.py` — in-memory SQLite session fixture helper.
- Create: `backend/tests/test_accounting_seed.py` — seeding + idempotency + tenancy tests.
- Create: `frontend/src/pages/ChartOfAccounts.jsx` — tree view, scheme init, CRUD, mapping editor.
- Modify: `frontend/src/App.jsx` — add protected route.
- Modify: nav component + `frontend/src/locales/*` — menu entry + strings (tr/ar/en).

---

## Task 1: Accounting enums + ChartOfAccount + AccountMapping models

**Files:**
- Create: `backend/app/models/accounting.py`
- Modify: `backend/app/models/master.py` (add `accounting_scheme` to `Company`)
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_accounting_models.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_accounting_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.accounting'`

- [ ] **Step 3: Write the model file**

Create `backend/app/models/accounting.py`:

```python
import uuid
import enum
from sqlalchemy import (
    Column, String, Boolean, Enum, ForeignKey, DateTime, Integer, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


class AccountType(str, enum.Enum):
    asset = "asset"
    liability = "liability"
    equity = "equity"
    revenue = "revenue"
    expense = "expense"


class AccountScheme(str, enum.Enum):
    thp = "thp"      # Türkiye Tekdüzen Hesap Planı
    intl = "intl"    # International / IFRS-style


class AccountRole(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    crypto = "crypto"
    customer_receivable = "customer_receivable"
    customer_payable = "customer_payable"
    supplier_receivable = "supplier_receivable"
    supplier_payable = "supplier_payable"
    fx_profit = "fx_profit"
    fx_loss = "fx_loss"
    commission_income = "commission_income"
    retained_earnings = "retained_earnings"
    opening_balance_equity = "opening_balance_equity"
    internal_transfer_clearing = "internal_transfer_clearing"
    rounding = "rounding"


class ChartOfAccount(Base):
    __tablename__ = "chart_of_accounts"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_coa_company_code"),
        Index("ix_coa_company_parent", "company_id", "parent_id"),
        Index("ix_coa_company_type", "company_id", "account_type"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True, index=True)
    code = Column(String(20), nullable=False)
    name_tr = Column(String, nullable=False)
    name_ar = Column(String, nullable=False)
    name_en = Column(String, nullable=False)
    account_type = Column(Enum(AccountType), nullable=False)
    thp_class = Column(Integer, nullable=True)
    parent_id = Column(GUID(), ForeignKey("chart_of_accounts.id"), nullable=True)
    is_postable = Column(Boolean, default=True, nullable=False)
    currency_id = Column(GUID(), ForeignKey("currencies.id"), nullable=True)
    scheme = Column(Enum(AccountScheme), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship("ChartOfAccount", remote_side=[id], backref="children")


class AccountMapping(Base):
    __tablename__ = "account_mappings"
    __table_args__ = (
        UniqueConstraint("company_id", "role", name="uq_mapping_company_role"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True, index=True)
    role = Column(Enum(AccountRole), nullable=False)
    coa_account_id = Column(GUID(), ForeignKey("chart_of_accounts.id"), nullable=False)

    account = relationship("ChartOfAccount")
```

- [ ] **Step 4: Add `accounting_scheme` to `Company`**

In `backend/app/models/master.py`, inside `class Company`, after the `telegram_bot_token` line, add:

```python
    accounting_scheme = Column(String(8), nullable=True)  # "thp" | "intl" | None until initialised
```

- [ ] **Step 5: Export new models**

In `backend/app/models/__init__.py`, add after the master import line:

```python
from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountType as CoaAccountType,
    AccountScheme, AccountRole,
)
```

(Alias `AccountType as CoaAccountType` avoids clashing with `master.AccountType`.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_accounting_models.py -v`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/accounting.py backend/app/models/master.py backend/app/models/__init__.py backend/tests/test_accounting_models.py
git commit -m "feat(coa): chart_of_accounts + account_mappings models and enums"
```

---

## Task 2: Seed templates (THP + International JSON)

**Files:**
- Create: `backend/app/data/coa_thp.json`
- Create: `backend/app/data/coa_intl.json`
- Test: `backend/tests/test_accounting_seed_data.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_accounting_seed_data.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_accounting_seed_data.py -v`
Expected: FAIL with `FileNotFoundError` for `coa_thp.json`

- [ ] **Step 3: Create `backend/app/data/coa_thp.json`**

```json
{
  "scheme": "thp",
  "accounts": [
    {"code": "1", "name_tr": "Dönen Varlıklar", "name_ar": "الأصول المتداولة", "name_en": "Current Assets", "account_type": "asset", "thp_class": 1, "is_postable": false, "children": [
      {"code": "100", "name_tr": "Kasa", "name_ar": "الصندوق", "name_en": "Cash", "account_type": "asset", "thp_class": 1, "is_postable": true},
      {"code": "101", "name_tr": "Alınan Çekler", "name_ar": "الشيكات المستلمة", "name_en": "Cheques Received", "account_type": "asset", "thp_class": 1, "is_postable": true},
      {"code": "102", "name_tr": "Bankalar", "name_ar": "البنوك", "name_en": "Banks", "account_type": "asset", "thp_class": 1, "is_postable": true},
      {"code": "108", "name_tr": "Diğer Hazır Değerler (Kripto)", "name_ar": "قيم جاهزة أخرى", "name_en": "Other Liquid Assets (Crypto)", "account_type": "asset", "thp_class": 1, "is_postable": true},
      {"code": "120", "name_tr": "Alıcılar", "name_ar": "المدينون", "name_en": "Trade Receivables", "account_type": "asset", "thp_class": 1, "is_postable": true},
      {"code": "127", "name_tr": "Diğer Ticari Alacaklar (Tedarikçi)", "name_ar": "ذمم مدينة أخرى", "name_en": "Other Receivables (Supplier)", "account_type": "asset", "thp_class": 1, "is_postable": true},
      {"code": "180", "name_tr": "Kur Farkı / Geçiş Hesabı", "name_ar": "حساب فروق العملة", "name_en": "FX Clearing", "account_type": "asset", "thp_class": 1, "is_postable": true}
    ]},
    {"code": "2", "name_tr": "Duran Varlıklar", "name_ar": "الأصول الثابتة", "name_en": "Non-Current Assets", "account_type": "asset", "thp_class": 2, "is_postable": false, "children": [
      {"code": "255", "name_tr": "Demirbaşlar", "name_ar": "الأثاث والمعدات", "name_en": "Fixtures & Equipment", "account_type": "asset", "thp_class": 2, "is_postable": true}
    ]},
    {"code": "3", "name_tr": "Kısa Vadeli Yabancı Kaynaklar", "name_ar": "الخصوم قصيرة الأجل", "name_en": "Short-Term Liabilities", "account_type": "liability", "thp_class": 3, "is_postable": false, "children": [
      {"code": "320", "name_tr": "Satıcılar", "name_ar": "الموردون", "name_en": "Trade Payables", "account_type": "liability", "thp_class": 3, "is_postable": true},
      {"code": "335", "name_tr": "Müşterilere Borçlar", "name_ar": "ذمم دائنة للعملاء", "name_en": "Customer Payables", "account_type": "liability", "thp_class": 3, "is_postable": true},
      {"code": "397", "name_tr": "Sayım ve Tesellüm Fazlaları (Yuvarlama)", "name_ar": "فروقات التقريب", "name_en": "Rounding Differences", "account_type": "liability", "thp_class": 3, "is_postable": true}
    ]},
    {"code": "4", "name_tr": "Uzun Vadeli Yabancı Kaynaklar", "name_ar": "الخصوم طويلة الأجل", "name_en": "Long-Term Liabilities", "account_type": "liability", "thp_class": 4, "is_postable": false, "children": [
      {"code": "400", "name_tr": "Banka Kredileri", "name_ar": "القروض البنكية", "name_en": "Bank Loans", "account_type": "liability", "thp_class": 4, "is_postable": true}
    ]},
    {"code": "5", "name_tr": "Özkaynaklar", "name_ar": "حقوق الملكية", "name_en": "Equity", "account_type": "equity", "thp_class": 5, "is_postable": false, "children": [
      {"code": "500", "name_tr": "Sermaye", "name_ar": "رأس المال", "name_en": "Capital", "account_type": "equity", "thp_class": 5, "is_postable": true},
      {"code": "501", "name_tr": "Açılış / Devir Hesabı", "name_ar": "حساب الافتتاح", "name_en": "Opening Balance Equity", "account_type": "equity", "thp_class": 5, "is_postable": true},
      {"code": "570", "name_tr": "Geçmiş Yıllar Kârları", "name_ar": "الأرباح المدورة", "name_en": "Retained Earnings", "account_type": "equity", "thp_class": 5, "is_postable": true},
      {"code": "590", "name_tr": "Dönem Net Kârı", "name_ar": "صافي ربح الفترة", "name_en": "Net Profit for Period", "account_type": "equity", "thp_class": 5, "is_postable": true}
    ]},
    {"code": "6", "name_tr": "Gelir Tablosu Hesapları", "name_ar": "حسابات قائمة الدخل", "name_en": "Income Statement Accounts", "account_type": "revenue", "thp_class": 6, "is_postable": false, "children": [
      {"code": "600", "name_tr": "Yurtiçi Satışlar / Hizmet Gelirleri", "name_ar": "إيرادات الخدمات", "name_en": "Service Revenue", "account_type": "revenue", "thp_class": 6, "is_postable": true},
      {"code": "601", "name_tr": "Kur / İşlem Kârı", "name_ar": "أرباح الصرف", "name_en": "FX / Trading Profit", "account_type": "revenue", "thp_class": 6, "is_postable": true},
      {"code": "602", "name_tr": "Komisyon Gelirleri", "name_ar": "إيرادات العمولات", "name_en": "Commission Income", "account_type": "revenue", "thp_class": 6, "is_postable": true},
      {"code": "656", "name_tr": "Kur / İşlem Zararı", "name_ar": "خسائر الصرف", "name_en": "FX / Trading Loss", "account_type": "expense", "thp_class": 6, "is_postable": true},
      {"code": "770", "name_tr": "Genel Yönetim Giderleri", "name_ar": "المصاريف الإدارية العامة", "name_en": "General & Admin Expenses", "account_type": "expense", "thp_class": 7, "is_postable": true}
    ]}
  ],
  "default_mappings": {
    "cash": "100",
    "bank": "102",
    "crypto": "108",
    "customer_receivable": "120",
    "customer_payable": "335",
    "supplier_receivable": "127",
    "supplier_payable": "320",
    "fx_profit": "601",
    "fx_loss": "656",
    "commission_income": "602",
    "retained_earnings": "570",
    "opening_balance_equity": "501",
    "internal_transfer_clearing": "180",
    "rounding": "397"
  }
}
```

- [ ] **Step 4: Create `backend/app/data/coa_intl.json`**

```json
{
  "scheme": "intl",
  "accounts": [
    {"code": "1000", "name_tr": "Varlıklar", "name_ar": "الأصول", "name_en": "Assets", "account_type": "asset", "is_postable": false, "children": [
      {"code": "1010", "name_tr": "Kasa", "name_ar": "الصندوق", "name_en": "Cash on Hand", "account_type": "asset", "is_postable": true},
      {"code": "1020", "name_tr": "Bankalar", "name_ar": "البنوك", "name_en": "Bank Accounts", "account_type": "asset", "is_postable": true},
      {"code": "1030", "name_tr": "Kripto Cüzdanları", "name_ar": "محافظ العملات الرقمية", "name_en": "Crypto Wallets", "account_type": "asset", "is_postable": true},
      {"code": "1200", "name_tr": "Müşteri Alacakları", "name_ar": "ذمم العملاء المدينة", "name_en": "Customer Receivables", "account_type": "asset", "is_postable": true},
      {"code": "1210", "name_tr": "Tedarikçi Alacakları", "name_ar": "ذمم الموردين المدينة", "name_en": "Supplier Receivables", "account_type": "asset", "is_postable": true},
      {"code": "1800", "name_tr": "Kur Geçiş Hesabı", "name_ar": "حساب تسوية العملة", "name_en": "FX Clearing", "account_type": "asset", "is_postable": true}
    ]},
    {"code": "2000", "name_tr": "Yükümlülükler", "name_ar": "الخصوم", "name_en": "Liabilities", "account_type": "liability", "is_postable": false, "children": [
      {"code": "2010", "name_tr": "Tedarikçi Borçları", "name_ar": "ذمم الموردين الدائنة", "name_en": "Supplier Payables", "account_type": "liability", "is_postable": true},
      {"code": "2020", "name_tr": "Müşteri Borçları", "name_ar": "ذمم العملاء الدائنة", "name_en": "Customer Payables", "account_type": "liability", "is_postable": true},
      {"code": "2900", "name_tr": "Yuvarlama Farkları", "name_ar": "فروقات التقريب", "name_en": "Rounding Differences", "account_type": "liability", "is_postable": true}
    ]},
    {"code": "3000", "name_tr": "Özkaynaklar", "name_ar": "حقوق الملكية", "name_en": "Equity", "account_type": "equity", "is_postable": false, "children": [
      {"code": "3010", "name_tr": "Sermaye", "name_ar": "رأس المال", "name_en": "Capital", "account_type": "equity", "is_postable": true},
      {"code": "3020", "name_tr": "Açılış Bakiyesi Özkaynağı", "name_ar": "حقوق ملكية الرصيد الافتتاحي", "name_en": "Opening Balance Equity", "account_type": "equity", "is_postable": true},
      {"code": "3900", "name_tr": "Geçmiş Yıl Kârları", "name_ar": "الأرباح المدورة", "name_en": "Retained Earnings", "account_type": "equity", "is_postable": true}
    ]},
    {"code": "4000", "name_tr": "Gelirler", "name_ar": "الإيرادات", "name_en": "Revenue", "account_type": "revenue", "is_postable": false, "children": [
      {"code": "4010", "name_tr": "İşlem / Kur Kârı", "name_ar": "أرباح الصرف", "name_en": "FX / Trading Profit", "account_type": "revenue", "is_postable": true},
      {"code": "4020", "name_tr": "Komisyon Gelirleri", "name_ar": "إيرادات العمولات", "name_en": "Commission Income", "account_type": "revenue", "is_postable": true},
      {"code": "4030", "name_tr": "Hizmet Gelirleri", "name_ar": "إيرادات الخدمات", "name_en": "Service Revenue", "account_type": "revenue", "is_postable": true}
    ]},
    {"code": "6000", "name_tr": "Faaliyet Giderleri", "name_ar": "المصاريف التشغيلية", "name_en": "Operating Expenses", "account_type": "expense", "is_postable": false, "children": [
      {"code": "6010", "name_tr": "İşlem / Kur Zararı", "name_ar": "خسائر الصرف", "name_en": "FX / Trading Loss", "account_type": "expense", "is_postable": true},
      {"code": "6900", "name_tr": "Genel Giderler", "name_ar": "المصاريف العامة", "name_en": "General Expenses", "account_type": "expense", "is_postable": true}
    ]}
  ],
  "default_mappings": {
    "cash": "1010",
    "bank": "1020",
    "crypto": "1030",
    "customer_receivable": "1200",
    "customer_payable": "2020",
    "supplier_receivable": "1210",
    "supplier_payable": "2010",
    "fx_profit": "4010",
    "fx_loss": "6010",
    "commission_income": "4020",
    "retained_earnings": "3900",
    "opening_balance_equity": "3020",
    "internal_transfer_clearing": "1800",
    "rounding": "2900"
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `./venv/bin/python -m pytest tests/test_accounting_seed_data.py -v`
Expected: PASS (2 params)

- [ ] **Step 6: Commit**

```bash
git add backend/app/data/coa_thp.json backend/app/data/coa_intl.json backend/tests/test_accounting_seed_data.py
git commit -m "feat(coa): THP + International seed templates with default role mappings"
```

---

## Task 3: Seeding service (`initialize_chart`, idempotent)

**Files:**
- Create: `backend/app/services/accounting_seed.py`
- Create: `backend/tests/conftest_db.py`
- Create: `backend/tests/test_accounting_seed.py`

- [ ] **Step 1: Create the in-memory DB fixture helper**

Create `backend/tests/conftest_db.py`:

```python
"""In-memory SQLite session for accounting integration tests."""
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa: F401  (registers all tables on Base.metadata)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def company_id(db):
    from app.models.master import Company
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Test Co", code="TST"))
    db.commit()
    return cid
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_accounting_seed.py`:

```python
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_accounting_seed.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.accounting_seed'`

- [ ] **Step 4: Write the seeding service**

Create `backend/app/services/accounting_seed.py`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_accounting_seed.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/accounting_seed.py backend/tests/conftest_db.py backend/tests/test_accounting_seed.py
git commit -m "feat(coa): idempotent chart initialization service + test DB fixture"
```

---

## Task 4: Pydantic schemas for COA + mappings

**Files:**
- Modify: `backend/app/schemas/schemas.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_accounting_schemas.py`:

```python
from app.schemas.schemas import (
    CoaAccountCreate, CoaAccountUpdate, CoaAccountOut, MappingUpdate, InitializeChart,
)


def test_initialize_schema_accepts_scheme():
    m = InitializeChart(scheme="thp")
    assert m.scheme == "thp"


def test_coa_create_requires_core_fields():
    c = CoaAccountCreate(
        code="999", name_tr="Test", account_type="asset",
    )
    assert c.code == "999"
    assert c.name_tr == "Test"
    assert c.is_postable is True  # default


def test_mapping_update_shape():
    import uuid
    m = MappingUpdate(role="cash", coa_account_id=uuid.uuid4())
    assert m.role == "cash"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_accounting_schemas.py -v`
Expected: FAIL with `ImportError: cannot import name 'CoaAccountCreate'`

- [ ] **Step 3: Add schemas**

Append to `backend/app/schemas/schemas.py`:

```python
# ── Chart of Accounts ─────────────────────────────────────────────────────────
class InitializeChart(BaseModel):
    scheme: str  # "thp" | "intl"


class CoaAccountCreate(BaseModel):
    code: str
    name_tr: str
    name_ar: str = ""
    name_en: str = ""
    account_type: str            # asset|liability|equity|revenue|expense
    thp_class: Optional[int] = None
    parent_id: Optional[UUID] = None
    is_postable: bool = True
    currency_id: Optional[UUID] = None


class CoaAccountUpdate(BaseModel):
    name_tr: Optional[str] = None
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    is_postable: Optional[bool] = None
    is_active: Optional[bool] = None
    parent_id: Optional[UUID] = None


class CoaAccountOut(BaseModel):
    id: UUID
    code: str
    name_tr: str
    name_ar: str
    name_en: str
    account_type: str
    thp_class: Optional[int] = None
    parent_id: Optional[UUID] = None
    is_postable: bool
    currency_id: Optional[UUID] = None
    scheme: str
    is_active: bool
    class Config:
        from_attributes = True


class MappingUpdate(BaseModel):
    role: str
    coa_account_id: UUID


class MappingOut(BaseModel):
    role: str
    coa_account_id: Optional[UUID] = None
    class Config:
        from_attributes = True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./venv/bin/python -m pytest tests/test_accounting_schemas.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/schemas.py backend/tests/test_accounting_schemas.py
git commit -m "feat(coa): pydantic schemas for chart accounts and mappings"
```

---

## Task 5: Accounting API router (initialize, chart CRUD, mappings)

**Files:**
- Create: `backend/app/api/accounting.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_accounting_api.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_accounting_api.py`:

```python
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
import app.models  # noqa: F401
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.master import Company
from app.main import app


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    s = Session()

    cid = uuid.uuid4()
    s.add(Company(id=cid, name="Co", code="CO"))
    admin = User(id=uuid.uuid4(), name="A", email="a@a.co", hashed_password="x",
                 role=UserRole.admin, company_id=cid)
    s.add(admin)
    s.commit()

    app.dependency_overrides[get_db] = lambda: s
    app.dependency_overrides[get_current_user] = lambda: admin
    yield TestClient(app)
    app.dependency_overrides.clear()
    s.close()


def test_initialize_then_list_chart(client):
    r = client.post("/api/accounting/initialize", json={"scheme": "thp"})
    assert r.status_code == 200
    r2 = client.get("/api/accounting/chart")
    assert r2.status_code == 200
    body = r2.json()
    assert len(body) > 10
    codes = {a["code"] for a in body}
    assert "100" in codes  # Kasa


def test_list_mappings_after_init(client):
    client.post("/api/accounting/initialize", json={"scheme": "intl"})
    r = client.get("/api/accounting/mappings")
    assert r.status_code == 200
    roles = {m["role"] for m in r.json()}
    assert "cash" in roles and "fx_profit" in roles


def test_create_custom_account(client):
    client.post("/api/accounting/initialize", json={"scheme": "thp"})
    r = client.post("/api/accounting/chart", json={
        "code": "103", "name_tr": "Verilen Çekler", "account_type": "asset", "is_postable": True
    })
    assert r.status_code == 200
    assert r.json()["code"] == "103"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_accounting_api.py -v`
Expected: FAIL (404s — router not registered)

- [ ] **Step 3: Write the router**

Create `backend/app/api/accounting.py`:

```python
"""
Chart of Accounts API — initialize, tree CRUD, role mappings.
Tenant-scoped via apply_company_filter. Phase 1 (no ledger yet).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountType, AccountScheme, AccountRole,
)
from app.schemas.schemas import (
    InitializeChart, CoaAccountCreate, CoaAccountUpdate, CoaAccountOut,
    MappingUpdate, MappingOut,
)
from app.services.accounting_seed import initialize_chart
from app.services.audit import log as audit_log

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

_ADMIN = (UserRole.admin, UserRole.super_admin, UserRole.accounting)


def _require(cu: User, *roles):
    if cu.role not in roles:
        raise HTTPException(403, "Forbidden")


@router.post("/initialize")
def initialize(data: InitializeChart, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, UserRole.admin, UserRole.super_admin)
    if data.scheme not in ("thp", "intl"):
        raise HTTPException(400, "scheme must be 'thp' or 'intl'")
    result = initialize_chart(db, cu.company_id, data.scheme)
    audit_log(db, "INITIALIZE", user_id=cu.id, entity="ChartOfAccounts",
              entity_id=cu.company_id, detail={"scheme": data.scheme, **result})
    return result


@router.get("/chart", response_model=List[CoaAccountOut])
def list_chart(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(ChartOfAccount).filter(ChartOfAccount.is_active == True)
    q = apply_company_filter(q, ChartOfAccount, cu)
    return q.order_by(ChartOfAccount.code).all()


@router.post("/chart", response_model=CoaAccountOut)
def create_account(data: CoaAccountCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    code = data.code.strip()
    if not code:
        raise HTTPException(400, "Code required")
    dupe = db.query(ChartOfAccount).filter(
        ChartOfAccount.company_id == cu.company_id, ChartOfAccount.code == code,
    ).first()
    if dupe:
        raise HTTPException(400, f"Code '{code}' already exists")
    # scheme: inherit company scheme (must be initialised first)
    scheme_row = db.query(ChartOfAccount.scheme).filter(
        ChartOfAccount.company_id == cu.company_id,
    ).first()
    if not scheme_row:
        raise HTTPException(400, "Initialise a chart scheme first")
    acc = ChartOfAccount(
        company_id=cu.company_id,
        code=code,
        name_tr=data.name_tr.strip(),
        name_ar=(data.name_ar or data.name_tr).strip(),
        name_en=(data.name_en or data.name_tr).strip(),
        account_type=AccountType(data.account_type),
        thp_class=data.thp_class,
        parent_id=data.parent_id,
        is_postable=data.is_postable,
        currency_id=data.currency_id,
        scheme=scheme_row[0],
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.patch("/chart/{acc_id}", response_model=CoaAccountOut)
def update_account(acc_id: UUID, data: CoaAccountUpdate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    q = db.query(ChartOfAccount).filter(ChartOfAccount.id == acc_id)
    q = apply_company_filter(q, ChartOfAccount, cu)
    acc = q.first()
    if not acc:
        raise HTTPException(404, "Account not found")
    for field in ("name_tr", "name_ar", "name_en", "is_postable", "is_active", "parent_id"):
        val = getattr(data, field)
        if val is not None:
            setattr(acc, field, val)
    db.commit()
    db.refresh(acc)
    return acc


@router.delete("/chart/{acc_id}")
def delete_account(acc_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    q = db.query(ChartOfAccount).filter(ChartOfAccount.id == acc_id)
    q = apply_company_filter(q, ChartOfAccount, cu)
    acc = q.first()
    if not acc:
        raise HTTPException(404, "Account not found")
    kids = db.query(ChartOfAccount).filter(ChartOfAccount.parent_id == acc_id, ChartOfAccount.is_active == True).count()
    if kids:
        raise HTTPException(400, f"Account has {kids} child account(s) — remove them first")
    acc.is_active = False
    db.commit()
    return {"ok": True}


@router.get("/mappings", response_model=List[MappingOut])
def list_mappings(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(AccountMapping)
    q = apply_company_filter(q, AccountMapping, cu)
    return q.all()


@router.put("/mappings", response_model=MappingOut)
def upsert_mapping(data: MappingUpdate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    # account must belong to company + be postable
    acc = db.query(ChartOfAccount).filter(
        ChartOfAccount.id == data.coa_account_id,
        ChartOfAccount.company_id == cu.company_id,
    ).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    if not acc.is_postable:
        raise HTTPException(400, "Mapping target must be a postable account")
    q = db.query(AccountMapping).filter(AccountMapping.role == AccountRole(data.role))
    q = apply_company_filter(q, AccountMapping, cu)
    m = q.first()
    if m:
        m.coa_account_id = data.coa_account_id
    else:
        m = AccountMapping(company_id=cu.company_id, role=AccountRole(data.role),
                           coa_account_id=data.coa_account_id)
        db.add(m)
    db.commit()
    db.refresh(m)
    return m
```

- [ ] **Step 4: Register the router in `main.py`**

In `backend/app/main.py`, add to the import block (after the `public` import, line ~17):

```python
from app.api.accounting import router as accounting_router
```

and after `app.include_router(public_router)` (line ~86):

```python
app.include_router(accounting_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_accounting_api.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full backend suite (no regressions)**

Run: `./venv/bin/python -m pytest tests/ -q`
Expected: all new tests pass; only the 4 known pre-existing failures remain.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/accounting.py backend/app/main.py backend/tests/test_accounting_api.py
git commit -m "feat(coa): accounting API — initialize, chart CRUD, role mappings"
```

---

## Task 6: migrate.py — create new tables on existing DBs

**Files:**
- Modify: `backend/migrate.py`

- [ ] **Step 1: Add table + column creation to `migrate.py`**

In `backend/migrate.py`, inside `with engine.begin() as conn:` (after the existing blocks), add:

```python
        # ── companies.accounting_scheme ──────────────────────────────────────
        if 'companies' in tables and not col_exists(insp, 'companies', 'accounting_scheme'):
            conn.execute(text("ALTER TABLE companies ADD COLUMN accounting_scheme VARCHAR(8)"))
            print("  ✅ companies.accounting_scheme eklendi")

        # ── chart_of_accounts + account_mappings (create_all handles new DBs) ─
        # On existing Postgres DBs, create via metadata if missing.
        from app.models.accounting import ChartOfAccount, AccountMapping
        for model in (ChartOfAccount, AccountMapping):
            if model.__tablename__ not in tables:
                model.__table__.create(bind=conn)
                print(f"  ✅ {model.__tablename__} tablosu oluşturuldu")
```

- [ ] **Step 2: Verify migrate runs clean against a scratch SQLite DB**

Run:
```bash
./venv/bin/python -c "
import os, tempfile
db = tempfile.mktemp(suffix='.db')
os.environ['SQLALCHEMY_DATABASE_URL'] = 'sqlite:///' + db
from app.core.database import Base, engine
import app.models
Base.metadata.create_all(engine)
import migrate; migrate.run()
print('MIGRATE OK')
"
```
Expected: prints `MIGRATE OK` with no traceback (idempotent — re-running prints "zaten var"-style lines).

- [ ] **Step 3: Commit**

```bash
git add backend/migrate.py
git commit -m "chore(coa): migrate.py creates COA tables + companies.accounting_scheme"
```

---

## Task 7: Frontend — Chart of Accounts page

**Files:**
- Create: `frontend/src/pages/ChartOfAccounts.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: nav menu component (locate via `grep -rn "/reports" frontend/src/components`)
- Modify: `frontend/src/locales/*` (tr/ar/en) for menu + page strings

- [ ] **Step 1: Inspect the API client + an existing protected page for patterns**

Run:
```bash
sed -n '1,40p' frontend/src/utils/api.js 2>/dev/null || ls frontend/src/utils
sed -n '1,60p' frontend/src/pages/Accounts.jsx
grep -rn "to=\"/accounts\"\|/accounts" frontend/src/components | head
```
Expected: identifies the API helper (auth header injection) and the nav file to edit. Match these patterns exactly in the next steps.

- [ ] **Step 2: Create `ChartOfAccounts.jsx`**

Mirror the structure of `Accounts.jsx` (same imports, same API helper, same layout wrapper). The page must:
1. `GET /api/accounting/chart` on mount; if empty, show a scheme picker (THP / International) that calls `POST /api/accounting/initialize`.
2. Render accounts as an indented tree sorted by `code` (indent by depth derived from `parent_id` chain), showing `code`, localized name (tr/ar/en per current language), `account_type`, and a postable/header badge.
3. "Add account" form → `POST /api/accounting/chart`; inline edit → `PATCH /api/accounting/chart/{id}`; deactivate → `DELETE`.
4. A "Mappings" panel: `GET /api/accounting/mappings`, each role with a `<select>` of postable accounts, save via `PUT /api/accounting/mappings`.

Use the exact API helper found in Step 1 (do not hand-roll `fetch` with manual tokens if a helper exists). Keep all user-facing strings in the locale files (Step 4), not hardcoded.

- [ ] **Step 3: Add the route in `App.jsx`**

After the `/accounts` route (line ~128), add:

```jsx
          <Route path="/chart-of-accounts" element={<Protected><ChartOfAccounts /></Protected>} />
```

and add the import near the other page imports at the top of `App.jsx`:

```jsx
import ChartOfAccounts from "./pages/ChartOfAccounts";
```

- [ ] **Step 4: Add nav entry + locale strings**

In the nav file found in Step 1, add a link to `/chart-of-accounts` beside the existing `/accounts` / `/reports` links, label via i18n key `nav.chartOfAccounts`. Add to each locale file:
- tr: `"chartOfAccounts": "Hesap Planı"`
- en: `"chartOfAccounts": "Chart of Accounts"`
- ar: `"chartOfAccounts": "دليل الحسابات"`
Plus page strings used in Step 2 (title, scheme picker labels, column headers, buttons) under a `coa.*` namespace in all three locales.

- [ ] **Step 5: Build the frontend to verify it compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds (prerender + sitemap as usual; needs Chrome per repo notes). Fix any import/JSX errors before committing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ChartOfAccounts.jsx frontend/src/App.jsx frontend/src/components frontend/src/locales
git commit -m "feat(coa): Chart of Accounts management page + nav + locales"
```

---

## Phase 1 Done — Verification Checklist

- [ ] `./venv/bin/python -m pytest tests/ -q` — all new accounting tests pass; only the 4 known pre-existing failures remain.
- [ ] `POST /api/accounting/initialize {"scheme":"thp"}` seeds the THP tree + 14 mappings; re-running is a no-op.
- [ ] `GET /api/accounting/chart` returns a tenant-scoped tree; company B cannot see company A's accounts.
- [ ] Custom account create/edit/deactivate works; deactivating a parent with children is blocked.
- [ ] Mapping update rejects non-postable targets.
- [ ] `frontend` builds; `/chart-of-accounts` renders the tree, scheme picker, and mapping editor in tr/ar/en.
- [ ] `migrate.py` creates the two tables + `companies.accounting_scheme` on an existing DB without error.

**Next:** Phase 2 plan — journal entries, posting engine, `gl_account_id` on Account, void/period-lock guard.
```
