"""
Kasa bakiyesi hesaplama.
Açılış bakiyesi + girişler - çıkışlar = anlık bakiye
"""
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.master import Account
from app.models.transaction import TransactionLeg, LegType, ExchangeRate

def get_account_balance(db: Session, account_id) -> Decimal:
    """Hesabın anlık bakiyesini hesapla."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return Decimal("0")

    in_total = db.query(func.sum(TransactionLeg.amount)).filter(
        TransactionLeg.account_id == account_id,
        TransactionLeg.leg_type == LegType.incoming,
    ).scalar() or Decimal("0")

    out_total = db.query(func.sum(TransactionLeg.amount)).filter(
        TransactionLeg.account_id == account_id,
        TransactionLeg.leg_type == LegType.outgoing,
    ).scalar() or Decimal("0")

    return account.opening_balance + in_total - out_total

def get_usd_rate(db: Session, currency_code: str) -> Decimal:
    """Para biriminin USD karşısındaki son kurunu al. 1 USD = ? currency"""
    if currency_code == "USD":
        return Decimal("1")

    rate = db.query(ExchangeRate).filter(
        ExchangeRate.currency_code == currency_code,
    ).order_by(ExchangeRate.date.desc()).first()

    return rate.rate_per_usd if rate else Decimal("1")

def balance_to_usd(balance: Decimal, currency_code: str, db: Session) -> Decimal:
    """Bakiyeyi USD'ye çevir."""
    if currency_code == "USD":
        return balance
    rate = get_usd_rate(db, currency_code)
    if rate == 0:
        return Decimal("0")
    return (balance / rate).quantize(Decimal("0.01"))
