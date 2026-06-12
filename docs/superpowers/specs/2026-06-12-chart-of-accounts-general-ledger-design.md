# Chart of Accounts & General Ledger — Design Spec

**Date:** 2026-06-12
**Status:** Approved for planning
**Author:** Claude (brainstormed with KayraYavuz)

## 1. Goal

Add a regulation-compliant **Chart of Accounts (Hesap Planı)** and a **double-entry General Ledger** on top of the existing Safiron remittance/forex operations platform. Transactions, PnL, and supplier settlements auto-post to ledger accounts, producing a real **Trial Balance (Mizan)**, **Balance Sheet (Bilanço)**, and **Income Statement (Gelir Tablosu)**.

Two accounting standards are supported and selectable **per company**:
- **THP** — Turkish Tekdüzen Hesap Planı (9 classes: 1 Dönen Varlıklar … 9 Nazım Hesaplar).
- **INTL** — International / IFRS-style 5-category scheme (1000 Assets … 6000 OpEx).

## 2. Scope decisions (locked)

| Decision | Choice |
|---|---|
| Depth | **Full general ledger** with auto-posting → Bilanço + Gelir Tablosu |
| Standards | **Both, selectable per company** (THP + INTL) |
| Currency | **USD functional + original per line** (uses existing `get_usd_rate`); statements in USD with per-currency drill-down |
| History | **Backfill all** (idempotent, re-runnable) |
| Posting | **Approach A** — role-based posting engine + per-company `AccountMapping` |
| Delivery | **Phased** (4 phases with review gates) |

## 3. Current system (context)

- Multi-tenant FastAPI + SQLAlchemy backend (`backend/app`), React frontend (`frontend/src`). Every domain table carries `company_id`; `apply_company_filter` enforces tenancy.
- **`Account`** = an operational cash/bank/crypto *till* (location + currency), **not** a GL account.
- **`Transaction`** + two **`TransactionLeg`** rows (`leg_type` in/out) move money across tills. Lifecycle: `pending` → `completed` (on `/approve`).
- **`TransactionPnL`** holds profit/commission; **`SupplierSettlement`** holds supplier receivable/payable.
- Tables are auto-created via `Base.metadata.create_all` in `main.py`; column/table migrations live in `migrate.py` (idempotent `col_exists`/table guards). No Alembic.
- Existing PnL-based `/api/reports/income-statement` stays; the new GL statements are **separate and GL-sourced**.

## 4. Architecture: role-based posting engine (Approach A)

The posting engine never references THP/INTL codes directly. It emits journal lines against **logical roles**; a per-company `AccountMapping` resolves each role to a concrete COA account. The scheme changes the mapping, not the engine.

**Roles (enum):** `cash`, `bank`, `crypto`, `customer_receivable`, `customer_payable`, `supplier_receivable`, `supplier_payable`, `fx_profit`, `fx_loss`, `commission_income`, `retained_earnings`, `opening_balance_equity`, `internal_transfer_clearing`, `rounding`.

## 5. Data model (new tables — all `company_id`-scoped)

### 5.1 `chart_of_accounts`
| Column | Type | Notes |
|---|---|---|
| id | GUID PK | |
| company_id | GUID FK | tenant |
| code | String(20) | unique per (company, code) |
| name_tr / name_ar / name_en | String | trilingual |
| account_type | Enum(asset, liability, equity, revenue, expense) | drives statement placement |
| thp_class | Integer nullable | 1–9 when scheme=THP |
| parent_id | GUID self-FK nullable | hierarchy |
| is_postable | Boolean | leaf accounts only accept journal lines |
| currency_id | GUID FK nullable | null = multi-currency |
| scheme | Enum(thp, intl) | which template it belongs to |
| is_active | Boolean | |

Constraint: `UniqueConstraint(company_id, code)`. Non-postable (header) accounts roll up children for statements.

### 5.2 Company scheme
Add `accounting_scheme = Column(Enum(thp, intl), nullable=True)` to `Company` (null until COA is initialised). No separate table needed.

### 5.3 `account_mappings`
| Column | Type | Notes |
|---|---|---|
| id | GUID PK | |
| company_id | GUID FK | |
| role | Enum(role) | see §4 |
| coa_account_id | GUID FK → chart_of_accounts | |

