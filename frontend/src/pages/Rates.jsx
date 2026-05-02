import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ratesApi, currenciesApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, Table, Th, Td, Badge, Btn, Input, Select, Info, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'

export default function Rates() {
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: today, currency_code: '', rate_per_usd: '' })

  const { data: rates = [], isLoading } = useQuery({ queryKey: ['rates'],      queryFn: () => ratesApi.list({}).then(r => r.data) })
  const { data: curs  = [] }            = useQuery({ queryKey: ['currencies'], queryFn: () => currenciesApi.list().then(r => r.data) })

  const saveMut = useMutation({
    mutationFn: ratesApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['rates', 'position'] }); setShowForm(false); toast.success('Kur kaydedildi') },
    onError:    e  => toast.error(e.response?.data?.detail || 'Hata'),
  })
  const autoMut = useMutation({
    mutationFn: ratesApi.autoUpdate,
    onSuccess:  r  => { qc.invalidateQueries({ queryKey: ['rates', 'position'] }); toast.success(`✅ ${r.data.saved} kur güncellendi`) },
    onError:    e  => toast.error(e.response?.data?.detail || 'API bağlantı hatası'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Auto-update banner */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px 18px', background: 'white', borderRadius: 12, border: `1px solid ${C.border}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Otomatik Kur Güncelleme</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
            Frankfurter API (ECB) · Her sabah 07:00'de otomatik · EUR, GBP, SAR, AED, TRY, CNY ve daha fazlası
          </div>
        </div>
        <Btn variant="accent" onClick={() => autoMut.mutate()} disabled={autoMut.isPending}>
          {autoMut.isPending
            ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(13,27,46,0.3)', borderTopColor: C.navy, borderRadius: '50%' }} className="spinning" /> Güncelleniyor...</>
            : <><Icon name="refresh" size={14} color={C.navy} /> Şimdi Güncelle</>
          }
        </Btn>
        <Btn onClick={() => setShowForm(!showForm)}><Icon name="plus" size={14} color="white" /> Manuel Kur</Btn>
      </div>

      <Info type="warning">
        ⚠ EGP, SDG, NGN, LBP, ETB gibi para birimleri otomatik güncellenmez — piyasa kuru resmi kurdan farklıdır. Manuel olarak girin.
      </Info>

      {showForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>Manuel Kur Girişi</div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label="Tarih" type="date" value={form.date} onChange={e => setForm(x => ({ ...x, date: e.target.value }))} />
              <Select label="Para Birimi" value={form.currency_code} onChange={e => setForm(x => ({ ...x, currency_code: e.target.value }))}>
                <option value="">— seç —</option>
                {curs.filter(c => c.code !== 'USD').sort((a, b) => a.code.localeCompare(b.code)).map(c =>
                  <option key={c.id} value={c.code}>{c.code} — {c.name_tr}</option>
                )}
              </Select>
              <div style={{ gridColumn: '1/-1' }}>
                <Input
                  label={`Kur${form.currency_code ? ` — 1 USD = ? ${form.currency_code}` : ''}`}
                  type="text" inputMode="decimal"
                  value={form.rate_per_usd}
                  onChange={e => setForm(x => ({ ...x, rate_per_usd: e.target.value.replace(',', '.') }))}
                  placeholder={form.currency_code === 'EGP' ? '52.80' : form.currency_code === 'SAR' ? '3.75' : '0.0000'}
                  style={{ fontFamily: 'var(--mono)', fontSize: 16 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.currency_code || !form.rate_per_usd}>
                {saveMut.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>İptal</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Para Birimi</Th><Th right>1 USD =</Th><Th>Kaynak</Th></tr></thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}
            {rates.map(r => (
              <tr key={r.id}>
                <Td style={{ color: C.text2 }}>{r.date}</Td>
                <Td>
                  <span style={{ fontWeight: 600, color: C.navy, marginRight: 6 }}>{r.currency_code}</span>
                  <span style={{ fontSize: 12, color: C.text3 }}>{curs.find(c => c.code === r.currency_code)?.name_tr}</span>
                </Td>
                <Td right mono style={{ fontSize: 15, fontWeight: 600, color: C.accent }}>{fmt(r.rate_per_usd, 4)} {r.currency_code}</Td>
                <Td><Badge type={r.source?.includes('auto') ? 'auto' : 'manual'}>{r.source?.includes('auto') ? '🤖 Otomatik' : '✍ Manuel'}</Badge></Td>
              </tr>
            ))}
            {!isLoading && !rates.length && (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: C.text3 }}>Kur girilmemiş</td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
