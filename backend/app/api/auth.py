"""
Auth API — 2FA (e-posta OTP) + "Cihaza güven" (10 gün) + rate limiting + audit log.

Akış (normal kullanıcılar — ilk giriş veya güvenilmeyen cihaz):
  1. POST /login      → kimlik doğrula, OTP e-postası gönder, session_token döner
  2. POST /verify-otp → OTP doğrula, JWT token döner
                        trust_device=true ise device_token da döner → localStorage

Akış (normal kullanıcılar — güvenilir cihaz):
  1. POST /login  (X-Device-Token header ile) → OTP atlanır, direkt JWT döner

Akış (super_admin):
  1. POST /login → direkt JWT döner (2FA yok)
"""
import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_token, get_current_user
from app.models.user import User, UserRole
from app.schemas.schemas import Token, UserOut
from app.services.audit import log as audit_log
from app.services.email_otp import create_otp_session, verify_otp, send_otp_email
from app.services.trusted_device import create_device_token, verify_device_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Rate limiter ──────────────────────────────────────────────────────────────
_login_attempts: dict = defaultdict(list)
MAX_ATTEMPTS = 10
WINDOW_SEC   = 60

def _check_rate_limit(ip: str):
    now      = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < WINDOW_SEC]
    _login_attempts[ip] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many login attempts. Please wait {WINDOW_SEC} seconds."
        )
    _login_attempts[ip].append(now)


# ── Şemalar ───────────────────────────────────────────────────────────────────
class LoginResponse(BaseModel):
    otp_required: bool
    # OTP akışı için
    session_token: Optional[str] = None
    email_hint:    Optional[str] = None
    # Direkt giriş (super_admin veya güvenilir cihaz) için
    access_token:  Optional[str] = None
    token_type:    Optional[str] = None

class VerifyOtpRequest(BaseModel):
    session_token: str
    otp:           str
    trust_device:  bool = False   # "Bu cihaza 10 gün güven"


# ── Endpoint'ler ──────────────────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    user = db.query(User).filter(User.email == form.username, User.is_active == True).first()
    if not user or not verify_password(form.password, user.hashed_password):
        audit_log(db, "LOGIN_FAIL", entity="User", detail={"email": form.username}, ip_address=ip)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Account not yet approved.")

    # ── Super admin: 2FA atla, direkt token ver ───────────────────────────────
    if user.role == UserRole.super_admin:
        _login_attempts[ip] = []
        audit_log(db, "LOGIN", user_id=user.id, entity="User", entity_id=user.id,
                  detail={"email": user.email, "method": "direct"}, ip_address=ip)
        db.commit()
        return LoginResponse(
            otp_required=False,
            access_token=create_token(str(user.id)),
            token_type="bearer",
        )

    # ── Güvenilir cihaz kontrolü ──────────────────────────────────────────────
    device_token_raw = request.headers.get("X-Device-Token", "").strip()
    if device_token_raw and verify_device_token(device_token_raw, str(user.id), db):
        _login_attempts[ip] = []
        audit_log(db, "LOGIN", user_id=user.id, entity="User", entity_id=user.id,
                  detail={"email": user.email, "method": "trusted_device"}, ip_address=ip)
        db.commit()
        return LoginResponse(
            otp_required=False,
            access_token=create_token(str(user.id)),
            token_type="bearer",
        )

    # ── Normal kullanıcı: OTP akışı ───────────────────────────────────────────
    session_token, otp = create_otp_session(str(user.id))
    send_otp_email(user.email, user.name, otp)

    audit_log(db, "OTP_SENT", user_id=user.id, entity="User", entity_id=user.id,
              detail={"email": user.email}, ip_address=ip)
    db.commit()

    parts = user.email.split("@")
    hint  = parts[0][:2] + "***@" + parts[1]

    return LoginResponse(otp_required=True, session_token=session_token, email_hint=hint)


@router.post("/verify-otp", response_model=Token)
def verify_otp_endpoint(
    request: Request,
    body: VerifyOtpRequest,
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"

    user_id = verify_otp(body.session_token, body.otp.strip())
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired code.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    _login_attempts[ip] = []  # başarılı giriş → denemeleri sıfırla

    # ── "Cihaza güven" seçilmişse token üret ─────────────────────────────────
    new_device_token = None
    if body.trust_device:
        new_device_token = create_device_token(str(user.id), db)

    audit_log(db, "LOGIN", user_id=user.id, entity="User", entity_id=user.id,
              detail={"email": user.email, "method": "2fa_email",
                      "trusted": body.trust_device}, ip_address=ip)
    db.commit()

    return Token(
        access_token=create_token(str(user.id)),
        token_type="bearer",
        device_token=new_device_token,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
