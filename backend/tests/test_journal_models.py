from app.models.accounting import (
    JournalEntry, JournalLine, JournalSequence, FiscalPeriod,
    JournalSourceType, JournalStatus, FiscalPeriodStatus,
)
from app.models.master import Account


def test_journal_source_types():
    assert {s.value for s in JournalSourceType} == {
        "transaction", "settlement", "manual", "opening", "backfill"
    }


def test_journal_status_values():
    assert {s.value for s in JournalStatus} == {"posted", "void"}


def test_fiscal_period_status_values():
    assert {s.value for s in FiscalPeriodStatus} == {"open", "closed"}


def test_journal_entry_columns():
    cols = JournalEntry.__table__.columns.keys()
    for c in ("id", "company_id", "entry_number", "entry_date", "value_date",
              "source_type", "source_id", "memo", "status", "reversed_by_id",
              "created_by", "created_at"):
        assert c in cols


def test_journal_line_columns():
    cols = JournalLine.__table__.columns.keys()
    for c in ("id", "entry_id", "coa_account_id", "debit", "credit",
              "currency_id", "rate_usd", "debit_usd", "credit_usd",
              "counterparty_id", "account_id"):
        assert c in cols


def test_account_has_gl_link():
    assert "gl_account_id" in Account.__table__.columns.keys()
