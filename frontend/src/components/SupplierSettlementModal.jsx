/**
 * SupplierSettlementModal
 *
 * TEMEL KURAL: Müşteri kuru bu modalda YOKTUR ve OLAMAZ.
 * Bu modal yalnızca tedarikçi tarafı verilerini işler:
 *   - Tedarikçi kim? (kayıtlı / harici / yok)
 *   - Tedarikçi kuru nedir? (1 USD = X {currency})
 *   - Tedarikçi uzlaşma tutarları nedir?
 *   - Hangi lokasyon/kasa etkilenir?
 */
import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supplierSettlementApi } from '../utils/api'
import { fmt, stripCommas } from '../utils/format'
import { Modal, Btn, Input, Select, RateInput, SumRow, Info, CPSearch, C } from './UI'
import { useLang } from '../hooks/useLang'
import toast from 'react-hot-toast'

function calcSettlement({ sourceCur, destCur, settlementUsd, supplierRate }) {
  const usd  = parseFloat(settlementUsd || 0)
  const rate = parseFloat(supplierRate  || 0)

  if (!usd || !rate || !sourceCur || !destCur) return null

  if (destCur === 'USD') {
    // Case A: SAR → USD
    // Tedarikçi source lokasyonda receivable: usd × rate [SAR]
    // Tedarikçi dest lokasyonda payable: usd [USD]
    return {
      receivable: { amount: usd * rate, currency: sourceCur },
      payable:    { amount: usd,        currency: destCur   },
    }
  }

  if (sourceCur === 'USD') {
    // Case B: USD → SAR
    // Tedarikçi source lokasyonda receivable: usd [USD]
    // Tedarikçi dest lokasyonda payable: usd × rate [SAR]
    return {
      receivable: { amount: usd,        currency: sourceCur },
      payable:    { amount: usd * rate, currency: destCur   },
    }
  }

  // Cross-currency
  return {
    receivable: { amount: usd * rate, currency: sourceCur },
    payable:    { amount: usd * rate, currency: destCur   },
  }
}

