import uuid
import enum
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.types import GUID

class UserRole(str, enum.Enum):
    super_admin = "super_admin"       # Sistem hakimi, Audit Log ve PnL dahil her şeye tam yetki
    admin = "admin"                   # Şirket yöneticisi, tam yetki (Logları sadece okur)
    auditor = "auditor"               # Denetçi: Değişiklik yapamaz ama PnL ve Audit Log'lar dahil her şeyi görür
    manager = "manager"               # Operasyon yöneticisi: Kurları yönetir, audit/log göremez
    branch_manager = "branch_manager" # Şube yöneticisi: Sadece kendi şubesinin verilerini görür
    accounting = "accounting"         # Muhasebe: Raporlar ve komisyon kayıtlarına bakar
    data_entry = "data_entry"         # Vezne (Eski clerk): Sadece veri girer. Kasa toplamı, Kâr ve Audit GÖREMEZ!
    viewer = "viewer"                 # İzleyici: Sınırlı okuma yetkisi

class User(Base):
    __tablename__ = "users"
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.viewer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
