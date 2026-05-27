# AI Analysis Fix + Telegram Bot Overhaul — Design Spec

## Goal
Fix AI analysis multi-tenancy data leak and overhaul the Telegram bot: persistent conversation state, transparent inline keyboard UI, bug fixes across broken flows, and three new features (rate update, customer statement, notifications).

## Architecture

### Part 1: AI Analysis Multi-tenancy Fix

**Problem**: `get_financial_summary(db)` in `backend/app/services/ai_analyst.py` queries ALL companies' transactions — no `company_id` filter.

**Fix**:
- Add `company_id: str` parameter to `get_financial_summary(db, company_id)` and `get_ai_chat_response(db, message, history, company_id)`
- Add `Transaction.company_id == company_id` filter to both queries
- In `backend/app/api/reports.py`, pass `cu.company_id` to both function calls

No schema changes needed.

---

### Part 2: Telegram Bot Overhaul

**Files touched**:
- `backend/app/services/telegram_multi_bot.py` — main bot service (1832 lines → ~2100)
- `backend/app/core/migrations.py` — add `bot_conversations` table migration
- `backend/app/api/transactions.py` — call `notify_company()` on approve/create events

---

#### 2a. DB-Backed Conversation State

**Problem**: `_CONV: Dict[str, dict]` is a process-local in-memory dict. Cloud Run restarts and redeployments wipe it — users in mid-flow get "timeout" errors.

**Fix**: Replace with a `bot_conversations` DB table.

Schema (added via migrations.py, idempotent):
```sql
CREATE TABLE IF NOT EXISTS bot_conversations (
    key         TEXT PRIMARY KEY,       -- "{company_id}:{telegram_id}"
    state       TEXT NOT NULL,
    data        TEXT NOT NULL DEFAULT '{}',  -- JSON string
    updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bot_conv_updated ON bot_conversations(updated_at);
```

`_cget/_cset/_cupd/_cclr` functions rewritten to use raw SQL via `SessionLocal`. Old entries older than 2 hours are ignored (treated as expired). Cleanup: delete entries older than 24h on each `_cset`.

---

#### 2b. Inline Keyboard UI ("Şeffaf Butonlar")

**Problem**: `ReplyKeyboardMarkup` creates a permanent grey keyboard that takes up screen space. User wants cleaner, "transparent" buttons.

**Fix**: Remove `ReplyKeyboardMarkup` entirely. Replace with `InlineKeyboardMarkup` main menu attached to messages.

New `_make_inline_menu(uid, is_admin=True)` function returns:
```
Row 1: [💰 Bakiye] [📊 Rapor] [💱 Kurlar]
Row 2: [📋 İşlemler] [➕ Yeni İşlem]
Row 3: [👤 Müşteri Ekle] [💱 Kur Güncelle]
Row 4: [👤 Ekstre] [🌐 Dil]
```

Callback data: `menu:balance`, `menu:report`, `menu:rates`, `menu:txns`, `menu:new_txn`, `menu:add_cp`, `menu:update_rate`, `menu:statement`, `menu:lang`

`on_message` and `on_callback` send this menu as `reply_markup` after every completed action.

`on_start` sends welcome + inline menu.

`ReplyKeyboardRemove` sent once on `/start` to dismiss any old persistent keyboard.

---

#### 2c. Bug Fixes

**Fix 1 — Menu button dispatch**: Replace `_menu_to_cmd` text-matching logic. Since we're moving to inline keyboards, all navigation goes through `on_callback` with `menu:` prefix callbacks. The text-based menu matching is no longer needed for main nav.

For backward compatibility (users who type commands directly), keep text command matching in `_admin_cmd` but fix the emoji-prefix issue: strip leading emoji from `cmd_lower` before matching.

**Fix 2 — `_q_son_islemler` wrong key**: Line 1574 uses `L.get('unknown_cmd', ...)` for empty state. Fix to `L.get('q_no_txn', '📭 *İşlem bulunamadı.*')`.

**Fix 3 — Flow helpers use hardcoded Turkish**: Add `uid` parameter to:
- `_ask_from_acc(txn_type, company_id, db, uid=0)` 
- `_ask_to_acc(company_id, db, uid=0, exclude_id=None)`
- `_ask_amount(data, uid=0)`
- `_ask_cp_type(name, uid=0)`
- `_txn_summary(company_id, uid, data, db)` — already has uid, use `_L(uid, ...)`
- `_do_create_txn(data, uid, company_id, db)` — use `_L(uid, "txn_created", num=txn_number)`
- `_do_create_cp(data, company_id, db, uid=0)` — use `_L(uid, "cp_created", ...)`

Add missing locale keys to `BOT_L` where needed.

**Fix 4 — Amount parsing**: Remove the dead first parse attempt at line 786. Keep only the correct logic:
```python
amt = float(text.replace(",", ".")) if "," in text else float(text.replace(",", ""))
```

