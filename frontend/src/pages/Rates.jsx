import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ratesApi, currenciesApi, marginsApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, Table, Th, Td, Badge, Btn, Input, Select, Info, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'
import { useAuthStore } from '../store'

export default function Rates() {
  const { t } = useLang()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'super_admin'].includes(user?.role)
  const today = new Date().toISOString().split('T')[0]
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: today, currency_code: '', rate_per_usd: '' })
  const [marginForm, setMarginForm] = useState({ currency_code: '', pct: '' })

  const { data: rates = [], isLoading } = useQuery({ queryKey: ['rates'],      queryFn: () => ratesApi.list({}).then(r => r.data) })
  const { data: curs  = [] }            = useQuery({ queryKey: ['currencies'], queryFn: () => currenciesApi.list().then(r => r.data) })

  const saveMut = useMutation({
    mutationFn: ratesApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['rates', 'position'] }); setShowForm(false); toast.success(t.rateSaved) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const autoMut = useMutation({
    mutationFn: ratesApi.autoUpdate,
    onSuccess:  r  => { qc.invalidateQueries({ queryKey: ['rates', 'position'] }); toast.success(`✅ ${r.data.saved} ${t.rateUpdated}`) },
    onError:    e  => toast.error(e.response?.data?.detail || t.apiError),
  })

  const { data: margins = [] } = useQuery({ queryKey: ['margins'], queryFn: () => marginsApi.list().then(r => r.data) })
  const marginUpsert = useMutation({
    mutationFn: () => marginsApi.upsert({ currency_code: marginForm.currency_code, margin_pct: Number(marginForm.pct) / 100 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['margins'] }); setMarginForm({ currency_code: '', pct: '' }); toast.success(t.saved) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const marginDelete = useMutation({
    mutationFn: (code) => marginsApi.remove(code),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['margins'] }); toast.success(t.deleted) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Auto-update banner */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px 18px', background: 'white', borderRadius: 12, border: `1px solid ${C.border}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.autoRateUpdate}</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{t.autoRateDesc}</div>
        </div>
        <Btn variant="accent" onClick={() => autoMut.mutate()} disabled={autoMut.isPending}>
          {autoMut.isPending
            ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(13,27,46,0.3)', borderTopColor: C.navy, borderRadius: '50%' }} className="spinning" /> {t.updating}</>
            : <><Icon name="refresh" size={14} color={C.navy} /> {t.updateNow}</>
          }
        </Btn>
        <Btn onClick={() => setShowForm(!showForm)}><Icon name="plus" size={14} color="white" /> {t.manualRate}</Btn>
      </div>

      <Info type="warning">{t.rateWarning}</Info>

      {showForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>{t.manualRateEntry}</div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label={t.date} type="date" value={form.date} onChange={e => setForm(x => ({ ...x, date: e.target.value }))} />
              <Select label={t.currencySelect} value={form.currency_code} onChange={e => setForm(x => ({ ...x, currency_code: e.target.value }))}>
                <option value="">{t.selectPlaceholder}</option>
                {curs.filter(c => c.code !== 'USD').sort((a, b) => a.code.localeCompare(b.code)).map(c =>
                  <option key={c.id} value={c.code}>{c.code} — {c.name_tr}</option>
                )}
              </Select>
              <div style={{ gridColumn: '1/-1' }}>
                <Input
                  label={`${t.rateLabel}${form.currency_code ? ` — 1 USD = ? ${form.currency_code}` : ''}`}
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
                {saveMut.isPending ? t.saving : t.save}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>{t.cancel}</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <thead><tr><Th>{t.date}</Th><Th>{t.currencySelect}</Th><Th right>1 USD =</Th><Th>{t.source}</Th></tr></thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}
            {rates.map(r => (
              <tr key={r.id}>
                <Td style={{ color: C.text2 }}>{r.date}</Td>
                <Td>
                  <span style={{ fontWeight: 600, color: C.navy, marginInlineEnd: 6 }}>{r.currency_code}</span>
                  <span style={{ fontSize: 12, color: C.text3 }}>{curs.find(c => c.code === r.currency_code)?.name_tr}</span>
                </Td>
                <Td right mono style={{ fontSize: 15, fontWeight: 600, color: C.accent }}>{fmt(r.rate_per_usd, 4)} {r.currency_code}</Td>
                <Td><Badge type={r.source?.includes('auto') ? 'auto' : 'manual'}>{r.source?.includes('auto') ? t.auto : t.manual}</Badge></Td>
              </tr>
            ))}
            {!isLoading && !rates.length && (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: C.text3 }}>{t.noRateYet}</td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ── Currency margins ── */}
      <Card>
        <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.currencyMargins}</div>
          <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{t.marginHint}</div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${C.border}`, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Select label={t.currencySelect} value={marginForm.currency_code}
                    onChange={e => setMarginForm(x => ({ ...x, currency_code: e.target.value }))} style={{ minWidth: 150 }}>
              <option value="">{t.selectPlaceholder}</option>
              {curs.filter(c => c.code !== 'USD').sort((a, b) => a.code.localeCompare(b.code)).map(c =>
                <option key={c.id} value={c.code}>{c.code} — {c.name_tr}</option>)}
            </Select>
            <Input label={t.marginPct} type="number" step="0.01" value={marginForm.pct}
                   onChange={e => setMarginForm(x => ({ ...x, pct: e.target.value }))} placeholder="1.5" style={{ maxWidth: 120 }} />
            <Btn onClick={() => marginUpsert.mutate()} disabled={marginUpsert.isPending || !marginForm.currency_code || marginForm.pct === ''}>
              {t.addMargin}
            </Btn>
          </div>
        )}
        <Table>
          <thead><tr><Th>{t.currencySelect}</Th><Th right>{t.marginPct}</Th><Th /></tr></thead>
          <tbody>
            {margins.map(m => (
              <tr key={m.currency_code}>
                <Td style={{ fontWeight: 600, color: C.navy }}>{m.currency_code}</Td>
                <Td right mono>{fmt(Number(m.margin_pct) * 100, 2)}%</Td>
                <Td right>{isAdmin && (
                  <button onClick={() => marginDelete.mutate(m.currency_code)} disabled={marginDelete.isPending}
                          style={{ fontSize: 11.5, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    {t.delete}
                  </button>
                )}</Td>
              </tr>
            ))}
            {!margins.length && (
              <tr><td colSpan={3} style={{ padding: 28, textAlign: 'center', color: C.text4, fontSize: 13 }}>{t.noMargins}</td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
