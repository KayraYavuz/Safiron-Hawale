from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user
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
def list_locations(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Location).filter(Location.is_active == True).all()

@router.post("/locations", response_model=LocationOut)
def create_location(data: LocationCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin yeni lokasyon ekleyebilir")
    code = data.code.upper().strip()
    if not code:
        raise HTTPException(400, "Lokasyon kodu boş olamaz")
    if len(code) > 10:
        raise HTTPException(400, "Lokasyon kodu en fazla 10 karakter olabilir")
    if not data.name_tr.strip():
        raise HTTPException(400, "Türkçe isim zorunludur")
    existing = db.query(Location).filter(Location.code == code).first()
    if existing:
        raise HTTPException(400, f"'{code}' kodu zaten kullanılıyor")
    loc = Location(
        code=code,
        name_tr=data.name_tr.strip(),
        name_ar=data.name_ar.strip() if data.name_ar else data.name_tr.strip(),
        name_en=data.name_en.strip() if data.name_en else data.name_tr.strip(),
        country=data.country.upper().strip() if data.country else None,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

@router.put("/locations/{loc_id}", response_model=LocationOut)
def update_location(loc_id: UUID, data: LocationUpdate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin lokasyon düzenleyebilir")
    loc = db.query(Location).filter(Location.id == loc_id, Location.is_active == True).first()
    if not loc:
        raise HTTPException(404, "Lokasyon bulunamadı")
    if data.name_tr is not None:
        if not data.name_tr.strip():
            raise HTTPException(400, "Türkçe isim boş olamaz")
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
        raise HTTPException(403, "Sadece admin lokasyon silebilir")
    loc = db.query(Location).filter(Location.id == loc_id, Location.is_active == True).first()
    if not loc:
        raise HTTPException(404, "Lokasyon bulunamadı")
    # Bağlı aktif hesap varsa silinemez
    active_accounts = db.query(Account).filter(Account.location_id == loc_id, Account.is_active == True).count()
    if active_accounts > 0:
        raise HTTPException(400, f"Bu lokasyona ait {active_accounts} aktif hesap var — önce hesapları silin")
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
    _=Depends(get_current_user),
):
    q = db.query(Account).filter(Account.is_active == True)
    if location_id:
        q = q.filter(Account.location_id == location_id)
    return q.all()

@router.post("/accounts", response_model=AccountOut)
def create_account(data: AccountCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin yapabilir")
    acc = Account(**data.model_dump())
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc

@router.get("/accounts/{account_id}/balance")
def account_balance(account_id: UUID, db: Session = Depends(get_db), _=Depends(get_current_user)):
    balance = get_account_balance(db, account_id)
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(404, "Hesap bulunamadı")
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
    _=Depends(get_current_user),
):
    q = db.query(Counterparty).filter(Counterparty.is_active == True)
    if type:
        q = q.filter(Counterparty.type == type)
    return q.order_by(Counterparty.name).all()

@router.post("/counterparties", response_model=CounterpartyOut)
def create_counterparty(data: CounterpartyCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    from datetime import datetime
    count = db.query(Counterparty).count()
    code = f"CP-{datetime.now().year}-{str(count+1).zfill(5)}"
    cp = Counterparty(**data.model_dump(), code=code)
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp

@router.put("/counterparties/{cp_id}", response_model=CounterpartyOut)
def update_counterparty(cp_id: UUID, data: CounterpartyCreate, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin, UserRole.accounting):
        raise HTTPException(403, "Yetkisiz")
    cp = db.query(Counterparty).filter(Counterparty.id == cp_id).first()
    if not cp:
        raise HTTPException(404, "Bulunamadı")
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
        raise HTTPException(403, "Sadece admin silebilir")
    cp = db.query(Counterparty).filter(Counterparty.id == cp_id).first()
    if not cp:
        raise HTTPException(404, "Karşı taraf bulunamadı")

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
        raise HTTPException(403, "Sadece admin silebilir")
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(404, "Hesap bulunamadı")

    # Bakiye kontrolü — bakiye varken pasife almak kafa karıştırır
    balance = get_account_balance(db, account_id)
    from decimal import Decimal
    if abs(balance) > Decimal("0.01"):
        raise HTTPException(400, f"Hesap bakiyesi {balance} — sıfırlanmadan silinemez")

    # Soft delete
    acc.is_active = False
    db.commit()
    return {"ok": True, "message": f"{acc.name} pasife alındı"}

# ── Exchange Rates ────────────────────────────────────────────────────────────
@router.get("/exchange-rates", response_model=List[ExchangeRateOut])
def list_rates(rate_date: Optional[date] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(ExchangeRate)
    if rate_date:
        q = q.filter(ExchangeRate.date == rate_date)
    return q.order_by(ExchangeRate.date.desc(), ExchangeRate.currency_code).limit(500).all()

@router.post("/exchange-rates", response_model=ExchangeRateOut)
def create_rate(data: ExchangeRateCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    from app.services.balance import invalidate_rates_cache
    # Aynı tarih + para birimi varsa güncelle
    existing = db.query(ExchangeRate).filter(
        ExchangeRate.date == data.date,
        ExchangeRate.currency_code == data.currency_code.upper(),
    ).first()
    if existing:
        existing.rate_per_usd = data.rate_per_usd
        existing.source = "manual"
        db.commit()
        db.refresh(existing)
        invalidate_rates_cache()
        return existing
    rate = ExchangeRate(**data.model_dump(), source="manual")
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
        raise HTTPException(503, f"Kur güncellenemedi: {result['error']}")
    invalidate_rates_cache()
    return result
