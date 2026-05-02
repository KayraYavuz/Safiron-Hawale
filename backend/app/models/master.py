import uuid
import enum
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, DateTime, Numeric, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


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
    transactions = relationship("Transaction", back_populates="counterparty")
