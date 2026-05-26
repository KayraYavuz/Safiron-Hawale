# Full Application Scan & Fix — Design Spec
**Date:** 2026-05-27  
**Project:** Safiron-Hawale (Hawala & FX Muhasebe Sistemi)  
**Scope:** Backend (FastAPI/Python) + Frontend (React/JSX)

---

## 1. Objective

Systematically scan the entire Hawala application across four error categories and fix all discovered issues:

1. 🐛 **Functional bugs** — broken features, wrong calculations, API errors, broken UI
2. 🔐 **Security vulnerabilities** — auth bypass, SQL injection, XSS, missing authorization, token issues
3. 🌍 **i18n / translation gaps** — hardcoded Turkish strings, missing locale keys, backend Turkish responses
4. ⚡ **Performance & code quality** — N+1 queries, memory leaks, dead code, type mismatches

---

## 2. Approach

**Sequential Deep Scan** — Backend first, then Frontend. Fixes are applied immediately upon discovery. This prevents cascading issues where a backend bug would invalidate a frontend fix.

---

## 3. Backend Scan Plan

### Files in scope (15 source files)
- `backend/app/api/` → auth.py, users.py, master.py, reconciliation.py, reports.py, settings.py, supplier_settlement.py, transactions.py, whatsapp.py, audit.py
- `backend/app/services/` → telegram_multi_bot.py, telegram_bot_service.py, ai_analyst.py, balance.py, email_otp.py, fx.py, pnl.py, trusted_device.py, whatsapp_bot.py, whatsapp_client.py
- `backend/app/core/` → security.py, database.py, config.py, tenant.py, types.py, migrations.py
- `backend/app/models/` → user.py, transaction.py, master.py, report.py, system_setting.py
- `backend/app/schemas/schemas.py`
- `backend/app/main.py`

### Scan lenses (per file)

| Category | What to check |
|----------|---------------|
| 🔐 Security | JWT validation, RBAC checks, input validation, raw SQL injection risk, token expiry/leakage, missing `Depends(get_current_user)` on protected routes |
| 🐛 Functional | Wrong HTTP status codes, missing error handling, incorrect business logic (FX calc, balance, PnL), broken endpoint contracts |
| 🌍 i18n | Hardcoded Turkish error/success messages, Turkish strings in API responses that reach the frontend |
| ⚡ Performance | N+1 queries, missing `await` on async calls, synchronous blocking in async context, repeated DB queries that could be cached |

### Priority order
1. `auth.py` + `core/security.py` — authentication foundation
2. `users.py` — user management & RBAC
3. `reconciliation.py`, `transactions.py`, `reports.py` — core business logic
4. `settings.py`, `master.py`, `supplier_settlement.py`, `audit.py`
5. `services/` — telegram, AI, FX, balance, PnL
6. `core/` — database, tenant, config, migrations

---

## 4. Frontend Scan Plan

### Files in scope (37 JSX/JS files)
- `frontend/src/utils/api.js` — API client
- `frontend/src/App.jsx` — routing
- `frontend/src/store/index.js` — state management
- `frontend/src/pages/` — 17 page components
- `frontend/src/components/` — 8 shared components
- `frontend/src/locales/` — tr.js, en.js, ar.js
- `frontend/src/hooks/useLang.js`
- `frontend/src/utils/format.js`
- `frontend/src/constants/index.js`

### Scan lenses (per file)

| Category | What to check |
|----------|---------------|
| 🔐 Security | Token stored in localStorage (XSS risk), API keys exposed in frontend, missing error boundaries for auth failures |
| 🐛 Functional | Broken state management, missing form validation, wrong API call shapes, undefined/null crash paths, missing loading/error states |
| 🌍 i18n | Hardcoded strings not using `t()`, missing keys in tr/en/ar locales, key mismatches between locale files |
| ⚡ Performance | Unnecessary re-renders, missing `useMemo`/`useCallback` for expensive ops, heavy synchronous imports |

### Priority order
1. `utils/api.js` — all API communication
2. `App.jsx` — routing & auth guards
3. `store/index.js` — global state
4. `pages/Login.jsx` — auth flow
5. All other pages (alphabetical)
6. Shared components
7. Locale files (tr/en/ar cross-check)

---

## 5. Verification Gates

After each major fix group:

| Gate | Command | Pass criteria |
|------|---------|---------------|
| Backend syntax | `cd backend && python -c "from app.main import app; print('OK')"` | Prints OK, no import errors |
| Frontend build | `cd frontend && npm run build` | Exit code 0, no errors |
| Git commit | One commit per category | Clean commit history |

---

## 6. Out of Scope

- Writing new tests (test infrastructure is not set up)
- Database migrations for schema changes
- Infrastructure / deployment changes
- Third-party service integrations (Frankfurter API, Groq, WhatsApp)

---

## 7. Success Criteria

- Zero hardcoded Turkish strings in backend API responses
- All protected routes have explicit authorization checks
- No undefined/null crash paths in frontend pages
- tr/en/ar locale files have identical key sets
- Frontend build passes without warnings/errors
- Backend imports without errors