**Fix 5 — `_conv_handle_text` hardcoded error strings**: Replace inline Turkish strings with `_L(uid, "txn_inv_rate")` and `_L(uid, "txn_inv_amt")`.

---

#### 2d. New Features

**Feature 1: Kur Güncelleme (Rate Update)**

Menu button: `💱 Kur Güncelle` → callback `menu:update_rate`

Flow states: `S_RATE_SELECT` → `S_RATE_VALUE` → confirm

```
Bot: "Hangi kuru güncellemek istiyorsunuz?"
[🇸🇦 SAR] [🇦🇪 AED] [🇪🇬 EGP] [🇹🇷 TRY] [🇬🇧 GBP] [🇪🇺 EUR]
[❌ İptal]

User: selects SAR

Bot: "💱 SAR — Mevcut kur: 1 USD = 3.7500 SAR
Yeni değeri girin:"

User: 3.78

Bot: "✅ SAR güncellendi: 1 USD = 3.7800 SAR"
+ inline menu
```

Implementation: `_do_update_rate(currency, rate, company_id, db)` — inserts a new `ExchangeRate` record (same model used by the web app). Only admin/manager roles can access this command.

Role check: `_find_admin` result role must be in `(admin, super_admin, manager, branch_manager)`.

**Feature 2: Müşteri Ekstre (Customer Statement)**

Menu button: `👤 Ekstre` → callback `menu:statement`

Flow states: `S_STMT_SEARCH` → user types name/code → bot shows matching customers as inline list → user selects → bot shows statement

```
Bot: "Müşteri adı veya kodunu yazın:"

User: "Ahmed"

Bot: [Ahmed Al-Rashidi (CP-2026-00001)]
     [Ahmed Hassan (CP-2026-00042)]
     [❌ İptal]

User: selects first

Bot: ─────────────────────
     👤 Ahmed Al-Rashidi
     📊 Net Bakiye: $1,250.00
     ─────────────────────
     Son 5 İşlem:
     ✅ TXN-2026-00121 | 15.05 14:30
      ├ 💸 Havale
      ├ $500.00
      └ —
     ...
     ─────────────────────
+ inline menu
```

Implementation: Reuse `_q_cp_bakiye()` + last 5 entries from `_q_cp_islemler()`. Search by name (case-insensitive ILIKE) or code (exact match).

**Feature 3: Bildirim Aboneliği (Notifications)**

Auto-notify all admins with `telegram_id` set when:
1. New transaction created via web app (any status)
2. Transaction status changed to `completed` or `cancelled`

Implementation:
- Add `notify_company(company_id: str, message: str)` to `telegram_multi_bot.py`
- Function: finds all users for that company with `telegram_id` set, sends `message` via the company's bot
- Called from `backend/app/api/transactions.py`:
  - After `POST /transactions` (new txn created)
  - After `PATCH /transactions/{id}/status` (status changed)
- Messages:
  - New: `"⏳ *Yeni İşlem*\n• No: TXN-XXX\n• Tür: Havale\n• Tutar: $500\n• Müşteri: Ahmed"`
  - Approved: `"✅ *Onaylandı*\n• No: TXN-XXX"`
  - Cancelled: `"❌ *İptal Edildi*\n• No: TXN-XXX"`

`notify_company` is non-blocking (fire-and-forget via `asyncio.create_task` or threading). Does not crash if bot is not running for that company.

---

## Data Flow

```
Web App creates txn
  → transactions.py API
  → notify_company(company_id, "⏳ Yeni işlem TXN-XXX...")
  → finds all admins with telegram_id for company
  → sends via running bot instance (if any)

Telegram user presses "➕ Yeni İşlem"
  → on_callback(menu:new_txn)
  → _cset(company_id, uid, S_TXN_TYPE, {})  [DB]
  → returns txn type selection keyboard

User selects type → selects customer → selects accounts → enters rate → enters amount
  → each step: state persisted in bot_conversations DB table
  → on restart: state survives, flow continues

User confirms
  → _do_create_txn() → DB insert
  → notify_company() sends confirmation to other admins
  → inline menu returned
```

## Error Handling

- `_cget` returns `None` if no row or if `updated_at` > 2h ago (treated as expired)
- `notify_company` wraps all sends in try/except, logs failures, never raises
- `_do_update_rate`: validates rate > 0, rate < 10000 (sanity check)
- `_do_create_txn` / `_do_create_cp`: DB errors caught, return `_L(uid, "server_err")`

## Testing

Each task includes a test or manual verification step:
- AI fix: verify two different company users see only their own data
- DB state: stop/start bot mid-flow, verify conversation resumes
- Inline menu: verify all 9 menu buttons trigger correct flows
- Rate update: verify ExchangeRate record created in DB
- Customer statement: verify correct data shown for known customer
- Notifications: verify message arrives in Telegram after web app creates a txn
