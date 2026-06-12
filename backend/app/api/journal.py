"""Journal API — list/detail, manual balanced entry, void."""
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.accounting import (
    ChartOfAccount, JournalEntry, JournalLine, JournalSourceType, JournalStatus,
)
from app.schemas.schemas import ManualJournalCreate, JournalEntryOut
from app.services.posting import _persist_entry, void_for_source, period_is_closed, PostingError

router = APIRouter(prefix="/api/accounting/journal", tags=["journal"])
_ADMIN = (UserRole.admin, UserRole.super_admin, UserRole.accounting)


def _require(cu, *roles):
    if cu.role not in roles:
        raise HTTPException(403, "Forbidden")


@router.get("/postable-accounts")
def postable_accounts(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(ChartOfAccount).filter(ChartOfAccount.is_postable == True, ChartOfAccount.is_active == True)
    q = apply_company_filter(q, ChartOfAccount, cu)
    return [{"id": str(a.id), "code": a.code, "name": a.name_tr}
            for a in q.order_by(ChartOfAccount.code).all()]


@router.get("", response_model=List[JournalEntryOut])
def list_journal(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(JournalEntry).options(joinedload(JournalEntry.lines))
    q = apply_company_filter(q, JournalEntry, cu)
    return q.order_by(JournalEntry.created_at.desc()).offset(offset).limit(min(limit, 300)).all()


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_entry(entry_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(JournalEntry).options(joinedload(JournalEntry.lines)).filter(JournalEntry.id == entry_id)
    q = apply_company_filter(q, JournalEntry, cu)
    e = q.first()
    if not e:
        raise HTTPException(404, "Entry not found")
    return e


@router.post("", response_model=JournalEntryOut)
def create_manual(data: ManualJournalCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    if len(data.lines) < 2:
        raise HTTPException(400, "At least two lines required")
    if period_is_closed(db, cu.company_id, data.entry_date):
        raise HTTPException(400, "Period is closed")
    line_dicts = []
    for ln in data.lines:
        acc = db.query(ChartOfAccount).filter(
            ChartOfAccount.id == ln.coa_account_id, ChartOfAccount.company_id == cu.company_id).first()
        if not acc:
            raise HTTPException(404, "Account not found")
        if not acc.is_postable:
            raise HTTPException(400, f"Account {acc.code} is not postable")
        d, c = Decimal(str(ln.debit_usd or 0)), Decimal(str(ln.credit_usd or 0))
        line_dicts.append(dict(coa_account_id=ln.coa_account_id, debit=d, credit=c,
                               currency_id=None, rate_usd=Decimal("1"),
                               debit_usd=d, credit_usd=c, counterparty_id=ln.counterparty_id))
    try:
        entry = _persist_entry(db, cu.company_id, data.entry_date, None,
                               JournalSourceType.manual, None, data.memo, cu.id, line_dicts)
    except PostingError as e:
        raise HTTPException(400, str(e))
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{entry_id}/void", response_model=JournalEntryOut)
def void_entry(entry_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    q = db.query(JournalEntry).filter(JournalEntry.id == entry_id, JournalEntry.status == JournalStatus.posted)
    q = apply_company_filter(q, JournalEntry, cu)
    entry = q.first()
    if not entry:
        raise HTTPException(404, "Posted entry not found")
    try:
        if entry.source_id:
            rev = void_for_source(db, entry.source_id, created_by=cu.id)
        else:
            rev = _reverse_manual(db, entry, cu.id)
    except PostingError as e:
        raise HTTPException(400, str(e))
    db.commit()
    db.refresh(rev)
    return rev


def _reverse_manual(db, entry, created_by):
    lines = db.query(JournalLine).filter(JournalLine.entry_id == entry.id).all()
    mirror = [dict(coa_account_id=l.coa_account_id, debit=l.credit, credit=l.debit,
                   currency_id=l.currency_id, rate_usd=l.rate_usd,
                   debit_usd=l.credit_usd, credit_usd=l.debit_usd,
                   counterparty_id=l.counterparty_id, account_id=l.account_id) for l in lines]
    rev = _persist_entry(db, entry.company_id, date.today(), None, JournalSourceType.manual,
                         None, f"REVERSAL {entry.entry_number}", created_by, mirror)
    entry.status = JournalStatus.void
    entry.reversed_by_id = rev.id
    db.flush()
    return rev
