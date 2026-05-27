# AI Analysis Fix + Telegram Bot Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix AI analysis multi-tenancy data leak (company isolation) and overhaul the Telegram bot with persistent DB-backed conversation state, inline keyboard UI, bug fixes, and three new features (rate update, customer statement, notifications).

**Architecture:** Two independent subsystems — (1) a two-line fix in `ai_analyst.py` + `reports.py` to add `company_id` filtering, (2) a major refactor of `telegram_multi_bot.py` replacing in-memory state with a PostgreSQL `bot_conversations` table, swapping `ReplyKeyboardMarkup` for `InlineKeyboardMarkup`, fixing five bugs, and adding three new features. The notification feature adds a hook in `transactions.py` that fires to Telegram on create/approve.

**Tech Stack:** FastAPI, SQLAlchemy (raw SQL for bot state), python-telegram-bot v20+, PostgreSQL, React 18, python-telegram-bot InlineKeyboardMarkup/InlineKeyboardButton

---

## File Map

| File | Change |
|------|--------|
| `backend/app/services/ai_analyst.py` | Add `company_id` param + filter to both query functions |
| `backend/app/api/reports.py` | Pass `cu.company_id` to both AI service calls |
| `backend/app/core/migrations.py` | Add `bot_conversations` table DDL |
| `backend/app/services/telegram_multi_bot.py` | DB state, inline menu, bug fixes, 3 new features |
| `backend/app/api/transactions.py` | Call `notify_company()` on create and approve |

---

### Task 1: AI Analysis Multi-tenancy Fix

**Files:**
- Modify: `backend/app/services/ai_analyst.py`
- Modify: `backend/app/api/reports.py`

- [ ] **Step 1: Read current ai_analyst.py**

```bash
cat -n backend/app/services/ai_analyst.py
```

- [ ] **Step 2: Fix `get_financial_summary` — add `company_id` param and filter**

In `ai_analyst.py`, locate `get_financial_summary(db)` and change signature + both queries:

```python
def get_financial_summary(db, company_id: str):
    thirty_days_ago = datetime.now() - timedelta(days=30)
    txns = db.query(Transaction).filter(
        Transaction.company_id == company_id,
        Transaction.txn_date >= thirty_days_ago.date(),
        Transaction.status == 'completed'
    ).all()
```

Also find the second query in this function (if any) and add the same filter.

- [ ] **Step 3: Fix `get_ai_financial_analysis` — add `company_id` param, pass to summary**

```python
def get_ai_financial_analysis(db, prompt: str = None, company_id: str = None):
    summary = get_financial_summary(db, company_id)
    ...
```

- [ ] **Step 4: Fix `get_ai_chat_response` — add `company_id` param, pass to summary**

```python
def get_ai_chat_response(db, message: str, history: list = [], company_id: str = None):
    summary = get_financial_summary(db, company_id)
    ...
```

- [ ] **Step 5: Read current reports.py AI section**

```bash
grep -n "get_ai" backend/app/api/reports.py
```

- [ ] **Step 6: Fix reports.py — pass company_id to both calls**

Find the call to `get_ai_financial_analysis(db, prompt)` and change to:
```python
get_ai_financial_analysis(db, prompt, company_id=str(cu.company_id))
```

Find the call to `get_ai_chat_response(db, message, history)` and change to:
```python
get_ai_chat_response(db, message, history, company_id=str(cu.company_id))
```

- [ ] **Step 7: Verify no other callers of these functions**

```bash
grep -rn "get_ai_financial_analysis\|get_ai_chat_response\|get_financial_summary" backend/
```

Confirm only `ai_analyst.py` and `reports.py` appear. If other callers exist, update them too.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/ai_analyst.py backend/app/api/reports.py
git commit -m "fix: add company_id filter to AI analysis queries — fix multi-tenancy data leak"
```

---

### Task 2: DB-Backed Bot Conversation State

**Files:**
- Modify: `backend/app/core/migrations.py`
- Modify: `backend/app/services/telegram_multi_bot.py` (lines 302–382: `_cget/_cset/_cupd/_cclr`)

- [ ] **Step 1: Read migrations.py to understand the `_exec` pattern**

```bash
cat -n backend/app/core/migrations.py
```

Note how `_exec(sql)` works and where to add the new migration.

- [ ] **Step 2: Add `bot_conversations` table migration**

Add before the final `run_migrations()` call or inside it, after existing table creations:

```python
_exec("""
    CREATE TABLE IF NOT EXISTS bot_conversations (
        key         TEXT PRIMARY KEY,
        state       TEXT NOT NULL,
        data        TEXT NOT NULL DEFAULT '{}',
        updated_at  TIMESTAMP DEFAULT NOW()
    )
""")
_exec("""
    CREATE INDEX IF NOT EXISTS idx_bot_conv_updated ON bot_conversations(updated_at)
""")
```

- [ ] **Step 3: Read current in-memory state block in telegram_multi_bot.py (lines 302–382)**

```bash
sed -n '295,390p' backend/app/services/telegram_multi_bot.py
```

- [ ] **Step 4: Locate the engine/SessionLocal import at top of file**

```bash
head -50 backend/app/services/telegram_multi_bot.py
```

Confirm `from ..core.database import SessionLocal` (or similar) is present. Note the exact import path for `engine` if available, or use `SessionLocal`.

- [ ] **Step 5: Replace in-memory `_CONV` dict and `_cget/_cset/_cupd/_cclr` with DB versions**

Replace the entire block (the dict declaration and all four `_c*` functions) with:

```python
# ── Conversation state (DB-backed, survives restarts) ──────────────────────
_CONV_TIMEOUT_HOURS = 2
_CONV_CLEANUP_HOURS = 24

