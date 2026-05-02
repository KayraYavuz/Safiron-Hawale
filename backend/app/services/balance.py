"""
Kasa bakiyesi hesaplama.
Açılış bakiyesi + girişler - çıkışlar = anlık bakiye
"""
from decimal import Decimal
from typing import Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.master import Account
from app.models.transaction import TransactionLeg, LegType, ExchangeRate
import time

# ── In-process TTL cache for exchange rates (5 dk) ───────────────────────────
_rates_cache: Tuple[float, Dict[str, Decimal]] = (0.0, {})
_RATES_TTL = 300  # saniye


def get_account_balance(db: Session, account_id) -> Decimal:
    """Tek hesap için anlık bakiye. Çoklu hesap varsa get_all_balances() kullan."""
    account = db.query(Account.opening_balance).filter(Account.id == account_id).first()
    if not account:
        return Decimal("0")

    # Tek sorguda in+out toplamı (2 sorgu yerine 1)
    row = db.query(
        func.sum(case((TransactionLeg.leg_type == LegType.incoming, TransactionLeg.amount), else_=0)).label("in_total"),
        func.sum(case((TransactionLeg.leg_type == LegType.outgoing, TransactionLeg.amount), else_=0)).label("out_total"),
    ).filter(TransactionLeg.account_id == account_id).first()

    in_total  = Decimal(str(row.in_total  or 0))
    out_total = Decimal(str(row.out_total or 0))
    return Decimal(str(account.opening_balance)) + in_total - out_total


def get_all_balances(db: Session) -> Dict[str, Decimal]:
    """
    Tüm aktif hesapların bakiyelerini TEK sorguda hesapla.
    N+1 sorunu yerine 2 sorgu: accounts + aggregate legs.
    Döndürür: {account_id_str: balance}
    """
    accounts = db.query(Account.id, Account.opening_balance).filter(Account.is_active == True).all()

    # Tüm hesaplar için in/out toplamını tek sorguda al
    leg_rows = db.query(
        TransactionLeg.account_id,
        func.sum(case((TransactionLeg.leg_type == LegType.incoming, TransactionLeg.amount), else_=0)).label("in_total"),
        func.sum(case((TransactionLeg.leg_type == LegType.outgoing, TransactionLeg.amount), else_=0)).label("out_total"),
    ).group_by(TransactionLeg.account_id).all()

    leg_map = {str(r.account_id): (Decimal(str(r.in_total or 0)), Decimal(str(r.out_total or 0))) for r in leg_rows}

    result = {}
    for acc in accounts:
        acc_id = str(acc.id)
        in_t, out_t = leg_map.get(acc_id, (Decimal("0"), Decimal("0")))
        result[acc_id] = Decimal(str(acc.opening_balance)) + in_t - out_t
    return result


def get_usd_rate(db: Session, currency_code: str) -> Decimal:
    """Para biriminin USD karşısındaki son kurunu al. 1 USD = ? currency"""
    if currency_code == "USD":
        return Decimal("1")

    rate = (db.query(ExchangeRate.rate_per_usd)
              .filter(ExchangeRate.currency_code == currency_code)
              .order_by(ExchangeRate.date.desc())
              .first())
    return Decimal(str(rate.rate_per_usd)) if rate else Decimal("1")


def get_all_usd_rates(db: Session) -> Dict[str, Decimal]:
    """
    Tüm para birimlerinin son kurlarını TEK sorguda çek.
    5 dakika TTL in-process cache ile — kur tablosu sorgu sayısını minimize eder.
    Döndürür: {currency_code: rate_per_usd}
    """
    global _rates_cache
    cached_at, cached_rates = _rates_cache
    if cached_rates and (time.time() - cached_at) < _RATES_TTL:
        return cached_rates

    from sqlalchemy import text
    rows = db.execute(text("""
        SELECT DISTINCT ON (currency_code) currency_code, rate_per_usd
        FROM exchange_rates
        ORDER BY currency_code, date DESC
    """)).fetchall()
    rates: Dict[str, Decimal] = {"USD": Decimal("1")}
    for row in rows:
        rates[row.currency_code] = Decimal(str(row.rate_per_usd))

    _rates_cache = (time.time(), rates)
    return rates


def invalidate_rates_cache():
    """Kur güncellendiğinde cache'i temizle."""
    global _rates_cache
    _rates_cache = (0.0, {})


def balance_to_usd(balance: Decimal, currency_code: str, db: Session) -> Decimal:
    """Bakiyeyi USD'ye çevir (tek para birimi için)."""
    if currency_code == "USD":
        return balance
    rate = get_usd_rate(db, currency_code)
    if rate == 0:
        return Decimal("0")
    return (balance / rate).quantize(Decimal("0.01"))
