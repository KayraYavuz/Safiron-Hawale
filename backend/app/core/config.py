from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    GEMINI_API_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALLOWED_ORIGINS: str = ""

    @property
    def SQLALCHEMY_DATABASE_URL(self) -> str:
        # SQLAlchemy 1.4+ requires 'postgresql+psycopg2://' instead of 'postgres://'
        # and sometimes the 'postgresql://' prefix needs to be explicit for some drivers
        if self.DATABASE_URL.startswith("postgres://"):
            return self.DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
        if self.DATABASE_URL.startswith("postgresql://"):
            return self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
        return self.DATABASE_URL

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