def _conv_key(company_id: str, uid: int) -> str:
    return f"{company_id}:{uid}"

def _cget(company_id: str, uid: int):
    """Return (state, data) or None if missing/expired."""
    from ..core.database import SessionLocal
    import json
    key = _conv_key(company_id, uid)
    db = SessionLocal()
    try:
        row = db.execute(
            text("""
                SELECT state, data, updated_at FROM bot_conversations
                WHERE key = :key
            """),
            {"key": key}
        ).fetchone()
        if row is None:
            return None
        from datetime import timezone
        updated = row.updated_at
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - updated).total_seconds() / 3600
        if age > _CONV_TIMEOUT_HOURS:
            _cclr(company_id, uid)
            return None
        return row.state, json.loads(row.data)
    except Exception as e:
        logger.warning(f"_cget error: {e}")
        return None
    finally:
        db.close()

def _cset(company_id: str, uid: int, state: str, data: dict):
    """Create or replace conversation row, cleanup old entries."""
    from ..core.database import SessionLocal
    import json
    key = _conv_key(company_id, uid)
    db = SessionLocal()
    try:
        db.execute(
            text("""
                INSERT INTO bot_conversations (key, state, data, updated_at)
                VALUES (:key, :state, :data, NOW())
                ON CONFLICT (key) DO UPDATE
                SET state = EXCLUDED.state,
                    data = EXCLUDED.data,
                    updated_at = NOW()
            """),
            {"key": key, "state": state, "data": json.dumps(data)}
        )
        # Cleanup entries older than 24h
        db.execute(
            text("""
                DELETE FROM bot_conversations
                WHERE updated_at < NOW() - INTERVAL ':hours hours'
            """),
            {"hours": _CONV_CLEANUP_HOURS}
        )
        db.commit()
    except Exception as e:
        logger.warning(f"_cset error: {e}")
        db.rollback()
    finally:
        db.close()

def _cupd(company_id: str, uid: int, data_update: dict):
    """Merge data_update into existing conversation data."""
    result = _cget(company_id, uid)
    if result is None:
        return
    state, data = result
    data.update(data_update)
    _cset(company_id, uid, state, data)

def _cclr(company_id: str, uid: int):
    """Delete conversation row."""
    from ..core.database import SessionLocal
    key = _conv_key(company_id, uid)
    db = SessionLocal()
    try:
        db.execute(
            text("DELETE FROM bot_conversations WHERE key = :key"),
            {"key": key}
        )
        db.commit()
    except Exception as e:
        logger.warning(f"_cclr error: {e}")
        db.rollback()
    finally:
        db.close()
