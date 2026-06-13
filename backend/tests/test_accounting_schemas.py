from app.schemas.schemas import (
    CoaAccountCreate, CoaAccountUpdate, CoaAccountOut, MappingUpdate, InitializeChart,
)


def test_initialize_schema_accepts_scheme():
    m = InitializeChart(scheme="thp")
    assert m.scheme == "thp"


def test_coa_create_requires_core_fields():
    c = CoaAccountCreate(
        code="999", name_tr="Test", account_type="asset",
    )
    assert c.code == "999"
    assert c.name_tr == "Test"
    assert c.is_postable is True  # default


def test_mapping_update_shape():
    import uuid
    m = MappingUpdate(role="cash", coa_account_id=uuid.uuid4())
    assert m.role == "cash"
