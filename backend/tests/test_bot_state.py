"""
Tests for Telegram bot conversation state helpers.
_cget / _cset / _cupd / _cclr — DB-backed state management.

SessionLocal mock'lanır, gerçek DB bağlantısı gerekmez.
"""
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, call
import pytest


def _make_session_mock(row=None):
    """Sahte SessionLocal session döndürür."""
    session = MagicMock()
    session.__enter__ = MagicMock(return_value=session)
    session.__exit__ = MagicMock(return_value=False)
    # execute().fetchone() zinciri
    fetch = MagicMock()
    fetch.fetchone.return_value = row
    session.execute.return_value = fetch
    return session


class TestCget:
    """_cget(company_id, uid) → (state, data) veya None."""

    def test_returns_none_when_no_row(self):
        """Kayıt yoksa None döner."""
        session = _make_session_mock(row=None)
        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cget
            result = _cget("company-1", 12345)
        assert result is None

    def test_returns_none_when_expired(self):
        """2 saatten eski kayıt None döner (süresi dolmuş)."""
        old_time = datetime.utcnow() - timedelta(hours=3)
        row = MagicMock()
        row.state = "some_state"
        row.data = "{}"
        row.updated_at = old_time

        session = _make_session_mock(row=row)
        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cget
            result = _cget("company-1", 12345)
        assert result is None

    def test_returns_state_and_data_when_fresh(self):
        """Taze kayıt (state, data) tuple döner."""
        recent = datetime.utcnow() - timedelta(minutes=30)
        row = MagicMock()
        row.state = "S_TXN_TYPE"
        row.data = '{"amount": 1000}'
        row.updated_at = recent

        session = _make_session_mock(row=row)
        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cget
            result = _cget("company-1", 12345)
        assert result is not None
        assert result["state"] == "S_TXN_TYPE"
        assert result["data"] == {"amount": 1000}

    def test_data_json_parsed(self):
        """data alanı JSON string → dict olarak parse edilmeli."""
        recent = datetime.utcnow() - timedelta(minutes=5)
        row = MagicMock()
        row.state = "S_TXN_AMT"
        row.data = '{"currency": "SAR", "rate": 3.75}'
        row.updated_at = recent

        session = _make_session_mock(row=row)
        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cget
            result = _cget("company-1", 99)
        assert result["data"]["currency"] == "SAR"
        assert result["data"]["rate"] == 3.75


class TestCset:
    """_cset(company_id, uid, state, data) — upsert."""

    def test_calls_execute_with_upsert(self):
        """execute() çağrılmalı (INSERT ON CONFLICT)."""
        session = _make_session_mock()
        session.execute.return_value = MagicMock()

        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cset
            _cset("company-1", 12345, "S_TXN_TYPE", {"step": 1})
        assert session.execute.called

    def test_commits(self):
        """Session commit edilmeli."""
        session = _make_session_mock()
        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cset
            _cset("company-1", 12345, "S_TXN_TYPE", {})
        session.commit.assert_called()

    def test_session_closed_on_error(self):
        """Hata durumunda session.close() yine de çağrılmalı."""
        session = _make_session_mock()
        session.execute.side_effect = RuntimeError("DB error")

        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cset
            # Exception fırlatmamalı
            _cset("company-1", 12345, "S_TXN_TYPE", {})
        session.close.assert_called()


class TestCclr:
    """_cclr(company_id, uid) — kaydı sil."""

    def test_calls_delete(self):
        """DELETE sorgusu çalıştırılmalı."""
        session = _make_session_mock()
        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cclr
            _cclr("company-1", 12345)
        assert session.execute.called

    def test_commits_after_delete(self):
        session = _make_session_mock()
        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cclr
            _cclr("company-1", 12345)
        session.commit.assert_called()


class TestConvKeyFormat:
    """Konuşma anahtarı formatı: '{company_id}:{uid}'."""

    def test_key_format(self):
        """_cset'te key formatı company_id:uid şeklinde olmalı."""
        session = _make_session_mock()
        captured_sql = []

        def capture_execute(sql, params=None):
            captured_sql.append((str(sql), params))
            return MagicMock()

        session.execute.side_effect = capture_execute

        with patch("app.core.database.SessionLocal", return_value=session):
            from app.services.telegram_multi_bot import _cset
            _cset("company-abc", 99999, "test_state", {})

        # En az bir execute çağrısında 'company-abc:99999' key geçmeli
        key_found = any(
            params and params.get("key") == "company-abc:99999"
            for _, params in captured_sql
        )
        assert key_found, f"Expected key 'company-abc:99999' in {captured_sql}"


class TestMakeInlineMenu:
    """_make_inline_menu() — InlineKeyboardMarkup döndürmeli."""

    def test_returns_inline_keyboard(self):
        from telegram import InlineKeyboardMarkup
        from app.services.telegram_multi_bot import _make_inline_menu
        menu = _make_inline_menu(uid=0, is_admin=True)
        assert isinstance(menu, InlineKeyboardMarkup)

    def test_admin_has_more_buttons_than_nonadmin(self):
        """Admin menüsü non-admin'den daha fazla satır içermeli."""
        from app.services.telegram_multi_bot import _make_inline_menu
        admin_menu = _make_inline_menu(uid=0, is_admin=True)
        nonadmin_menu = _make_inline_menu(uid=0, is_admin=False)
        admin_rows = len(admin_menu.inline_keyboard)
        nonadmin_rows = len(nonadmin_menu.inline_keyboard)
        assert admin_rows > nonadmin_rows

    def test_menu_callbacks_have_menu_prefix(self):
        """Tüm callback_data değerleri 'menu:' ile başlamalı."""
        from app.services.telegram_multi_bot import _make_inline_menu
        menu = _make_inline_menu(uid=0, is_admin=True)
        for row in menu.inline_keyboard:
            for btn in row:
                assert btn.callback_data.startswith("menu:"), \
                    f"Button '{btn.text}' callback '{btn.callback_data}' should start with 'menu:'"
