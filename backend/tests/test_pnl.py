"""
Tests for app.services.pnl.calculate_pnl()

İş Kuralı Özeti:
  Case A — dest=USD  : müşteri SAR veriyor, USD alıyor
                        profit(SAR) = customerPays - supplierCost
                        kâr için: customerRate > supplierRate
  Case B — source=USD: müşteri USD veriyor, SAR alıyor
                        profit(SAR) = supplierSettlement - customerGets
                        kâr için: supplierRate > customerRate
  Case C — cross      : ikisi de USD değil (EGP→SAR gibi)
"""
from decimal import Decimal
import pytest
from app.services.pnl import calculate_pnl

D = Decimal  # kısaltma


# ─── CASE A: dest=USD (müşteri USD alıyor) ───────────────────────────────────

class TestCaseA:
    """SAR → USD: müşteri SAR veriyor, USD alıyor."""

    def _calc(self, customer_rate, supplier_rate, usd_amount=D("1000"), commission=D("0")):
        return calculate_pnl(
            source_currency="SAR",
            dest_currency="USD",
            usd_amount=D(str(usd_amount)),
            customer_rate=D(str(customer_rate)),
            supplier_rate=D(str(supplier_rate)),
            commission_usd=D(str(commission)),
        )

    def test_basic_profit(self):
        """customerRate > supplierRate → kâr olmalı."""
        r = self._calc(customer_rate="3.80", supplier_rate="3.75", usd_amount="1000")
        assert r["profit"] > 0
        assert r["profit_currency"] == "SAR"
        assert r["is_profit"] is True

    def test_profit_amount_correct(self):
        """1000 USD × 3.80 = 3800 SAR alındı; 1000 × 3.75 = 3750 SAR ödendi; kâr = 50 SAR."""
        r = self._calc(customer_rate="3.80", supplier_rate="3.75", usd_amount="1000")
        assert r["profit"] == D("50.0000")
        assert r["customer_pays"] == D("3800.0000")
        assert r["customer_receives"] == D("1000.0000")  # USD

    def test_loss_when_rate_inverted(self):
        """customerRate < supplierRate → zarar."""
        r = self._calc(customer_rate="3.70", supplier_rate="3.75")
        assert r["profit"] < 0
        assert r["is_profit"] is False

    def test_zero_profit_equal_rates(self):
        """Aynı kur → sıfır kâr."""
        r = self._calc(customer_rate="3.75", supplier_rate="3.75")
        assert r["profit"] == D("0.0000")
        assert r["is_profit"] is True  # >= 0 → True

    def test_commission_adds_to_net_pnl(self):
        """commission_usd net_pnl_usd'ye eklenmeli."""
        r = self._calc(customer_rate="3.80", supplier_rate="3.75", commission=D("5"))
        profit_usd = r["profit_usd"]
        assert r["net_pnl_usd"] == (profit_usd + D("5")).quantize(D("0.0001"))

    def test_source_dest_fields(self):
        r = self._calc(customer_rate="3.80", supplier_rate="3.75")
        assert r["source_currency"] == "SAR"
        assert r["dest_currency"] == "USD"
        assert r["customer_pays_currency"] == "SAR"
        assert r["customer_receives_currency"] == "USD"

    def test_supplier_settlement_currency_is_source(self):
        """Case A'da tedarikçi SAR cinsinden ödeme alır."""
        r = self._calc(customer_rate="3.80", supplier_rate="3.75")
        assert r["supplier_settlement_currency"] == "SAR"

    def test_direction_string(self):
        r = self._calc(customer_rate="3.80", supplier_rate="3.75")
        assert r["direction"] == "SAR → USD"


# ─── CASE B: source=USD (müşteri USD veriyor) ─────────────────────────────────

class TestCaseB:
    """USD → SAR: müşteri USD veriyor, SAR alıyor."""

    def _calc(self, customer_rate, supplier_rate, usd_amount=D("1000"), commission=D("0")):
        return calculate_pnl(
            source_currency="USD",
            dest_currency="SAR",
            usd_amount=D(str(usd_amount)),
            customer_rate=D(str(customer_rate)),
            supplier_rate=D(str(supplier_rate)),
            commission_usd=D(str(commission)),
        )

    def test_basic_profit(self):
        """supplierRate > customerRate → kâr olmalı."""
        r = self._calc(customer_rate="3.75", supplier_rate="3.80")
        assert r["profit"] > 0
        assert r["profit_currency"] == "SAR"
        assert r["is_profit"] is True

    def test_profit_amount_correct(self):
        """1000 USD × 3.80 = 3800 SAR tedarikçiden; 1000 × 3.75 = 3750 SAR müşteriye; kâr = 50 SAR."""
        r = self._calc(customer_rate="3.75", supplier_rate="3.80")
        assert r["profit"] == D("50.0000")
        assert r["customer_pays"] == D("1000.0000")  # USD
        assert r["customer_receives"] == D("3750.0000")  # SAR

    def test_loss_when_rate_inverted(self):
        """customerRate > supplierRate → zarar."""
        r = self._calc(customer_rate="3.80", supplier_rate="3.75")
        assert r["profit"] < 0
        assert r["is_profit"] is False

    def test_supplier_settlement_currency_is_dest(self):
        """Case B'de tedarikçi SAR (dest) cinsinden ödeme yapar."""
        r = self._calc(customer_rate="3.75", supplier_rate="3.80")
        assert r["supplier_settlement_currency"] == "SAR"

    def test_commission_adds_to_net_pnl(self):
        r = self._calc(customer_rate="3.75", supplier_rate="3.80", commission=D("10"))
        assert r["net_pnl_usd"] == (r["profit_usd"] + D("10")).quantize(D("0.0001"))

    def test_aed_case(self):
        """AED ile de aynı mantık çalışmalı."""
        r = calculate_pnl(
            source_currency="USD",
            dest_currency="AED",
            usd_amount=D("500"),
            customer_rate=D("3.67"),
            supplier_rate=D("3.68"),
        )
        assert r["profit"] > 0
        assert r["profit_currency"] == "AED"