```

**Important**: Ensure `from sqlalchemy import text` is imported at the top of the file (check existing imports; add if missing).

- [ ] **Step 6: Update all call sites that used old 2-arg `_cget(key)` / `_cset(key, state, data)` signatures**

Old pattern: `_cget(f"{company_id}:{uid}")` → New: `_cget(company_id, uid)`
Old pattern: `_cset(f"{company_id}:{uid}", state, data)` → New: `_cset(company_id, uid, state, data)`
Old pattern: `_cupd(f"{company_id}:{uid}", {...})` → New: `_cupd(company_id, uid, {...})`
Old pattern: `_cclr(f"{company_id}:{uid}")` → New: `_cclr(company_id, uid)`

```bash
grep -n "_cget\|_cset\|_cupd\|_cclr" backend/app/services/telegram_multi_bot.py
```

Update each call site to use the new 2-arg form (company_id, uid). The functions inside `make_handlers` capture `company_id` in closure, so `company_id` is available.

- [ ] **Step 7: Verify `text` import exists**

```bash
grep -n "from sqlalchemy" backend/app/services/telegram_multi_bot.py
```

If `from sqlalchemy import text` is missing, add it at the top.

- [ ] **Step 8: Commit**

```bash
git add backend/app/core/migrations.py backend/app/services/telegram_multi_bot.py
git commit -m "feat: replace in-memory bot state with DB-backed bot_conversations table"
```

---

### Task 3: Inline Keyboard UI

**Files:**
- Modify: `backend/app/services/telegram_multi_bot.py`

- [ ] **Step 1: Check current imports in telegram_multi_bot.py**

```bash
head -35 backend/app/services/telegram_multi_bot.py
```

Note which telegram classes are imported. We need `InlineKeyboardMarkup`, `InlineKeyboardButton`, `ReplyKeyboardRemove`.

- [ ] **Step 2: Update telegram imports**

In the import block, ensure these are present (add what's missing):
```python
from telegram import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardRemove,
    # ... keep existing imports except ReplyKeyboardMarkup if desired
)
```

- [ ] **Step 3: Add BOT_L keys for new menu buttons**

In the `BOT_L` dict (around line 36), add to all three languages (`tr`, `ar`, `en`):

```python
# In tr:
"btn_update_rate": "💱 Kur Güncelle",
"btn_statement":   "👤 Ekstre",
"btn_balance":     "💰 Bakiye",
"btn_report":      "📊 Rapor",
"btn_rates":       "💱 Kurlar",
"btn_txns":        "📋 İşlemler",
"btn_new_txn":     "➕ Yeni İşlem",
"btn_add_cp":      "👤 Müşteri Ekle",
"btn_lang":        "🌐 Dil",

# In ar:
"btn_update_rate": "💱 تحديث السعر",
"btn_statement":   "👤 كشف الحساب",
"btn_balance":     "💰 الرصيد",
"btn_report":      "📊 التقرير",
"btn_rates":       "💱 الأسعار",
"btn_txns":        "📋 المعاملات",
"btn_new_txn":     "➕ معاملة جديدة",
"btn_add_cp":      "👤 إضافة عميل",
"btn_lang":        "🌐 اللغة",

# In en:
"btn_update_rate": "💱 Update Rate",
"btn_statement":   "👤 Statement",
"btn_balance":     "💰 Balance",
"btn_report":      "📊 Report",
"btn_rates":       "💱 Rates",
"btn_txns":        "📋 Transactions",
"btn_new_txn":     "➕ New Transaction",
"btn_add_cp":      "👤 Add Customer",
"btn_lang":        "🌐 Language",
```

- [ ] **Step 4: Replace `_make_menu(uid)` with `_make_inline_menu(uid, is_admin=True)`**

Find `_make_menu` function and replace entirely:

```python
def _make_inline_menu(uid: int, is_admin: bool = True) -> InlineKeyboardMarkup:
    L = _L_raw(uid)  # or however _L is accessed for raw dict
    rows = [
        [
            InlineKeyboardButton(L.get("btn_balance", "💰 Bakiye"),     callback_data="menu:balance"),
            InlineKeyboardButton(L.get("btn_report",  "📊 Rapor"),      callback_data="menu:report"),
            InlineKeyboardButton(L.get("btn_rates",   "💱 Kurlar"),     callback_data="menu:rates"),
        ],
        [
            InlineKeyboardButton(L.get("btn_txns",    "📋 İşlemler"),   callback_data="menu:txns"),
            InlineKeyboardButton(L.get("btn_new_txn", "➕ Yeni İşlem"), callback_data="menu:new_txn"),
        ],
    ]
    if is_admin:
        rows.append([
            InlineKeyboardButton(L.get("btn_add_cp",      "👤 Müşteri Ekle"), callback_data="menu:add_cp"),
            InlineKeyboardButton(L.get("btn_update_rate", "💱 Kur Güncelle"), callback_data="menu:update_rate"),
        ])
        rows.append([
            InlineKeyboardButton(L.get("btn_statement", "👤 Ekstre"), callback_data="menu:statement"),
            InlineKeyboardButton(L.get("btn_lang",      "🌐 Dil"),    callback_data="menu:lang"),
        ])
    else:
        rows.append([
            InlineKeyboardButton(L.get("btn_lang", "🌐 Dil"), callback_data="menu:lang"),
        ])
    return InlineKeyboardMarkup(rows)
```

Note: check how `_L_raw(uid)` works in the existing code (it may be `BOT_L.get(_lang(uid), BOT_L["tr"])`). Use the same pattern.

- [ ] **Step 5: Update `on_start` to send `ReplyKeyboardRemove` then welcome + inline menu**

Find `on_start` handler and update the final send:

```python
# First, dismiss any old persistent keyboard
await update.message.reply_text("👋", reply_markup=ReplyKeyboardRemove())

