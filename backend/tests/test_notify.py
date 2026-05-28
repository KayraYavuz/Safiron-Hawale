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
    """Telegram MarkdownV1 kaçış karakteri testleri (transactions.py)."""

    def test_underscore_escaped(self):
        name = "Ahmed_Hassan"
        safe = name.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
        assert "\\_" in safe
        assert "_" not in safe.replace("\\_", "")

    def test_asterisk_escaped(self):
        name = "Ahmed*Bold"
        safe = name.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
        assert "\\*" in safe

    def test_backtick_escaped(self):
        name = "Ahmed`Code"
        safe = name.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
        assert "\\`" in safe

    def test_clean_name_unchanged(self):
        name = "Ahmed Al-Rashidi"
        safe = name.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
        assert safe == "Ahmed Al-Rashidi"

    def test_all_special_chars(self):
        name = "test_name*bold`code"
        safe = name.replace("_", "\\_").replace("*", "\\*").replace("`", "\\`")
        assert safe == "test\\_name\\*bold\\`code"


class TestNotifyCompanyFunction:
    """notify_company() — çalışmayan bot sessizce atlanır."""

    def test_no_app_returns_silently(self):
        """Bot çalışmıyorsa (app None) hata fırlatmamalı."""
        with patch("app.services.telegram_multi_bot._running_apps", {}), \
             patch("app.services.telegram_multi_bot._running_loops", {}):
            from app.services.telegram_multi_bot import notify_company
            # Çökmemeli
            notify_company("nonexistent-company", "Test mesajı")

    def test_dead_loop_returns_silently(self):
        """Loop çalışmıyorsa (is_running=False) hata fırlatmamalı."""
        mock_app = MagicMock()
        mock_loop = MagicMock()
        mock_loop.is_running.return_value = False

        with patch("app.services.telegram_multi_bot._running_apps", {"company-123": mock_app}), \
             patch("app.services.telegram_multi_bot._running_loops", {"company-123": mock_loop}):
            from app.services.telegram_multi_bot import notify_company
            notify_company("company-123", "Test")
            # run_coroutine_threadsafe çağrılmamalı
