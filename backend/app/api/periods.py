"""Fiscal period close / reopen / list API."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.accounting import FiscalPeriod
from app.services import period_close

router = APIRouter(prefix="/api/accounting/periods", tags=["periods"])
_ADMIN = (UserRole.admin, UserRole.super_admin, UserRole.accounting)


class CloseRequest(BaseModel):
    period_start: date
    period_end: date


def _require(cu, *roles):
    if cu.role not in roles:
        raise HTTPException(403, "Forbidden")


def _out(p: FiscalPeriod) -> dict:
    return {"id": str(p.id), "period_start": str(p.period_start), "period_end": str(p.period_end),
            "status": p.status.value, "closed_at": str(p.closed_at) if p.closed_at else None}


@router.get("")
def list_periods(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return [_out(p) for p in period_close.list_periods(db, cu.company_id)]


@router.post("/close")
def close(data: CloseRequest, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    try:
        p = period_close.close_period(db, cu.company_id, data.period_start, data.period_end, user_id=cu.id)
    except period_close.PeriodError as e:
        raise HTTPException(400, str(e))
    db.commit()
    db.refresh(p)
    return _out(p)


@router.post("/{period_id}/reopen")
def reopen(period_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    q = apply_company_filter(db.query(FiscalPeriod).filter(FiscalPeriod.id == period_id), FiscalPeriod, cu)
    if not q.first():
        raise HTTPException(404, "Period not found")
    try:
        p = period_close.reopen_period(db, cu.company_id, period_id)
    except period_close.PeriodError as e:
        raise HTTPException(400, str(e))
    db.commit()
    db.refresh(p)
    return _out(p)