welcome_text = _L(uid, "welcome")  # existing welcome string
await update.message.reply_text(
    welcome_text,
    parse_mode="Markdown",
    reply_markup=_make_inline_menu(uid, is_admin=is_admin)
)
```

- [ ] **Step 6: Update `on_callback` to handle `menu:` prefix callbacks**

Find `on_callback` and add dispatch at the start:

```python
async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    data = query.data

    if data.startswith("menu:"):
        action = data[5:]  # strip "menu:"
        dispatch = {
            "balance":     lambda: _q_bakiye(company_id, uid, db),
            "report":      lambda: _q_rapor(company_id, uid, db),
            "rates":       lambda: _q_kurlar(company_id, uid, db),
            "txns":        lambda: _q_son_islemler(company_id, uid, db),
            "new_txn":     lambda: _start_txn_type(company_id, uid, db),
            "add_cp":      lambda: _start_add_cp(company_id, uid, db),
            "update_rate": lambda: _start_rate_update(company_id, uid, db),
            "statement":   lambda: _start_statement(company_id, uid, db),
            "lang":        lambda: _q_lang(uid),
        }
        handler = dispatch.get(action)
        if handler:
            result = await handler()
            if result:
                await query.message.reply_text(
                    result,
                    parse_mode="Markdown",
                    reply_markup=_make_inline_menu(uid, is_admin=True)
                )
        return

    # ... existing callback handling below
```

Adjust the lambda pattern to match actual function signatures in the codebase (some may be coroutines, some may send directly).

- [ ] **Step 7: Remove `_menu_to_cmd` text-matching logic from `on_message`**

Find `_menu_to_cmd` and the call to it in `on_message`. Since all navigation is now inline keyboard callbacks, remove the text-to-command matching for main menu navigation. Keep direct command typing (`/start`, `/help`, etc.) working through `_admin_cmd`.

- [ ] **Step 8: Update all "completed action" responses to include inline menu**

Find places where bot returns a final result message (after `_q_bakiye`, `_q_rapor`, etc.) and add `reply_markup=_make_inline_menu(uid, is_admin=True)` to those `reply_text` calls.

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/telegram_multi_bot.py
git commit -m "feat: replace ReplyKeyboardMarkup with InlineKeyboardMarkup transparent menu"
```

---

### Task 4: Bug Fixes

**Files:**
- Modify: `backend/app/services/telegram_multi_bot.py`

- [ ] **Step 1: Fix `_q_son_islemler` wrong locale key**

```bash
grep -n "unknown_cmd\|q_no_txn" backend/app/services/telegram_multi_bot.py
```

Find line ~1574 where `L.get('unknown_cmd', ...)` is used for empty transaction list. Change to:
```python
L.get('q_no_txn', '📭 *İşlem bulunamadı.*')
```

- [ ] **Step 2: Fix `_ask_from_acc` — add `uid` param, replace hardcoded Turkish**

```bash
grep -n "_ask_from_acc\|_ask_to_acc\|_ask_amount\|_ask_cp_type" backend/app/services/telegram_multi_bot.py
```

For each flow helper that has hardcoded Turkish strings, update the signature to include `uid: int = 0` and replace strings with `_L(uid, "key")`. Add the required keys to `BOT_L` if not present:

- `"ask_from_acc"`: `"Gönderen hesabı seçin:"` / `"Select sender account:"` / `"اختر حساب المرسل:"`
- `"ask_to_acc"`: `"Alıcı hesabı seçin:"` / `"Select recipient account:"` / `"اختر حساب المستلم:"`
- `"ask_amount"`: `"Tutarı girin:"` / `"Enter amount:"` / `"أدخل المبلغ:"`
- `"ask_cp_type"`: `"Müşteri türü:"` / `"Customer type:"` / `"نوع العميل:"`

- [ ] **Step 3: Fix amount parsing dead code**

```bash
grep -n "replace.*,\|float(text" backend/app/services/telegram_multi_bot.py | head -20
```

Find the dead first parse attempt around line 786. Replace the entire amount-parsing block with:
```python
try:
    if "," in text and "." in text:
        amt = float(text.replace(",", ""))
    elif "," in text:
        amt = float(text.replace(",", "."))
    else:
        amt = float(text)
except ValueError:
    amt = None
```

- [ ] **Step 4: Fix `_conv_handle_text` hardcoded error strings**

```bash
grep -n "txn_inv_rate\|txn_inv_amt\|Geçersiz kur\|Geçersiz tutar" backend/app/services/telegram_multi_bot.py
```

