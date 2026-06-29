import uuid
import enum
from sqlalchemy import Column, String, Enum, ForeignKey, DateTime, Boolean, Text, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


class ComplianceRule(str, enum.Enum):
    amount = "amount"            # tutar eşiği aşıldı
    watchlist = "watchlist"      # karşı taraf yaptırım/yasaklı listede
    structuring = "structuring"  # eşik-altı bölünmüş işlemler toplamı eşiği aştı


class ComplianceStatus(str, enum.Enum):
    open = "open"
    cleared = "cleared"


class Watchlist(Base):
    """Per-company sanctions/blocked-name list, screened by fuzzy name match."""
    __tablename__ = "watchlist"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    name_ar = Column(String, nullable=True)
    reason = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ComplianceFlag(Base):
    """A risk flag raised against a transaction by the screening service.
    One transaction may have several flags; (transaction_id, rule) is unique so
    re-screening is idempotent."""
    __tablename__ = "compliance_flags"
    __table_args__ = (
        UniqueConstraint("transaction_id", "rule", name="uq_flag_txn_rule"),
    )
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"), nullable=True, index=True)
    transaction_id = Column(GUID(), ForeignKey("transactions.id"), nullable=False, index=True)
    rule = Column(Enum(ComplianceRule), nullable=False)
    detail = Column(Text, nullable=True)
    status = Column(Enum(ComplianceStatus), nullable=False, default=ComplianceStatus.open)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cleared_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    cleared_at = Column(DateTime(timezone=True), nullable=True)
