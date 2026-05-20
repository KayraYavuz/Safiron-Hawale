/**
 * TransactionForm
 *
 * İş kuralları:
 *   fromAcc = source kasa (müşterinin para VERDİĞİ yer) → outgoing leg
 *   toAcc   = dest kasa   (müşterinin para ALDIĞI yer)  → incoming leg
 *
 * Kur formatı: 1 USD = X {nonUsdCur}  (daima)
 *   customerRate: müşteriye uygulanan kur
 *   supplierRate: piyasadan/tedarikçiden alınan kur
 *
 * Çift yönlü tutar:
 *   USD değişince  → local = USD × rate
 *   Local değişince → USD  = local / rate
 *   lastEdited ref, kur değişince hangi tarafın baz alınacağını belirler.
 *   Render döngüsü yok: her handler sadece kendi state'ini + karşı tarafı setter ile günceller.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { transactionsApi, locationsApi } from '../utils/api'
import { fmt, stripCommas, addCommas, calcPnl } from '../utils/format'
import { Modal, Btn, Steps, AmountInput, RateInput, SumRow, Info, CPSearch, LocAccPicker, Input, C } from './UI'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'

// ── buildLegs — saf fonksiyon, state bağımlılığı yok ─────────────────────────
function buildLegs({ txnType, fromAcc, toAcc, sourceCur, destCur, usdAmount, customerRate, dwAcc, dwAmount, itFromAcc, itToAcc, itAmount, itRate }) {
  const n = (v) => {
    const f = parseFloat(stripCommas(String(v ?? 0)))
    return isFinite(f) ? f : 0
  }

  if (txnType === 'deposit') {
    if (!dwAcc?.id) return []
    return [{ leg_type: 'in', account_id: dwAcc.id, currency_id: dwAcc.currency_id, amount: n(dwAmount) }]
  }
  if (txnType === 'withdrawal') {
    if (!dwAcc?.id) return []
    return [{ leg_type: 'out', account_id: dwAcc.id, currency_id: dwAcc.currency_id, amount: n(dwAmount) }]
  }
  if (txnType === 'internal_transfer') {
    if (!itFromAcc?.id || !itToAcc?.id) return []
    const fromAmt = n(itAmount)
    const rateVal = n(itRate)
    const toAmt   = rateVal > 0 ? fromAmt / rateVal : fromAmt
    return [
      { leg_type: 'out', account_id: itFromAcc.id, currency_id: itFromAcc.currency_id, amount: fromAmt },
      { leg_type: 'in',  account_id: itToAcc.id,   currency_id: itToAcc.currency_id,   amount: toAmt  },
    ]
  }

  // remittance / fx / swift
  if (!fromAcc?.id || !toAcc?.id) return []

  const usd = n(usdAmount)
  const cr  = n(customerRate)

  let outAmt, inAmt

  if (destCur === 'USD') {
    // Case A: source=SAR → dest=USD, müşteri SAR veriyor, USD alıyor
    outAmt = cr > 0 ? usd * cr : usd
    inAmt  = usd
  } else if (sourceCur === 'USD') {
    // Case B: source=USD → dest=SAR, müşteri USD veriyor, SAR alıyor
    outAmt = usd
    inAmt  = cr > 0 ? usd * cr : usd
  } else {
    // Case C: cross-currency, USD pivot
    outAmt = usd
    inAmt  = usd
  }

  return [
    { leg_type: 'out', account_id: fromAcc.id, currency_id: fromAcc.currency_id, amount: outAmt },
    { leg_type: 'in',  account_id: toAcc.id,   currency_id: toAcc.currency_id,   amount: inAmt  },
  ]
}

// ── Yardımcı: güvenli para hesabı ────────────────────────────────────────────
function safeCalc(a, op, b) {
  const fa = parseFloat(a)
  const fb = parseFloat(b)
  if (!isFinite(fa) || !isFinite(fb) || fb === 0) return ''
  const result = op === '*' ? fa * fb : fa / fb
  return isFinite(result) ? addCommas(result.toFixed(2)) : ''
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export default function TransactionForm({ onClose, accounts = [], counterparties = [] }) {
  const { t } = useLang()
  const qc    = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const TXN_TYPES = [
    { v:'remittance',        label: t.remittance,       desc: t.remittanceDesc },
    { v:'fx',                label: t.fx,               desc: t.fxDesc },
    { v:'swift',             label: t.swift,            desc: t.swiftDesc },
    { v:'deposit',           label: t.deposit,          desc: t.depositDesc },
    { v:'withdrawal',        label: t.withdrawal,       desc: t.withdrawalDesc },
    { v:'internal_transfer', label: t.internalTransfer, desc: t.internalTransferDesc },
  ]
  const ROLE_LABELS = { customer: t.customer, supplier: t.supplier, founder: t.founder }

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn:  () => locationsApi.list().then(r => r.data),
    staleTime: 5 * 60 * 1000,  // 5 dk — lokasyonlar değişmez
  })

  // ── State ──────────────────────────────────────────────────────────────────
  const [step,      setStep]      = useState(0)
  const [txnType,   setTxnType]   = useState('')
  const [txnDate,   setTxnDate]   = useState(today)
  const [valueDate, setValueDate] = useState(today)
  const [notes,     setNotes]     = useState('')
  const [cpId,      setCpId]      = useState('')
  const [cpRole,    setCpRole]    = useState('customer')

  // Kasalar
  const [fromLocId, setFromLocId] = useState('')
  const [fromAccId, setFromAccId] = useState('')
  const [toLocId,   setToLocId]   = useState('')
  const [toAccId,   setToAccId]   = useState('')

  // Kurlar
  const [customerRate, setCustomerRate] = useState('')
  const [supplierRate, setSupplierRate] = useState('')

  // Çift yönlü tutar
  const [usdAmount,   setUsdAmount]   = useState('')
  const [localAmount, setLocalAmount] = useState('')
  // lastEdited ref: render döngüsüne girmemek için state değil ref kullanıyoruz
  const lastEdited = useRef('usd')  // 'usd' | 'local'

  const [commission, setCommission] = useState('')

  // Deposit / withdrawal
  const [dwLocId,  setDwLocId]  = useState('')
  const [dwAccId,  setDwAccId]  = useState('')
  const [dwAmount, setDwAmount] = useState('')

  // Internal transfer
  const [itFromLocId, setItFromLocId] = useState('')
  const [itFromAccId, setItFromAccId] = useState('')
  const [itToLocId,   setItToLocId]   = useState('')
  const [itToAccId,   setItToAccId]   = useState('')
  const [itAmount,    setItAmount]    = useState('')
  const [itRate,      setItRate]      = useState('')

  // ── Türetilmiş değerler (render başına, ucuz) ──────────────────────────────
  const fromAcc   = accounts.find(a => a.id === fromAccId) ?? null
  const toAcc     = accounts.find(a => a.id === toAccId)   ?? null
  const dwAcc     = accounts.find(a => a.id === dwAccId)   ?? null
  const itFromAcc = accounts.find(a => a.id === itFromAccId) ?? null
  const itToAcc   = accounts.find(a => a.id === itToAccId)   ?? null

  const sourceCur = fromAcc?.currency?.code ?? ''
  const destCur   = toAcc?.currency?.code   ?? ''
  const sameCur   = !!(sourceCur && destCur && sourceCur === destCur)

  // nonUsdCur: kur alanında gösterilecek non-USD para birimi
  const nonUsdCur = destCur === 'USD' ? sourceCur
                  : sourceCur === 'USD' ? destCur
                  : destCur

  // ── Çift yönlü tutar handler'ları ─────────────────────────────────────────
  const handleUsdChange = useCallback((val) => {
    lastEdited.current = 'usd'
    setUsdAmount(val)
    setLocalAmount(prev => {
      const usd  = parseFloat(stripCommas(val) || 0)
      const rate = parseFloat(customerRate || 0)
      if (usd > 0 && rate > 0) return safeCalc(usd, '*', rate)
      return ''
    })
  }, [customerRate])

  const handleLocalChange = useCallback((val) => {
    lastEdited.current = 'local'
    setLocalAmount(val)
    setUsdAmount(prev => {
      const local = parseFloat(stripCommas(val) || 0)
      const rate  = parseFloat(customerRate || 0)
      if (local > 0 && rate > 0) return safeCalc(local, '/', rate)
      return ''
    })
  }, [customerRate])

  useEffect(() => {
    const rate = parseFloat(customerRate || 0)
    if (rate <= 0) return

    if (lastEdited.current === 'usd') {
      setUsdAmount(prev => {
        const usd = parseFloat(stripCommas(prev) || 0)
        if (usd <= 0) return prev
        setLocalAmount(safeCalc(usd, '*', rate))
        return prev
      })
    } else {
      setLocalAmount(prev => {
        const local = parseFloat(stripCommas(prev) || 0)
        if (local <= 0) return prev
        setUsdAmount(safeCalc(local, '/', rate))
        return prev
      })
    }
  }, [customerRate])

  // ── Kâr önizlemesi ────────────────────────────────────────────────────────
  const pnl = useMemo(() => {
    if (!sourceCur || !destCur) return null
    const usd = parseFloat(stripCommas(usdAmount) || 0)
    if (usd <= 0) return null
    const cr   = parseFloat(customerRate || 0)
    const sr   = parseFloat(supplierRate || 0)
    const comm = parseFloat(stripCommas(commission) || 0)
    return calcPnl({ sourceCur, destCur, usdAmount: usd, customerRate: cr, supplierRate: sr, commissionUsd: comm })
  }, [sourceCur, destCur, usdAmount, customerRate, supplierRate, commission])

  // ── Anlık kur farkı önizlemesi (adım 3) ──────────────────────────────────
  const ratePreview = useMemo(() => {
    const cr = parseFloat(customerRate || 0)
    const sr = parseFloat(supplierRate || 0)
    if (!cr || !sr || !destCur || !sourceCur || sameCur) return null
    const isProfit = destCur === 'USD' ? cr > sr : sr > cr
    const spread   = destCur === 'USD' ? cr - sr : sr - cr
    return { isProfit, spread: spread.toFixed(4), cr, sr }
  }, [customerRate, supplierRate, destCur, sourceCur, sameCur])

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['position'] })
      qc.invalidateQueries({ queryKey: ['cashMovDash'] })
      toast.success(t.txnSaved)
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || t.saveError),
  })

  const handleSubmit = () => {
    const legs = buildLegs({
      txnType, fromAcc, toAcc, sourceCur, destCur,
      usdAmount: stripCommas(usdAmount),
      customerRate: stripCommas(customerRate),
      dwAcc, dwAmount, itFromAcc, itToAcc, itAmount, itRate,
    })

    if (!legs.length || legs.some(l => !l.account_id || !(l.amount > 0))) {
      return toast.error(t.missingInfo)
    }

    const usdNum = parseFloat(stripCommas(usdAmount))
    mutation.mutate({
      txn_date:         txnDate,
      value_date:       valueDate,
      txn_type:         txnType,
      counterparty_id:  cpId || null,
      counterparty_role: cpId ? cpRole : null,
      notes:            notes || null,
      legs,
      usd_amount:    isFinite(usdNum) && usdNum > 0 ? usdNum : null,
      customer_rate: customerRate ? parseFloat(customerRate) : null,
      supplier_rate: supplierRate ? parseFloat(supplierRate) : null,
      commission_usd: commission ? parseFloat(stripCommas(commission)) : null,
    })
  }

  // ── Step logic ─────────────────────────────────────────────────────────────
  const isSimple   = ['deposit', 'withdrawal'].includes(txnType)
  const isTransfer = txnType === 'internal_transfer'
  const isFX       = ['remittance', 'fx', 'swift'].includes(txnType)
  const totalSteps = isSimple ? 1 : isTransfer ? 3 : isFX ? 4 : 0

  const canNext = () => {
    if (isSimple)   return !!(dwAccId && parseFloat(stripCommas(dwAmount)) > 0)
    if (isTransfer) {
      if (step === 1) return !!(itFromAccId && itToAccId)
      if (step === 2) return parseFloat(stripCommas(itAmount)) > 0
      return true
    }
    if (isFX) {
      if (step === 1) return true
      if (step === 2) return !!(fromAccId && toAccId)
      if (step === 3) return !!(customerRate || sameCur)
      if (step === 4) {
        const usd   = parseFloat(stripCommas(usdAmount))
        const local = parseFloat(stripCommas(localAmount))
        return (isFinite(usd) && usd > 0) || (isFinite(local) && local > 0)
      }
    }
    return false
  }

  const subtitle = txnType
    ? `${TXN_TYPES.find(t_opt => t_opt.v === txnType)?.label ?? ''}${fromAcc && toAcc ? ` · ${fromAcc.location?.name_tr ?? ''} → ${toAcc.location?.name_tr ?? ''}` : ''}`
    : ''

  // ── Kâr koşul metni (adım 3) ──────────────────────────────────────────────
  const profitConditionText = () => {
    if (!sourceCur || !destCur || sameCur) return ''
    if (destCur === 'USD')   return t.profitConditionA.replace('{source}', sourceCur)
    if (sourceCur === 'USD') return t.profitConditionB.replace('{dest}', destCur)
    return `${t.crossTxn}: ${sourceCur} → ${destCur} — ${t.bothRatesUsd}`
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      title={t.newTxnTitle}
      subtitle={subtitle}
      onClose={onClose}
      footer={step > 0 && (
        <>
          <Btn variant="ghost" onClick={() => step === 1 ? setStep(0) : setStep(s => s - 1)}>
            {t.back}
          </Btn>
          <div style={{ flex: 1 }}><Steps current={step} total={totalSteps} /></div>
          {step < totalSteps
            ? <Btn onClick={() => setStep(s => s + 1)} disabled={!canNext()}>{t.next}</Btn>
            : <Btn variant="success" onClick={handleSubmit} disabled={mutation.isPending}>
                {mutation.isPending ? `⏳ ${t.saving}` : `✓ ${t.save}`}
              </Btn>
          }
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── ADIM 0: Tür seç ───────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <div style={{ fontSize: 13.5, color: C.text2, marginBottom: 12 }}>
              {t.whatToDo}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TXN_TYPES.map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => { setTxnType(opt.v); setStep(1) }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 11, padding: 13,
                    border: `1.5px solid ${C.border}`, borderRadius: 10,
                    background: 'white', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy3; e.currentTarget.style.background = C.blueBg }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'white' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: C.text1 }}>{opt.label}</div>
                    <div style={{ fontSize: 11.5, color: C.text3, marginTop: 3, lineHeight: 1.4 }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tarih satırı ──────────────────────────────────────────────── */}
        {step > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
            <Input label={t.txnDate} type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
            <Input label={t.valueDate}  type="date" value={valueDate} onChange={e => setValueDate(e.target.value)} />
          </div>
        )}

        {/* ══ PARA YATIRMA / ÇEKME ════════════════════════════════════════ */}
        {isSimple && step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Info type={txnType === 'deposit' ? 'info' : 'warning'}>
              {txnType === 'deposit' ? t.depositInfo : t.withdrawalInfo}
            </Info>
            <CPSearch list={counterparties} value={cpId} onChange={setCpId} label={t.counterpartyOptional} />
            {cpId && (
              <div style={{ display: 'flex', gap: 8 }}>
                {['customer', 'supplier', 'founder'].map(r => (
                  <button key={r} type="button" onClick={() => setCpRole(r)} style={{
                    padding: '6px 13px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                    fontFamily: 'var(--font)', cursor: 'pointer', transition: 'all 0.12s',
                    background: cpRole === r ? C.navy : 'white',
                    color:      cpRole === r ? 'white' : C.text2,
                    border:     `1px solid ${cpRole === r ? C.navy : C.border}`,
                  }}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            )}
            <LocAccPicker
              locations={locations} accounts={accounts}
              locVal={dwLocId} onLoc={setDwLocId} accVal={dwAccId} onAcc={setDwAccId}
              label={txnType === 'deposit' ? t.depositTarget : t.withdrawalTarget}
            />
            {dwAccId && (
              <AmountInput value={dwAmount} onChange={setDwAmount} currency={dwAcc?.currency?.code} label={t.amount} />
            )}
            <Input label={t.noteOptional} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t.descPlaceholder} />
          </div>
        )}

        {/* ══ İÇ TRANSFER ═════════════════════════════════════════════════ */}
        {isTransfer && step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Info>{t.internalTransferInfo}</Info>
            <LocAccPicker locations={locations} accounts={accounts}
              locVal={itFromLocId} onLoc={setItFromLocId} accVal={itFromAccId} onAcc={setItFromAccId}
              label={t.outgoingSafe} />
            <LocAccPicker locations={locations} accounts={accounts}
              locVal={itToLocId} onLoc={setItToLocId} accVal={itToAccId} onAcc={setItToAccId}
              label={t.incomingSafe} />
          </div>
        )}
        {isTransfer && step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AmountInput value={itAmount} onChange={setItAmount} currency={itFromAcc?.currency?.code} label={t.amount} />
            {itFromAcc && itToAcc && itFromAcc.currency?.code !== itToAcc.currency?.code && (
              <RateInput value={itRate} onChange={setItRate} accent="amber"
                label={`${t.conversionRate} — 1 ${itToAcc.currency?.code} = ? ${itFromAcc.currency?.code}`} />
            )}
            <Input label={t.noteOptional} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t.descPlaceholder} />
          </div>
        )}
        {isTransfer && step === 3 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{t.summaryTitle}</div>
            <SumRow label={t.outgoing} value={`${itFromAcc?.location?.name_tr ?? ''} · ${itFromAcc?.name ?? ''} (${itFromAcc?.currency?.code ?? ''})`} />
            <SumRow label={t.incoming} value={`${itToAcc?.location?.name_tr ?? ''} · ${itToAcc?.name ?? ''} (${itToAcc?.currency?.code ?? ''})`} />
            <SumRow label={t.amount} value={`${fmt(stripCommas(itAmount))} ${itFromAcc?.currency?.code ?? ''}`} />
            {itRate && <SumRow label={t.rateLabel} value={`1 ${itToAcc?.currency?.code ?? ''} = ${itRate} ${itFromAcc?.currency?.code ?? ''}`} />}
          </div>
        )}

        {/* ══ HAVALE / FX / SWIFT ══════════════════════════════════════════ */}

        {/* Adım 1: Karşı taraf */}
        {isFX && step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Info>{t.fxInfo}</Info>
            <CPSearch list={counterparties} value={cpId} onChange={setCpId} label={t.counterpartyOptional} />
            {cpId && (
              <div style={{ display: 'flex', gap: 8 }}>
                {['customer', 'supplier', 'founder'].map(r => (
                  <button key={r} type="button" onClick={() => setCpRole(r)} style={{
                    padding: '6px 13px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                    fontFamily: 'var(--font)', cursor: 'pointer', transition: 'all 0.12s',
                    background: cpRole === r ? C.navy : 'white',
                    color:      cpRole === r ? 'white' : C.text2,
                    border:     `1px solid ${cpRole === r ? C.navy : C.border}`,
                  }}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Adım 2: Kasalar */}
        {isFX && step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <LocAccPicker locations={locations} accounts={accounts}
              locVal={fromLocId} onLoc={setFromLocId} accVal={fromAccId} onAcc={setFromAccId}
              label={t.sourceAccount} />
            <LocAccPicker locations={locations} accounts={accounts}
              locVal={toLocId} onLoc={setToLocId} accVal={toAccId} onAcc={setToAccId}
              label={t.destAccount} />
            {sourceCur && destCur && !sameCur && (
              <Info type="info">
                <strong>{t.directionLabel}:</strong> {sourceCur} → {destCur}<br />
                {t.customerGives} <strong>{sourceCur}</strong>, {t.customerGets} <strong>{destCur}</strong>.<br />
                {t.rateFormatTitle}: <strong>1 USD = X {nonUsdCur}</strong>
              </Info>
            )}
            {sameCur && (
              <Info>💱 {t.sameCurrencyInfo.replace('{cur}', sourceCur)}</Info>
            )}
          </div>
        )}

        {/* Adım 3: Fiyatlandırma */}
        {isFX && step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sameCur ? (
              <>
                <Info>{t.sameCurrencyNoFx}</Info>
                <AmountInput value={commission} onChange={setCommission} currency="USD" label={t.commissionOptional} />
              </>
            ) : (
              <>
                {/* Kur açıklama kutusu */}
                <div style={{
                  background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)',
                  borderRadius: 9, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.7,
                }}>
                  <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6, fontSize: 13 }}>
                    {t.rateFormatTitle}: 1 USD = X {nonUsdCur}
                  </div>
                  <div style={{ color: C.text2 }}>{profitConditionText()}</div>
                  {destCur === 'USD' && (
                    <div style={{ marginTop: 6, fontSize: 12, color: C.text3 }}>
                      {t.exampleProfit}: {t.customerRate} = 3.86, {t.supplierRate} = 3.80 → {t.profit} = 60 SAR / 1,000 USD
                    </div>
                  )}
                  {sourceCur === 'USD' && (
                    <div style={{ marginTop: 6, fontSize: 12, color: C.text3 }}>
                      {t.exampleProfit}: {t.supplierRate} = 3.86, {t.customerRate} = 3.80 → {t.profit} = 60 SAR / 1,000 USD
                    </div>
                  )}
                </div>

                {/* Müşteri Kuru */}
                <RateInput
                  value={customerRate}
                  onChange={setCustomerRate}
                  accent="green"
                  label={`${t.customerRate} — 1 USD = ? ${nonUsdCur}`}
                  hint={destCur === 'USD' ? t.customerRateHintHigh : t.customerRateHintLow}
                />

                {/* Tedarikçi Kuru */}
                <RateInput
                  value={supplierRate}
                  onChange={setSupplierRate}
                  accent="red"
                  label={`${t.supplierRate} — 1 USD = ? ${nonUsdCur}`}
                  hint={destCur === 'USD' ? t.supplierRateHintLow : t.supplierRateHintHigh}
                />

                {/* Anlık kâr önizlemesi */}
                {ratePreview && (
                  <div style={{
                    background: ratePreview.isProfit ? C.greenBg : C.redBg,
                    border: `1px solid ${ratePreview.isProfit ? 'rgba(14,164,114,0.25)' : 'rgba(229,62,62,0.25)'}`,
                    borderRadius: 8, padding: '10px 13px', fontSize: 12.5,
                  }}>
                    <span style={{ fontWeight: 600, color: ratePreview.isProfit ? C.green : C.red }}>
                      {ratePreview.isProfit ? t.profitLabel : t.lossLabel}
                    </span>
                    <span style={{ color: C.text2, marginLeft: 8 }}>
                      {destCur === 'USD'
                        ? `${t.customerRate}(${ratePreview.cr}) - ${t.supplierRate}(${ratePreview.sr})`
                        : `${t.supplierRate}(${ratePreview.sr}) - ${t.customerRate}(${ratePreview.cr})`}
                      {' → '}
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: ratePreview.isProfit ? C.green : C.red }}>
                        {ratePreview.isProfit ? '+' : ''}{ratePreview.spread} {nonUsdCur} / USD
                      </span>
                    </span>
                  </div>
                )}

                <AmountInput value={commission} onChange={setCommission} currency="USD" label={t.commissionOptional} />
              </>
            )}
          </div>
        )}

        {/* Adım 4: Tutar & Özet */}
        {isFX && step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Açıklama — sadece farklı para birimleri varsa */}
            {!sameCur && nonUsdCur && (
              <Info>
                {t.autoCalcInfo.replace('{cur}', nonUsdCur)}<br />
                {t.rateLabel}: 1 USD = {customerRate || '?'} {nonUsdCur}
              </Info>
            )}

            {/* USD alanı */}
            <AmountInput
              value={usdAmount}
              onChange={handleUsdChange}
              currency="USD"
              label={t.usdAmount}
              hint={t.usdHint}
            />

            {/* Yerel para birimi alanı — çift yönlü, sadece farklı para biriminde göster */}
            {!sameCur && nonUsdCur && (
              <AmountInput
                value={localAmount}
                onChange={handleLocalChange}
                currency={nonUsdCur}
                label={`${nonUsdCur} ${t.localAmount}`}
                hint={`${t.localHint} 1 USD = ${customerRate || '?'} ${nonUsdCur}`}
                highlight={lastEdited.current === 'local'}
              />
            )}

            {/* Özet kutusu */}
            {pnl && (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: 16, marginTop: 4,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: C.text3,
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
                }}>
                  {t.txnSummary}
                </div>

                {cpId && (
                  <SumRow label={t.counterparty} value={counterparties.find(c => c.id === cpId)?.name ?? '—'} />
                )}

                <SumRow label={t.direction} value={`${sourceCur} → ${destCur}`} />

                {pnl.customerPays > 0 && (
                  <SumRow
                    label={t.customerPays}
                    value={`${fmt(pnl.customerPays)} ${pnl.customerPaysCur ?? ''}`}
                  />
                )}
                {pnl.customerReceives > 0 && (
                  <SumRow
                    label={t.customerReceives}
                    value={`${fmt(pnl.customerReceives)} ${pnl.customerReceivesCur ?? ''}`}
                  />
                )}
                {pnl.supplierSettlement > 0 && (
                  <SumRow
                    label={t.supplierSettlement}
                    value={`${fmt(pnl.supplierSettlement)} ${pnl.supplierSettlementCur ?? ''}`}
                  />
                )}
                {customerRate && (
                  <SumRow label={t.customerRate} value={`1 USD = ${customerRate} ${nonUsdCur}`} />
                )}
                {supplierRate && (
                  <SumRow label={t.supplierRate} value={`1 USD = ${supplierRate} ${nonUsdCur}`} />
                )}
                {pnl.hasRates && (
                  <SumRow
                    label={pnl.isProfit ? t.profitText : t.lossText}
                    value={`${pnl.isProfit ? '+' : ''}${fmt(pnl.profit ?? 0)} ${pnl.profitCur ?? ''}`}
                    warn={!pnl.isProfit}
                    highlight
                  />
                )}
                {commission && parseFloat(stripCommas(commission)) > 0 && (
                  <SumRow label={t.commission} value={`+$${fmt(stripCommas(commission))}`} />
                )}
                {pnl.hasRates && (
                  <SumRow
                    label={t.netProfitUsdLabel}
                    value={`${(pnl.netPnlUsd ?? 0) >= 0 ? '+' : ''}$${fmt(Math.abs(pnl.netPnlUsd ?? 0))}`}
                    highlight
                  />
                )}
                {!pnl.hasRates && (
                  <SumRow label={t.note} value={t.noSupplierRate} warn />
                )}
              </div>
            )}

            <Input label={t.noteOptional} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t.descPlaceholder} />
          </div>
        )}

      </div>
    </Modal>
  )
}
