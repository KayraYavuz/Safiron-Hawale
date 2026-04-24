"""
Hawala & FX İşlem Yön ve Kâr Hesaplama Servisi
================================================

TEMEL İŞ KURALI:
  A → B havalesi/dövizi:
    - Müşteri A tarafında para verir  (sourceCurrency)
    - Müşteri B tarafında para alır   (destCurrency)
    - Müşteri her zaman destination-side currency satın alıyor

KUR FORMATI — daima:
  1 USD = X {currency}
  Örn: SAR = 3.75, EGP = 52.50, TRY = 38.20

  Asla ters (inverse) format kullanılmaz (0.266 gibi).

KÂR HESABI:

  Case A — Müşteri USD alıyor (source=SAR, dest=USD):
    SAR veriyor, USD alıyor
    customerPaysSAR    = usdAmount × customerRate
    supplierCostSAR    = usdAmount × supplierRate
    profit             = customerPaysSAR - supplierCostSAR  [SAR]
    kâr için:          customerRate > supplierRate

  Case B — Müşteri SAR alıyor (source=USD, dest=SAR):
    USD veriyor, SAR alıyor
    customerGetsSAR    = usdAmount × customerRate
    supplierSettlement = usdAmount × supplierRate
    profit             = supplierSettlement - customerGetsSAR  [SAR]
    kâr için:          supplierRate > customerRate

  Genel kural:
    profit_currency = dest_currency (müşterinin aldığı para)
    Eğer dest=USD: profit zaten USD
    Eğer source=USD: profit source=USD değil dest currency
    İkisi de USD değil: profit = dest currency, USD karşılığı yaklaşık
"""

from decimal import Decimal