Constraint: `UniqueConstraint(company_id, role)`.

### 5.4 `journal_entries`
| Column | Type | Notes |
|---|---|---|
| id | GUID PK | |
| company_id | GUID FK | |
| entry_number | String(24) | e.g. `JE-2026-000123`, MAX+1 per year (mirror `_next_txn_number`) |
| entry_date | Date | |
| value_date | Date | |
| source_type | Enum(transaction, settlement, manual, opening, backfill) | |
| source_id | GUID nullable | links to originating Transaction/SupplierSettlement |
| memo | Text nullable | |
| status | Enum(posted, void) | reversals set void + create a mirror entry |
| reversed_by_id | GUID self-FK nullable | points to the reversing entry |
| created_by | GUID FK → users | |
| created_at | DateTime | |

Index `(source_type, source_id)` for idempotent backfill/lookups.

### 5.5 `journal_lines`
| Column | Type | Notes |
|---|---|---|
| id | GUID PK | |
| entry_id | GUID FK → journal_entries | cascade delete-orphan |
| coa_account_id | GUID FK → chart_of_accounts | postable leaf |
| debit | Numeric(18,4) default 0 | original currency |
| credit | Numeric(18,4) default 0 | original currency |
| currency_id | GUID FK → currencies | |
| rate_usd | Numeric(18,8) default 1 | 1 USD = rate ccy |
| debit_usd | Numeric(18,4) default 0 | |
| credit_usd | Numeric(18,4) default 0 | |
| counterparty_id | GUID FK nullable | sub-ledger drill-down |
| account_id | GUID FK → accounts nullable | originating till |

**Invariant (enforced in engine + tested):** for each entry, `Σ debit_usd == Σ credit_usd` (to the cent). Each line is either a debit or a credit, not both.

### 5.6 `Account` (till) link
Add `gl_account_id = Column(GUID FK → chart_of_accounts, nullable=True)` to `Account`. On first posting, if null, the engine **auto-creates** a postable leaf under the mapped parent for the till's `account_type` (e.g. `100.01 Kasa – İstanbul USD`) and assigns it. Gives a per-till sub-ledger automatically.

## 6. Posting rules

Triggered on transaction **approval** (`pending → completed`) and on supplier-settlement create. One balanced `journal_entry` per source event.

**Transaction legs:**
- Each **incoming** leg → **debit** the till's `gl_account_id` (asset increases).
- Each **outgoing** leg → **credit** the till's `gl_account_id` (asset decreases).
- The net imbalance is closed by mapped roles:
  - Customer side → `customer_receivable` / `customer_payable` (when `counterparty_role` = customer).
  - Supplier side → `supplier_payable` / `supplier_receivable`.
  - `TransactionPnL.profit` (>0) → credit `fx_profit`; (<0) → debit `fx_loss`.
  - `TransactionPnL.commission_usd` → credit `commission_income`.
- `deposit` → debit till, credit `customer_payable`/`opening_balance_equity`. `withdrawal` → reverse. `internal_transfer` → debit dest till, credit source till (same entry, may pass through `internal_transfer_clearing` when cross-currency).

**Supplier settlement:** posts `supplier_receivable` / `supplier_payable` legs against the relevant clearing/cash role per the settlement's receivable/payable amounts.

**Currency:** every line stores original `debit`/`credit` + `rate_usd` + `debit_usd`/`credit_usd` from `get_usd_rate`. Engine balances on the **USD** amounts; sub-cent FX rounding differences post to the `rounding` role.

**Void/reversal:** cancelling or deleting a posted transaction creates a mirror entry (debits↔credits swapped), sets original `status=void`, links via `reversed_by_id`. Entries are never hard-deleted (audit-safe).

## 7. Reports (GL-backed)

New endpoints under `/api/accounting`, all `company_id`-scoped, USD presentation with per-currency drill-down:
- **Mizan / Trial Balance** — per account: opening, period debit, period credit, closing; asserts Σdr = Σcr.
- **Bilanço / Balance Sheet** — Assets = Liabilities + Equity, grouped by `account_type`; when scheme=THP also grouped by class 1–5. As-of-date.
- **Gelir Tablosu / Income Statement (GL)** — Revenue − Expenses for a date range; computes period profit (feeds `retained_earnings`).
- **Defter-i Kebir / General Ledger** — line-level drill-down for one account over a range.
- **Journal** — entry list + detail.

