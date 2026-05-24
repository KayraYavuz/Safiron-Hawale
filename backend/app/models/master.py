import uuid
import enum
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, DateTime, Numeric, Integer
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


class Location(Base):
    __tablename__ = "locations"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    code = Column(String(10), unique=True, nullable=False, index=True)
    name_tr = Column(String, nullable=False)
    name_ar = Column(String, nullable=False)
    name_en = Column(String, nullable=False)
    country = Column(String(3))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    accounts = relationship("Account", back_populates="location")


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


class AccountType(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    crypto = "crypto"


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
    code = Column(String(20), unique=True, nullable=False, index=True)
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
