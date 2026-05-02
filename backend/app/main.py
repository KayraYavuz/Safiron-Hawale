from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base, SessionLocal
from app.models import *
from app.api.auth import router as auth_router
from app.api.master import router as master_router
from app.api.transactions import router as txn_router
from app.api.reports import router as reports_router
from app.api.users import router as users_router
from app.api.supplier_settlement import router as supplier_router
from app.api.audit import router as audit_router
from app.api.reconciliation import router as reconciliation_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hawala & FX Accounting", version="2.0.0")

# ── Güvenlik başlıkları ───────────────────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"]           = "DENY"
        response.headers["X-Content-Type-Options"]    = "nosniff"
        response.headers["X-XSS-Protection"]          = "1; mode=block"
        response.headers["Referrer-Policy"]            = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]         = "geolocation=(), microphone=(), camera=()"
        # HSTS — sadece production HTTPS'de aktif edilmeli
        # response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ── CORS — production'da env'den al ──────────────────────────────────────────
import os
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins = (
    [o.strip() for o in _origins_env.split(",") if o.strip()]
    if _origins_env
    else ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(master_router)
app.include_router(txn_router)
app.include_router(reports_router)
app.include_router(users_router)
app.include_router(supplier_router)
app.include_router(audit_router)
app.include_router(reconciliation_router)

@app.get("/")
def root():
    return {"status": "ok", "version": "2.0.0"}

@app.on_event("startup")
async def startup():
    from app.core.security import hash_password
    from app.models.user import User, UserRole
    from app.models.master import Location, Currency

    # Migration: mevcut DB'ye eksik kolonları ekle (idempotent — güvenli tekrar çalıştırılabilir)
    try:
        from sqlalchemy import text, inspect
        insp = inspect(engine)
        tables = insp.get_table_names()
        with engine.begin() as conn:
            if 'transaction_pnl' in tables:
                pnl_new_cols = [
                    ("source_currency",              "VARCHAR(5)"),
                    ("dest_currency",                "VARCHAR(5)"),
                    ("usd_amount",                   "NUMERIC(18,4)"),
                    ("customer_rate",                "NUMERIC(18,8)"),
                    ("supplier_rate",                "NUMERIC(18,8)"),
                    ("customer_pays",                "NUMERIC(18,4)"),
                    ("customer_pays_currency",       "VARCHAR(5)"),
                    ("customer_receives",            "NUMERIC(18,4)"),
                    ("customer_receives_currency",   "VARCHAR(5)"),
                    ("supplier_settlement",          "NUMERIC(18,4)"),
                    ("supplier_settlement_currency", "VARCHAR(5)"),
                    ("profit",                       "NUMERIC(18,4) DEFAULT 0"),
                    ("profit_currency",              "VARCHAR(5)"),
                    ("profit_usd",                   "NUMERIC(18,4) DEFAULT 0"),
                ]
                existing = {col["name"] for col in insp.get_columns("transaction_pnl")}
                for col, dtype in pnl_new_cols:
                    if col not in existing:
                        conn.execute(text(f"ALTER TABLE transaction_pnl ADD COLUMN {col} {dtype}"))
            if 'audit_logs' not in tables:
                conn.execute(text("""
                    CREATE TABLE audit_logs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id),
                        action VARCHAR(50) NOT NULL,
                        entity VARCHAR(50),
                        entity_id VARCHAR(100),
                        detail TEXT,
                        ip_address VARCHAR(45),
                        created_at TIMESTAMPTZ DEFAULT now()
                    )
                """))
            if 'supplier_settlements' not in tables:
                conn.execute(text("""
                    CREATE TABLE supplier_settlements (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
                        settlement_type VARCHAR(20) NOT NULL,
                        counterparty_id UUID REFERENCES counterparties(id),
                        external_name VARCHAR,
                        source_currency VARCHAR(5),
                        dest_currency VARCHAR(5),
                        supplier_rate NUMERIC(18,8),
                        settlement_amount_usd NUMERIC(18,4),
                        receivable_amount NUMERIC(18,4),
                        receivable_currency VARCHAR(5),
                        payable_amount NUMERIC(18,4),
                        payable_currency VARCHAR(5),
                        receivable_location_id UUID REFERENCES locations(id),
                        payable_location_id UUID REFERENCES locations(id),
                        notes TEXT,
                        created_by UUID NOT NULL REFERENCES users(id),
                        created_at TIMESTAMPTZ DEFAULT now()
                    )
                """))
    except Exception as e:
        print(f"Migration uyarısı: {e}")

    db = SessionLocal()
    try:
        # Admin
        if not db.query(User).filter(User.email == "admin@hawala.com").first():
            db.add(User(
                name="System Admin",
                email="admin@hawala.com",
                hashed_password=hash_password("admin123"),
                role=UserRole.admin,
            ))

        # Lokasyonlar
        locs = [
            ("IST", "İstanbul", "إسطنبول", "Istanbul", "TUR"),
            ("CAI", "Kahire", "القاهرة", "Cairo", "EGY"),
            ("RYD", "Riyad", "الرياض", "Riyadh", "SAU"),
            ("DXB", "Dubai", "دبي", "Dubai", "UAE"),
            ("CHN", "Çin", "الصين", "China", "CHN"),
        ]
        for code, tr, ar, en, country in locs:
            if not db.query(Location).filter(Location.code == code).first():
                db.add(Location(code=code, name_tr=tr, name_ar=ar, name_en=en, country=country))

        # Para birimleri
        currencies = [
            ("USD", "Amerikan Doları", "الدولار الأمريكي", "US Dollar", "$", 2),
            ("EUR", "Euro", "اليورو", "Euro", "€", 2),
            ("GBP", "İngiliz Sterlini", "الجنيه الإسترليني", "British Pound", "£", 2),
            ("TRY", "Türk Lirası", "الليرة التركية", "Turkish Lira", "₺", 2),
            ("EGP", "Mısır Poundu", "الجنيه المصري", "Egyptian Pound", "£E", 2),
            ("SAR", "Suudi Riyali", "الريال السعودي", "Saudi Riyal", "﷼", 2),
            ("AED", "BAE Dirhemi", "الدرهم الإماراتي", "UAE Dirham", "د.إ", 2),
            ("CNY", "Çin Yuanı", "اليوان الصيني", "Chinese Yuan", "¥", 2),
            ("KWD", "Kuveyt Dinarı", "الدينار الكويتي", "Kuwaiti Dinar", "KD", 3),
            ("BHD", "Bahreyn Dinarı", "الدينار البحريني", "Bahraini Dinar", "BD", 3),
            ("OMR", "Umman Riyali", "الريال العماني", "Omani Rial", "﷼", 3),
            ("QAR", "Katar Riyali", "الريال القطري", "Qatari Riyal", "﷼", 2),
            ("JOD", "Ürdün Dinarı", "الدينار الأردني", "Jordanian Dinar", "JD", 3),
            ("MAD", "Fas Dirhemi", "الدرهم المغربي", "Moroccan Dirham", "MAD", 2),
            ("INR", "Hint Rupisi", "الروبية الهندية", "Indian Rupee", "₹", 2),
            ("PKR", "Pakistan Rupisi", "الروبية الباكستانية", "Pakistani Rupee", "₨", 2),
            ("NGN", "Nijerya Nayrası", "النيرة النيجيرية", "Nigerian Naira", "₦", 2),
            ("SDG", "Sudan Sterlini", "الجنيه السوداني", "Sudanese Pound", "SDG", 2),
            ("ETB", "Etiyopya Birr", "البر الإثيوبي", "Ethiopian Birr", "Br", 2),
            ("LBP", "Lübnan Lirası", "الليرة اللبنانية", "Lebanese Pound", "LL", 2),
            ("RUB", "Rus Rublesi", "الروبل الروسي", "Russian Ruble", "₽", 2),
            ("USDT", "Tether", "تيثر", "Tether", "₮", 6),
        ]
        for code, tr, ar, en, sym, dec in currencies:
            if not db.query(Currency).filter(Currency.code == code).first():
                db.add(Currency(code=code, name_tr=tr, name_ar=ar, name_en=en, symbol=sym, decimal_places=dec))

        db.commit()

        # Otomatik kur scheduler
        from app.services.fx import setup_scheduler
        setup_scheduler()

    except Exception as e:
        db.rollback()
        print(f"Startup hatası: {e}")
    finally:
        db.close()
