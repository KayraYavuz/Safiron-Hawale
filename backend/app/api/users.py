from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.models.user import User, UserRole
from app.schemas.schemas import UserCreate, UserOut
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["users"])

def _admin_or_manager(cu: User = Depends(get_current_user)):
    if cu.role not in (UserRole.admin, UserRole.super_admin, UserRole.manager):
        raise HTTPException(403, "Yetkisiz")
    return cu

@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), cu: User = Depends(_admin_or_manager)):
    return db.query(User).order_by(User.created_at).all()

@router.post("", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), cu: User = Depends(_admin_or_manager)):
    # Sadece admin başkasına admin rolü verebilir
    if data.role in (UserRole.admin, UserRole.super_admin) and cu.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(403, "Sadece admin yeni bir admin oluşturabilir")
        
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Bu email zaten kayıtlı")
    
    from app.services.audit import log as audit_log
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    audit_log(db, "CREATE_USER", user_id=cu.id, entity="User", detail={"email": data.email, "role": data.role})
    db.commit()
    db.refresh(user)
    return user

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