## 8. Backfill

`python migrate.py` gains a `backfill-gl` path (or a dedicated `backfill_gl.py`). Steps, all idempotent:
1. `create_all` the new tables (guarded).
2. For each company without `accounting_scheme`, default to `thp` (configurable) and seed the scheme template (§9) + default `account_mappings`.
3. Post every historical `completed` transaction and every supplier settlement, **keyed on `(source_type, source_id)`** — skip if an entry already exists. Re-runnable safely.
4. Print a per-company summary (entries created, skipped, Σdr/Σcr balance check).

## 9. Seed templates

Two JSON files under `backend/app/data/`:
- `coa_thp.json` — Tekdüzen Hesap Planı tree: classes 1–9 with standard headers and common postable sub-accounts (100 Kasa, 101 Alınan Çekler, 102 Bankalar, 120 Alıcılar, 320 Satıcılar, 600 Yurtiçi Satışlar, 642 Faiz Gelirleri, 770 Genel Yönetim Giderleri, 590/591 Dönem Kârı/Zararı, etc.), each with tr/ar/en names + `account_type` + `thp_class`.
- `coa_intl.json` — 1000 Assets / 2000 Liabilities / 3000 Equity / 4000 Revenue / 5000 COGS / 6000 OpEx tree.

Each file ships a `default_mappings` block (role → code) so seeding wires `account_mappings` automatically.

## 10. API surface (`backend/app/api/accounting.py`)

- `GET /api/accounting/chart` — tree; `POST/PATCH/DELETE /api/accounting/chart/{id}` — CRUD (admin/accounting roles).
- `POST /api/accounting/initialize` — pick scheme + seed template + mappings for the company (idempotent).
- `GET/PUT /api/accounting/mappings` — view/edit role→account mapping.
- `GET /api/accounting/journal`, `GET /api/accounting/journal/{id}`, `POST /api/accounting/journal` (manual balanced entry), `POST /api/accounting/journal/{id}/void`.
- `GET /api/accounting/trial-balance`, `/balance-sheet`, `/income-statement-gl`, `/general-ledger/{account_id}`.

Register router in `main.py`. Reuse existing role guards (`admin`, `super_admin`, `accounting`).

## 11. Frontend (`frontend/src/pages`)

- **`ChartOfAccounts.jsx`** — tree editor, scheme picker + "Initialize" action, mapping editor. Trilingual.
- **`Journal.jsx`** — journal entry list/detail + manual entry form (debit=credit validation) + void.
- **`FinancialStatements.jsx`** — tabs: Mizan / Bilanço / Gelir Tablosu / Defter-i Kebir.
- Wire routes into `App.jsx` (Protected) + nav menu; add tr/ar/en locale strings.

## 12. Testing

- Posting engine unit tests: each TxnType + settlement produces a **balanced** entry (Σdr_usd = Σcr_usd); profit/commission land on correct roles; void mirrors correctly.
- Backfill idempotency test: running twice creates entries once.
- Statement tests: Bilanço balances (A = L + E); Mizan Σdr = Σcr; Gelir Tablosu = Revenue − Expenses.
- Tenancy test: company A never sees company B's COA/journal (mirror existing `test_ai_tenancy.py`).
- Use `./venv/bin/python` per repo convention; 4 known pre-existing failures are unrelated.

## 13. Phasing (delivery)

1. **Phase 1 — COA master:** models (`chart_of_accounts`, company scheme, mappings), seed templates, `initialize`, CRUD API, `ChartOfAccounts.jsx`. Review gate.
2. **Phase 2 — Journal + posting engine:** `journal_entries`/`journal_lines`, `gl_account_id` on Account, role-based engine, hook into approve/settlement/void, `Journal.jsx`. Review gate.
3. **Phase 3 — Backfill:** idempotent `backfill-gl` over history. Review gate.
4. **Phase 4 — Statements:** Mizan / Bilanço / Gelir Tablosu / Defter-i Kebir endpoints + `FinancialStatements.jsx`. Review gate.

## 14. Non-goals (v1)

Period close/locking, multi-level approval workflow for journals, tax (KDV) sub-ledger automation, depreciation schedules, consolidated multi-company statements, Alembic migration framework. Can be follow-ups.
