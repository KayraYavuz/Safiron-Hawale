"""
WhatsApp Webhook API
Meta Cloud API webhook'u dinler, bottan yanıt gönderir.

Endpoints:
  GET  /api/whatsapp/webhook  → Meta doğrulama (subscribe sırasında)
  POST /api/whatsapp/webhook  → Gelen mesajlar

Güvenlik:
  - X-Hub-Signature-256 ile HMAC doğrulaması
  - WHATSAPP_ALLOWED_NUMBERS whitelist kontrolü
"""
import hashlib
import hmac
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.whatsapp_client import is_allowed_number, send_message
from app.services.whatsapp_bot import handle_message

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


def _get_config():
    from app.core.config import settings
    return settings


# ─────────────────────────────────────────────────────────────────────────────
# GET  /api/whatsapp/webhook  — Meta webhook doğrulama
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/webhook")
def verify_webhook(
    hub_mode:       str = Query(None, alias="hub.mode"),
    hub_challenge:  str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    """
    Meta'nın webhook subscription doğrulaması.
    Meta panelden webhook URL ayarlandığında bu endpoint çağrılır.
    """
    cfg = _get_config()
    verify_token = getattr(cfg, "WHATSAPP_VERIFY_TOKEN", None)

    if not verify_token:
        raise HTTPException(500, "WHATSAPP_VERIFY_TOKEN not configured")

    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("WhatsApp webhook doğrulandı ✓")
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(hub_challenge)  # Meta challenge'ı aynen döndür

    logger.warning(f"WhatsApp webhook doğrulama başarısız: mode={hub_mode}")
    raise HTTPException(403, "Verification failed")


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/whatsapp/webhook  — Gelen mesajları işle
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def receive_message(request: Request, db: Session = Depends(get_db)):
    """
    Meta'dan gelen WhatsApp mesajlarını işle.
    HMAC-SHA256 imzası doğrulanır → bot yanıtı gönderilir.
    """
    raw_body = await request.body()
    cfg      = _get_config()

    # ── HMAC doğrulama ────────────────────────────────────────────────────
    app_secret = getattr(cfg, "WHATSAPP_APP_SECRET", None)
    if app_secret:
        sig_header = request.headers.get("x-hub-signature-256", "")
        expected   = "sha256=" + hmac.new(
            app_secret.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig_header, expected):
            logger.warning("WhatsApp HMAC doğrulama başarısız")
            raise HTTPException(403, "Invalid signature")

    # ── JSON parse ────────────────────────────────────────────────────────
    try:
        import json
        data: Dict[str, Any] = json.loads(raw_body)
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    # ── Mesaj çıkar ───────────────────────────────────────────────────────
    try:
        entry   = data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value   = changes.get("value", {})

        # Statüs güncellemeleri (okundu, iletildi) — ignore
        if "statuses" in value and "messages" not in value:
            return {"status": "ok"}

        messages = value.get("messages", [])
        if not messages:
            return {"status": "ok"}

        msg    = messages[0]
        sender = msg.get("from", "")                # "905551234567"
        mtype  = msg.get("type", "")
        text   = msg.get("text", {}).get("body", "")

        # Sadece metin mesajlarını işle
        if mtype != "text" or not text:
            send_message(sender, "ℹ️ Sadece metin mesajları desteklenir. Yardım: `?`")
            return {"status": "ok"}

    except Exception as exc:
        logger.exception(f"Mesaj parse hatası: {exc}")
        return {"status": "ok"}  # Meta'ya 200 döndür, hata logla

    # ── Yetki kontrolü ────────────────────────────────────────────────────
    if not is_allowed_number(sender):
        logger.warning(f"WhatsApp: izinsiz numara {sender}")
        send_message(sender, "🚫 Bu numaradan erişim yetkiniz bulunmamaktadır.")
        return {"status": "ok"}

    # ── Bot yanıtı ────────────────────────────────────────────────────────
    logger.info(f"WhatsApp mesaj: {sender} → {text[:50]!r}")
    try:
        reply = handle_message(sender, text, db)
    except Exception as exc:
        logger.exception(f"Bot hatası: {exc}")
        reply = "❌ Sunucu hatası. Lütfen tekrar deneyin."

    send_message(sender, reply)
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/whatsapp/notify  — Sistem bildirimleri (internal)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/notify")
async def send_notification(request: Request):
    """
    Sistem içi bildirim gönderme endpoint'i.
    Diğer servisler bu endpoint'e istek atarak WhatsApp bildirimi tetikler.

    Body: {"to": "+905551234567", "message": "Bildirim metni", "secret": "..."}
    """
    cfg = _get_config()
    internal_secret = getattr(cfg, "WHATSAPP_INTERNAL_SECRET", None)

    try:
        import json
        data = json.loads(await request.body())
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    # Internal secret doğrulama
    if internal_secret and data.get("secret") != internal_secret:
        raise HTTPException(403, "Yetkisiz")

    to      = data.get("to", "")
    message = data.get("message", "")

    if not to or not message:
        raise HTTPException(400, "'to' and 'message' fields are required")

    success = send_message(to, message)
    return {"success": success}
