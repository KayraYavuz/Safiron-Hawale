import uuid
import enum
from sqlalchemy import (
    Column, String, Boolean, Enum, ForeignKey, DateTime, Integer, Numeric,
    Date, Text, UniqueConstraint, Index,
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
    tax_payable = "tax_payable"   # commission tax (KDV/BSMV) liability


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
    # Distinct PG enum type name: master.AccountType (cash/bank/crypto) also maps
    # to "accounttype" on PostgreSQL — without an explicit name they collide.
    account_type = Column(Enum(AccountType, name="coa_account_type"), nullable=False)
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


class JournalSourceType(str, enum.Enum):
    transaction = "transaction"
    settlement = "settlement"
    manual = "manual"
    opening = "opening"
    backfill = "backfill"


class JournalStatus(str, enum.Enum):
    posted = "posted"
    void = "void"


class FiscalPeriodStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("company_id", "entry_number", name="uq_je_company_number"),
        Index("ix_je_company", "company_id"),
        Index("ix_je_source", "source_type", "source_id"),
        Index("ix_je_date", "entry_date"),
        Index("ix_je_status", "status"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    entry_number = Column(String(24), nullable=False)
    entry_date = Column(Date, nullable=False)
    value_date = Column(Date, nullable=True)
    source_type = Column(Enum(JournalSourceType), nullable=False)
    source_id = Column(GUID(), nullable=True)
    memo = Column(Text, nullable=True)
    status = Column(Enum(JournalStatus), default=JournalStatus.posted, nullable=False)
    reversed_by_id = Column(GUID(), ForeignKey("journal_entries.id"), nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lines = relationship("JournalLine", back_populates="entry", cascade="all, delete-orphan")


class JournalLine(Base):
    __tablename__ = "journal_lines"
    __table_args__ = (
        Index("ix_jl_entry", "entry_id"),
        Index("ix_jl_account", "coa_account_id"),
        Index("ix_jl_account_entry", "coa_account_id", "entry_id"),
        Index("ix_jl_counterparty", "counterparty_id"),
        Index("ix_jl_till", "account_id"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    entry_id = Column(GUID(), ForeignKey("journal_entries.id"), nullable=False)
    coa_account_id = Column(GUID(), ForeignKey("chart_of_accounts.id"), nullable=False)
    debit = Column(Numeric(18, 4), default=0)
    credit = Column(Numeric(18, 4), default=0)
    currency_id = Column(GUID(), ForeignKey("currencies.id"), nullable=True)
    rate_usd = Column(Numeric(18, 8), default=1)
    debit_usd = Column(Numeric(18, 4), default=0)
    credit_usd = Column(Numeric(18, 4), default=0)
    counterparty_id = Column(GUID(), ForeignKey("counterparties.id"), nullable=True)
    account_id = Column(GUID(), ForeignKey("accounts.id"), nullable=True)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccount")


class JournalSequence(Base):
    """Gap-free per-(company, year) journal numbering counter."""
    __tablename__ = "journal_sequences"
    __table_args__ = (
        UniqueConstraint("company_id", "year", name="uq_jseq_company_year"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    year = Column(Integer, nullable=False)
    last_value = Column(Integer, default=0, nullable=False)


class FiscalPeriod(Base):
    __tablename__ = "fiscal_periods"
    __table_args__ = (
        Index("ix_fp_company", "company_id"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    status = Column(Enum(FiscalPeriodStatus), default=FiscalPeriodStatus.open, nullable=False)
    closed_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
