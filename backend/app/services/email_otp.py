"""
E-posta tabanlı 2FA — OTP üretimi, gönderimi ve doğrulama.
OTP'ler in-memory tutulur (5 dakika geçerli).
"""
import random
import string
import time
import smtplib
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import settings

# {session_token: {otp, user_id, expires_at}}
_pending: dict = {}

OTP_EXPIRE_SEC = 300  # 5 dakika


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def create_otp_session(user_id: str) -> tuple[str, str]:
    """OTP üret, session token oluştur. (session_token, otp) döner."""
    otp = _generate_otp()
    session_token = secrets.token_urlsafe(32)
    _pending[session_token] = {
        "otp": otp,
        "user_id": user_id,
        "expires_at": time.time() + OTP_EXPIRE_SEC,
    }
    return session_token, otp


def verify_otp(session_token: str, otp: str) -> Optional[str]:
    """
    OTP doğrula. Başarılıysa user_id döner, aksi halde None.
    Tek kullanımlık — doğrulama sonrası silinir.
    """
    entry = _pending.get(session_token)
    if not entry:
        return None
    if time.time() > entry["expires_at"]:
        del _pending[session_token]
        return None
    if entry["otp"] != otp:
        return None
    user_id = entry["user_id"]
    del _pending[session_token]
    return user_id


def send_otp_email(to_email: str, to_name: str, otp: str) -> bool:
    """Gmail SMTP ile OTP e-postası gönder. Başarılıysa True döner."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        # SMTP yapılandırılmamışsa konsola yaz (geliştirme modu)
        print(f"[2FA OTP] {to_email} → {otp}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Safiron Giriş Kodu: {otp}"
        # SMTP_FROM varsa onu kullan (Resend gibi proxy SMTP'lerde SMTP_USER ≠ From adresi)
        sender_addr = settings.SMTP_FROM or settings.SMTP_USER
        msg["From"]    = f"Safiron Global Solutions <{sender_addr}>"
        msg["To"]      = to_email

        html = f"""
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#F8FAFD;border-radius:16px">
          <div style="text-align:center;margin-bottom:28px">
            <div style="font-size:22px;font-weight:800;color:#0D1F3C">Safiron <span style="color:#C9A84C">Global Solutions</span></div>
          </div>
          <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #E2E8F0">
            <p style="font-size:15px;color:#334155;margin-bottom:8px">Merhaba <strong>{to_name}</strong>,</p>
            <p style="font-size:14px;color:#64748B;margin-bottom:24px">
              Safiron Havale'ye giriş için doğrulama kodunuz:
            </p>
            <div style="text-align:center;margin:24px 0">
              <span style="font-size:38px;font-weight:900;letter-spacing:10px;color:#0D1F3C;font-family:monospace">{otp}</span>
            </div>
            <p style="font-size:13px;color:#94A3B8;text-align:center">
              Bu kod <strong>5 dakika</strong> geçerlidir.<br/>
              Giriş yapmadıysanız bu e-postayı dikkate almayın.
            </p>
          </div>
          <p style="font-size:12px;color:#CBD5E1;text-align:center;margin-top:20px">
            Safiron Global Solutions · safironpay.com
          </p>
        </div>
        """

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            # sendmail'in ilk parametresi gönderen email adresi olmalı (SMTP_USER değil)
            server.sendmail(sender_addr, to_email, msg.as_string())

        return True

    except Exception as e:
        print(f"[2FA] E-posta gönderilemedi: {e}")
        return False
