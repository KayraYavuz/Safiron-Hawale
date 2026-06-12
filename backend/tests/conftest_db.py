"""In-memory SQLite session for accounting integration tests."""
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
import app.models  # noqa: F401  (registers all tables on Base.metadata)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def company_id(db):
    from app.models.master import Company
    cid = uuid.uuid4()
    db.add(Company(id=cid, name="Test Co", code="TST"))
    db.commit()
    return cid
