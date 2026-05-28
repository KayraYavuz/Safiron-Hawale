"""
Tests for app.services.balance — balance_to_usd(), get_usd_rate()
DB bağımlı fonksiyonlar mock kullanır.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest

from app.services.balance import balance_to_usd, get_usd_rate, invalidate_rates_cache


class TestBalanceToUsd:
    """balance_to_usd(balance, currency_code, db) testleri."""

    def test_usd_passthrough(self):
        """USD bakiyesi dönüştürme olmadan döner."""
        db = MagicMock()
        result = balance_to_usd(Decimal("1000"), "USD", db)
        assert result == Decimal("1000")

    def test_converts_sar_to_usd(self):
        """3750 SAR / 3.75 rate = 1000 USD."""
        db = MagicMock()
        with patch("app.services.balance.get_usd_rate", return_value=Decimal("3.75")):
            result = balance_to_usd(Decimal("3750"), "SAR", db)
        assert result == Decimal("1000.00")

    def test_zero_rate_returns_zero(self):
        """Kur sıfır ise sıfır döner (sıfıra bölme hatası yok)."""
        db = MagicMock()
        with patch("app.services.balance.get_usd_rate", return_value=Decimal("0")):
            result = balance_to_usd(Decimal("1000"), "EGP", db)
        assert result == Decimal("0")

    def test_zero_balance(self):
        """Sıfır bakiye → sıfır sonuç."""
        db = MagicMock()
        with patch("app.services.balance.get_usd_rate", return_value=Decimal("3.75")):
            result = balance_to_usd(Decimal("0"), "SAR", db)
        assert result == Decimal("0.00")

    def test_precision_two_decimals(self):
        """Sonuç 2 ondalık basamakla yuvarlanmalı."""
        db = MagicMock()
        with patch("app.services.balance.get_usd_rate", return_value=Decimal("3.671")):
            result = balance_to_usd(Decimal("1000"), "AED", db)
        # 1000 / 3.671 = 272.40... → 2 decimal
        assert result == result.quantize(Decimal("0.01"))


class TestGetUsdRate:
    """get_usd_rate(db, currency_code) testleri."""

    def test_usd_returns_one(self):
        """USD/USD kuru daima 1."""
        db = MagicMock()
        rate = get_usd_rate(db, "USD")
        assert rate == Decimal("1")
        db.query.assert_not_called()  # DB sorgusu yapılmamalı

    def test_returns_rate_from_db(self):
        """DB'deki kur değeri döndürülmeli."""
        db = MagicMock()
        mock_rate = MagicMock()
        mock_rate.rate_per_usd = Decimal("3.75")
        db.query.return_value.filter.return_value.order_by.return_value.first.return_value = mock_rate

        rate = get_usd_rate(db, "SAR")
        assert rate == Decimal("3.75")

    def test_returns_one_when_no_rate_in_db(self):
        """DB'de kur yoksa 1 döner (fallback)."""
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
        rate = get_usd_rate(db, "XYZ")
        assert rate == Decimal("1")


class TestInvalidateRatesCache:
    """Cache temizleme testi."""

    def test_invalidate_clears_cache(self):
        """Cache temizlendikten sonra sıfır timestamp döner."""
        from app.services import balance as bal_module
        # Önce bir değer set et
        bal_module._rates_cache = (9999999.0, {"SAR": Decimal("3.75")})
        invalidate_rates_cache()
        cached_at, cached_rates = bal_module._rates_cache
        assert cached_at == 0.0
        assert cached_rates == {}
