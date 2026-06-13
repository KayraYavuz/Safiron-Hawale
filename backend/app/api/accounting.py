"""
Chart of Accounts API — initialize, tree CRUD, role mappings.
Tenant-scoped via apply_company_filter. Phase 1 (no ledger yet).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from decimal import Decimal
from pydantic import BaseModel
from app.models.user import User, UserRole
from app.models.master import Company
from app.models.accounting import (
    ChartOfAccount, AccountMapping, AccountType, AccountScheme, AccountRole,
)
from app.schemas.schemas import (
    InitializeChart, CoaAccountCreate, CoaAccountUpdate, CoaAccountOut,
    MappingUpdate, MappingOut,
)
from app.services.accounting_seed import initialize_chart
from app.services.audit import log as audit_log

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

_ADMIN = (UserRole.admin, UserRole.super_admin, UserRole.accounting)


def _require(cu: User, *roles):
    if cu.role not in roles:
        raise HTTPException(403, "Forbidden")


@router.post("/initialize")
def initialize(data: InitializeChart, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, UserRole.admin, UserRole.super_admin)
    if data.scheme not in ("thp", "intl"):
        raise HTTPException(400, "scheme must be 'thp' or 'intl'")
    result = initialize_chart(db, cu.company_id, data.scheme)
    audit_log(db, "INITIALIZE", user_id=cu.id, entity="ChartOfAccounts",
              entity_id=cu.company_id, detail={"scheme": data.scheme, **result})
    db.commit()
    return result


@router.get("/chart", response_model=List[CoaAccountOut])
def list_chart(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(ChartOfAccount).filter(ChartOfAccount.is_active == True)
    q = apply_company_filter(q, ChartOfAccount, cu)
    return q.order_by(ChartOfAccount.code).all()


@router.post("/chart", response_model=CoaAccountOut)
def create_account(data: CoaAccountCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    code = data.code.strip()
    if not code:
        raise HTTPException(400, "Code required")
    dupe = db.query(ChartOfAccount).filter(
        ChartOfAccount.company_id == cu.company_id, ChartOfAccount.code == code,
    ).first()
    if dupe:
        raise HTTPException(400, f"Code '{code}' already exists")
    # scheme: inherit company scheme (must be initialised first)
    scheme_row = db.query(ChartOfAccount.scheme).filter(
        ChartOfAccount.company_id == cu.company_id,
    ).first()
    if not scheme_row:
        raise HTTPException(400, "Initialise a chart scheme first")
    acc = ChartOfAccount(
        company_id=cu.company_id,
        code=code,
        name_tr=data.name_tr.strip(),
        name_ar=(data.name_ar or data.name_tr).strip(),
        name_en=(data.name_en or data.name_tr).strip(),
        account_type=AccountType(data.account_type),
        thp_class=data.thp_class,
        parent_id=data.parent_id,
        is_postable=data.is_postable,
        currency_id=data.currency_id,
        scheme=scheme_row[0],
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.patch("/chart/{acc_id}", response_model=CoaAccountOut)
def update_account(acc_id: UUID, data: CoaAccountUpdate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    q = db.query(ChartOfAccount).filter(ChartOfAccount.id == acc_id)
    q = apply_company_filter(q, ChartOfAccount, cu)
    acc = q.first()
    if not acc:
        raise HTTPException(404, "Account not found")
    for field in ("name_tr", "name_ar", "name_en", "is_postable", "is_active", "parent_id"):
        val = getattr(data, field)
        if val is not None:
            setattr(acc, field, val)
    db.commit()
    db.refresh(acc)
    return acc


@router.delete("/chart/{acc_id}")
def delete_account(acc_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    q = db.query(ChartOfAccount).filter(ChartOfAccount.id == acc_id)
    q = apply_company_filter(q, ChartOfAccount, cu)
    acc = q.first()
    if not acc:
        raise HTTPException(404, "Account not found")
    kids = db.query(ChartOfAccount).filter(ChartOfAccount.parent_id == acc_id, ChartOfAccount.is_active == True).count()
    if kids:
        raise HTTPException(400, f"Account has {kids} child account(s) — remove them first")
    acc.is_active = False
    db.commit()
    return {"ok": True}


class TaxRateUpdate(BaseModel):
    rate: Decimal  # fraction, e.g. 0.05 = 5%


@router.get("/tax-rate")
def get_tax_rate(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    co = db.query(Company).filter(Company.id == cu.company_id).first()
    return {"rate": str(co.commission_tax_rate or 0) if co else "0"}


@router.put("/tax-rate")
def set_tax_rate(data: TaxRateUpdate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, UserRole.admin, UserRole.super_admin)
    if data.rate < 0 or data.rate > 1:
        raise HTTPException(400, "Rate must be a fraction between 0 and 1 (e.g. 0.05 for 5%)")
    co = db.query(Company).filter(Company.id == cu.company_id).first()
    if not co:
        raise HTTPException(404, "Company not found")
    co.commission_tax_rate = data.rate
    db.commit()
    return {"rate": str(co.commission_tax_rate)}


@router.get("/mappings", response_model=List[MappingOut])
def list_mappings(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(AccountMapping)
    q = apply_company_filter(q, AccountMapping, cu)
    return q.all()


@router.put("/mappings", response_model=MappingOut)
def upsert_mapping(data: MappingUpdate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    _require(cu, *_ADMIN)
    # account must belong to company + be postable
    acc = db.query(ChartOfAccount).filter(
        ChartOfAccount.id == data.coa_account_id,
        ChartOfAccount.company_id == cu.company_id,
    ).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    if not acc.is_postable:
        raise HTTPException(400, "Mapping target must be a postable account")
    q = db.query(AccountMapping).filter(AccountMapping.role == AccountRole(data.role))
    q = apply_company_filter(q, AccountMapping, cu)
    m = q.first()
    if m:
        m.coa_account_id = data.coa_account_id
    else:
        m = AccountMapping(company_id=cu.company_id, role=AccountRole(data.role),
                           coa_account_id=data.coa_account_id)
        db.add(m)
    db.commit()
    db.refresh(m)
    return m
