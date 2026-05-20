from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.system_setting import SystemSetting

router = APIRouter(prefix="/api/settings", tags=["settings"])

KNOWN_KEYS = {
    "GROQ_API_KEY":    {"description": "Groq API Key (LLaMA 3 — AI Analiz & Chat)", "is_secret": True},
    "OPENAI_API_KEY":  {"description": "OpenAI API Key (GPT-4 — yakında)", "is_secret": True},
    "GEMINI_API_KEY":  {"description": "Google Gemini API Key (yakında)", "is_secret": True},
    "ANTHROPIC_API_KEY": {"description": "Anthropic Claude API Key (yakında)", "is_secret": True},
    "WEBHOOK_URL":     {"description": "Webhook URL (bildirimler için)", "is_secret": False},
    "TELEGRAM_BOT_TOKEN": {"description": "Telegram Bot Token (ajan bildirimleri)", "is_secret": True},
    "SLACK_WEBHOOK":   {"description": "Slack Webhook URL", "is_secret": False},
}

def _mask(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 8:
        return "••••••••"
    return value[:4] + "••••••••" + value[-4:]


def _require_admin(cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin erişebilir")
    return cu


@router.get("")
def list_settings(db: Session = Depends(get_db), cu: User = Depends(_require_admin)):
    rows = {s.key: s for s in db.query(SystemSetting).all()}
    result = []
    for key, meta in KNOWN_KEYS.items():
        row = rows.get(key)
        value = row.value if row else None
        result.append({
            "key": key,
            "description": meta["description"],
            "is_secret": meta["is_secret"],
            "value_masked": _mask(value) if meta["is_secret"] else value,
            "is_set": bool(value),
            "updated_at": row.updated_at.isoformat() if row and row.updated_at else None,
        })
    return result


class SettingUpdate(BaseModel):
    value: Optional[str] = None


@router.patch("/{key}")
def update_setting(key: str, data: SettingUpdate, db: Session = Depends(get_db), cu: User = Depends(_require_admin)):
    if key not in KNOWN_KEYS:
        raise HTTPException(400, f"Bilinmeyen ayar anahtarı: {key}")

    meta = KNOWN_KEYS[key]
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row:
        row.value = data.value or None
    else:
        row = SystemSetting(key=key, value=data.value or None,
                            description=meta["description"], is_secret=meta["is_secret"])
        db.add(row)
    db.commit()

    # Reload AI service key at runtime so no restart needed
    if key == "GROQ_API_KEY" and data.value:
        from app.core.config import settings as app_settings
        app_settings.GROQ_API_KEY = data.value

    return {"ok": True, "key": key, "is_set": bool(data.value)}


@router.delete("/{key}")
def clear_setting(key: str, db: Session = Depends(get_db), cu: User = Depends(_require_admin)):
    if key not in KNOWN_KEYS:
        raise HTTPException(400, f"Bilinmeyen ayar anahtarı: {key}")
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row:
        row.value = None
        db.commit()
    return {"ok": True}
