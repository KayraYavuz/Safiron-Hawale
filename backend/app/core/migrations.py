"""Run on startup to ensure multi-tenant columns exist."""
from sqlalchemy import text
from app.core.database import engine


def _exec(sql: str, **params):
    """Her SQL'i kendi transaction'ında çalıştır — hata diğerlerini etkilemez."""
    try:
        with engine.begin() as conn:
            conn.execute(text(sql), params)
        return True
    except Exception as e:
        # Sadece beklenmeyen hataları logla; "zaten var" hataları normaldir
        err = str(e)
        if not any(x in err for x in (
            "already exists", "duplicate", "does not exist",
            "DuplicateTable", "DuplicateColumn", "DuplicateObject",
        )):
            print(f"  ⚠️  Migration adım hatası: {err[:200]}")
        return False


def run_migrations():
    print("🔧 Migration başlıyor…")

    # ── companies tablosu ────────────────────────────────────────────────────
    _exec("""
        CREATE TABLE IF NOT EXISTS companies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR NOT NULL,
            code VARCHAR(20) UNIQUE NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # DB-level default yoksa ekle (SQLAlchemy sadece Python-side default kullanır)
    _exec("ALTER TABLE companies ALTER COLUMN id SET DEFAULT gen_random_uuid()")

    # Default company
    _exec("""
        INSERT INTO companies (name, code)
        VALUES ('Safiron Global Solutions', 'SAFIRON')
        ON CONFLICT (code) DO NOTHING
    """)

    # telegram_bot_token kolonu
    _exec("ALTER TABLE companies ADD COLUMN IF NOT EXISTS telegram_bot_token VARCHAR")

    # ── Diğer tablolara company_id ekle ─────────────────────────────────────
    for table in ['users', 'locations', 'accounts', 'counterparties', 'transactions', 'exchange_rates']:
        _exec(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id)")

    # ── Mevcut verileri SAFIRON şirketine ata ───────────────────────────────
    _exec("""
        UPDATE users SET company_id = (SELECT id FROM companies WHERE code = 'SAFIRON')
        WHERE company_id IS NULL AND role NOT IN ('super_admin')
    """)

    for table in ['locations', 'accounts', 'counterparties', 'transactions', 'exchange_rates']:
        _exec(f"""
            UPDATE {table} SET company_id = (SELECT id FROM companies WHERE code = 'SAFIRON')
            WHERE company_id IS NULL
        """)

    # ── users tablosu — Telegram kolonları ──────────────────────────────────
    _exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(20)")
    _exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_pin VARCHAR(12)")

    # bot_pin unique index (opsiyonel — varsa skip)
    _exec("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_bot_pin ON users (bot_pin) WHERE bot_pin IS NOT NULL")

    # telegram_id index
    _exec("CREATE INDEX IF NOT EXISTS ix_users_telegram_id ON users (telegram_id) WHERE telegram_id IS NOT NULL")

    # ── Bot erişimine sahip roller: sadece admin/manager seviyesi ────────────
    BOT_ROLES = ('super_admin', 'admin', 'manager', 'auditor', 'branch_manager')

    # ── Mevcut yetkili kullanıcılara bot_pin üret ────────────────────────────
    # Pin'i Python'da üretmek gerekiyor — DB'de rastgele string oluşturmak zor
    try:
        from app.core.database import SessionLocal
        from app.models.user import User
        import random, string

        def _gen_pin(db):
            chars = string.ascii_uppercase + string.digits
            chars = chars.translate(str.maketrans('', '', 'IO01'))
            while True:
                prefix = ''.join(random.choices(chars, k=3))
                suffix = ''.join(random.choices(chars, k=4))
                pin = f"{prefix}-{suffix}"
                if not db.query(User).filter(User.bot_pin == pin).first():
                    return pin

        db = SessionLocal()
        try:
            # Sadece admin/manager/auditor/branch_manager rollerine pin ver
            users_without_pin = (
                db.query(User)
                .filter(
                    User.bot_pin.is_(None),
                    User.is_active == True,
                    User.role.in_(BOT_ROLES),
                )
                .all()
            )
            for u in users_without_pin:
                u.bot_pin = _gen_pin(db)
            if users_without_pin:
                db.commit()
                print(f"  ✅ {len(users_without_pin)} kullanıcıya bot_pin atandı.")
        finally:
            db.close()
    except Exception as e:
        print(f"  ⚠️  bot_pin atama hatası: {e}")

    # ── Soft-deleted kullanıcıların emaillerini düzelt ───────────────────────
    _exec("""
        UPDATE users
        SET email = CONCAT('deleted_', id::text, '@deleted')
        WHERE is_active = FALSE
        AND email NOT LIKE 'deleted_%@deleted'
    """)

    # ── Multi-tenant unique constraints ─────────────────────────────────────
    for tbl, idx_name, constraint_name in [
        ("locations",      "ix_locations_code",      "uq_location_code_company"),
        ("counterparties", "ix_counterparties_code", "uq_counterparty_code_company"),
    ]:
        _exec(f"DROP INDEX IF EXISTS {idx_name}")
        _exec(f"ALTER TABLE {tbl} ADD CONSTRAINT {constraint_name} UNIQUE (code, company_id)")

    print("✅ Migration tamamlandı.")
