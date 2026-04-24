// ── Biçimlendirme yardımcıları ────────────────────────────────────────────────

export function fmt(value, decimals = 2) {
  const n = parseFloat(value ?? 0)
  if (!isFinite(n)) return '0.00'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtUSD(value) {
  return `$${fmt(value)}`
}

// "1,234,567.89" → "1234567.89"
export function stripCommas(str) {
  return String(str ?? '').replace(/,/g, '')
}

// "1234567.89" → "1,234,567.89"
export function addCommas(str) {
  const s = String(str ?? '').replace(/[^0-9.]/g, '')
  const parts = s.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.length > 1 ? parts.join('.') : parts[0]
}

/**
 * calcPnl — İşlem kâr/zarar hesabı
 *
 * İş kuralları:
 *   A → B: Müşteri A'da para verir (sourceCur), B'de alır (destCur).
 *   Müşteri her zaman destination-side currency satın alıyor.
 *
 * Kur formatı: 1 USD = X {currency}  (daima — ters format yok)
 *
 * Case A (destCur = USD):
 *   customerPays   = usdAmount × customerRate  [sourceCur]
 *   supplierCost   = usdAmount × supplierRate  [sourceCur]
 *   profit         = customerPays - supplierCost
 *   kâr için: customerRate > supplierRate
 *
 * Case B (sourceCur = USD):
 *   customerReceives = usdAmount × customerRate  [destCur]
 *   supplierSettl    = usdAmount × supplierRate  [destCur]
 *   profit           = supplierSettl - customerReceives
 *   kâr için: supplierRate > customerRate
 *
 * Case C (cross, ikisi de non-USD):
 *   USD pivot üzerinden yaklaşık hesap.
 *
 * @returns {object|null} — null sadece sourceCur/destCur yoksa veya usd <= 0 ise
 */
export function calcPnl({
  sourceCur,
  destCur,
  usdAmount,
  customerRate,
  supplierRate,
  commissionUsd = 0,
}) {
  // Girdi normalleştirme — NaN/Infinity gelmez
  const usd  = parseFloat(usdAmount  || 0)
  const cr   = parseFloat(customerRate || 0)
  const sr   = parseFloat(supplierRate || 0)
  const comm = parseFloat(commissionUsd || 0)

  if (!sourceCur || !destCur || !isFinite(usd) || usd <= 0) return null
  if (!isFinite(cr) || !isFinite(sr) || !isFinite(comm)) return null

  const hasRates = cr > 0 && sr > 0

  // ── Aynı para birimi ─────────────────────────────────────────────────────
  if (sourceCur === destCur) {
    return {
      direction: `${sourceCur} → ${destCur}`,
      sourceCur, destCur, usdAmount: usd,
      customerRate: cr, supplierRate: sr,
      customerPays: usd,       customerPaysCur: sourceCur,
      customerReceives: usd,   customerReceivesCur: destCur,
      supplierSettlement: usd, supplierSettlementCur: sourceCur,
      profit: 0, profitCur: sourceCur,
      profitUsd: comm, netPnlUsd: comm,
      isProfit: comm >= 0,
      hasRates: true,
    }
  }

  // ── Case A: Müşteri USD alıyor ────────────────────────────────────────────
  if (destCur === 'USD') {
    const customerPays     = usd * cr   // sourceCur
    const supplierCost     = usd * sr   // sourceCur
    const customerReceives = usd        // USD
    const profit           = customerPays - supplierCost
    // refRate için sıfır bölme koruması
    const refRate    = sr > 0 ? sr : cr > 0 ? cr : 1
    const profitUsd  = profit / refRate
    const netPnlUsd  = profitUsd + comm

    return {
      direction: `${sourceCur} → ${destCur}`,
      sourceCur, destCur, usdAmount: usd,
      customerRate: cr, supplierRate: sr,
      customerPays,       customerPaysCur: sourceCur,
      customerReceives,   customerReceivesCur: destCur,
      supplierSettlement: supplierCost, supplierSettlementCur: sourceCur,
      profit, profitCur: sourceCur,
      profitUsd, netPnlUsd,
      isProfit: profit >= 0,
      hasRates,
    }
  }

  // ── Case B: Müşteri USD veriyor ───────────────────────────────────────────
  if (sourceCur === 'USD') {
    const customerPays     = usd        // USD
    const customerReceives = usd * cr   // destCur
    const supplierSettl    = usd * sr   // destCur
    const profit           = supplierSettl - customerReceives
    const refRate    = sr > 0 ? sr : cr > 0 ? cr : 1
    const profitUsd  = profit / refRate
    const netPnlUsd  = profitUsd + comm

    return {
      direction: `${sourceCur} → ${destCur}`,
      sourceCur, destCur, usdAmount: usd,
      customerRate: cr, supplierRate: sr,
      customerPays,       customerPaysCur: sourceCur,
      customerReceives,   customerReceivesCur: destCur,
      supplierSettlement: supplierSettl, supplierSettlementCur: destCur,
      profit, profitCur: destCur,
      profitUsd, netPnlUsd,
      isProfit: profit >= 0,
      hasRates,
    }
  }

  // ── Case C: Cross-currency (EGP → SAR gibi) ───────────────────────────────
  // USD pivot — customer_rate = dest kuru, supplier_rate = source kuru
  // Infinity koruması: cr ve sr sıfır kontrolü hasRates'e ek olarak explicit
  const customerPays     = usd * sr     // sourceCur (EGP)
  const customerReceives = usd * cr     // destCur (SAR)
  const supplierSettl    = usd * sr     // sourceCur

  // profitUsd: USD cinsinden yaklaşık kâr
  // 1/cr ve 1/sr — cr > 0 && sr > 0 zaten hasRates ile garanti, ek guard ekle
  const profitUsd = (cr > 0 && sr > 0)
    ? (() => {
        const v = usd * (1 / cr - 1 / sr)
        return isFinite(v) ? v : 0
      })()
    : 0
  const netPnlUsd = profitUsd + comm

  return {
    direction: `${sourceCur} → ${destCur}`,
    sourceCur, destCur, usdAmount: usd,
    customerRate: cr, supplierRate: sr,
    customerPays,       customerPaysCur: sourceCur,
    customerReceives,   customerReceivesCur: destCur,
    supplierSettlement: supplierSettl, supplierSettlementCur: sourceCur,
    profit: profitUsd, profitCur: 'USD',
    profitUsd, netPnlUsd,
    isProfit: profitUsd >= 0,
    hasRates,
    isCross: true,
  }
}
