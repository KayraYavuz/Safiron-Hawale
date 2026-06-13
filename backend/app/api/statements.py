"""GL-backed financial statement endpoints (read-only)."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services import statements

router = APIRouter(prefix="/api/accounting", tags=["statements"])


@router.get("/trial-balance")
def trial_balance(as_of: Optional[date] = None, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return statements.trial_balance(db, cu.company_id, as_of=as_of)


@router.get("/balance-sheet")
def balance_sheet(as_of: Optional[date] = None, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return statements.balance_sheet(db, cu.company_id, as_of=as_of)


@router.get("/income-statement-gl")
def income_statement_gl(start: date, end: date, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return statements.income_statement(db, cu.company_id, start, end)


@router.get("/general-ledger/{account_id}")
def general_ledger(account_id: UUID, start: Optional[date] = None, end: Optional[date] = None,
                   db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return statements.general_ledger(db, cu.company_id, account_id, start, end)
