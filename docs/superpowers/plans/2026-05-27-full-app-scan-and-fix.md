# Full App Scan & Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every discovered bug, security issue, i18n gap, and performance problem across backend (FastAPI) and frontend (React).

**Architecture:** Sequential fixes — backend first, then frontend. Each task commits independently so partial progress is always recoverable.

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy (backend) · React 18 / Vite / Zustand / react-router-dom v6 (frontend)

---

## Discovered Issues Summary

| # | File | Category | Issue |
|---|------|----------|-------|
| 1 | auth.py | 🌍 i18n | 5 hardcoded Turkish HTTP error messages |
| 2 | security.py | 🌍 i18n | 3 hardcoded Turkish error strings |
| 3 | users.py | 🌍 i18n | 20+ hardcoded Turkish HTTP error messages |
| 4 | reports.py | 🌍 i18n | 5 hardcoded Turkish HTTP error messages |
| 5 | transactions.py | 🌍 i18n | 5 hardcoded Turkish HTTP error messages |
| 6 | master.py | 🌍 i18n | 18 hardcoded Turkish HTTP error messages |
| 7 | settings.py | 🌍 i18n | 3 hardcoded Turkish HTTP error messages |
| 8 | users.py:45 | ⚡ Perf | `is_active` filtered in Python not SQL — fetches all users from DB |
| 9 | users.py:196 | 🔐 Security | `PasswordReset` model has no min-length validation |
| 10 | reports.py:57 | 🐛 Bug | Commented-out `audit_log(None, ...)` — dead code with wrong params |
| 11 | reconciliation.py | ⚡ Perf | N+1: per-account aggregate queries — 2 SQL per account |
| 12 | App.jsx:71 | 🐛 Bug | `window.location.pathname` not reactive — should use `useLocation()` |
| 13 | locale files | 🌍 i18n | `deleteUserConfirm` format inconsistency across tr/en/ar |

---

## Task 1: Backend i18n — auth.py + security.py

**Files:**
- Modify: `backend/app/api/auth.py`
- Modify: `backend/app/core/security.py`

- [ ] **Step 1: Fix auth.py — 5 Turkish error strings**

  Open `backend/app/api/auth.py` and apply these exact replacements:

  ```python
  # Line 44 — rate limit message
  # BEFORE:
  detail=f"Çok fazla giriş denemesi. {WINDOW_SEC} saniye bekleyin."
  # AFTER:
  detail=f"Too many login attempts. Please wait {WINDOW_SEC} seconds."

  # Line 79 — wrong credentials
  # BEFORE:
  raise HTTPException(status_code=401, detail="Hatalı email veya şifre")
  # AFTER:
  raise HTTPException(status_code=401, detail="Invalid email or password")

  # Line 82 — not approved
  # BEFORE:
  raise HTTPException(status_code=403, detail="Hesabınız henüz onaylanmadı.")
  # AFTER:
  raise HTTPException(status_code=403, detail="Account not yet approved.")

  # Line 133 — OTP invalid
  # BEFORE:
  raise HTTPException(status_code=401, detail="Kod hatalı veya süresi dolmuş.")
  # AFTER:
  raise HTTPException(status_code=401, detail="Invalid or expired code.")

  # Line 137 — user not found after OTP
  # BEFORE:
  raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
  # AFTER:
  raise HTTPException(status_code=404, detail="User not found.")
  ```

- [ ] **Step 2: Fix security.py — 3 Turkish error strings**

  Open `backend/app/core/security.py` and apply:

  ```python
  # Line 29 — invalid token (no sub claim)
  # BEFORE:
  raise HTTPException(status_code=401, detail="Geçersiz token")
  # AFTER:
  raise HTTPException(status_code=401, detail="Invalid token")

  # Line 31 — JWTError
  # BEFORE:
  raise HTTPException(status_code=401, detail="Geçersiz token")
  # AFTER:
  raise HTTPException(status_code=401, detail="Invalid token")

  # Line 34 — user not found / inactive
  # BEFORE:
  raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
  # AFTER:
  raise HTTPException(status_code=401, detail="User not found or inactive")
  ```

