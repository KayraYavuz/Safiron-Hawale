"""
Tests for transaction notification helpers.
app.api.transactions._notify() ve Telegram entegrasyonu.
"""
from unittest.mock import patch, MagicMock
import pytest


class TestNotifyWrapper:
    """_notify() fire-and-forget wrapper testleri."""

    def test_calls_tg_notify(self):
        """Normal durumda _tg_notify çağrılmalı."""
        with patch("app.api.transactions._tg_notify") as mock_tg:
            from app.api.transactions import _notify
            _notify("company-123", "Test mesajı")
            mock_tg.assert_called_once_with("company-123", "Test mesajı")

    def test_converts_company_id_to_str(self):
        """UUID gibi non-str company_id str'ye çevrilmeli."""
        import uuid
        cid = uuid.uuid4()
        with patch("app.api.transactions._tg_notify") as mock_tg:
            from app.api.transactions import _notify
            _notify(cid, "Test")
            mock_tg.assert_called_once_with(str(cid), "Test")

    def test_swallows_exception(self):
        """_tg_notify hata fırlattığında _notify sessizce devam eder."""
        with patch("app.api.transactions._tg_notify", side_effect=RuntimeError("bot down")):
            from app.api.transactions import _notify
            # Exception fırlatmamalı
            _notify("company-123", "Test")

    def test_none_company_id_str_conversion(self):
        """None company_id güvenle 'None' str'ye dönüştürülür — çökmemeli."""
        with patch("app.api.transactions._tg_notify") as mock_tg:
            from app.api.transactions import _notify
            _notify(None, "Test")
            mock_tg.assert_called_once_with("None", "Test")


class TestMarkdownEscaping:
    """transactions._md_escape() — legacy-Markdown kaçış testleri."""

    def test_underscore_escaped(self):
        from app.api.transactions import _md_escape
        assert _md_escape("Ahmed_Hassan") == "Ahmed\\_Hassan"

    def test_asterisk_escaped(self):
        from app.api.transactions import _md_escape
        assert "\\*" in _md_escape("Ahmed*Bold")

    def test_backtick_escaped(self):
        from app.api.transactions import _md_escape
        assert "\\`" in _md_escape("Ahmed`Code")

    def test_link_brackets_escaped(self):
        """[ ] ( ) kaçırılmalı — Markdown link injection engellenir."""
        from app.api.transactions import _md_escape
        out = _md_escape("[click](http://evil.com)")
        assert all(seq in out for seq in ("\\[", "\\]", "\\(", "\\)"))

    def test_clean_name_unchanged(self):
        from app.api.transactions import _md_escape
        assert _md_escape("Ahmed Al-Rashidi") == "Ahmed Al-Rashidi"

    def test_all_special_chars(self):
        from app.api.transactions import _md_escape
        assert _md_escape("test_name*bold`code") == "test\\_name\\*bold\\`code"


class TestNotifyCompanyFunction:
    """notify_company() — çalışmayan bot sessizce atlanır."""

    def test_no_app_returns_silently(self):
        """Bot çalışmıyorsa (app yok) çökmemeli ve coroutine dispatch edilmemeli."""
        with patch("app.services.telegram_multi_bot._running_apps", {}), \
             patch("app.services.telegram_multi_bot.asyncio.run_coroutine_threadsafe") as mock_dispatch:
            from app.services.telegram_multi_bot import notify_company
            notify_company("nonexistent-company", "Test mesajı")
            mock_dispatch.assert_not_called()

    def test_dead_loop_returns_silently(self):
        """Event loop çalışmıyorsa çökmemeli ve coroutine dispatch edilmemeli."""
        mock_app = MagicMock()
        mock_loop = MagicMock()
        mock_loop.is_running.return_value = False

        with patch("app.services.telegram_multi_bot._running_apps", {"company-123": mock_app}), \
             patch("app.services.telegram_multi_bot._main_loop", mock_loop), \
             patch("app.services.telegram_multi_bot.asyncio.run_coroutine_threadsafe") as mock_dispatch:
            from app.services.telegram_multi_bot import notify_company
            notify_company("company-123", "Test")
            mock_dispatch.assert_not_called()