Replace inline Turkish error strings with:
- `"Geçersiz kur"` → `_L(uid, "txn_inv_rate")`
- `"Geçersiz tutar"` → `_L(uid, "txn_inv_amt")`

Add to BOT_L if missing:
```python
# tr
"txn_inv_rate": "❌ Geçersiz kur. Sayısal değer girin.",
"txn_inv_amt":  "❌ Geçersiz tutar. Sayısal değer girin.",
# en
"txn_inv_rate": "❌ Invalid rate. Enter a numeric value.",
"txn_inv_amt":  "❌ Invalid amount. Enter a numeric value.",
# ar
"txn_inv_rate": "❌ سعر غير صالح. أدخل قيمة رقمية.",
"txn_inv_amt":  "❌ مبلغ غير صالح. أدخل قيمة رقمية.",
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/telegram_multi_bot.py
git commit -m "fix: correct q_no_txn key, add uid to flow helpers, fix amount parsing, i18n error strings"
```

---

### Task 5: Rate Update Feature

**Files:**
- Modify: `backend/app/services/telegram_multi_bot.py`

- [ ] **Step 1: Add new state constants**

Find the state constants block (S_TXN_TYPE, S_TXN_CP, etc.) and add:
```python
S_RATE_SELECT = "rate_select"
S_RATE_VALUE  = "rate_value"
```

- [ ] **Step 2: Add BOT_L keys for rate update**

```python
# tr
"rate_select_prompt": "💱 Hangi kuru güncellemek istiyorsunuz?",
"rate_current":       "💱 {currency} — Mevcut kur: 1 USD = {rate:.4f} {currency}\nYeni değeri girin:",
"rate_updated":       "✅ {currency} güncellendi: 1 USD = {rate:.4f} {currency}",
"rate_invalid":       "❌ Geçersiz değer. Pozitif sayı girin.",
# en
"rate_select_prompt": "💱 Which rate do you want to update?",
"rate_current":       "💱 {currency} — Current rate: 1 USD = {rate:.4f} {currency}\nEnter new value:",
"rate_updated":       "✅ {currency} updated: 1 USD = {rate:.4f} {currency}",
"rate_invalid":       "❌ Invalid value. Enter a positive number.",
# ar
"rate_select_prompt": "💱 أي سعر تريد تحديثه؟",
"rate_current":       "💱 {currency} — السعر الحالي: 1 USD = {rate:.4f} {currency}\nأدخل القيمة الجديدة:",
"rate_updated":       "✅ تم تحديث {currency}: 1 USD = {rate:.4f} {currency}",
"rate_invalid":       "❌ قيمة غير صالحة. أدخل رقمًا موجبًا.",
```

- [ ] **Step 3: Implement `_start_rate_update(company_id, uid, db)`**

```python
async def _start_rate_update(company_id: str, uid: int, db) -> str:
    """Start rate update flow — show currency selection keyboard."""
    currencies = ["SAR", "AED", "EGP", "TRY", "GBP", "EUR"]
    flags = {"SAR": "🇸🇦", "AED": "🇦🇪", "EGP": "🇪🇬", "TRY": "🇹🇷", "GBP": "🇬🇧", "EUR": "🇪🇺"}
    buttons = [
        [InlineKeyboardButton(f"{flags.get(c, '')} {c}", callback_data=f"rate_sel:{c}")]
        for c in currencies
    ]
    buttons.append([InlineKeyboardButton("❌ " + _L(uid, "cancel", "İptal"), callback_data="rate_sel:cancel")])
    _cset(company_id, uid, S_RATE_SELECT, {})
    return _L(uid, "rate_select_prompt")
    # Note: caller sends with InlineKeyboardMarkup(buttons) as reply_markup
```

Adjust return to pass the keyboard too — return a tuple `(text, markup)` or send directly. Follow the pattern used by existing flow starters.

- [ ] **Step 4: Handle `rate_sel:` callback in `on_callback`**

In `on_callback`, add after the `menu:` handler:
```python
if data.startswith("rate_sel:"):
    currency = data[9:]
    if currency == "cancel":
        _cclr(company_id, uid)
        await query.message.reply_text(
            _L(uid, "cancelled", "İptal edildi."),
            reply_markup=_make_inline_menu(uid)
        )
        return
    # Fetch current rate
    from ..models.transaction import ExchangeRate
    rate_row = db.query(ExchangeRate).filter(
        ExchangeRate.currency_code == currency,
        ExchangeRate.company_id == company_id
    ).order_by(ExchangeRate.date.desc()).first()
    current_rate = float(rate_row.rate_per_usd) if rate_row else 0.0
    _cset(company_id, uid, S_RATE_VALUE, {"currency": currency})
    msg = _L(uid, "rate_current").format(currency=currency, rate=current_rate)
    await query.message.reply_text(msg, parse_mode="Markdown")
    return
```