def calculate_pnl(
    source_currency: str,   # Müşterinin VERDİĞİ para birimi (A lokasyonu)
    dest_currency: str,     # Müşterinin ALDIĞI para birimi (B lokasyonu)
    usd_amount: Decimal,    # İşlemin USD bazında miktarı (referans)
    customer_rate: Decimal, # Müşteriye uygulanan kur: 1 USD = X currency
    supplier_rate: Decimal, # Tedarikçi/piyasa kuru:   1 USD = X currency
    commission_usd: Decimal = Decimal("0"),
) -> dict:
    """
    Havale/FX işlemi için yön, kur ve kâr hesapla.

    KURAL: Müşteri her zaman destination-side currency alıyor.

    Case A — dest_currency == USD (müşteri USD alıyor):
      Örn: Riyadh(SAR) → Istanbul(USD)
      profit_currency = source_currency (SAR)
      customerPays    = usdAmount × customerRate  [SAR]
      supplierCost    = usdAmount × supplierRate   [SAR]
      profit          = customerPays - supplierCost
      kâr için: customerRate > supplierRate

    Case B — source_currency == USD (müşteri USD veriyor):
      Örn: Istanbul(USD) → Riyadh(SAR)
      profit_currency = dest_currency (SAR)
      customerGets    = usdAmount × customerRate  [SAR]
      supplierSettl.  = usdAmount × supplierRate  [SAR]
      profit          = supplierSettl - customerGets
      kâr için: supplierRate > customerRate

    Case C — ikisi de USD değil:
      Cross-currency: EGP → SAR gibi
      USD pivot üzerinden hesap.

    Returns:
        direction:              "A→B" açıklaması
        source_currency:        müşteri veriyor
        dest_currency:          müşteri alıyor
        usd_amount:             USD referans miktar
        customer_rate:          1 USD = X (operatörün müşteriye uyguladığı)
        supplier_rate:          1 USD = X (operatörün piyasadan aldığı)
        customer_pays:          müşteri ne kadar veriyor
        customer_pays_currency: hangi para birimi
        customer_receives:      müşteri ne kadar alıyor
        customer_receives_currency: hangi para birimi
        supplier_settlement:    tedarikçiye/piyasaya ne ödendi
        supplier_settlement_currency:
        profit:                 kâr miktarı
        profit_currency:        kâr para birimi
        profit_usd:             kâr USD karşılığı (yaklaşık)
        net_pnl_usd:            komisyon dahil net kâr
        is_profit:              bool
    """

    # Aynı para birimi — sadece komisyon
    if source_currency == dest_currency:
        return {
            "direction":                   f"{source_currency} → {dest_currency}",
            "source_currency":             source_currency,
            "dest_currency":               dest_currency,
            "usd_amount":                  usd_amount,
            "customer_rate":               customer_rate,
            "supplier_rate":               supplier_rate,
            "customer_pays":               usd_amount,
            "customer_pays_currency":      source_currency,
            "customer_receives":           usd_amount,
            "customer_receives_currency":  dest_currency,
            "supplier_settlement":         usd_amount,
            "supplier_settlement_currency": source_currency,
            "profit":                      Decimal("0"),
            "profit_currency":             source_currency,
            "profit_usd":                  commission_usd,
            "net_pnl_usd":                 commission_usd,
            "is_profit":                   commission_usd >= 0,
            "gross_profit_quote":          Decimal("0"),
            "gross_profit_usd":            commission_usd,
            "quote_cur":                   source_currency,
        }

    if dest_currency == "USD":
        # ── CASE A: Müşteri USD alıyor ──────────────────────────────────────
        # Örn: Riyadh(SAR) → Istanbul(USD)
        # Müşteri SAR veriyor, USD alıyor
        # Kur: 1 USD = X SAR
        # customerPays(SAR)  = usdAmount × customerRate
        # supplierCost(SAR)  = usdAmount × supplierRate
        # profit(SAR)        = customerPays - supplierCost
        # kâr için: customerRate > supplierRate

        profit_currency         = source_currency
        customer_pays           = usd_amount * customer_rate
        customer_receives       = usd_amount  # USD
        supplier_settlement     = usd_amount * supplier_rate
        profit                  = customer_pays - supplier_settlement

        # USD karşılığı: profit SAR cinsinden, supplier_rate ile böl
        ref_rate = supplier_rate if supplier_rate > 0 else customer_rate
        profit_usd = (profit / ref_rate) if ref_rate else Decimal("0")

    elif source_currency == "USD":
        # ── CASE B: Müşteri USD veriyor ─────────────────────────────────────
        # Örn: Istanbul(USD) → Riyadh(SAR)
        # Müşteri USD veriyor, SAR alıyor
        # Kur: 1 USD = X SAR
        # customerGets(SAR)  = usdAmount × customerRate
        # supplierSettl(SAR) = usdAmount × supplierRate
        # profit(SAR)        = supplierSettlement - customerGets
        # kâr için: supplierRate > customerRate

        profit_currency         = dest_currency
        customer_pays           = usd_amount  # USD
        customer_receives       = usd_amount * customer_rate
        supplier_settlement     = usd_amount * supplier_rate
        profit                  = supplier_settlement - customer_receives

        ref_rate = supplier_rate if supplier_rate > 0 else customer_rate
        profit_usd = (profit / ref_rate) if ref_rate else Decimal("0")

    else:
        # ── CASE C: Cross-currency (EGP→SAR gibi) ───────────────────────────
        # USD pivot üzerinden hesap
        # customer_rate ve supplier_rate ikisi de "1 USD = X {currency}"
        # source side: customer_rate_source = ? (ayrı girilmeli)
        # Bu senaryoda: customer_rate = dest currency rate, supplier_rate = source currency rate
        # Pratik: cross işlemi genellikle iki bacak olarak modellenir
        # Basit yaklaşım: USD pivot
        # customerPays(source)   = usdAmount × supplierRate  (source kuru)
        # customerReceives(dest) = usdAmount × customerRate  (dest kuru)
        # profit(USD)            = fark USD cinsinden
        # Bu karmaşık senaryo için şimdilik Case B mantığını uygula
        profit_currency         = dest_currency
        customer_pays           = usd_amount * supplier_rate   # source currency ödüyor
        customer_receives       = usd_amount * customer_rate   # dest currency alıyor
        supplier_settlement     = usd_amount * supplier_rate
        profit                  = (usd_amount * supplier_rate) - (usd_amount * customer_rate)

        ref_rate = customer_rate if customer_rate > 0 else Decimal("1")
        profit_usd = (profit / ref_rate) if ref_rate else Decimal("0")

    net_pnl_usd = profit_usd + commission_usd

    return {
        "direction":                    f"{source_currency} → {dest_currency}",
        "source_currency":              source_currency,
        "dest_currency":                dest_currency,
        "usd_amount":                   usd_amount,
        "customer_rate":                customer_rate,
        "supplier_rate":                supplier_rate,
        "customer_pays":                customer_pays.quantize(Decimal("0.0001")),
        "customer_pays_currency":       source_currency,
        "customer_receives":            customer_receives.quantize(Decimal("0.0001")),
        "customer_receives_currency":   dest_currency,
        "supplier_settlement":          supplier_settlement.quantize(Decimal("0.0001")),
        "supplier_settlement_currency": source_currency if dest_currency == "USD" else dest_currency,
        "profit":                       profit.quantize(Decimal("0.0001")),
        "profit_currency":              profit_currency,
        "profit_usd":                   profit_usd.quantize(Decimal("0.0001")),
        "net_pnl_usd":                  net_pnl_usd.quantize(Decimal("0.0001")),
        "is_profit":                    profit >= 0,
        # Geriye dönük uyumluluk için
        "gross_profit_quote":           profit.quantize(Decimal("0.0001")),
        "gross_profit_usd":             profit_usd.quantize(Decimal("0.0001")),
        "quote_cur":                    profit_currency,
        "from_is_base":                 source_currency == "USD",
    }
