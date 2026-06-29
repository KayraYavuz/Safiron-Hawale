import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { complianceApi } from '../utils/api'
import { useAuthStore } from '../store'
import { Card, CardHeader, Table, Th, Td, Btn, Input, Select, TrHover, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { useLang } from '../hooks/useLang'
import toast from 'react-hot-toast'

const RULE_KEY = { amount: 'flagAmount', watchlist: 'flagWatchlist', structuring: 'flagStructuring' }

function SettingsForm({ settings }) {
  const { t } = useLang()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    aml_threshold_usd: settings?.aml_threshold_usd ?? '0',
    aml_structuring_window_days: settings?.aml_structuring_window_days ?? 1,
  })
  const saveMut = useMutation({
    mutationFn: () => complianceApi.updateSettings({
      aml_threshold_usd: form.aml_threshold_usd,
      aml_structuring_window_days: Number(form.aml_structuring_window_days),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['complianceSettings'] }); toast.success(t.saved) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  return (
    <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <Input label={t.amlThreshold} type="number" value={form.aml_threshold_usd}
             onChange={e => setForm(x => ({ ...x, aml_threshold_usd: e.target.value }))} min={0} style={{ maxWidth: 200 }} />
      <Input label={t.amlWindow} type="number" value={form.aml_structuring_window_days}
             onChange={e => setForm(x => ({ ...x, aml_structuring_window_days: e.target.value }))} min={1} style={{ maxWidth: 160 }} />
      <Btn onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? t.saving : t.save}</Btn>
    </div>
  )
}

export default function Compliance() {
  const { t } = useLang()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'super_admin'].includes(user?.role)
  const canClear = isAdmin || ['manager', 'branch_manager'].includes(user?.role)

  const [statusFilter, setStatusFilter] = useState('open')
  const [wlForm, setWlForm] = useState({ name: '', reason: '' })

  const { data: flags = [], isLoading: flagsLoading } = useQuery({
    queryKey: ['complianceFlags', statusFilter],
    queryFn: () => complianceApi.flags(statusFilter ? { status: statusFilter } : {}).then(r => r.data),
  })
  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'], queryFn: () => complianceApi.watchlist().then(r => r.data),
  })
  const { data: settings } = useQuery({
    queryKey: ['complianceSettings'], queryFn: () => complianceApi.settings().then(r => r.data),
  })

  const clearMut = useMutation({
    mutationFn: (id) => complianceApi.clearFlag(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['complianceFlags'] }); qc.invalidateQueries({ queryKey: ['transactions'] }); toast.success(t.flagCleared) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const addWlMut = useMutation({
    mutationFn: () => complianceApi.addWatchlist(wlForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['watchlist'] }); setWlForm({ name: '', reason: '' }); toast.success(t.saved) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const delWlMut = useMutation({
    mutationFn: (id) => complianceApi.removeWatchlist(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['watchlist'] }); toast.success(t.deleted) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  return (
    <>
      <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Flags report */}
        <Card>
          <CardHeader action={
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 130 }}>
              <option value="open">{t.openFlags}</option>
              <option value="cleared">{t.clearedFlags}</option>
              <option value="">{t.allFlags}</option>
            </Select>
          }>{t.complianceFlags}</CardHeader>
          <Table>
            <thead><tr>
              <Th>{t.txnNo}</Th><Th>{t.date}</Th><Th>{t.flagRule}</Th><Th>{t.flagDetail}</Th><Th>{t.status}</Th><Th />
            </tr></thead>
            <tbody>
              {flagsLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
              {flags.map(f => (
                <TrHover key={f.id}>
                  <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3 }}>{f.txn_number}</span></Td>
                  <Td style={{ fontSize: 12.5, color: C.text2 }}>{f.txn_date}</Td>
                  <Td><span style={{ fontSize: 11.5, fontWeight: 600, color: C.red, background: C.redBg, padding: '2px 7px', borderRadius: 99 }}>
                    {t[RULE_KEY[f.rule]] ?? f.rule}
                  </span></Td>
                  <Td style={{ fontSize: 12.5, color: C.text2 }}>{f.detail}</Td>
                  <Td style={{ fontSize: 12 }}>{f.status === 'open' ? t.openFlags : t.clearedFlags}</Td>
                  <Td right>
                    {f.status === 'open' && canClear && (
                      <Btn variant="ghost" size="sm" onClick={() => clearMut.mutate(f.id)} disabled={clearMut.isPending}>
                        {t.clearFlag}
                      </Btn>
                    )}
                  </Td>
                </TrHover>
              ))}
              {!flagsLoading && !flags.length && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: C.text4, fontSize: 13 }}>{t.noFlags}</td></tr>
              )}
            </tbody>
          </Table>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Watchlist */}
          <Card>
            <CardHeader>{t.complianceWatchlist}</CardHeader>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'flex-end' }}>
                <Input label={t.watchlistName} value={wlForm.name} onChange={e => setWlForm(x => ({ ...x, name: e.target.value }))} />
                <Input label={t.watchlistReason} value={wlForm.reason} onChange={e => setWlForm(x => ({ ...x, reason: e.target.value }))} />
                <Btn onClick={() => addWlMut.mutate()} disabled={addWlMut.isPending || !wlForm.name.trim()}>{t.addToWatchlist}</Btn>
              </div>
            )}
            <Table>
              <thead><tr><Th>{t.watchlistName}</Th><Th>{t.watchlistReason}</Th><Th /></tr></thead>
              <tbody>
                {watchlist.map(w => (
                  <TrHover key={w.id}>
                    <Td style={{ fontWeight: 500 }}>{w.name}{w.name_ar && <span style={{ direction: 'rtl', color: C.text3, marginInlineStart: 6 }}>{w.name_ar}</span>}</Td>
                    <Td style={{ color: C.text2, fontSize: 12.5 }}>{w.reason || '—'}</Td>
                    <Td right>{isAdmin && (
                      <button onClick={() => delWlMut.mutate(w.id)} disabled={delWlMut.isPending}
                              style={{ fontSize: 11.5, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        {t.delete}
                      </button>
                    )}</Td>
                  </TrHover>
                ))}
                {!watchlist.length && (
                  <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: C.text4, fontSize: 13 }}>{t.noWatchlist}</td></tr>
                )}
              </tbody>
            </Table>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>{t.complianceSettings}</CardHeader>
            {settings && (isAdmin
              ? <SettingsForm settings={settings} />
              : <div style={{ padding: 18, fontSize: 13, color: C.text2 }}>
                  {t.amlThreshold}: <strong>${settings.aml_threshold_usd}</strong> · {t.amlWindow}: <strong>{settings.aml_structuring_window_days}</strong>
                </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