- [ ] **Step 5: Handle `S_RATE_VALUE` state in `_conv_handle_text`**

In the state dispatch of `_conv_handle_text`, add:
```python
elif state == S_RATE_VALUE:
    try:
        new_rate = float(text.replace(",", "."))
        if new_rate <= 0 or new_rate > 10000:
            raise ValueError("out of range")
    except ValueError:
        await message.reply_text(_L(uid, "rate_invalid"))
        return
    currency = data.get("currency", "")
    await _do_update_rate(currency, new_rate, company_id, uid, db)
    _cclr(company_id, uid)
    await message.reply_text(
        _L(uid, "rate_updated").format(currency=currency, rate=new_rate),
        parse_mode="Markdown",
        reply_markup=_make_inline_menu(uid)
    )
```

- [ ] **Step 6: Implement `_do_update_rate(currency, rate, company_id, uid, db)`**

```python
async def _do_update_rate(currency: str, rate: float, company_id: str, uid: int, db) -> str:
    """Insert a new ExchangeRate record."""
    from ..models.transaction import ExchangeRate
    from decimal import Decimal
    from datetime import date
    try:
        er = ExchangeRate(
            date=date.today(),
            currency_code=currency,
            rate_per_usd=Decimal(str(rate)),
            source="telegram_bot",
            company_id=company_id,
        )
        db.add(er)
        db.commit()
        return _L(uid, "rate_updated").format(currency=currency, rate=rate)
    except Exception as e:
        db.rollback()
        logger.error(f"_do_update_rate error: {e}")
        return _L(uid, "server_err", "❌ Sunucu hatası.")
```

- [ ] **Step 7: Add role check — only admin/manager can update rates**

In `_start_rate_update`, add before setting state:
```python
admin = _find_admin(company_id, uid, db)
if not admin or admin.role not in ("admin", "super_admin", "manager", "branch_manager"):
    return _L(uid, "no_permission", "❌ Bu işlem için yetkiniz yok.")
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/telegram_multi_bot.py
git commit -m "feat: add Kur Güncelleme (rate update) feature to Telegram bot"
```

---

### Task 6: Customer Statement Feature

**Files:**
- Modify: `backend/app/services/telegram_multi_bot.py`

- [ ] **Step 1: Add new state constants**

```python
S_STMT_SEARCH = "stmt_search"
S_STMT_SELECT = "stmt_select"
```

- [ ] **Step 2: Add BOT_L keys for statement**

```python
# tr
"stmt_search_prompt": "👤 Müşteri adı veya kodunu yazın:",
"stmt_no_results":    "📭 Eşleşen müşteri bulunamadı.",
"stmt_header":        "─────────────────────\n👤 {name}\n📊 Net Bakiye: ${balance:,.2f}\n─────────────────────\nSon 5 İşlem:",
"stmt_footer":        "─────────────────────",
# en
"stmt_search_prompt": "👤 Enter customer name or code:",
"stmt_no_results":    "📭 No matching customers found.",
"stmt_header":        "─────────────────────\n👤 {name}\n📊 Net Balance: ${balance:,.2f}\n─────────────────────\nLast 5 Transactions:",
"stmt_footer":        "─────────────────────",
# ar
"stmt_search_prompt": "👤 أدخل اسم العميل أو الرمز:",
"stmt_no_results":    "📭 لم يتم العثور على عملاء مطابقين.",
"stmt_header":        "─────────────────────\n👤 {name}\n📊 الرصيد الصافي: ${balance:,.2f}\n─────────────────────\nآخر 5 معاملات:",
"stmt_footer":        "─────────────────────",
```

- [ ] **Step 3: Implement `_start_statement(company_id, uid, db)`**

```python
async def _start_statement(company_id: str, uid: int, db) -> str:
    _cset(company_id, uid, S_STMT_SEARCH, {})
    return _L(uid, "stmt_search_prompt")
```

- [ ] **Step 4: Implement `_search_counterparties(query, company_id, db)`**

```python
def _search_counterparties(query: str, company_id: str, db):
    """Search counterparties by name (ILIKE) or exact code match."""
    from ..models.transaction import Counterparty  # adjust import
    results = db.query(Counterparty).filter(
        Counterparty.company_id == company_id,
        (Counterparty.name.ilike(f"%{query}%") | (Counterparty.code == query))
    ).limit(10).all()
    return results
```

Note: verify the actual model name and field names from the codebase (`grep -n "class Counterparty\|cp_code\|cp_name" backend/app/models/`).

