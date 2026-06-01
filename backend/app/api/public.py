"""
Public (auth gerektirmeyen) uç noktalar — pazarlama sitesindeki formlar.

Şimdilik yalnızca demo/randevu talebi. E-posta sabit bir iç adrese (satış)
gider; alıcı kullanıcı kontrolünde DEĞİLDİR, böylece form keyfi adreslere spam
göndermek için kullanılamaz. Ek olarak IP bazlı basit bir hız sınırı vardır.
"""
import time

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from app.services.email_otp import send_demo_request_email

router = APIRouter(prefix="/api/public", tags=["public"])

# ── Basit IP bazlı hız sınırı (kötüye kullanım / spam'i azaltmak için) ─────────
_hits: dict[str, list[float]] = {}
_WINDOW_SEC = 3600  # 1 saat
_MAX_PER_WINDOW = 5


def _rate_limited(ip: str) -> bool:
    now = time.time()
    recent = [t for t in _hits.get(ip, []) if now - t < _WINDOW_SEC]
    recent.append(now)
    _hits[ip] = recent
    return len(recent) > _MAX_PER_WINDOW


class DemoRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: str = Field(default="", max_length=160)
    phone: str = Field(default="", max_length=40)
    preferred_at: str = Field(default="", max_length=80)
    message: str = Field(default="", max_length=2000)
    lang: str = Field(default="en", max_length=5)


@router.post("/demo-request")
def demo_request(data: DemoRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    if _rate_limited(ip):
        raise HTTPException(429, "Too many requests. Please email sales@safironpay.com directly.")

    ok = send_demo_request_email(
        name=data.name,
        email=str(data.email),
        company=data.company,
        phone=data.phone,
        preferred_at=data.preferred_at,
        message=data.message,
        lang=data.lang,
    )
    if not ok:
        raise HTTPException(502, "Could not send the request. Please email sales@safironpay.com.")
    return {"ok": True}
