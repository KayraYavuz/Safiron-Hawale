"""
WhatsApp Cloud API Client
Meta Cloud API v21.0 üzerinden mesaj gönderme.

Kurulum için: backend/.env dosyasına eklenmesi gerekenler:
  WHATSAPP_TOKEN=<Meta Business API erişim tokeni>
  WHATSAPP_PHONE_ID=<WhatsApp Business Phone Number ID>
  WHATSAPP_VERIFY_TOKEN=<Webhook doğrulama tokeni — siz belirleyin>
  WHATSAPP_ALLOWED_NUMBERS=+905551234567,+905559876543  (virgülle ayrılmış)
"""
import httpx
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _cfg():
    """Lazy import — circular import riskini önler."""
    from app.core.config import settings
    return settings


def send_message(to: str, text: str) -> bool:
    """
    Kısa mesaj gönder (≤4096 karakter).
    Returns True on success.
    """
    cfg = _cfg()
    token    = getattr(cfg, "WHATSAPP_TOKEN", None)
    phone_id = getattr(cfg, "WHATSAPP_PHONE_ID", None)

    if not token or not phone_id:
        logger.error("WhatsApp: WHATSAPP_TOKEN veya WHATSAPP_PHONE_ID eksik")
        return False

    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to.lstrip("+"),          # Meta numara başına + istemez
        "type": "text",
        "text": {"body": text[:4096]}, # Meta karakter limiti
    }

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                logger.info(f"WhatsApp mesaj gönderildi → {to}")
                return True
            logger.error(f"WhatsApp API hata {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as exc:
        logger.exception(f"WhatsApp gönderim hatası: {exc}")
        return False


def send_template(to: str, template_name: str, lang: str = "tr", components: list = None) -> bool:
    """
    WhatsApp onaylı şablon mesajı gönder.
    Bildirimler (alarm, uyarı) için kullanılır.
    """
    cfg = _cfg()
    token    = getattr(cfg, "WHATSAPP_TOKEN", None)
    phone_id = getattr(cfg, "WHATSAPP_PHONE_ID", None)

    if not token or not phone_id:
        return False

    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    template: dict = {
        "name": template_name,
        "language": {"code": lang},
    }
    if components:
        template["components"] = components

    payload = {
        "messaging_product": "whatsapp",
        "to": to.lstrip("+"),
        "type": "template",
        "template": template,
    }

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, headers=headers, json=payload)
            return resp.status_code == 200
    except Exception:
        return False


def is_allowed_number(phone: str) -> bool:
    """
    Sadece izin verilen numaraların komut çalıştırmasına izin ver.
    WHATSAPP_ALLOWED_NUMBERS boşsa güvenlik için tüm erişimi reddeder.
    """
    cfg = _cfg()
    allowed_raw = getattr(cfg, "WHATSAPP_ALLOWED_NUMBERS", "")
    if not allowed_raw:
        logger.warning("WHATSAPP_ALLOWED_NUMBERS tanımlı değil — tüm erişim reddedildi")
        return False

    allowed = {n.strip().lstrip("+") for n in allowed_raw.split(",") if n.strip()}
    return phone.lstrip("+") in allowed