- [ ] **Step 3: Verify backend still starts**

  ```bash
  cd backend && python -c "from app.main import app; print('OK')"
  ```
  Expected output: `OK`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/app/api/auth.py backend/app/core/security.py
  git commit -m "i18n: translate auth and security error messages to English"
  ```

---

## Task 2: Backend i18n — users.py

**Files:**
- Modify: `backend/app/api/users.py`

- [ ] **Step 1: Fix all 20 Turkish error messages in users.py**

  Apply these replacements in `backend/app/api/users.py`:

  ```python
  # Line 34 — _admin_or_manager guard
  # BEFORE: raise HTTPException(403, "Yetkisiz")
  # AFTER:
  raise HTTPException(403, "Forbidden")

  # Line 51 — admin role creation restriction
  # BEFORE: raise HTTPException(403, "Sadece admin yeni bir admin oluşturabilir")
  # AFTER:
  raise HTTPException(403, "Only admin can create another admin")

  # Line 54 — duplicate email
  # BEFORE: raise HTTPException(400, "Bu email zaten kayıtlı")
  # AFTER:
  raise HTTPException(400, "Email already registered")

  # Line 88 — approve: role check
  # BEFORE: raise HTTPException(403, "Sadece admin onaylayabilir")
  # AFTER:
  raise HTTPException(403, "Only admin can approve users")

  # Line 91 — approve: user not found
  # BEFORE: raise HTTPException(404, "Kullanıcı bulunamadı")
  # AFTER:
  raise HTTPException(404, "User not found")

  # Line 94 — approve: cross-company
  # BEFORE: raise HTTPException(403, "Başka şirketin kullanıcısını onaylayamazsınız")
  # AFTER:
  raise HTTPException(403, "Cannot approve users from another company")

  # Line 106 — _super_admin_only
  # BEFORE: raise HTTPException(403, "Sadece super_admin şirketleri yönetebilir")
  # AFTER:
  raise HTTPException(403, "Only super_admin can manage companies")

  # Line 117 — empty company code
  # BEFORE: raise HTTPException(400, "Şirket kodu boş olamaz")
  # AFTER:
  raise HTTPException(400, "Company code cannot be empty")

  # Line 119 — duplicate company code
  # BEFORE: raise HTTPException(400, f"'{code}' kodu zaten kullanılıyor")
  # AFTER:
  raise HTTPException(400, f"Code '{code}' is already in use")

  # Line 121 — duplicate admin email
  # BEFORE: raise HTTPException(400, f"'{data.admin_email}' e-posta adresi zaten kayıtlı")
  # AFTER:
  raise HTTPException(400, f"Email '{data.admin_email}' is already registered")

  # Line 123 — weak admin password
  # BEFORE: raise HTTPException(400, "Admin şifresi en az 6 karakter olmalı")
  # AFTER:
  raise HTTPException(400, "Admin password must be at least 6 characters")

  # Line 168 — telegram-bot: forbidden
  # BEFORE: raise HTTPException(403, "Yetki yok")
  # AFTER:
  raise HTTPException(403, "Forbidden")

  # Line 171 — telegram-bot: company not found
  # BEFORE: raise HTTPException(404, "Şirket bulunamadı")
  # AFTER:
  raise HTTPException(404, "Company not found")

  # Line 189 — toggle: company not found
  # BEFORE: raise HTTPException(404, "Şirket bulunamadı")
  # AFTER:
  raise HTTPException(404, "Company not found")

  # Line 202 — reset_password: user not found
  # BEFORE: raise HTTPException(404, "Kullanıcı bulunamadı")
  # AFTER:
  raise HTTPException(404, "User not found")

  # Line 205 — reset_password: cross-company (admin)
  # BEFORE: raise HTTPException(403, "Başka şirketin kullanıcısının şifresini değiştiremezsiniz")
  # AFTER:
  raise HTTPException(403, "Cannot reset password of a user from another company")

  # Line 209 — reset_password: manager vs admin
  # BEFORE: raise HTTPException(403, "Manager bir adminin şifresini değiştiremez")
  # AFTER:
  raise HTTPException(403, "Manager cannot reset an admin's password")

  # Line 211 — reset_password: cross-company (manager)
  # BEFORE: raise HTTPException(403, "Başka şirketin kullanıcısının şifresini değiştiremezsiniz")
  # AFTER:
  raise HTTPException(403, "Cannot reset password of a user from another company")

  # Line 231 — regenerate-pin: role check
  # BEFORE: raise HTTPException(403, "Sadece admin PIN yenileyebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can regenerate PIN")

  # Line 233 — regenerate-pin: user not found
  # BEFORE: raise HTTPException(404, "Kullanıcı bulunamadı")
  # AFTER:
  raise HTTPException(404, "User not found")

  # Line 236 — regenerate-pin: cross-company
  # BEFORE: raise HTTPException(403, "Başka şirketin kullanıcısını düzenleyemezsiniz")
  # AFTER:
  raise HTTPException(403, "Cannot edit users from another company")

  # Line 252 — delete: role check
  # BEFORE: raise HTTPException(403, "Sadece admin kullanıcı silebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can delete users")

  # Line 255 — delete: self-delete
  # BEFORE: raise HTTPException(400, "Kendinizi silemezsiniz")
  # AFTER:
  raise HTTPException(400, "Cannot delete yourself")

  # Line 258 — delete: user not found
  # BEFORE: raise HTTPException(404, "Kullanıcı bulunamadı")
  # AFTER:
  raise HTTPException(404, "User not found")
  ```

- [ ] **Step 2: Verify**

  ```bash
  cd backend && python -c "from app.api.users import router; print('OK')"
  ```
  Expected: `OK`

- [ ] **Step 3: Commit**

  ```bash
  git add backend/app/api/users.py
  git commit -m "i18n: translate users API error messages to English"
  ```

---

## Task 3: Backend i18n — reports.py + transactions.py

**Files:**
- Modify: `backend/app/api/reports.py`
- Modify: `backend/app/api/transactions.py`

- [ ] **Step 1: Fix reports.py — 5 Turkish strings**

  ```python
  # Line 58 — _require_role unauthorized
  # BEFORE:
  raise HTTPException(403, f"Yetkisiz: Bu rapor için {', '.join(roles)} yetkisi gerekli")
  # AFTER:
  raise HTTPException(403, f"Unauthorized: required roles: {', '.join(r.value for r in roles)}")

  # Line 68 — data_entry position restriction
  # BEFORE:
  raise HTTPException(403, "Veri giriş personeli kasa bakiyelerini göremez")
  # AFTER:
  raise HTTPException(403, "Data entry role cannot view account balances")

  # Line 328 — counterparty not found
  # BEFORE:
  raise HTTPException(404, "Karşı taraf bulunamadı")
  # AFTER:
  raise HTTPException(404, "Counterparty not found")

  # Line 666 — saved report not found (toggle favorite)
  # BEFORE:
  raise HTTPException(404, "Rapor bulunamadı")
  # AFTER:
  raise HTTPException(404, "Report not found")

  # Line 678 — saved report not found (delete)
  # BEFORE:
  raise HTTPException(404, "Rapor bulunamadı")
  # AFTER:
  raise HTTPException(404, "Report not found")
  ```

- [ ] **Step 2: Fix transactions.py — 5 Turkish strings**

  ```python
  # Line 33 — _require: forbidden
  # BEFORE:
  raise HTTPException(403, "Yetkisiz işlem")
  # AFTER:
  raise HTTPException(403, "Forbidden")

  # Line 116 — account not found
  # BEFORE:
  raise HTTPException(404, f"Hesap bulunamadı: {leg.account_id}")
  # AFTER:
  raise HTTPException(404, f"Account not found: {leg.account_id}")

  # Line 118 — currency mismatch
  # BEFORE:
  raise HTTPException(400, f"'{acc.name}' hesabı sadece {acc.currency.code} cinsinden işlem yapabilir")
  # AFTER:
  raise HTTPException(400, f"Account '{acc.name}' only supports {acc.currency.code} transactions")

  # Line 275 — transaction not found (approve)
  # BEFORE:
  raise HTTPException(404, "İşlem bulunamadı")
  # AFTER:
  raise HTTPException(404, "Transaction not found")

  # Line 309 — transaction not found (delete)
  # BEFORE:
  raise HTTPException(404, "İşlem bulunamadı")
  # AFTER:
  raise HTTPException(404, "Transaction not found")
  ```

- [ ] **Step 3: Verify**

  ```bash
  cd backend && python -c "from app.api.reports import router; from app.api.transactions import router as tr; print('OK')"
  ```
  Expected: `OK`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/app/api/reports.py backend/app/api/transactions.py
  git commit -m "i18n: translate reports and transactions API error messages to English"
  ```