export default function SupplierSettlementModal({ txn, counterparties = [], onClose }) {
  const qc = useQueryClient()
  const { t } = useLang()

  // İşlemden yön ve tutar bilgisi al — müşteri kuru DEĞİL
  const sourceCur     = txn?.pnl?.source_currency ?? ''
  const destCur       = txn?.pnl?.dest_currency   ?? ''
  const defaultUsd    = txn?.pnl?.usd_amount       ?? ''
  const sourceLocName = txn?.legs?.find(l => l.leg_type === 'out')?.account?.location?.name_tr ?? '?'
  const destLocName   = txn?.legs?.find(l => l.leg_type === 'in')?.account?.location?.name_tr  ?? '?'
  const nonUsdCur     = destCur === 'USD' ? sourceCur : destCur

  // Sadece supplier veya both tipindeki karşı taraflar
  const suppliers = counterparties.filter(cp => ['supplier','both','founder'].includes(cp.type))

  // Mevcut uzlaşma varsa göster
  const existing = txn?.supplier_settlement

  const [settlementType, setSettlementType] = useState(existing?.settlement_type ?? 'registered')
  const [supplierId,     setSupplierId]     = useState(existing?.counterparty_id ?? '')
  const [externalName,   setExternalName]   = useState(existing?.external_name   ?? '')
  const [supplierRate,   setSupplierRate]   = useState(existing?.supplier_rate   ? String(existing.supplier_rate) : '')
  const [usdAmount,      setUsdAmount]      = useState(existing?.settlement_amount_usd ? String(existing.settlement_amount_usd) : String(defaultUsd))
  const [notes,          setNotes]          = useState(existing?.notes ?? '')

  const preview = useMemo(() => calcSettlement({
    sourceCur, destCur,
    settlementUsd: parseFloat(stripCommas(usdAmount)),
    supplierRate:  parseFloat(supplierRate),
  }), [sourceCur, destCur, usdAmount, supplierRate])

  const mutation = useMutation({
    mutationFn: (data) => supplierSettlementApi.create(txn?.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['transactions'] })
      toast.success(t.settlementSaved)
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || t.saveError),
  })

  const deleteMutation = useMutation({
    mutationFn: () => supplierSettlementApi.delete(txn?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['transactions'] })
      toast.success(t.settlementDeleted)
      onClose()
    },
  })

  const handleSave = () => {
    if (settlementType === 'registered' && !supplierId) {
      return toast.error(t.selectRegistered)
    }
    if (settlementType === 'external' && !externalName.trim()) {
      return toast.error(t.enterExternalName)
    }
    if (settlementType !== 'internal' && !supplierRate) {
      return toast.error(t.enterSupplierRate)
    }

    mutation.mutate({
      settlement_type:       settlementType,
      counterparty_id:       settlementType === 'registered' ? supplierId : null,
      external_name:         settlementType === 'external'   ? externalName : null,
      supplier_rate:         settlementType !== 'internal'   ? parseFloat(supplierRate) : null,
      settlement_amount_usd: parseFloat(stripCommas(usdAmount)) || null,
      notes: notes || null,
    })
  }

  const TYPE_LABELS = {
    registered: t.registeredSupplier,
    external:   t.externalSupplier,
    internal:   t.noSupplier,
  }

  const selSupplier = suppliers.find(s => s.id === supplierId)

  return (
    <Modal
      title={t.supplierSettlementTitle}
      subtitle={`${txn?.txn_number ?? ''} · ${sourceCur} → ${destCur}`}
      onClose={onClose}
      footer={
        <div style={{ display:'flex', gap:10, width:'100%' }}>
          {existing && (
            <Btn variant="danger" size="sm"
              onClick={() => window.confirm(t.deleteSettlement) && deleteMutation.mutate()}
              disabled={deleteMutation.isPending}>
              {t.delete}
            </Btn>
          )}
          <div style={{ flex:1 }} />
          <Btn variant="ghost" onClick={onClose}>{t.cancel}</Btn>
          <Btn variant="success" onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? `⏳ ${t.saving}` : `✓ ${t.save}`}
          </Btn>
        </div>
      }
    >
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Supplier-side only warning */}
        <Info type="info">
          <strong>{t.note}:</strong> {t.supplierSettlementNote}
        </Info>

        {/* Transaction summary — direction only */}
        <div style={{
          background: C.surface2,
          border: `1px solid ${C.border}`,
          borderRadius: 9, padding:'12px 14px',
        }}>
          <div style={{ fontSize:11, fontWeight:600, color:C.text3, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
            {t.txnInfo}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div>
              <div style={{ fontSize:11, color:C.text3, marginBottom:2 }}>{t.txnNo}</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:500 }}>{txn?.txn_number ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.text3, marginBottom:2 }}>{t.directionLabel}</div>
              <div style={{ fontWeight:600, fontSize:13 }}>{sourceCur} → {destCur}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.text3, marginBottom:2 }}>{t.locationLabel}</div>
              <div style={{ fontSize:12, color:C.text2 }}>{sourceLocName} → {destLocName}</div>
            </div>
          </div>
        </div>

        {/* Settlement type */}
        <div>
          <div style={{ fontSize:12, fontWeight:500, color:C.text2, marginBottom:8 }}>{t.settlementType}</div>
          <div style={{ display:'flex', gap:8 }}>
            {['registered','external','internal'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setSettlementType(t)}
                style={{
                  flex:1, padding:'9px 10px', borderRadius:8, border:'none',
                  cursor:'pointer', fontFamily:'var(--font)', fontSize:12.5, fontWeight:500,
                  transition:'all 0.12s',
                  background: settlementType===t ? C.navy : C.surface2,
                  color: settlementType===t ? 'white' : C.text2,
                }}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Registered supplier */}
        {settlementType === 'registered' && (
          <CPSearch
            list={suppliers}
            value={supplierId}
            onChange={setSupplierId}
            label={t.selectSupplier}
          />
        )}

        {/* External supplier */}
        {settlementType === 'external' && (
          <Input
            label={t.externalSupplierName}
            value={externalName}
            onChange={e => setExternalName(e.target.value)}
            placeholder="Al-Rashidi Exchange"
          />
        )}

        {/* Internal safe */}
        {settlementType === 'internal' && (
          <Info type="success">
            {t.internalInfo}
          </Info>
        )}

        {/* Supplier rate — only when not internal */}
        {settlementType !== 'internal' && (
          <RateInput
            value={supplierRate}
            onChange={setSupplierRate}
            accent="red"
            label={`${t.supplierRate} — 1 USD = ? ${nonUsdCur || '?'}`}
            hint={t.supplierRateHint}
          />
        )}

        {/* Reference USD amount */}
        {settlementType !== 'internal' && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:500, color:C.text2 }}>
              {t.refUsdAmount}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={usdAmount}
              onChange={e => setUsdAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="1000"
              style={{
                width:'100%', padding:'8px 11px',
                border:`1px solid ${C.border}`,
                borderRadius:7, fontSize:14, fontFamily:'var(--mono)',
                color:C.text1, background:'white', outline:'none',
              }}
            />
          </div>
        )}

        {/* Settlement preview — supplier side only */}
        {settlementType !== 'internal' && preview && (
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10, padding: 16,
          }}>
            <div style={{
              fontSize:11, fontWeight:600, color:C.text3,
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12,
            }}>
              {t.settlementPreview}
            </div>

            {/* Who */}
            {(selSupplier || externalName) && (
              <SumRow
                label={t.supplierCol}
                value={selSupplier?.name || externalName}
              />
            )}

            <SumRow label={t.supplierRate} value={`1 USD = ${supplierRate} ${nonUsdCur}`} />

            {/* Receivable */}
            <div style={{
              display:'flex', alignItems:'flex-start', justifyContent:'space-between',
              padding:'10px 0', borderTop:`1px solid ${C.border}`, marginTop:8,
            }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:C.text1 }}>
                  {t.receivable}
                </div>
                <div style={{ fontSize:11.5, color:C.text3, marginTop:2 }}>
                  {sourceLocName} {t.receivableFrom}
                </div>
              </div>
              <span style={{
                fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:C.blue,
              }}>
                {fmt(preview.receivable.amount)} {preview.receivable.currency}
              </span>
            </div>

            {/* Payable */}
            <div style={{
              display:'flex', alignItems:'flex-start', justifyContent:'space-between',
              padding:'10px 0', borderTop:`1px solid ${C.border}`,
            }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:C.text1 }}>
                  {t.payable}
                </div>
                <div style={{ fontSize:11.5, color:C.text3, marginTop:2 }}>
                  {destLocName} {t.payableTo}
                </div>
              </div>
              <span style={{
                fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:C.amber,
              }}>
                {fmt(preview.payable.amount)} {preview.payable.currency}
              </span>
            </div>
          </div>
        )}

        {/* Note */}
        <Input
          label={t.noteOptional}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t.settlementNote}
        />

      </div>
    </Modal>
  )
}
