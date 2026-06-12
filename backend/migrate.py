"""
Migration scripti — mevcut DB'ye yeni kolonları ekler.
Yeni kurulum için gerekli değil (create_all halleder).
Mevcut DB'yi güncellemek için: python migrate.py
"""
import sys
sys.path.insert(0, '/home/claude/hawala_v2/backend')

from sqlalchemy import text, inspect
from app.core.database import engine

def col_exists(inspector, table, col):
    return any(c['name'] == col for c in inspector.get_columns(table))

def run():
    insp = inspect(engine)
    tables = insp.get_table_names()
    
    with engine.begin() as conn:
        
        # ── transaction_pnl — yeni kolonlar ──────────────────────────────────
        if 'transaction_pnl' in tables:
            pnl_cols = [
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
            for col, dtype in pnl_cols:
                if not col_exists(insp, 'transaction_pnl', col):
                    conn.execute(text(f"ALTER TABLE transaction_pnl ADD COLUMN {col} {dtype}"))
                    print(f"  ✅ transaction_pnl.{col} eklendi")
                else:
                    print(f"  — transaction_pnl.{col} zaten var")
        
        # ── supplier_settlements — yeni tablo ─────────────────────────────────
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
            print("  ✅ supplier_settlements tablosu oluşturuldu")
        else:
            print("  — supplier_settlements zaten var")

        # ── companies.accounting_scheme ──────────────────────────────────────
        if 'companies' in tables and not col_exists(insp, 'companies', 'accounting_scheme'):
            conn.execute(text("ALTER TABLE companies ADD COLUMN accounting_scheme VARCHAR(8)"))
            print("  ✅ companies.accounting_scheme eklendi")
        elif 'companies' in tables:
            print("  — companies.accounting_scheme zaten var")

        # ── chart_of_accounts + account_mappings (yeni Hesap Planı tabloları) ─
        from app.models.accounting import ChartOfAccount, AccountMapping
        for model in (ChartOfAccount, AccountMapping):
            if model.__tablename__ not in tables:
                model.__table__.create(bind=conn)
                print(f"  ✅ {model.__tablename__} tablosu oluşturuldu")
            else:
                print(f"  — {model.__tablename__} zaten var")

    print("\n✅ Migration tamamlandı")

if __name__ == '__main__':
    run()