---

## Task 4: Backend i18n — master.py + settings.py

**Files:**
- Modify: `backend/app/api/master.py`
- Modify: `backend/app/api/settings.py`

- [ ] **Step 1: Fix master.py — 18 Turkish strings**

  ```python
  # Line 38 — create_location: role check
  # BEFORE: raise HTTPException(403, "Sadece admin yeni lokasyon ekleyebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can add locations")

  # Line 41 — create_location: empty code
  # BEFORE: raise HTTPException(400, "Lokasyon kodu boş olamaz")
  # AFTER:
  raise HTTPException(400, "Location code cannot be empty")

  # Line 43 — create_location: code too long
  # BEFORE: raise HTTPException(400, "Lokasyon kodu en fazla 10 karakter olabilir")
  # AFTER:
  raise HTTPException(400, "Location code cannot exceed 10 characters")

  # Line 45 — create_location: name_tr required
  # BEFORE: raise HTTPException(400, "Türkçe isim zorunludur")
  # AFTER:
  raise HTTPException(400, "Turkish name is required")

  # Line 48 — create_location: duplicate code
  # BEFORE: raise HTTPException(400, f"'{code}' kodu zaten kullanılıyor")
  # AFTER:
  raise HTTPException(400, f"Code '{code}' is already in use")

  # Line 65 — update_location: role check
  # BEFORE: raise HTTPException(403, "Sadece admin lokasyon düzenleyebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can edit locations")

  # Line 70 — update_location: not found
  # BEFORE: raise HTTPException(404, "Lokasyon bulunamadı")
  # AFTER:
  raise HTTPException(404, "Location not found")

  # Line 73 — update_location: empty name_tr
  # BEFORE: raise HTTPException(400, "Türkçe isim boş olamaz")
  # AFTER:
  raise HTTPException(400, "Turkish name cannot be empty")

  # Line 88 — delete_location: role check
  # BEFORE: raise HTTPException(403, "Sadece admin lokasyon silebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can delete locations")

  # Line 93 — delete_location: not found
  # BEFORE: raise HTTPException(404, "Lokasyon bulunamadı")
  # AFTER:
  raise HTTPException(404, "Location not found")

  # Line 97 — delete_location: has active accounts
  # BEFORE: raise HTTPException(400, f"Bu lokasyona ait {active_accounts} aktif hesap var — önce hesapları silin")
  # AFTER:
  raise HTTPException(400, f"Location has {active_accounts} active account(s) — delete them first")

  # Line 128 — create_account: role check
  # BEFORE: raise HTTPException(403, "Sadece admin yapabilir")
  # AFTER:
  raise HTTPException(403, "Only admin can perform this action")

  # Line 140 — account_balance: not found
  # BEFORE: raise HTTPException(404, "Hesap bulunamadı")
  # AFTER:
  raise HTTPException(404, "Account not found")

  # Line 205 — regenerate_bot_pin: role check
  # BEFORE: raise HTTPException(403, "Sadece admin PIN yenileyebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can regenerate PIN")

  # Line 210 — regenerate_bot_pin: not found
  # BEFORE: raise HTTPException(404, "Müşteri bulunamadı")
  # AFTER:
  raise HTTPException(404, "Counterparty not found")

  # Line 221 — update_counterparty: role check
  # BEFORE: raise HTTPException(403, "Yetkisiz")
  # AFTER:
  raise HTTPException(403, "Forbidden")

  # Line 226 — update_counterparty: not found
  # BEFORE: raise HTTPException(404, "Bulunamadı")
  # AFTER:
  raise HTTPException(404, "Counterparty not found")

  # Line 240 — delete_counterparty: role check
  # BEFORE: raise HTTPException(403, "Sadece admin silebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can delete")

  # Line 245 — delete_counterparty: not found
  # BEFORE: raise HTTPException(404, "Karşı taraf bulunamadı")
  # AFTER:
  raise HTTPException(404, "Counterparty not found")

  # Line 259 — delete_account: role check
  # BEFORE: raise HTTPException(403, "Sadece admin silebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can delete")

  # Line 265 — delete_account: not found
  # BEFORE: raise HTTPException(404, "Hesap bulunamadı")
  # AFTER:
  raise HTTPException(404, "Account not found")

  # Line 271 — delete_account: non-zero balance
  # BEFORE: raise HTTPException(400, f"Hesap bakiyesi {balance} — sıfırlanmadan silinemez")
  # AFTER:
  raise HTTPException(400, f"Account balance is {balance} — cannot delete until zero")

  # Line 323 — auto_update_rates: error
  # BEFORE: raise HTTPException(503, f"Kur güncellenemedi: {result['error']}")
  # AFTER:
  raise HTTPException(503, f"Rate update failed: {result['error']}")
  ```

