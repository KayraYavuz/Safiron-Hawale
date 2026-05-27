"""
Güvenilir cihaz tokenleri — "Bu cihaza X gün güven" özelliği.

Akış:
  1. Kullanıcı OTP'yi doğrular + "Cihaza güven" kutusunu işaretler
  2. create_device_token() → raw token üretilir, SHA-256 hash'i DB'ye yazılır
  3. Raw token frontend'e gönderilir → localStorage'a kaydedilir
  4. Sonraki girişlerde login isteğiyle X-Device-Token header'ı gelir
  5. verify_device_token() → geçerliyse OTP adımı atlanır, direkt JWT döner
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.orm import Session
from app.core.database import Base, engine
from app.core.types import GUID

TRUST_DAYS = 10


# ── Model ─────────────────────────────────────────────────────────────────────
class TrustedDevice(Base):
    __tablename__ = "trusted_device_tokens"

    id          = Column(GUID(), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id     = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash  = Column(String(64), nullable=False, unique=True, index=True)
    created_at  = Column(DateTime(timezone=True), server_default=text("NOW()"))
    expires_at  = Column(DateTime(timezone=True), nullable=False)
    last_used_at= Column(DateTime(timezone=True), nullable=True)


def ensure_table():
    """Uygulama başlarken tabloyu oluştur (yoksa)."""
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS trusted_device_tokens (
                    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash   VARCHAR(64) NOT NULL UNIQUE,
                    created_at   TIMESTAMPTZ DEFAULT NOW(),
                    expires_at   TIMESTAMPTZ NOT NULL,
                    last_used_at TIMESTAMPTZ
                )
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_tdt_user_id ON trusted_device_tokens(user_id)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_tdt_token_hash ON trusted_device_tokens(token_hash)"
            ))
    except Exception as e:
        print(f"[TrustedDevice] Tablo oluşturma hatası: {e}")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_device_token(user_id: str, db: Session) -> str:
    """
    Yeni bir güvenilir cihaz tokeni üretir.
    Raw tokeni döner (frontend localStorage'a kaydeder).
    DB'ye yalnızca hash yazar.
    """
    raw = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(days=TRUST_DAYS)

    device = TrustedDevice(
        user_id=user_id,
        token_hash=_hash(raw),
        expires_at=expires,
    )
    db.add(device)
    db.flush()   # commit çağıran tarafta yapılacak
    return raw


def verify_device_token(raw: str, user_id: str, db: Session) -> bool:
    """
    Token geçerliyse True döner ve last_used_at günceller.
    Süresi dolmuşsa kaydı siler.
    """
    h = _hash(raw)
    device = (
        db.query(TrustedDevice)
        .filter(
            TrustedDevice.token_hash == h,
            TrustedDevice.user_id    == user_id,
        )
        .first()
    )

    if not device:
        return False

    now = datetime.now(timezone.utc)
    if device.expires_at < now:
        db.delete(device)
        db.commit()
        return False

    device.last_used_at = now
    db.commit()
    return True


def revoke_all_devices(user_id: str, db: Session):
    """Kullanıcının tüm güvenilir cihazlarını iptal et (şifre değişiminde vb.)."""
    db.query(TrustedDevice).filter(TrustedDevice.user_id == user_id).delete()
    db.commit()
