from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,       # bağlantı ölü mü kontrol et
    pool_size=5,              # kalıcı bağlantı sayısı
    max_overflow=10,          # ani yük için ek bağlantılar
    pool_recycle=1800,        # 30 dk'da bir bağlantıyı yenile (Supabase idle timeout)
    pool_timeout=30,          # bağlantı beklemek için max süre
    echo=False,               # SQL logunu kapat (production'da False)
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