- [ ] **Step 2: Fix settings.py — 3 Turkish strings**

  ```python
  # Line 32 — _require_admin: role check
  # BEFORE: raise HTTPException(403, "Sadece admin erişebilir")
  # AFTER:
  raise HTTPException(403, "Only admin can access settings")

  # Line 61 — update_setting: unknown key
  # BEFORE: raise HTTPException(400, f"Bilinmeyen ayar anahtarı: {key}")
  # AFTER:
  raise HTTPException(400, f"Unknown setting key: {key}")

  # Line 84 — clear_setting: unknown key
  # BEFORE: raise HTTPException(400, f"Bilinmeyen ayar anahtarı: {key}")
  # AFTER:
  raise HTTPException(400, f"Unknown setting key: {key}")
  ```

- [ ] **Step 3: Verify**

  ```bash
  cd backend && python -c "from app.api.master import router; from app.api.settings import router as sr; print('OK')"
  ```
  Expected: `OK`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/app/api/master.py backend/app/api/settings.py
  git commit -m "i18n: translate master and settings API error messages to English"
  ```

---

## Task 5: Backend — Functional Bug Fixes

**Files:**
- Modify: `backend/app/api/users.py`
- Modify: `backend/app/api/reports.py`

- [ ] **Step 1: Fix users.py list_users — move is_active filter to SQL**

  In `backend/app/api/users.py`, `list_users` function (around line 37-45):

  ```python
  # BEFORE:
  @router.get("", response_model=List[UserOut])
  def list_users(db: Session = Depends(get_db), cu: User = Depends(_admin_or_manager)):
      q = db.query(User).order_by(User.created_at)
      # Non-super_admin only sees users in their own company
      company_id = get_company_id(cu)
      if company_id is not None:
          q = q.filter(User.company_id == company_id)
      # Sadece aktif kullanıcıları döndür (silinen kullanıcılar is_active=False)
      return [u for u in q.all() if u.is_active]

  # AFTER:
  @router.get("", response_model=List[UserOut])
  def list_users(db: Session = Depends(get_db), cu: User = Depends(_admin_or_manager)):
      q = db.query(User).filter(User.is_active == True).order_by(User.created_at)
      company_id = get_company_id(cu)
      if company_id is not None:
          q = q.filter(User.company_id == company_id)
      return q.all()
  ```

- [ ] **Step 2: Fix users.py PasswordReset — add min_length validation**

  In `backend/app/api/users.py`, add `Field` import and update `PasswordReset` model:

  ```python
  # At the top of the file, add Field to the pydantic import:
  # BEFORE:
  from pydantic import BaseModel
  # AFTER:
  from pydantic import BaseModel, Field

  # The PasswordReset class (around line 196):
  # BEFORE:
  class PasswordReset(BaseModel):
      password: str
  # AFTER:
  class PasswordReset(BaseModel):
      password: str = Field(min_length=6, description="New password (minimum 6 characters)")
  ```

- [ ] **Step 3: Fix reports.py — remove dead commented-out audit_log with None db**

  In `backend/app/api/reports.py`, inside `_require_role`, remove the dead comment (around line 56-57):

  ```python
  # BEFORE:
  def role_checker(cu: User = Depends(get_current_user)):
      if cu.role not in roles and cu.role not in [UserRole.admin, UserRole.super_admin, UserRole.auditor]:
          from app.services.audit import log as audit_log
          # Yetkisiz erişim denemesini logla
          # audit_log(None, "UNAUTHORIZED_ACCESS", user_id=cu.id, entity="Report") 
          raise HTTPException(403, f"Unauthorized: required roles: {', '.join(r.value for r in roles)}")
      return cu

  # AFTER:
  def role_checker(cu: User = Depends(get_current_user)):
      if cu.role not in roles and cu.role not in [UserRole.admin, UserRole.super_admin, UserRole.auditor]:
          raise HTTPException(403, f"Unauthorized: required roles: {', '.join(r.value for r in roles)}")
      return cu
  ```

- [ ] **Step 4: Verify**

  ```bash
  cd backend && python -c "from app.api.users import router; from app.api.reports import router as rr; print('OK')"
  ```
  Expected: `OK`

- [ ] **Step 5: Commit**

  ```bash
  git add backend/app/api/users.py backend/app/api/reports.py
  git commit -m "fix: move is_active to SQL filter, add password min_length, remove dead audit_log"
  ```

---

## Task 6: Backend Performance — Reconciliation N+1 Fix

**Files:**
- Modify: `backend/app/api/reconciliation.py`

**Context:** `daily_reconciliation` currently runs 2 separate SQL aggregate queries **per account** for the cash summary (lines 83–105). With 20 accounts that's 40 queries. Fix: one GROUP BY query covers all accounts at once.

- [ ] **Step 1: Replace per-account queries with a single batch query**

  In `backend/app/api/reconciliation.py`, replace the `cash_summary` block (lines 81–105):

  ```python
  # BEFORE (2 queries per account, N+1):
  cash_summary = []
  for acc in accs:
      in_sum = (db.query(func.sum(TransactionLeg.amount))
                .join(Transaction)
                .filter(TransactionLeg.account_id == acc.id,
                        TransactionLeg.leg_type == LegType.incoming,
                        Transaction.txn_date == report_date)
                .scalar() or ZERO)
      out_sum = (db.query(func.sum(TransactionLeg.amount))
                 .join(Transaction)
                 .filter(TransactionLeg.account_id == acc.id,
                         TransactionLeg.leg_type == LegType.outgoing,
                         Transaction.txn_date == report_date)
                 .scalar() or ZERO)
      net = in_sum - out_sum
      if in_sum == ZERO and out_sum == ZERO:
          continue  # Hareketsiz kasaları atla
      cash_summary.append({
          "account":       acc.name,
          "location":      acc.location.name_tr if acc.location else "",
          "currency":      acc.currency.code if acc.currency else "",
          "in":            str(in_sum.quantize(Decimal("0.01"))),
          "out":           str(out_sum.quantize(Decimal("0.01"))),
          "net":           str(net.quantize(Decimal("0.01"))),
      })

  # AFTER (1 batch query for all accounts):
  acc_ids = [acc.id for acc in accs]
  acc_map = {acc.id: acc for acc in accs}

  # Single query: sum by (account_id, leg_type) for the report date
  from sqlalchemy import case
  sums_q = (db.query(
                TransactionLeg.account_id,
                func.sum(case((TransactionLeg.leg_type == LegType.incoming, TransactionLeg.amount), else_=ZERO)).label("in_sum"),
                func.sum(case((TransactionLeg.leg_type == LegType.outgoing, TransactionLeg.amount), else_=ZERO)).label("out_sum"),
            )
            .join(Transaction)
            .filter(
                TransactionLeg.account_id.in_(acc_ids),
                Transaction.txn_date == report_date,
            )
            .group_by(TransactionLeg.account_id)
            .all())

  cash_summary = []
  for row in sums_q:
      acc = acc_map.get(row.account_id)
      if not acc:
          continue
      in_sum  = row.in_sum  or ZERO
      out_sum = row.out_sum or ZERO
      if in_sum == ZERO and out_sum == ZERO:
          continue
      net = in_sum - out_sum
      cash_summary.append({
          "account":  acc.name,
          "location": acc.location.name_tr if acc.location else "",
          "currency": acc.currency.code if acc.currency else "",
          "in":       str(in_sum.quantize(Decimal("0.01"))),
          "out":      str(out_sum.quantize(Decimal("0.01"))),
          "net":      str(net.quantize(Decimal("0.01"))),
      })
  ```

- [ ] **Step 2: Verify**

  ```bash
  cd backend && python -c "from app.api.reconciliation import router; print('OK')"
  ```
  Expected: `OK`

- [ ] **Step 3: Commit**

  ```bash
  git add backend/app/api/reconciliation.py
  git commit -m "perf: replace N+1 cash summary queries with single batch GROUP BY query"
  ```

---

## Task 7: Frontend — App.jsx useLocation fix

**Files:**
- Modify: `frontend/src/App.jsx`

**Context:** The `Protected` component uses `window.location.pathname` at line 71. While React Router v6 triggers re-renders on route changes, using the router's own `useLocation()` is idiomatic, reactive, and avoids stale reads in edge cases (SSR, testing).

- [ ] **Step 1: Replace window.location.pathname with useLocation()**

  In `frontend/src/App.jsx`:

  ```jsx
  // BEFORE (line 1):
  import { lazy, Suspense, useEffect, useRef } from 'react'
  import { Routes, Route, Navigate } from 'react-router-dom'

  // AFTER — add useLocation to react-router-dom import:
  import { lazy, Suspense, useEffect, useRef } from 'react'
  import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
  ```

  Then inside the `Protected` function component:

  ```jsx
  // BEFORE (around line 40-74):
  function Protected({ children }) {
    const { token, logout } = useAuthStore()
    const { user }    = useAuthStore()
    const { t } = useLang()
    const timerRef = useRef(null)
    // ... useEffect ...
    if (!token) return <Navigate to="/" replace />
    // Super admin goes to company management, not dashboard
    if (user?.role === 'super_admin' && window.location.pathname === '/dashboard') {
      return <Navigate to="/companies" replace />
    }
    return <Layout>{children}</Layout>
  }

  // AFTER — add useLocation() hook and replace window.location.pathname:
  function Protected({ children }) {
    const { token, logout } = useAuthStore()
    const { user }    = useAuthStore()
    const { t } = useLang()
    const timerRef = useRef(null)
    const location = useLocation()
    // ... useEffect (unchanged) ...
    if (!token) return <Navigate to="/" replace />
    // Super admin goes to company management, not dashboard
    if (user?.role === 'super_admin' && location.pathname === '/dashboard') {
      return <Navigate to="/companies" replace />
    }
    return <Layout>{children}</Layout>
  }
  ```

- [ ] **Step 2: Verify frontend builds**

  ```bash
  cd frontend && npm run build 2>&1 | tail -20
  ```
  Expected: exit code 0, no errors

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/App.jsx
  git commit -m "fix: use useLocation() instead of window.location.pathname in Protected component"
  ```

