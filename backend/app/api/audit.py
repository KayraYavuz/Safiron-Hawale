from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.transaction import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])

def _require_admin_or_manager(user: User):
    if user.role not in (UserRole.admin, UserRole.super_admin, UserRole.auditor, UserRole.manager):
        from fastapi import HTTPException
        raise HTTPException(403, "Sadece admin, super_admin, auditor veya manager görebilir")

@router.get("")
def list_audit(
    from_date: Optional[date] = None,
    to_date:   Optional[date] = None,
    action:    Optional[str]  = None,
    entity:    Optional[str]  = None,
    limit:     int = 200,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    _require_admin_or_manager(cu)
    
    from app.services.audit import log as audit_log
    audit_log(db, "VIEW_AUDIT", user_id=cu.id, entity="Audit")
    
    q = db.query(AuditLog).options(joinedload(AuditLog.user))
    if from_date: q = q.filter(AuditLog.created_at >= from_date)
    if to_date:   q = q.filter(AuditLog.created_at <= to_date)
    if action:    q = q.filter(AuditLog.action == action)
    if entity:    q = q.filter(AuditLog.entity == entity)
    logs = q.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [{
        "id":         str(l.id),
        "action":     l.action,
        "entity":     l.entity,
        "entity_id":  l.entity_id,
        "detail":     l.detail,
        "ip_address": l.ip_address,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "user_name":  l.user.name if l.user else "Sistem",
        "user_email": l.user.email if l.user else None,
    } for l in logs]
