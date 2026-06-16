# THP ⇄ IFRS Çift-Raporlama (Dual-Scheme Reporting) — Design

**Date:** 2026-06-15
**Branch:** `feat/dual-scheme-reporting`
**Status:** Approved design → implementation

## Problem

The GL produces financial statements (Mizan / Trial Balance, Bilanço / Balance Sheet,
Gelir Tablosu / Income Statement) only in each company's single configured scheme
(`Company.accounting_scheme` ∈ {`thp`, `intl`}). Operators want to view the **same
ledger** under **both** the Turkish Tekdüzen (THP) and the international/IFRS-style
(INTL) chart of accounts — without keeping two sets of books.

## Key insight

The posting engine is already **role-based**: every posted line maps to a semantic
role (`cash`, `bank`, `customer_receivable`, `commission_income`, …). Both seed files
(`backend/app/data/coa_thp.json`, `coa_intl.json`) carry a complete `default_mappings`
(role → account code) **and** the account definitions (code → names / `account_type` /
`thp_class`). So the ledger is effectively scheme-neutral; the chart is a presentation
layer. We can render the "other" scheme purely at presentation time by pivoting on the
role — **no schema change, no second chart seeded in the DB**.

## Scope

- **In:** Dual rendering of **Mizan, Bilanço, Gelir Tablosu** (all three) via a
  `scheme=thp|intl` selector; backend API param + frontend toggle; tr/en/ar i18n.
- **Out:** Defter-i Kebir (general ledger) — a per-account drill-down stays in its
  native scheme. Recognition/measurement differences between THP and IFRS
  (TFRS 16 leasing, inflation accounting, provisions) — this is a *presentation*
  hybrid only. For the remittance business these line items are effectively absent.

## Architecture / data flow

No DB schema changes. Crosswalk is presentation-time. **Pivot = role.**

1. Aggregate posted journal lines by `coa_account_id` in the company's own scheme
   (existing `statements._agg`).
2. If the requested `target_scheme` equals the company scheme → current behavior.
3. If it differs → remap the aggregation onto the target scheme's synthetic accounts
   via the role pivot, then run the **same** grouping / sign logic using the target
   account metadata.

## New module: `app/services/scheme_crosswalk.py`

- `scheme_index(scheme: str) -> dict[role, dict]`
  Build `{role: {"code", "name_tr", "name_en", "name_ar", "account_type", "thp_class"}}`
  from the seed JSON for `scheme`. Cached (module-level) — seed files are static.
- `reverse_roles(db, company_id) -> dict[str, str]`
  `{coa_account_id (str): role}` from the company's `account_mappings` rows.
- `remap(agg, reverse_roles, target_index) -> dict[str, tuple[Decimal, Decimal]]`
  Sum the `{account_id: (dr, cr)}` aggregation **by role**, then re-key onto the
  target scheme's account (code/meta from `target_index`). Account ids with **no role**
  go to a synthetic **`UNMAPPED`** account (`code="—"`, type `asset`, name
  "Eşlenmemiş / Unmapped") so totals still balance and nothing is silently dropped.

## `statements.py` changes

- `trial_balance`, `income_statement`, `balance_sheet` gain optional
  `target_scheme: str | None = None`.
- When `target_scheme` is `None` or equals the company scheme → unchanged path
  (join DB `ChartOfAccount`).
- Otherwise → call `_agg` as today, then `scheme_crosswalk.remap(...)`, and build rows
  from the **target** account metadata. The existing `account_type`-based grouping and
  debit/credit-normal sign logic are reused unchanged (role semantics preserve
  `account_type` across schemes — `cash` is an asset in both).
- `general_ledger` is unchanged (out of scope).

## API changes (`app/api/statements.py`)

- Add `scheme: Optional[str] = None` query param to:
  - `GET /api/accounting/trial-balance`
  - `GET /api/accounting/balance-sheet`
  - `GET /api/accounting/income-statement-gl`
- Validate `scheme ∈ {thp, intl}` when provided; else `400`.
- Resolve the company's own scheme from `Company.accounting_scheme`; if `scheme`
  matches or is omitted, no remap. Pass `target_scheme` to the service.
- Existing `?format=csv` continues to work with the scheme param (CSV reflects the
  selected scheme's codes/names).

## Frontend (`FinancialStatements.jsx`)

- A **THP / IFRS** segmented toggle in the page header, defaulting to the company's
  own scheme. Selecting a scheme re-fetches the Mizan / Bilanço / Gelir Tablosu tabs
  with `?scheme=`. Defter-i Kebir tab ignores the toggle.
- New i18n keys in tr / en / ar (e.g. `schemeToggle`, `schemeTHP`, `schemeIFRS`).

## Edge cases

- Role-unmapped posted lines → `UNMAPPED` bucket (visible, keeps statement balanced).
- Invalid `scheme` value → `400`.
- Company with no `account_mappings` rows → `reverse_roles` empty → everything lands
  in `UNMAPPED` (degraded but balanced; signals misconfiguration rather than crashing).

## Testing (TDD)

- **crosswalk unit:** `scheme_index` loads both schemes with expected role→code
  (`cash`→`100` thp / `1010` intl); `reverse_roles` builds the inverse map; `remap`
  sums by role and routes unmapped ids to `UNMAPPED`.
- **statements:** seed a `thp` company, post entries, request `target_scheme="intl"`
  trial balance → rows carry intl codes (`1010`, `2020`, …), totals balance, and the
  grand totals equal the native-scheme totals.
- **API:** `scheme=intl` routes through remap; invalid `scheme=xxx` → `400`;
  omitted scheme → native behavior unchanged.

## Deployment

Backend + frontend. After merge to `main`: `./deploy.sh` (both services). No migration
(no schema change). Verify `/api/accounting/trial-balance?scheme=intl` on a `thp`
company returns intl-coded rows.