---

## Task 8: Frontend i18n — Locale Key Consistency

**Files:**
- Modify: `frontend/src/locales/en.js`
- Modify: `frontend/src/locales/ar.js`

**Context:** The `deleteUserConfirm`, `confirmPasswordReset`, and `confirmRegenPin` keys have inconsistent format across locales. Turkish uses name-prepended patterns (`${user.name} ${t.deleteUserConfirm}`), but English is a standalone sentence. The AR `confirmPasswordReset` also lacks the name reference. Fix: standardize to name-prepended pattern across all three locales.

- [ ] **Step 1: Check how the keys are used in Users.jsx**

  ```bash
  grep -n "deleteUserConfirm\|confirmPasswordReset\|confirmRegenPin" frontend/src/pages/Users.jsx
  ```

  This tells us the exact interpolation pattern (e.g. `\`${user.name} ${t.deleteUserConfirm}\``).

- [ ] **Step 2: Fix en.js to match the name-prepended pattern**

  If Users.jsx uses `${user.name} ${t.deleteUserConfirm}`:

  ```js
  // frontend/src/locales/en.js
  // BEFORE:
  deleteUserConfirm: 'Delete this user?',
  confirmPasswordReset: '— change password?',
  confirmRegenPin: '— generate new PIN?\nOld PIN and Telegram link will be removed.',

  // AFTER:
  deleteUserConfirm: '— delete this user?',
  confirmPasswordReset: '— change password?',   // already correct
  confirmRegenPin: '— generate new PIN?\nOld PIN and Telegram link will be removed.',  // already correct
  ```

