import uuid
import enum
from sqlalchemy import (
    Column, String, Boolean, Enum, ForeignKey, DateTime, Integer, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


class AccountType(str, enum.Enum):
    asset = "asset"
    liability = "liability"
    equity = "equity"
    revenue = "revenue"
    expense = "expense"


class AccountScheme(str, enum.Enum):
    thp = "thp"      # Türkiye Tekdüzen Hesap Planı
    intl = "intl"    # International / IFRS-style


class AccountRole(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    crypto = "crypto"
    customer_receivable = "customer_receivable"
    customer_payable = "customer_payable"
    supplier_receivable = "supplier_receivable"
    supplier_payable = "supplier_payable"
    fx_profit = "fx_profit"
    fx_loss = "fx_loss"
    commission_income = "commission_income"
    retained_earnings = "retained_earnings"
    opening_balance_equity = "opening_balance_equity"
    internal_transfer_clearing = "internal_transfer_clearing"
    rounding = "rounding"


class ChartOfAccount(Base):
    __tablename__ = "chart_of_accounts"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_coa_company_code"),
        Index("ix_coa_company_parent", "company_id", "parent_id"),
        Index("ix_coa_company_type", "company_id", "account_type"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True, index=True)
    code = Column(String(20), nullable=False)
    name_tr = Column(String, nullable=False)
    name_ar = Column(String, nullable=False)
    name_en = Column(String, nullable=False)
    account_type = Column(Enum(AccountType), nullable=False)
    thp_class = Column(Integer, nullable=True)
    parent_id = Column(GUID(), ForeignKey("chart_of_accounts.id"), nullable=True)
    is_postable = Column(Boolean, default=True, nullable=False)
    currency_id = Column(GUID(), ForeignKey("currencies.id"), nullable=True)
    scheme = Column(Enum(AccountScheme), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship("ChartOfAccount", remote_side=[id], backref="children")


class AccountMapping(Base):
    __tablename__ = "account_mappings"
    __table_args__ = (
        UniqueConstraint("company_id", "role", name="uq_mapping_company_role"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True, index=True)
    role = Column(Enum(AccountRole), nullable=False)
    coa_account_id = Column(GUID(), ForeignKey("chart_of_accounts.id"), nullable=False)

    account = relationship("ChartOfAccount")
