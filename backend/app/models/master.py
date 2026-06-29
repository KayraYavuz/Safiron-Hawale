import uuid
import enum
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, DateTime, Numeric, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


class Company(Base):
    __tablename__ = "companies"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    code = Column(String(20), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    telegram_bot_token = Column(String, nullable=True)  # @BotFather'dan alınan token
    whatsapp_phone_id = Column(String, nullable=True)   # WhatsApp Business Phone Number ID (şirket kimliği)
    whatsapp_token = Column(String, nullable=True)      # şirkete özel gönderim token'ı (boşsa global)
    accounting_scheme = Column(String(8), nullable=True)  # "thp" | "intl" | None until initialised
    commission_tax_rate = Column(Numeric(5, 4), default=0)  # opt-in KDV/BSMV on commission (0 = off)
    aml_threshold_usd = Column(Numeric(18, 4), default=0)   # AML reporting/flag threshold (0 = off)
    aml_structuring_window_days = Column(Integer, default=1)  # window for structuring aggregation


class Location(Base):
    __tablename__ = "locations"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    code = Column(String(10), nullable=False, index=True)  # unique=True kaldırıldı, (code,company_id) unique
    name_tr = Column(String, nullable=False)
    name_ar = Column(String, nullable=False)
    name_en = Column(String, nullable=False)
    country = Column(String(3))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    accounts = relationship("Account", back_populates="location")
    __table_args__ = (UniqueConstraint("code", "company_id", name="uq_location_code_company"),)


class Currency(Base):
    __tablename__ = "currencies"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    code = Column(String(5), unique=True, nullable=False, index=True)
    name_tr = Column(String, nullable=False)
    name_ar = Column(String, nullable=False)
    name_en = Column(String, nullable=False)
    symbol = Column(String(5))
    decimal_places = Column(Integer, default=2)
    is_active = Column(Boolean, default=True)
    accounts = relationship("Account", back_populates="currency")


class CurrencyMargin(Base):
    """Per-company default markup % applied to the market rate to suggest a
    customer rate during transaction entry (0.01 = 1%)."""
    __tablename__ = "currency_margin"
    __table_args__ = (
        UniqueConstraint("company_id", "currency_code", name="uq_margin_company_currency"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True, index=True)
    currency_code = Column(String(5), nullable=False)
    margin_pct = Column(Numeric(6, 4), default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AccountType(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    crypto = "crypto"
    itimad = "itimad"


class Account(Base):
    __tablename__ = "accounts"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    location_id = Column(GUID(), ForeignKey("locations.id"), nullable=False)
    currency_id = Column(GUID(), ForeignKey("currencies.id"), nullable=False)
    account_type = Column(Enum(AccountType), nullable=False)
    name = Column(String, nullable=False)
    bank_name = Column(String)
    account_number = Column(String)
    swift_code = Column(String(11))
    wallet_address = Column(String)
    opening_balance = Column(Numeric(18, 4), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    gl_account_id = Column(GUID(), ForeignKey("chart_of_accounts.id"), nullable=True)

    location = relationship("Location", back_populates="accounts")
    currency = relationship("Currency", back_populates="accounts")
    legs = relationship("TransactionLeg", back_populates="account")


class CounterpartyType(str, enum.Enum):
    customer = "customer"
    supplier = "supplier"
    both = "both"
    founder = "founder"


class Counterparty(Base):
    __tablename__ = "counterparties"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    code = Column(String(20), nullable=False, index=True)  # unique=True kaldırıldı, (code,company_id) unique
    name = Column(String, nullable=False)
    name_ar = Column(String)
    type = Column(Enum(CounterpartyType), nullable=False, default=CounterpartyType.customer)
    country = Column(String(3))
    phone = Column(String)
    credit_limit_usd = Column(Numeric(18, 4), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    telegram_id = Column(String(20), nullable=True, index=True)  # Telegram user ID bağlantısı
    bot_pin     = Column(String(12), nullable=True, unique=True, index=True)  # Bot erişim kodu (ör: SAF-7K2M)
    transactions = relationship("Transaction", back_populates="counterparty")
    __table_args__ = (UniqueConstraint("code", "company_id", name="uq_counterparty_code_company"),)
