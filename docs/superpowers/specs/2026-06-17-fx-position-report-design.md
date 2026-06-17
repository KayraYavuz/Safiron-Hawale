# Döviz Pozisyon Raporu (FX Position Report) — Design

**Date:** 2026-06-17
**Branch:** `feat/fx-position-report`
**Status:** Approved design → implementation

## Problem

The platform is a havale/remittance + FX business holding balances in many
currencies (cash, bank, crypto) and carrying receivables/payables in foreign
currencies. The USD-functional GL records each line's original currency and a
booked USD value (at the posting rate). There is no report that answers the core
FX-risk question: **for each currency, what is our net position (long/short), and
what unrealized FX gain/loss are we sitting on at today's rate?**

## Scope

- **In:** A per-currency net monetary position report over **asset + liability**
  accounts: net original-currency position, booked USD, current USD, unrealized
  FX P&L. Backend service + `GET /api/accounting/fx-position` (+ CSV) + a new tab
  on the Financial Statements page. tr/en/ar strings.
- **Out:** Revenue/expense/equity accounts (flows, not positions). Realized FX P&L
  reporting (already booked via `fx_profit`/`fx_loss` roles in posting). Rate
  management (uses the existing rate source). No schema change.

## Data & conventions

- `journal_lines`: `currency_id`, `debit`/`credit` (original), `debit_usd`/
  `credit_usd` (booked USD at posting rate), joined via `entry_id` to
  `journal_entries` (company, status, date) and via `coa_account_id` to
  `chart_of_accounts` (`account_type`).
- Current rates: `app/services/balance.get_all_usd_rates(db) -> {code: rate_per_usd}`
  where `rate_per_usd` is **currency units per 1 USD** (USD value = amount ÷ rate);
  `USD → 1`. 5-minute in-process cache.

## Service: `app/services/fx_position.py`

`fx_position(db, company_id, as_of: date = None, rates: dict = None) -> dict`

1. Aggregate posted journal lines for the company (`entry_date <= as_of` if given),
   restricted to `chart_of_accounts.account_type IN (asset, liability)`, grouped by
   `currency_id`, summing `debit-credit` (original) and `debit_usd-credit_usd`.
2. `rates = rates or get_all_usd_rates(db)` (injectable for tests).
3. Per currency (skip net-zero positions):
   - `net_original = Σ(debit - credit)`
   - `booked_usd   = Σ(debit_usd - credit_usd)`
   - `rate = rates.get(code)`; `current_usd = net_original / rate` if `rate` else `None`
   - `unrealized_fx = current_usd - booked_usd` if `current_usd is not None` else `None`
   - `side = "long" if net_original > 0 else "short"`
4. Return `{rows: [...], total_booked_usd, total_current_usd, total_unrealized_fx}`
   (totals sum only rows with a known rate). Rows sorted by `abs(current_usd or booked_usd)` desc.

Rows carry: `currency` (code), `net_position`, `booked_usd`, `current_usd`,
`unrealized_fx`, `rate_per_usd`, `side`, `has_rate` (bool).

## API (`app/api/statements.py`, accounting router)

`GET /api/accounting/fx-position?as_of=&format=` — auth-gated, company-scoped via
`cu.company_id`. `format=csv` → columns currency, net_position, booked_usd,
current_usd, unrealized_fx, side. JSON otherwise.

## Frontend (`FinancialStatements.jsx`)

New `fxPosition` tab. Table: Para Birimi | Net Pozisyon | Defter USD | Güncel USD |
Gerçekleşmemiş FX K/Z | Long/Short (Badge). Totals row. CSV + print buttons.
Currencies without a current rate show "—" for current/unrealized with a "kur yok"
hint. New tr/en/ar keys (`fsFxPosition`, `fsNetPosition`, `fsBookedUsd`,
`fsCurrentUsd`, `fsUnrealizedFx`, `fsLong`, `fsShort`, `fsNoRate`).

## Edge cases

- Currency with no current rate → `current_usd`/`unrealized_fx` null, `has_rate=false`,
  UI shows "—"/"kur yok". Excluded from totals.
- USD → `unrealized_fx = 0` (rate 1).
- Net-zero currency → skipped (noise reduction).
- `as_of` → historical position (filters by `entry_date`).

## Testing (TDD)

- **service:** post a TRY asset entry + a EUR liability entry; with injected rates,
  assert `net_position`/`booked_usd`/`current_usd`/`unrealized_fx` and `side`;
  assert revenue/expense lines are excluded; assert a currency with no rate yields
  `current_usd=None` and is left out of totals; assert net-zero currency is skipped.
- **API:** `fx-position` returns rows for an authed company; `format=csv` returns CSV;
  unauth → 401 (covered by the shared dependency).

## Deployment

Backend + frontend, no migration. After merge: `./deploy.sh`; verify
`/api/accounting/fx-position` returns 401 unauth (live) and renders for a real company.