# ─── CASE C: Cross-currency (ikisi de USD değil) ──────────────────────────────

class TestCaseC:
    """EGP → SAR: USD pivot üzerinden."""

    def _calc(self, customer_rate="3.75", supplier_rate="52.00", usd_amount="1000"):
        return calculate_pnl(
            source_currency="EGP",
            dest_currency="SAR",
            usd_amount=D(str(usd_amount)),
            customer_rate=D(str(customer_rate)),
            supplier_rate=D(str(supplier_rate)),
        )

    def test_returns_result_dict(self):
        r = self._calc()
        required_keys = {
            "direction", "source_currency", "dest_currency",
            "profit", "profit_currency", "net_pnl_usd", "is_profit",
        }
        assert required_keys.issubset(r.keys())

    def test_profit_currency_is_dest(self):
        r = self._calc()
        assert r["profit_currency"] == "SAR"

    def test_direction_string(self):
        r = self._calc()
        assert r["direction"] == "EGP → SAR"

    def test_profit_is_not_cross_currency_garbage(self):
        """Tek kur çiftiyle cross-currency spread kârı türetilemez → profit 0.

        Regresyon: eski kod iki farklı para birimini (EGP − SAR) çıkarıp
        100$'lık işlemde ~1200$ sahte kâr üretiyordu. Kâr 0 olmalı."""
        r = self._calc(customer_rate="3.75", supplier_rate="52.00", usd_amount="100")
        assert r["profit"] == D("0")
        assert r["profit_usd"] == D("0")
        assert r["net_pnl_usd"] == D("0")

    def test_commission_only_in_net_pnl(self):
        """Cross-currency'de net P&L yalnızca komisyondan oluşur."""
        r = calculate_pnl(
            source_currency="EGP", dest_currency="SAR",
            usd_amount=D("1000"), customer_rate=D("3.75"),
            supplier_rate=D("52.00"), commission_usd=D("8"),
        )
        assert r["net_pnl_usd"] == D("8.0000")

    def test_supplier_settlement_currency_is_source(self):
        """Cross-currency'de tedarikçi maliyeti kaynak (EGP) cinsindendir."""
        r = self._calc()
        assert r["supplier_settlement_currency"] == "EGP"


# ─── Same-currency ────────────────────────────────────────────────────────────

class TestSameCurrency:
    """Aynı para birimi — profit=0, sadece komisyon."""

    def test_usd_to_usd(self):
        r = calculate_pnl(
            source_currency="USD",
            dest_currency="USD",
            usd_amount=D("1000"),
            customer_rate=D("1"),
            supplier_rate=D("1"),
        )
        assert r["profit"] == D("0")
        assert r["net_pnl_usd"] == D("0")

    def test_sar_to_sar_with_commission(self):
        r = calculate_pnl(
            source_currency="SAR",
            dest_currency="SAR",
            usd_amount=D("1000"),
            customer_rate=D("3.75"),
            supplier_rate=D("3.75"),
            commission_usd=D("15"),
        )
        assert r["profit"] == D("0")
        assert r["net_pnl_usd"] == D("15")

    def test_passthrough_amounts(self):
        r = calculate_pnl(
            source_currency="SAR",
            dest_currency="SAR",
            usd_amount=D("500"),
            customer_rate=D("3.75"),
            supplier_rate=D("3.75"),
        )
        assert r["customer_pays"] == D("500")
        assert r["customer_receives"] == D("500")


# ─── Edge cases ───────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_zero_usd_amount(self):
        """Sıfır miktar → sıfır kâr."""
        r = calculate_pnl(
            source_currency="SAR",
            dest_currency="USD",
            usd_amount=D("0"),
            customer_rate=D("3.80"),
            supplier_rate=D("3.75"),
        )
        assert r["profit"] == D("0.0000")
        assert r["net_pnl_usd"] == D("0.0000")

    def test_large_transaction(self):
        """Büyük işlemde precision kaybı olmamalı."""
        r = calculate_pnl(
            source_currency="USD",
            dest_currency="TRY",
            usd_amount=D("100000"),
            customer_rate=D("38.20"),
            supplier_rate=D("38.50"),
        )
        assert r["profit"] > 0
        assert r["profit_currency"] == "TRY"

    def test_return_type_all_decimal(self):
        """Tüm sayısal alanlar Decimal olmalı."""
        r = calculate_pnl(
            source_currency="SAR",
            dest_currency="USD",
            usd_amount=D("1000"),
            customer_rate=D("3.80"),
            supplier_rate=D("3.75"),
        )
        for key in ("profit", "profit_usd", "net_pnl_usd", "customer_pays",
                    "customer_receives", "supplier_settlement"):
            assert isinstance(r[key], Decimal), f"{key} should be Decimal"

    def test_backward_compat_keys(self):
        """gross_profit_quote ve quote_cur geriye dönük uyumluluk için mevcut olmalı."""
        r = calculate_pnl(
            source_currency="SAR",
            dest_currency="USD",
            usd_amount=D("1000"),
            customer_rate=D("3.80"),
            supplier_rate=D("3.75"),
        )
        assert "gross_profit_quote" in r
        assert "gross_profit_usd" in r
        assert "quote_cur" in r