- [ ] **Step 5: Handle `S_STMT_SEARCH` state in `_conv_handle_text`**

```python
elif state == S_STMT_SEARCH:
    results = _search_counterparties(text, company_id, db)
    if not results:
        await message.reply_text(_L(uid, "stmt_no_results"))
        return
    buttons = [
        [InlineKeyboardButton(f"{cp.name} ({cp.code})", callback_data=f"stmt_cp:{cp.id}")]
        for cp in results
    ]
    buttons.append([InlineKeyboardButton("❌ " + _L(uid, "cancel", "İptal"), callback_data="stmt_cp:cancel")])
    _cset(company_id, uid, S_STMT_SELECT, {"search": text})
    await message.reply_text(
        _L(uid, "stmt_search_prompt"),
        reply_markup=InlineKeyboardMarkup(buttons)
    )
```

- [ ] **Step 6: Handle `stmt_cp:` callback in `on_callback`**

```python
if data.startswith("stmt_cp:"):
    cp_id = data[8:]
    if cp_id == "cancel":
        _cclr(company_id, uid)
        await query.message.reply_text(
            _L(uid, "cancelled", "İptal edildi."),
            reply_markup=_make_inline_menu(uid)
        )
        return
    # Build statement
    stmt_text = await _build_statement(cp_id, company_id, uid, db)
    _cclr(company_id, uid)
    await query.message.reply_text(
        stmt_text,
        parse_mode="Markdown",
        reply_markup=_make_inline_menu(uid)
    )
    return
```

- [ ] **Step 7: Implement `_build_statement(cp_id, company_id, uid, db)`**

```python
async def _build_statement(cp_id: str, company_id: str, uid: int, db) -> str:
    """Build a customer statement: net balance + last 5 transactions."""
    from ..models.transaction import Counterparty, Transaction
    cp = db.query(Counterparty).filter(
        Counterparty.id == cp_id,
        Counterparty.company_id == company_id
    ).first()
    if not cp:
        return _L(uid, "server_err", "❌ Müşteri bulunamadı.")

    # Net balance: sum of completed transactions
    txns = db.query(Transaction).filter(
        Transaction.company_id == company_id,
        Transaction.counterparty_id == cp_id,
        Transaction.status == "completed"
    ).order_by(Transaction.txn_date.desc()).all()

    balance = sum(
        float(t.amount_usd) if t.direction == "credit" else -float(t.amount_usd)
        for t in txns
        if t.amount_usd is not None
    )

    header = _L(uid, "stmt_header").format(name=cp.name, balance=balance)
    lines = [header]

    for t in txns[:5]:
        date_str = t.txn_date.strftime("%d.%m %H:%M") if t.txn_date else "—"
        amount_str = f"${float(t.amount_usd):,.2f}" if t.amount_usd else "—"
        lines.append(
            f"✅ {t.txn_number} | {date_str}\n"
            f" ├ 💸 {t.txn_type}\n"
            f" ├ {amount_str}\n"
            f" └ —"
        )

    lines.append(_L(uid, "stmt_footer"))
    return "\n".join(lines)
```

Verify field names match the actual Transaction model (use `grep -n "txn_number\|amount_usd\|direction\|txn_type" backend/app/models/transaction.py`).

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/telegram_multi_bot.py
git commit -m "feat: add Müşteri Ekstre (customer statement) feature to Telegram bot"
```

---

### Task 7: Notifications Feature

**Files:**
- Modify: `backend/app/services/telegram_multi_bot.py`
- Modify: `backend/app/api/transactions.py`

- [ ] **Step 1: Add `_running_apps` dict to telegram_multi_bot.py**

Find where bot applications are stored (likely where `Application.builder()` is called and stored). Add a module-level dict:

```python
_running_apps: Dict[str, Any] = {}  # company_id → telegram Application instance
```

When a bot starts for a company, register it: `_running_apps[company_id] = application`
When a bot stops, deregister: `_running_apps.pop(company_id, None)`

Find `start_bot(company_id, token)` or equivalent and add registration.

- [ ] **Step 2: Implement `notify_company(company_id, message)`**

```python
async def _notify_company_async(company_id: str, message: str):
    """Send message to all admins with telegram_id for this company."""
    from ..core.database import SessionLocal
    from ..models.user import User  # adjust import
    db = SessionLocal()
    try:
        app = _running_apps.get(str(company_id))
        if app is None:
            return
        admins = db.query(User).filter(
            User.company_id == company_id,
            User.telegram_id.isnot(None),
            User.role.in_(["admin", "super_admin", "manager", "branch_manager"])
        ).all()
        for admin in admins:
            try:
                await app.bot.send_message(
                    chat_id=int(admin.telegram_id),
                    text=message,
                    parse_mode="Markdown"
                )
            except Exception as e:
                logger.warning(f"notify_company send error uid={admin.telegram_id}: {e}")
    except Exception as e:
        logger.warning(f"notify_company error: {e}")
    finally:
        db.close()


