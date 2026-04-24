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
      toast.success('Tedarikçi uzlaşması kaydedildi ✓')
      onClose()
    },
    onError: e => toast.error(e.response?.data?.detail || 'Kaydetme hatası'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => supplierSettlementApi.delete(txn?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['transactions'] })
      toast.success('Uzlaşma silindi')
      onClose()
    },
  })

  const handleSave = () => {
    if (settlementType === 'registered' && !supplierId) {
      return toast.error('Kayıtlı tedarikçi seçiniz')
    }
    if (settlementType === 'external' && !externalName.trim()) {
      return toast.error('Harici tedarikçi adı giriniz')
    }
    if (settlementType !== 'internal' && !supplierRate) {
      return toast.error('Tedarikçi kuru giriniz')
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
    registered: 'Kayıtlı Tedarikçi',
    external:   'Harici Tedarikçi',
    internal:   'Tedarikçisiz / İç Kasa',
  }

  const selSupplier = suppliers.find(s => s.id === supplierId)

  return (
    <Modal
      title="Tedarikçi Uzlaşması"
      subtitle={`${txn?.txn_number ?? ''} · ${sourceCur} → ${destCur}`}
      onClose={onClose}
      footer={
        <div style={{ display:'flex', gap:10, width:'100%' }}>
          {existing && (
            <Btn variant="danger" size="sm"
              onClick={() => window.confirm('Uzlaşma silinsin mi?') && deleteMutation.mutate()}
              disabled={deleteMutation.isPending}>
              Sil
            </Btn>
          )}
          <div style={{ flex:1 }} />
          <Btn variant="ghost" onClick={onClose}>İptal</Btn>
          <Btn variant="success" onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? '⏳ Kaydediliyor...' : '✓ Kaydet'}
          </Btn>
        </div>
      }
    >
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Uyarı: müşteri kuru bu adımda yok */}
        <Info type="info">
          <strong>Not:</strong> Bu adım yalnızca tedarikçi tarafını kapsar.
          Müşteri kuru ve müşteri fiyatlandırması burada görünmez ve kullanılmaz.
        </Info>

        {/* İşlem özeti — yalnızca yön bilgisi */}
        <div style={{
          background: C.surface2,
          border: `1px solid ${C.border}`,
          borderRadius: 9, padding:'12px 14px',
        }}>
          <div style={{ fontSize:11, fontWeight:600, color:C.text3, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
            İşlem Bilgisi
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div>
              <div style={{ fontSize:11, color:C.text3, marginBottom:2 }}>İşlem No</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:500 }}>{txn?.txn_number ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.text3, marginBottom:2 }}>Yön</div>
              <div style={{ fontWeight:600, fontSize:13 }}>{sourceCur} → {destCur}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.text3, marginBottom:2 }}>Lokasyon</div>
              <div style={{ fontSize:12, color:C.text2 }}>{sourceLocName} → {destLocName}</div>
            </div>
          </div>
        </div>

        {/* Uzlaşma türü */}
        <div>
          <div style={{ fontSize:12, fontWeight:500, color:C.text2, marginBottom:8 }}>Uzlaşma Türü</div>
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

        {/* Kayıtlı tedarikçi */}
        {settlementType === 'registered' && (
          <CPSearch
            list={suppliers}
            value={supplierId}
            onChange={setSupplierId}
            label="Tedarikçi Seç"
          />
        )}

        {/* Harici tedarikçi */}
        {settlementType === 'external' && (
          <Input
            label="Harici Tedarikçi Adı"
            value={externalName}
            onChange={e => setExternalName(e.target.value)}
            placeholder="Al-Rashidi Exchange"
          />
        )}

        {/* İç kasa */}
        {settlementType === 'internal' && (
          <Info type="success">
            ✓ İç kasa hareketi — tedarikçi uzlaşma girişi yapılmayacak.
            İşlem kendi lokasyonlar/kasalar arası olarak kapatılır.
          </Info>
        )}

        {/* Tedarikçi Kuru — sadece internal değilse */}
        {settlementType !== 'internal' && (
          <RateInput
            value={supplierRate}
            onChange={setSupplierRate}
            accent="red"
            label={`Tedarikçi Kuru — 1 USD = ? ${nonUsdCur || '?'}`}
            hint={`Piyasadan/tedarikçiden aldığın kur. Müşteri kuruyla KARISTIRILMAZ.`}
          />
        )}

        {/* Referans USD tutarı */}
        {settlementType !== 'internal' && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:500, color:C.text2 }}>
              Referans USD Miktarı
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

        {/* Uzlaşma önizlemesi — yalnızca tedarikçi tarafı */}
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
              Tedarikçi Uzlaşma Önizlemesi
            </div>

            {/* Kim */}
            {(selSupplier || externalName) && (
              <SumRow
                label="Tedarikçi"
                value={selSupplier?.name || externalName}
              />
            )}

            <SumRow label="Tedarikçi Kuru" value={`1 USD = ${supplierRate} ${nonUsdCur}`} />

            {/* Receivable */}
            <div style={{
              display:'flex', alignItems:'flex-start', justifyContent:'space-between',
              padding:'10px 0', borderTop:`1px solid ${C.border}`, marginTop:8,
            }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:C.text1 }}>
                  Tedarikçi Alacağı (Receivable)
                </div>
                <div style={{ fontSize:11.5, color:C.text3, marginTop:2 }}>
                  {sourceLocName} lokasyonundan alacaklı
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
                  Tedarikçi Borcu (Payable)
                </div>
                <div style={{ fontSize:11.5, color:C.text3, marginTop:2 }}>
                  {destLocName} lokasyonuna borçlu
                </div>
              </div>
              <span style={{
                fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:C.amber,
              }}>
                {fmt(preview.payable.amount)} {preview.payable.currency}
              </span>
            </div>

            {/* Açıklama kutusu */}
            <div style={{
              marginTop:8, padding:'10px 12px',
              background:`rgba(37,99,235,0.05)`, borderRadius:7,
              fontSize:12, color:C.blue, lineHeight:1.6,
            }}>
              {destCur === 'USD'
                ? <>Tedarikçi <strong>{sourceLocName}</strong>'dan <strong>{fmt(preview.receivable.amount)} {sourceCur}</strong> tahsil edecek ve <strong>{destLocName}</strong>'a <strong>{fmt(preview.payable.amount)} USD</strong> ödeyecek.</>
                : <>Tedarikçi <strong>{sourceLocName}</strong>'dan <strong>{fmt(preview.receivable.amount)} USD</strong> tahsil edecek ve <strong>{destLocName}</strong>'a <strong>{fmt(preview.payable.amount)} {destCur}</strong> ödeyecek.</>
              }
            </div>
          </div>
        )}

        {/* Not */}
        <Input
          label="Not (opsiyonel)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Uzlaşma notu..."
        />

      </div>
    </Modal>
  )
}
