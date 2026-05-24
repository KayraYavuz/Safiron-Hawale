from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.core.tenant import get_company_id
from app.models.user import User, UserRole
from app.models.master import Company
from app.schemas.schemas import UserCreate, UserOut, CompanyCreate, CompanyOut
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["users"])


def _generate_user_bot_pin(db) -> str:
    """
    Yönetici kullanıcılar için benzersiz 8 karakterlik Telegram bağlama kodu üretir.
    Format: XXX-XXXX (harf+rakam karışımı, okunabilir)
    Karıştırıcı karakterler (I, O, 0, 1) hariç tutulur.
    """
    import random, string
    chars = string.ascii_uppercase + string.digits
    chars = chars.translate(str.maketrans('', '', 'IO01'))
    while True:
        prefix = ''.join(random.choices(chars, k=3))
        suffix = ''.join(random.choices(chars, k=4))
        pin = f"{prefix}-{suffix}"
        if not db.query(User).filter(User.bot_pin == pin).first():
            return pin

def _admin_or_manager(cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin, UserRole.manager):
        raise HTTPException(403, "Yetkisiz")
    return cu

@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), cu: User = Depends(_admin_or_manager)):
    q = db.query(User).order_by(User.created_at)
    # Non-super_admin only sees users in their own company
    company_id = get_company_id(cu)
    if company_id is not None:
        q = q.filter(User.company_id == company_id)
    return q.all()

@router.post("", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), cu: User = Depends(_admin_or_manager)):
    # Sadece admin başkasına admin rolü verebilir
    if data.role in (UserRole.admin, UserRole.super_admin) and cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin yeni bir admin oluşturabilir")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Bu email zaten kayıtlı")

    # Determine company_id: use provided value (super_admin only), else caller's company
    if data.company_id and cu.role == UserRole.super_admin:
        company_id = data.company_id
    else:
        company_id = cu.company_id

    from app.services.audit import log as audit_log
    # super_admin başka şirkete kullanıcı ekliyorsa onay beklenir
    needs_approval = cu.role == UserRole.super_admin and company_id != cu.company_id
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        company_id=company_id,
        is_approved=not needs_approval,
        bot_pin=_generate_user_bot_pin(db),  # Telegram bağlama kodu
    )
    db.add(user)
    audit_log(db, "CREATE_USER", user_id=cu.id, entity="User", detail={"email": data.email, "role": data.role, "needs_approval": needs_approval})
    db.commit()
    db.refresh(user)
    return user

