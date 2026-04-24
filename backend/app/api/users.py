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

def _admin_only(cu: User = Depends(get_current_user)):
    if cu.role != UserRole.admin:
        raise HTTPException(403, "Sadece admin")
    return cu

@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(_admin_only)):
    return db.query(User).order_by(User.created_at).all()

@router.post("", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), _=Depends(_admin_only)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Bu email zaten kayıtlı")
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

class PasswordReset(BaseModel):
    password: str

@router.patch("/{user_id}/password")
def reset_password(user_id: UUID, data: PasswordReset, db: Session = Depends(get_db), _=Depends(_admin_only)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    user.hashed_password = hash_password(data.password)
    db.commit()
    return {"ok": True}

@router.delete("/{user_id}")
def delete_user(user_id: UUID, db: Session = Depends(get_db), cu: User = Depends(_admin_only)):
    if str(cu.id) == str(user_id):
        raise HTTPException(400, "Kendinizi silemezsiniz")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    user.is_active = False
    db.commit()
    return {"ok": True}
