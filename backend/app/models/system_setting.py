import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID


class SystemSetting(Base):
    __tablename__ = "system_settings"
    id          = Column(GUID(), primary_key=True, default=uuid.uuid4)
    key         = Column(String(100), unique=True, nullable=False, index=True)
    value       = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    is_secret   = Column(Boolean, default=False)
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