@router.patch("/{user_id}/approve")
def approve_user(user_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin onaylayabilir")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    # Admin sadece kendi şirketindeki kullanıcıyı onaylayabilir
    if cu.role == UserRole.admin and str(user.company_id) != str(cu.company_id):
        raise HTTPException(403, "Başka şirketin kullanıcısını onaylayamazsınız")
    from app.services.audit import log as audit_log
    user.is_approved = True
    audit_log(db, "APPROVE_USER", user_id=cu.id, entity="User", entity_id=user_id, detail={"email": user.email})
    db.commit()
    return {"ok": True}

# ── Companies ─────────────────────────────────────────────────────────────────
companies_router = APIRouter(prefix="/api/companies", tags=["companies"])

def _super_admin_only(cu: User = Depends(get_current_user)):
    if cu.role != UserRole.super_admin:
        raise HTTPException(403, "Sadece super_admin şirketleri yönetebilir")
    return cu

@companies_router.get("", response_model=List[CompanyOut])
def list_companies(db: Session = Depends(get_db), _=Depends(_super_admin_only)):
    return db.query(Company).order_by(Company.name).all()

@companies_router.post("", response_model=CompanyOut)
def create_company(data: CompanyCreate, db: Session = Depends(get_db), cu: User = Depends(_super_admin_only)):
    code = data.code.upper().strip()
    if not code:
        raise HTTPException(400, "Şirket kodu boş olamaz")
    if db.query(Company).filter(Company.code == code).first():
        raise HTTPException(400, f"'{code}' kodu zaten kullanılıyor")
    if db.query(User).filter(User.email == data.admin_email).first():
        raise HTTPException(400, f"'{data.admin_email}' e-posta adresi zaten kayıtlı")
    if len(data.admin_password) < 6:
        raise HTTPException(400, "Admin şifresi en az 6 karakter olmalı")

    company = Company(name=data.name.strip(), code=code)
    db.add(company)
    db.flush()  # company.id'yi al

    admin = User(
        name=data.admin_name.strip(),
        email=data.admin_email.strip().lower(),
        hashed_password=hash_password(data.admin_password),
        role=UserRole.admin,
        company_id=company.id,
        is_approved=True,
        is_active=True,
        bot_pin=_generate_user_bot_pin(db),  # Telegram bağlama kodu
    )
    db.add(admin)

    from app.services.audit import log as audit_log
    audit_log(db, "CREATE_COMPANY", user_id=cu.id, entity="Company", detail={
        "name": data.name, "code": code, "admin_email": data.admin_email
    })
    db.commit()
    db.refresh(company)
    return company

class TelegramBotUpdate(BaseModel):
    token: Optional[str] = None  # None veya boş → kaldır

@companies_router.patch("/{company_id}/telegram-bot")
def set_telegram_bot(
    company_id: UUID,
    data: TelegramBotUpdate,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    """
    Şirkete Telegram bot token'ı ata.
    Admin kendi şirketini, super_admin hepsini güncelleyebilir.
    """
    if cu.role == UserRole.super_admin:
        company = db.query(Company).filter(Company.id == company_id).first()
    elif cu.role == UserRole.admin and str(cu.company_id) == str(company_id):
        company = db.query(Company).filter(Company.id == company_id).first()
    else:
        raise HTTPException(403, "Yetki yok")

    if not company:
        raise HTTPException(404, "Şirket bulunamadı")

    token = (data.token or "").strip() or None
    company.telegram_bot_token = token
    db.commit()

    # Token eklendiyse botu hemen başlat
    if token:
        from app.services.telegram_multi_bot import start_company_bot
        start_company_bot(str(company.id), company.name, token)
        return {"ok": True, "status": "bot_started", "company": company.name}

    return {"ok": True, "status": "token_cleared"}


@companies_router.patch("/{company_id}/toggle")
def toggle_company(company_id: UUID, db: Session = Depends(get_db), _=Depends(_super_admin_only)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "Şirket bulunamadı")
    company.is_active = not company.is_active
    db.commit()
    return {"ok": True, "is_active": company.is_active}

class PasswordReset(BaseModel):
    password: str

@router.patch("/{user_id}/password")
def reset_password(user_id: UUID, data: PasswordReset, db: Session = Depends(get_db), cu: User = Depends(_admin_or_manager)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")
        
    # Manager kendisinden üstün veya eşit rollerin şifresini değiştiremez (admin hariç)
    if cu.role == UserRole.manager and user.role in (UserRole.admin, UserRole.super_admin):
         raise HTTPException(403, "Manager bir adminin şifresini değiştiremez")

    from app.services.audit import log as audit_log
    user.hashed_password = hash_password(data.password)
    audit_log(db, "RESET_PWD", user_id=cu.id, entity="User", entity_id=user_id, detail={"email": user.email})
    db.commit()
    return {"ok": True}

@router.post("/{user_id}/regenerate-pin")
def regenerate_user_pin(user_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    """
    Kullanıcının bot PIN'ini yenile — eski PIN ve Telegram bağlantısı sıfırlanır.
    Admin kendi şirketindeki, super_admin herkesi yenileyebilir.
    """
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin PIN yenileyebilir")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    if cu.role == UserRole.admin and str(user.company_id) != str(cu.company_id):
        raise HTTPException(403, "Başka şirketin kullanıcısını düzenleyemezsiniz")

    old_pin = user.bot_pin
    user.bot_pin     = _generate_user_bot_pin(db)
    user.telegram_id = None   # Eski Telegram bağlantısını da kopar
    from app.services.audit import log as audit_log
    audit_log(db, "REGEN_USER_PIN", user_id=cu.id, entity="User", entity_id=user_id,
              detail={"email": user.email, "old_pin": old_pin, "new_pin": user.bot_pin})
    db.commit()
    db.refresh(user)
    return {"ok": True, "new_pin": user.bot_pin, "note": "Telegram bağlantısı sıfırlandı. Yeni kodu kullanıcıya iletin."}


@router.delete("/{user_id}")
def delete_user(user_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin kullanıcı silebilir")
        
    if str(cu.id) == str(user_id):
        raise HTTPException(400, "Kendinizi silemezsiniz")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    
    from app.services.audit import log as audit_log
    user.is_active = False
    audit_log(db, "DELETE_USER", user_id=cu.id, entity="User", entity_id=user_id, detail={"email": user.email})
    db.commit()
    return {"ok": True}