def notify_company(company_id: str, message: str):
    """Fire-and-forget notification to all company admins with telegram_id."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(_notify_company_async(company_id, message))
        else:
            loop.run_until_complete(_notify_company_async(company_id, message))
    except Exception as e:
        logger.warning(f"notify_company dispatch error: {e}")
```

- [ ] **Step 3: Export `notify_company` in module**

Ensure `notify_company` is accessible from `transactions.py`. Verify with:
```bash
grep -n "^from\|^import" backend/app/api/transactions.py | head -20
```

- [ ] **Step 4: Read transactions.py create_transaction and approve functions**

```bash
grep -n "def create_transaction\|def approve\|db.commit" backend/app/api/transactions.py | head -30
```

- [ ] **Step 5: Add import in transactions.py**

At the top of `transactions.py`, add:
```python
from ..services.telegram_multi_bot import notify_company
```

Use a try/except to handle cases where the bot service is not available:
```python
try:
    from ..services.telegram_multi_bot import notify_company as _notify_company
    def notify_company(company_id, message):
        try:
            _notify_company(company_id, message)
        except Exception:
            pass
except ImportError:
    def notify_company(company_id, message):
        pass
```

- [ ] **Step 6: Add notification after `create_transaction` commit**

Find the `db.commit()` call after a new transaction is created. After it, add:
```python
# Notify admins via Telegram
msg = (
    f"⏳ *Yeni İşlem*\n"
    f"• No: {new_txn.txn_number}\n"
    f"• Tür: {new_txn.txn_type}\n"
    f"• Tutar: ${float(new_txn.amount_usd or 0):,.2f}\n"
    f"• Müşteri: {new_txn.counterparty_name or '—'}"
)
notify_company(str(new_txn.company_id), msg)
```

Adjust field names to match the actual Transaction model fields.

- [ ] **Step 7: Add notification after `approve` / status change commit**

Find the function that changes transaction status to `completed` or `cancelled`. After commit:
```python
if new_status == "completed":
    msg = f"✅ *Onaylandı*\n• No: {txn.txn_number}"
elif new_status == "cancelled":
    msg = f"❌ *İptal Edildi*\n• No: {txn.txn_number}"
else:
    msg = None
if msg:
    notify_company(str(txn.company_id), msg)
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/telegram_multi_bot.py backend/app/api/transactions.py
git commit -m "feat: add notify_company() and transaction notification hooks for Telegram bot"
```

---

### Task 8: Build Verify + Deploy

**Files:** No code changes — verify build and deploy.

- [ ] **Step 1: Check Python syntax on modified backend files**

```bash
python -m py_compile backend/app/services/ai_analyst.py && echo "OK"
python -m py_compile backend/app/api/reports.py && echo "OK"
python -m py_compile backend/app/core/migrations.py && echo "OK"
python -m py_compile backend/app/services/telegram_multi_bot.py && echo "OK"
python -m py_compile backend/app/api/transactions.py && echo "OK"
```

Fix any syntax errors before proceeding.

- [ ] **Step 2: Check frontend builds (optional fast check)**

```bash
cd frontend && npm run build --silent 2>&1 | tail -5
```

Expected: `✓ built in X.Xs` or similar success output.

- [ ] **Step 3: Verify all commits are clean**

```bash
git log --oneline -10
git status
```

Expected: clean working tree, 7 new commits on top of pre-task baseline.

- [ ] **Step 4: Deploy backend**

```bash
./deploy.sh hawale-backend
```

Wait for success message: `[✓] hawale-backend deploy tamamlandı`

- [ ] **Step 5: Deploy frontend**

```bash
./deploy.sh hawale-frontend
```

Wait for success message: `[✓] hawale-frontend deploy tamamlandı`

- [ ] **Step 6: Smoke-test AI analysis isolation**

Log in as two users from different companies. Both use AI Analysis. Verify each sees only their own company's transaction data in the analysis.

- [ ] **Step 7: Smoke-test Telegram bot inline menu**

Send `/start` to the bot. Verify:
- Old persistent keyboard is dismissed (ReplyKeyboardRemove sent)
- Welcome message shows with inline buttons
- All 9 buttons visible and labeled correctly in the user's language

- [ ] **Step 8: Final commit (if any cleanup needed)**

```bash
git add -A
git status  # should be clean
# If any stray changes:
git commit -m "chore: post-deploy cleanup"
```
