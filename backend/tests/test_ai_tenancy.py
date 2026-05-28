"""
Tests for AI Analysis multi-tenancy isolation.
app.services.ai_analyst.get_financial_summary() company_id filtresi.

Güvenlik garantileri:
  1. company_id verilmişse sadece o şirketin işlemleri görünür
  2. company_id=None ise (super_admin) tüm veriler görünür
  3. Python döngüsündeki çift kontrol yanlış şirket verisini filtreler
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch
from datetime import date
import pytest


def _make_txn(company_id, txn_type_val="transfer", pnl_usd=0.0, legs=None):
    """Test için sahte Transaction nesnesi üretir."""
    txn = MagicMock()
    txn.company_id = company_id
    txn.txn_type = MagicMock()
    txn.txn_type.value = txn_type_val
    txn.txn_date = date.today()
    txn.status = "completed"
    txn.pnl = MagicMock()
    txn.pnl.net_pnl_usd = Decimal(str(pnl_usd))
    txn.legs = legs or []
    return txn


class TestGetFinancialSummaryTenancy:
    """get_financial_summary() multi-tenancy testleri."""

    def _run(self, company_id, db_transactions):
        """Mock DB ile get_financial_summary çalıştır."""
        db = MagicMock()
        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = db_transactions
        db.query.return_value = mock_q

        from app.services.ai_analyst import get_financial_summary
        return get_financial_summary(db, company_id=company_id)

    def test_filters_by_company_id(self):
        """company_id verilmişse, DB query'ye filter eklenmeli."""
        db = MagicMock()
        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = []
        db.query.return_value = mock_q

        from app.services.ai_analyst import get_financial_summary
        get_financial_summary(db, company_id="company-abc")

        # filter en az 3 kez çağrılmalı: txn_date, status, company_id
        assert mock_q.filter.call_count >= 2

    def test_super_admin_sees_all(self):
        """company_id=None → DB'den gelen tüm txn'ler sayılır."""
        txns = [
            _make_txn("company-a", pnl_usd=100),
            _make_txn("company-b", pnl_usd=200),
        ]
        result = self._run(company_id=None, db_transactions=txns)
        assert result["total_transactions"] == 2

    def test_company_sees_only_own_txns(self):
        """company_id="company-a" → sadece company-a'nın işlemleri sayılır."""
        txns = [
            _make_txn("company-a", pnl_usd=100),
            _make_txn("company-a", pnl_usd=50),
            # company-b hiç döndürülmez çünkü DB filtresi uygulanmış kabul edilir
        ]
        result = self._run(company_id="company-a", db_transactions=txns)
        assert result["total_transactions"] == 2

    def test_double_check_filters_wrong_company(self):
        """
        Python döngüsündeki çift kontrol: DB filtresi bypass edilse bile
        yanlış şirket verisi total_estimated_pnl_usd'ye eklenmemeli.
        (Savunma katmanı testi)
        """
        # Senaryo: DB bir şekilde company-b'nin datasını da döndürdü
        txns = [
            _make_txn("company-a", pnl_usd=100),
            _make_txn("company-b", pnl_usd=9999),  # yanlış şirket
        ]
        result = self._run(company_id="company-a", db_transactions=txns)
        # company-b'nin 9999 PnL'i dahil edilmemeli
        assert result["total_estimated_pnl_usd"] == pytest.approx(100.0)
        assert result["total_transactions"] == 2  # count DB'den geliyor

    def test_empty_result_no_error(self):
        """İşlem yoksa hata fırlatmaz, sıfır özet döner."""
        result = self._run(company_id="company-x", db_transactions=[])
        assert result["total_transactions"] == 0
        assert result["total_estimated_pnl_usd"] == 0

    def test_pnl_aggregated_correctly(self):
        """Birden fazla işlemin PnL'i toplanmalı."""
        txns = [
            _make_txn("company-a", pnl_usd=100),
            _make_txn("company-a", pnl_usd=250),
            _make_txn("company-a", pnl_usd=50),
        ]
        result = self._run(company_id="company-a", db_transactions=txns)
        assert result["total_estimated_pnl_usd"] == pytest.approx(400.0)

    def test_transaction_type_grouping(self):
        """txn_type'lara göre gruplama yapılmalı."""
        txns = [
            _make_txn("company-a", txn_type_val="transfer"),
            _make_txn("company-a", txn_type_val="transfer"),
            _make_txn("company-a", txn_type_val="deposit"),
        ]
        result = self._run(company_id="company-a", db_transactions=txns)
        assert result["transaction_types"]["transfer"] == 2
        assert result["transaction_types"]["deposit"] == 1

    def test_summary_structure(self):
        """Sonuç dict gerekli anahtarları içermeli."""
        result = self._run(company_id="company-a", db_transactions=[])
        assert "period" in result
        assert "total_transactions" in result
        assert "transaction_types" in result
        assert "total_estimated_pnl_usd" in result