- [ ] **Step 3: Fix ar.js confirmPasswordReset to include name reference**

  ```js
  // frontend/src/locales/ar.js
  // BEFORE:
  confirmPasswordReset: 'تغيير كلمة المرور؟',

  // AFTER (with name prepend — "— change password?" pattern):
  confirmPasswordReset: '— تغيير كلمة المرور؟',
  ```

- [ ] **Step 4: Verify all three locale files export correctly**

  ```bash
  cd frontend && node -e "import('./src/locales/tr.js').then(m => console.log('tr keys:', Object.keys(m.default).length))"
  cd frontend && node -e "import('./src/locales/en.js').then(m => console.log('en keys:', Object.keys(m.default).length))"
  cd frontend && node -e "import('./src/locales/ar.js').then(m => console.log('ar keys:', Object.keys(m.default).length))"
  ```
  Expected: all three print the same count (they should be identical key sets)

- [ ] **Step 5: Build verify**

  ```bash
  cd frontend && npm run build 2>&1 | tail -5
  ```
  Expected: exit code 0

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/locales/en.js frontend/src/locales/ar.js
  git commit -m "i18n: fix deleteUserConfirm and confirmPasswordReset format consistency across locales"
  ```

---

## Task 9: Final Verification

- [ ] **Step 1: Full backend import check**

  ```bash
  cd backend && python -c "
  from app.main import app
  from app.api import auth, users, master, transactions, reports, reconciliation, settings, audit
  print('All backend modules OK')
  "
  ```
  Expected: `All backend modules OK`

- [ ] **Step 2: Full frontend build**

  ```bash
  cd frontend && npm run build 2>&1 | grep -E "error|warning|built in"
  ```
  Expected: `built in` line, no `error` lines

- [ ] **Step 3: Confirm no remaining Turkish strings in HTTP error responses**

  ```bash
  grep -rn "HTTPException" backend/app/api/ | grep -E "Türkçe|Sadece|bulunamadı|Yetkisiz|Geçersiz|dolmuş|olamaz|edilemez|yapılamaz" | wc -l
  ```
  Expected: `0`

- [ ] **Step 4: Final commit**

  ```bash
  git add -A
  git commit -m "chore: full app scan and fix complete — i18n, security, perf, bugs"
  ```

---

## Quick Reference — All Changed Files

| File | Change type |
|------|------------|
| `backend/app/api/auth.py` | i18n: 5 Turkish errors → English |
| `backend/app/core/security.py` | i18n: 3 Turkish errors → English |
| `backend/app/api/users.py` | i18n: 23 Turkish errors + SQL filter + PasswordReset Field |
| `backend/app/api/reports.py` | i18n: 5 Turkish errors + dead code removed |
| `backend/app/api/transactions.py` | i18n: 5 Turkish errors → English |
| `backend/app/api/master.py` | i18n: 22 Turkish errors → English |
| `backend/app/api/settings.py` | i18n: 3 Turkish errors → English |
| `backend/app/api/reconciliation.py` | perf: N+1 → 1 batch GROUP BY query |
| `frontend/src/App.jsx` | fix: useLocation() instead of window.location.pathname |
| `frontend/src/locales/en.js` | i18n: deleteUserConfirm format |
| `frontend/src/locales/ar.js` | i18n: confirmPasswordReset format |
