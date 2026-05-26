from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import apply_company_filter
from app.models.user import User, UserRole
from app.models.master import Location, Currency, Account, Counterparty, CounterpartyType
from app.models.transaction import ExchangeRate
from app.schemas.schemas import (
    LocationCreate, LocationUpdate, LocationOut, CurrencyOut,
    AccountCreate, AccountOut,
    CounterpartyCreate, CounterpartyOut,
    ExchangeRateCreate, ExchangeRateOut,
)
from app.services.balance import get_account_balance, balance_to_usd

router = APIRouter(prefix="/api", tags=["master"])

# ── Cache header helpers ──────────────────────────────────────────────────────
def _cache(seconds: int = 60) -> dict:
    """Return Cache-Control headers for read-only master data."""
    return {"Cache-Control": f"private, max-age={seconds}"}

# ── Locations ─────────────────────────────────────────────────────────────────
@router.get("/locations", response_model=List[LocationOut])
def list_locations(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(Location).filter(Location.is_active == True)
    q = apply_company_filter(q, Location, cu)
    return q.all()

@router.post("/locations", response_model=LocationOut)
def create_location(data: LocationCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Only admin can add locations")
    code = data.code.upper().strip()
    if not code:
        raise HTTPException(400, "Location code cannot be empty")
    if len(code) > 10:
        raise HTTPException(400, "Location code cannot exceed 10 characters")
    if not data.name_tr.strip():
        raise HTTPException(400, "Turkish name is required")
    existing = db.query(Location).filter(Location.code == code).first()
    if existing:
        raise HTTPException(400, f"Code '{code}' is already in use")
    loc = Location(
        code=code,
        name_tr=data.name_tr.strip(),
        name_ar=data.name_ar.strip() if data.name_ar else data.name_tr.strip(),
        name_en=data.name_en.strip() if data.name_en else data.name_tr.strip(),
        country=data.country.upper().strip() if data.country else None,
        company_id=cu.company_id,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

@router.put("/locations/{loc_id}", response_model=LocationOut)
def update_location(loc_id: UUID, data: LocationUpdate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Only admin can edit locations")
    q = db.query(Location).filter(Location.id == loc_id, Location.is_active == True)
    q = apply_company_filter(q, Location, cu)
    loc = q.first()
    if not loc:
        raise HTTPException(404, "Location not found")
    if data.name_tr is not None:
        if not data.name_tr.strip():
            raise HTTPException(400, "Turkish name cannot be empty")
        loc.name_tr = data.name_tr.strip()
    if data.name_ar is not None:
        loc.name_ar = data.name_ar.strip()
    if data.name_en is not None:
        loc.name_en = data.name_en.strip()
    if data.country is not None:
        loc.country = data.country.upper().strip() if data.country.strip() else None
    db.commit()
    db.refresh(loc)
    return loc

@router.delete("/locations/{loc_id}")
def delete_location(loc_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Only admin can delete locations")
    q = db.query(Location).filter(Location.id == loc_id, Location.is_active == True)
    q = apply_company_filter(q, Location, cu)
    loc = q.first()
    if not loc:
        raise HTTPException(404, "Location not found")
    # Bağlı aktif hesap varsa silinemez
    active_accounts = db.query(Account).filter(Account.location_id == loc_id, Account.is_active == True).count()
    if active_accounts > 0:
        raise HTTPException(400, f"Location has {active_accounts} active account(s) — delete them first")
    loc.is_active = False
    db.commit()
    return {"ok": True, "message": f"'{loc.name_tr}' lokasyonu pasife alındı"}

# ── Currencies ────────────────────────────────────────────────────────────────
@router.get("/currencies", response_model=List[CurrencyOut])
def list_currencies(db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Currencies almost never change — cache for 5 minutes in browser
    data = db.query(Currency).filter(Currency.is_active == True).order_by(Currency.code).all()
    return JSONResponse(
        content=[{"id": str(c.id), "code": c.code, "name_tr": c.name_tr, "name_ar": c.name_ar, "name_en": c.name_en, "symbol": c.symbol, "decimal_places": c.decimal_places, "is_active": c.is_active} for c in data],
        headers=_cache(300)
    )

# ── Accounts ──────────────────────────────────────────────────────────────────
@router.get("/accounts", response_model=List[AccountOut])
def list_accounts(
    location_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    q = db.query(Account).filter(Account.is_active == True)
    q = apply_company_filter(q, Account, cu)
    if location_id:
        q = q.filter(Account.location_id == location_id)
    return q.all()

@router.post("/accounts", response_model=AccountOut)
def create_account(data: AccountCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Only admin can perform this action")
    acc = Account(**data.model_dump(), company_id=cu.company_id)
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc

@router.get("/accounts/{account_id}/balance")
def account_balance(account_id: UUID, db: Session = Depends(get_db), _=Depends(get_current_user)):
    balance = get_account_balance(db, account_id)
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    balance_usd = balance_to_usd(balance, acc.currency.code, db)
    return {
        "account_id": str(account_id),
        "balance": str(balance),
        "currency_code": acc.currency.code,
        "balance_usd": str(balance_usd),
    }

# ── Counterparties ────────────────────────────────────────────────────────────
@router.get("/counterparties", response_model=List[CounterpartyOut])
def list_counterparties(
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    q = db.query(Counterparty).filter(Counterparty.is_active == True)
    q = apply_company_filter(q, Counterparty, cu)
    if type:
        q = q.filter(Counterparty.type == type)
    return q.order_by(Counterparty.name).all()

@router.post("/counterparties", response_model=CounterpartyOut)
def create_counterparty(data: CounterpartyCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    from datetime import datetime
    count = db.query(Counterparty).count()
    code  = f"CP-{datetime.now().year}-{str(count+1).zfill(5)}"
    pin   = _generate_bot_pin(db)
    cp = Counterparty(**data.model_dump(), code=code, company_id=cu.company_id, bot_pin=pin)
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp


def _generate_bot_pin(db) -> str:
    """
    Benzersiz 8 karakterlik bot erişim kodu üretir.
    Format: XXX-XXXX (harf+rakam karışımı, okunabilir)
    Örnek: SAF-7K2M
    """
    import random, string
    chars = string.ascii_uppercase + string.digits
    # I, O, 0, 1 gibi karıştırıcı karakterleri çıkar
    chars = chars.translate(str.maketrans('', '', 'IO01'))
    while True:
        prefix = ''.join(random.choices(chars, k=3))
        suffix = ''.join(random.choices(chars, k=4))
        pin = f"{prefix}-{suffix}"
        # Benzersizlik kontrolü
        if not db.query(Counterparty).filter(Counterparty.bot_pin == pin).first():
            return pin


@router.post("/counterparties/{cp_id}/regenerate-pin")
def regenerate_bot_pin(
    cp_id: UUID,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    """
    Müşterinin bot PIN'ini yenile (eski PIN geçersiz olur).
    Güvenlik ihlali şüphesinde kullanılır.
    """
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Only admin can regenerate PIN")
    q  = db.query(Counterparty).filter(Counterparty.id == cp_id)
    q  = apply_company_filter(q, Counterparty, cu)
    cp = q.first()
    if not cp:
        raise HTTPException(404, "Counterparty not found")
    old_pin = cp.bot_pin
    cp.bot_pin     = _generate_bot_pin(db)
    cp.telegram_id = None   # Eski bağlantıyı da sıfırla
    db.commit()
    return {"ok": True, "new_pin": cp.bot_pin, "old_pin": old_pin,
            "note": "Müşterinin Telegram bağlantısı sıfırlandı. Yeni kodu iletin."}

@router.put("/counterparties/{cp_id}", response_model=CounterpartyOut)
def update_counterparty(cp_id: UUID, data: CounterpartyCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin, UserRole.accounting):
        raise HTTPException(403, "Forbidden")
    q = db.query(Counterparty).filter(Counterparty.id == cp_id)
    q = apply_company_filter(q, Counterparty, cu)
    cp = q.first()
    if not cp:
        raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items():
        setattr(cp, k, v)
    db.commit()
    db.refresh(cp)
    return cp

@router.delete("/counterparties/{cp_id}")
def delete_counterparty(cp_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    """
    Karşı taraf silme — soft delete (is_active=False).
    Bağlı işlemi olsa dahi pasife alınabilir (geçmişi korumak için).
    """
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Only admin can delete")
    q = db.query(Counterparty).filter(Counterparty.id == cp_id)
    q = apply_company_filter(q, Counterparty, cu)
    cp = q.first()
    if not cp:
        raise HTTPException(404, "Counterparty not found")

    # Soft delete — işlemi olsa dahi artık listelerde görünmeyecek
    cp.is_active = False
    db.commit()
    return {"ok": True, "message": f"{cp.name} pasife alındı"}

@router.delete("/accounts/{account_id}")
def delete_account(account_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    """
    Hesap silme — soft delete (is_active=False).
    Bakiyesi olan hesaplar silinemez (sıfırlanmalı).
    İşlem geçmişi olsa dahi pasife alınabilir.
    """
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Only admin can delete")
    q = db.query(Account).filter(Account.id == account_id)
    q = apply_company_filter(q, Account, cu)
    acc = q.first()
    if not acc:
        raise HTTPException(404, "Account not found")

    # Bakiye kontrolü — bakiye varken pasife almak kafa karıştırır
    balance = get_account_balance(db, account_id)
    from decimal import Decimal
    if abs(balance) > Decimal("0.01"):
        raise HTTPException(400, f"Account balance is {balance} — cannot delete until zero")

    # Soft delete
    acc.is_active = False
    db.commit()
    return {"ok": True, "message": f"{acc.name} pasife alındı"}

# ── Exchange Rates ────────────────────────────────────────────────────────────
@router.get("/exchange-rates", response_model=List[ExchangeRateOut])
def list_rates(rate_date: Optional[date] = None, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    from sqlalchemy import or_
    from app.core.tenant import get_company_id
    company_id = get_company_id(cu)
    q = db.query(ExchangeRate)
    if company_id is not None:
        # Şirkete ait manuel kurlar + global (auto) kurlar
        q = q.filter(or_(ExchangeRate.company_id == company_id, ExchangeRate.company_id == None))
    if rate_date:
        q = q.filter(ExchangeRate.date == rate_date)
    return q.order_by(ExchangeRate.date.desc(), ExchangeRate.currency_code).limit(500).all()

@router.post("/exchange-rates", response_model=ExchangeRateOut)
def create_rate(data: ExchangeRateCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    from app.services.balance import invalidate_rates_cache
    # Aynı tarih + para birimi + şirket varsa güncelle
    q = db.query(ExchangeRate).filter(
        ExchangeRate.date == data.date,
        ExchangeRate.currency_code == data.currency_code.upper(),
    )
    q = apply_company_filter(q, ExchangeRate, cu)
    existing = q.first()
    if existing:
        existing.rate_per_usd = data.rate_per_usd
        existing.source = "manual"
        db.commit()
        db.refresh(existing)
        invalidate_rates_cache()
        return existing
    rate = ExchangeRate(**data.model_dump(), source="manual", company_id=cu.company_id)
    rate.currency_code = rate.currency_code.upper()
    db.add(rate)
    db.commit()
    db.refresh(rate)
    invalidate_rates_cache()
    return rate

@router.post("/fx/update-rates")
async def auto_update_rates(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from app.services.fx import fetch_and_save_rates
    from app.services.balance import invalidate_rates_cache
    result = await fetch_and_save_rates()
    if "error" in result:
        raise HTTPException(503, f"Rate update failed: {result['error']}")
    invalidate_rates_cache()
    return result
