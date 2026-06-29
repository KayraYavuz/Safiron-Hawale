"""AML / compliance API — watchlist management, flag report, settings."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.timeutil import utcnow
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.master import Company
from app.models.transaction import Transaction
from app.models.compliance import Watchlist, ComplianceFlag, ComplianceStatus
from app.services.audit import log as audit_log

router = APIRouter(prefix="/api/compliance", tags=["compliance"])

_ADMIN = (UserRole.admin, UserRole.super_admin)
_MANAGER = (UserRole.admin, UserRole.super_admin, UserRole.manager, UserRole.branch_manager)


def _block_data_entry(cu: User):
    if cu.role == UserRole.data_entry:
        raise HTTPException(403, "Forbidden")


# ── Watchlist ──────────────────────────────────────────────────────────────────
class WatchlistCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    reason: Optional[str] = None


@router.get("/watchlist")
def list_watchlist(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _block_data_entry(cu)
    q = apply_company_filter(db.query(Watchlist).filter(Watchlist.is_active == True), Watchlist, cu)
    return [{"id": str(w.id), "name": w.name, "name_ar": w.name_ar, "reason": w.reason}
            for w in q.order_by(Watchlist.name).all()]


@router.post("/watchlist")
def add_watchlist(data: WatchlistCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in _ADMIN:
        raise HTTPException(403, "Only admin can edit the watchlist")
    if not data.name.strip():
        raise HTTPException(400, "Name is required")
    w = Watchlist(company_id=cu.company_id, name=data.name.strip(),
                  name_ar=(data.name_ar or "").strip() or None,
                  reason=(data.reason or "").strip() or None)
    db.add(w)
    audit_log(db, "WATCHLIST_ADD", user_id=cu.id, entity="Watchlist", detail={"name": w.name})
    db.commit()
    db.refresh(w)
    return {"id": str(w.id), "name": w.name, "name_ar": w.name_ar, "reason": w.reason}


@router.delete("/watchlist/{wl_id}")
def remove_watchlist(wl_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in _ADMIN:
        raise HTTPException(403, "Only admin can edit the watchlist")
    q = apply_company_filter(db.query(Watchlist).filter(Watchlist.id == wl_id), Watchlist, cu)
    w = q.first()
    if not w:
        raise HTTPException(404, "Not found")
    w.is_active = False
    db.commit()
    return {"ok": True}


# ── Flags (compliance report) ───────────────────────────────────────────────────
@router.get("/flags")
def list_flags(status: Optional[str] = None, rule: Optional[str] = None,
               db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _block_data_entry(cu)
    q = db.query(ComplianceFlag)
    q = apply_company_filter(q, ComplianceFlag, cu)
    if status:
        q = q.filter(ComplianceFlag.status == status)
    if rule:
        q = q.filter(ComplianceFlag.rule == rule)
    flags = q.order_by(ComplianceFlag.created_at.desc()).limit(500).all()
    # batch-load transaction numbers
    txn_ids = {f.transaction_id for f in flags}
    txns = {t.id: t for t in db.query(Transaction).filter(Transaction.id.in_(txn_ids)).all()} if txn_ids else {}
    out = []
    for f in flags:
        t = txns.get(f.transaction_id)
        out.append({
            "id": str(f.id),
            "transaction_id": str(f.transaction_id),
            "txn_number": t.txn_number if t else None,
            "txn_date": str(t.txn_date) if t else None,
            "rule": f.rule.value,
            "detail": f.detail,
            "status": f.status.value,
            "created_at": str(f.created_at),
        })
    return out


class ClearRequest(BaseModel):
    note: Optional[str] = None


@router.post("/flags/{flag_id}/clear")
def clear_flag(flag_id: UUID, data: ClearRequest, db: Session = Depends(get_db),
               cu: User = Depends(get_current_user)):
    if cu.role not in _MANAGER:
        raise HTTPException(403, "Only managers can clear flags")
    q = apply_company_filter(db.query(ComplianceFlag).filter(ComplianceFlag.id == flag_id), ComplianceFlag, cu)
    f = q.first()
    if not f:
        raise HTTPException(404, "Flag not found")
    f.status = ComplianceStatus.cleared
    f.cleared_by = cu.id
    f.cleared_at = utcnow()
    audit_log(db, "COMPLIANCE_CLEAR", user_id=cu.id, entity="ComplianceFlag",
              entity_id=flag_id, detail={"note": data.note, "rule": f.rule.value})
    db.commit()
    return {"ok": True}


# ── Settings ────────────────────────────────────────────────────────────────────
class SettingsUpdate(BaseModel):
    aml_threshold_usd: Decimal
    aml_structuring_window_days: int


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _block_data_entry(cu)
    co = db.query(Company).filter(Company.id == cu.company_id).first()
    if not co:
        raise HTTPException(404, "Company not found")
    return {
        "aml_threshold_usd": str(co.aml_threshold_usd or 0),
        "aml_structuring_window_days": int(co.aml_structuring_window_days or 1),
    }


@router.put("/settings")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in _ADMIN:
        raise HTTPException(403, "Only admin can change compliance settings")
    co = db.query(Company).filter(Company.id == cu.company_id).first()
    if not co:
        raise HTTPException(404, "Company not found")
    if data.aml_threshold_usd < 0:
        raise HTTPException(400, "Threshold cannot be negative")
    if data.aml_structuring_window_days < 1:
        raise HTTPException(400, "Window must be at least 1 day")
    co.aml_threshold_usd = data.aml_threshold_usd
    co.aml_structuring_window_days = data.aml_structuring_window_days
    audit_log(db, "COMPLIANCE_SETTINGS", user_id=cu.id, entity="Company", entity_id=co.id,
              detail={"threshold": str(data.aml_threshold_usd), "window": data.aml_structuring_window_days})
    db.commit()
    return {"ok": True}
