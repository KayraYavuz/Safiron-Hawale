"""
Auth API — login rate limiting + audit log.

Rate limiting: IP başına dakikada max 10 deneme.
Basit in-memory (production'da Redis kullanılmalı).
"""
import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_token, get_current_user, hash_password
from app.models.user import User
from app.schemas.schemas import Token, UserCreate, UserOut
from app.services.audit import log as audit_log

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory rate limiter: {ip: [timestamp, ...]}
_login_attempts: dict = defaultdict(list)
MAX_ATTEMPTS = 10
WINDOW_SEC   = 60


def _check_rate_limit(ip: str):
    now = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < WINDOW_SEC]
    _login_attempts[ip] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Çok fazla giriş denemesi. {WINDOW_SEC} saniye bekleyin."
        )
    _login_attempts[ip].append(now)


@router.post("/login", response_model=Token)
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
        raise HTTPException(status_code=401, detail="Hatalı email veya şifre")

    # Başarılı giriş — attempt'leri temizle
    _login_attempts[ip] = []

    audit_log(db, "LOGIN", user_id=user.id, entity="User", entity_id=user.id,
              detail={"email": user.email}, ip_address=ip)
    db.commit()

    return {"access_token": create_token(str(user.id)), "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
