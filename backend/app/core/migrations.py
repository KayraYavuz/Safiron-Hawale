"""Run on startup to ensure multi-tenant columns exist."""
from sqlalchemy import text
from app.core.database import engine


def run_migrations():
    with engine.connect() as conn:
        # Create companies table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS companies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR NOT NULL,
                code VARCHAR(20) UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        # Insert default company
        conn.execute(text("""
            INSERT INTO companies (name, code)
            VALUES ('Safiron Global Solutions', 'SAFIRON')
            ON CONFLICT (code) DO NOTHING
        """))

        # Add company_id to tables if not exists
        for table in ['users', 'locations', 'accounts', 'counterparties', 'transactions', 'exchange_rates']:
            try:
                conn.execute(text(f"""
                    ALTER TABLE {table}
                    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id)
                """))
            except Exception:
                pass

        # Assign existing data to SAFIRON company
        conn.execute(text("""
            UPDATE users SET company_id = (SELECT id FROM companies WHERE code = 'SAFIRON')
            WHERE company_id IS NULL AND role NOT IN ('super_admin')
        """))

        for table in ['locations', 'accounts', 'counterparties', 'transactions', 'exchange_rates']:
            try:
                conn.execute(text(f"""
                    UPDATE {table} SET company_id = (SELECT id FROM companies WHERE code = 'SAFIRON')
                    WHERE company_id IS NULL
                """))
            except Exception:
                pass

        conn.commit()
