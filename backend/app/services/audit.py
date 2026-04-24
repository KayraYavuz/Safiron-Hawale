"""
Audit log servisi — her kritik işlemde çağrılır.
"""
import json
from sqlalchemy.orm import Session
from app.models.transaction import AuditLog


def log(
    db: Session,
    action: str,
    user_id=None,
    entity: str = None,
    entity_id: str = None,
    detail: dict = None,
    ip_address: str = None,
):
    """Denetim kaydı oluştur. Hata olursa sessizce geç — iş akışını engelleme."""
    try:
        db.add(AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id else None,
            detail=json.dumps(detail, default=str) if detail else None,
            ip_address=ip_address,
        ))
        # flush yapma — çağıran commit eder
    except Exception as e:
        print(f"[audit] log hatası: {e}")
