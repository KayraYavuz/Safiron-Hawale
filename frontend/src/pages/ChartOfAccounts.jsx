import { useState, useMemo, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountingApi } from '../utils/api'
import { useAuthStore } from '../store'
import { Card, CardHeader, Table, Th, Td, Btn, Input, Select, TrHover, Badge, Info, C } from '../components/UI'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'

const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense']
const ROLES = [
  'cash', 'bank', 'crypto', 'customer_receivable', 'customer_payable',
  'supplier_receivable', 'supplier_payable', 'fx_profit', 'fx_loss',
  'commission_income', 'retained_earnings', 'opening_balance_equity',
  'internal_transfer_clearing', 'rounding', 'tax_payable',
]
const BLANK = { code: '', name_tr: '', name_ar: '', name_en: '', account_type: 'asset', parent_id: '', is_postable: true }

export default function ChartOfAccounts() {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'super_admin', 'accounting'].includes(user?.role)

  const [scheme,  setScheme]  = useState('thp')
  const [form,    setForm]    = useState(BLANK)
  const [editId,  setEditId]  = useState(null)
  const [showForm, setShowForm] = useState(false)

  const { data: chart = [], isLoading } = useQuery({
    queryKey: ['coa-chart'], queryFn: () => accountingApi.chart().then(r => r.data),
  })
  const { data: mappings = [] } = useQuery({
    queryKey: ['coa-mappings'], queryFn: () => accountingApi.mappings().then(r => r.data),
    enabled: chart.length > 0,
  })

  const initMut = useMutation({
    mutationFn: () => accountingApi.initialize(scheme),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coa-chart'] }); qc.invalidateQueries({ queryKey: ['coa-mappings'] }); toast.success(t.coaInitialized) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const saveMut = useMutation({
    mutationFn: (payload) => editId ? accountingApi.updateAcc(editId, payload) : accountingApi.createAcc(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coa-chart'] })
      setShowForm(false); setForm(BLANK); setEditId(null)
      toast.success(editId ? t.coaAccountUpdated : t.coaAccountCreated)
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const delMut = useMutation({
    mutationFn: accountingApi.deleteAcc,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coa-chart'] }); toast.success(t.coaAccountDeleted) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const mapMut = useMutation({
    mutationFn: accountingApi.setMapping,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coa-mappings'] }); toast.success(t.coaSaved) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const { data: taxData } = useQuery({
    queryKey: ['coa-tax-rate'], queryFn: () => accountingApi.taxRate().then(r => r.data),
    enabled: chart.length > 0,
  })
  const [taxPct, setTaxPct] = useState(null)
  const taxValue = taxPct !== null ? taxPct : (taxData ? String(+(Number(taxData.rate) * 100).toFixed(2)) : '')
  const taxMut = useMutation({
    mutationFn: () => accountingApi.setTaxRate((Number(taxValue || 0) / 100).toFixed(4)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coa-tax-rate'] }); setTaxPct(null); toast.success(t.coaSaved) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const nameOf = useCallback((a) => a[`name_${lang}`] || a.name_tr, [lang])

  // depth for indentation, derived from parent chain
  const { ordered, depthMap, postable } = useMemo(() => {
    const byId = Object.fromEntries(chart.map(a => [a.id, a]))
    const depth = {}
    const d = (a) => {
      if (depth[a.id] != null) return depth[a.id]
      depth[a.id] = a.parent_id && byId[a.parent_id] ? d(byId[a.parent_id]) + 1 : 0
      return depth[a.id]
    }
    chart.forEach(d)
    const ord = [...chart].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    return { ordered: ord, depthMap: depth, postable: chart.filter(a => a.is_postable) }
  }, [chart])

  const mapValue = useCallback((role) => mappings.find(m => m.role === role)?.coa_account_id || '', [mappings])

  const startEdit = useCallback((a) => {
    setEditId(a.id)
    setForm({ code: a.code, name_tr: a.name_tr, name_ar: a.name_ar, name_en: a.name_en, account_type: a.account_type, parent_id: a.parent_id || '', is_postable: a.is_postable })
    setShowForm(true)
  }, [])

  const submit = useCallback(() => {
    const payload = editId
      ? { name_tr: form.name_tr, name_ar: form.name_ar, name_en: form.name_en, is_postable: form.is_postable, parent_id: form.parent_id || null }
      : { ...form, parent_id: form.parent_id || null }
    saveMut.mutate(payload)
  }, [editId, form, saveMut])

  // ── Empty state: scheme picker ──────────────────────────────────────────────
  if (!isLoading && chart.length === 0) {
    return (
      <>
        <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
        <Card>
          <CardHeader>{t.coaInitTitle}</CardHeader>
          <div style={{ padding: 24, maxWidth: 560 }}>
            <p style={{ color: C.text3, fontSize: 13, marginBottom: 18 }}>{t.coaInitDesc}</p>
            <div style={{ display: 'grid', gap: 12 }}>
              {[['thp', t.coaSchemeThp, t.coaSchemeThpDesc], ['intl', t.coaSchemeIntl, t.coaSchemeIntlDesc]].map(([val, label, desc]) => (
                <label key={val} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, border: `1px solid ${scheme === val ? C.navy : C.border}`, borderRadius: 10, cursor: 'pointer', background: scheme === val ? C.surface2 : 'white' }}>
                  <input type="radio" name="scheme" value={val} checked={scheme === val} onChange={() => setScheme(val)} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                    <div style={{ fontSize: 12, color: C.text3 }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <Btn onClick={() => initMut.mutate()} disabled={initMut.isPending || !isAdmin}>
                <Icon name="plus" size={14} color="white" /> {t.coaInitialize}
              </Btn>
            </div>
          </div>
        </Card>
      </>
    )
  }

  const typeLabel = (ty) => t[`coaType${ty.charAt(0).toUpperCase()}${ty.slice(1)}`] || ty

  return (
    <>
      <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t.coaTitle}</h2>
            <div style={{ fontSize: 12, color: C.text3 }}>{t.coaSubtitle}</div>
          </div>
          {isAdmin && (
            <Btn onClick={() => { setEditId(null); setForm(BLANK); setShowForm(!showForm) }}>
              <Icon name="plus" size={14} color="white" /> {t.coaNewAccount}
            </Btn>
          )}
        </div>

        <Info type="info">{t.coaIntro}</Info>

        {isAdmin && showForm && (
          <Card>
            <CardHeader>{editId ? t.coaEditAccount : t.coaNewAccount}</CardHeader>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label={t.coaCode} value={form.code} disabled={!!editId} onChange={e => setForm(x => ({ ...x, code: e.target.value }))} placeholder="100" />
              <Select label={t.coaType} value={form.account_type} disabled={!!editId} onChange={e => setForm(x => ({ ...x, account_type: e.target.value }))}>
                {TYPES.map(ty => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
              </Select>
              <Input label={`${t.coaName} (TR)`} value={form.name_tr} onChange={e => setForm(x => ({ ...x, name_tr: e.target.value }))} />
              <Input label={`${t.coaName} (EN)`} value={form.name_en} onChange={e => setForm(x => ({ ...x, name_en: e.target.value }))} />
              <Input label={`${t.coaName} (AR)`} value={form.name_ar} onChange={e => setForm(x => ({ ...x, name_ar: e.target.value }))} />
              <Select label={t.coaParent} value={form.parent_id} onChange={e => setForm(x => ({ ...x, parent_id: e.target.value }))}>
                <option value="">{t.coaNone}</option>
                {ordered.filter(a => !a.is_postable && a.id !== editId).map(a => <option key={a.id} value={a.id}>{a.code} · {nameOf(a)}</option>)}
              </Select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.is_postable} onChange={e => setForm(x => ({ ...x, is_postable: e.target.checked }))} /> {t.coaPostable}
              </label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Btn variant="ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(BLANK) }}>{t.cancel}</Btn>
                <Btn onClick={submit} disabled={saveMut.isPending || !form.code || !form.name_tr}>{t.save}</Btn>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text1 }}>{t.coaTitle}</div>
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>
              {chart[0]?.scheme === 'intl' ? t.coaSchemeIntl : t.coaSchemeThp}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font)' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 14px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text3, borderBottom: `2px solid ${C.text1}`, textAlign: 'left', width: 110 }}>{t.coaCode}</th>
                  <th style={{ padding: '8px 14px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text3, borderBottom: `2px solid ${C.text1}`, textAlign: 'left' }}>{t.coaName}</th>
                  <th style={{ padding: '8px 14px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text3, borderBottom: `2px solid ${C.text1}`, textAlign: 'left' }}>{t.coaType}</th>
                  {isAdmin && <th className="no-print" style={{ borderBottom: `2px solid ${C.text1}`, width: 70 }} />}
                </tr>
              </thead>
              <tbody>
                {ordered.map(a => {
                  const header = !a.is_postable
                  const depth = depthMap[a.id] || 0
                  return (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${C.surface3}`, background: header ? C.surface3 : 'transparent' }}>
                      <td style={{ padding: '6px 14px', fontFamily: 'var(--mono)', fontSize: 12.5, color: header ? C.text1 : C.text2, fontWeight: header ? 700 : 400 }}>{a.code}</td>
                      <td style={{ padding: '6px 14px', fontSize: 13 }}>
                        <span style={{ paddingInlineStart: depth * 20, fontWeight: header ? 700 : 400, textTransform: header ? 'uppercase' : 'none', letterSpacing: header ? '0.02em' : 0, fontSize: header ? 12 : 13 }}>{nameOf(a)}</span>
                      </td>
                      <td style={{ padding: '6px 14px', fontSize: 11.5, color: C.text3 }}>{typeLabel(a.account_type)}</td>
                      {isAdmin && (
                        <td className="no-print" style={{ padding: '6px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => startEdit(a)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title={t.edit}><Icon name="edit" size={14} color={C.navy} /></button>
                          <button onClick={() => window.confirm(`"${nameOf(a)}" ${t.coaDeleteConfirm}`) && delMut.mutate(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginInlineStart: 8 }} title={t.delete}><Icon name="trash" size={14} color={C.red} /></button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Commission tax (KDV/BSMV) */}
        <Card>
          <CardHeader>{t.coaTaxTitle}</CardHeader>
          <div style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Input label={t.coaTaxRate} value={taxValue} disabled={!isAdmin}
                   onChange={e => setTaxPct(e.target.value)} placeholder="0" style={{ width: 120 }} />
            <span style={{ fontSize: 14, paddingBottom: 10 }}>%</span>
            {isAdmin && <Btn onClick={() => taxMut.mutate()} disabled={taxMut.isPending}>{t.save}</Btn>}
            <div style={{ flexBasis: '100%', fontSize: 12, color: C.text3 }}>{t.coaTaxHint}</div>
          </div>
        </Card>

        {/* Role mappings */}
        <Card>
          <CardHeader>{t.coaMappings}</CardHeader>
          <div style={{ padding: '12px 18px 4px', fontSize: 12.5, color: C.text2 }}>{t.coaRolesHelp}</div>
          <Table>
            <thead><tr><Th>{t.coaRole}</Th><Th>{t.coaAccount}</Th></tr></thead>
            <tbody>
              {ROLES.map(role => (
                <TrHover key={role}>
                  <Td>
                    <div style={{ fontWeight: 500 }}>{t.coaRoles?.[role] || role}</div>
                    <div style={{ fontSize: 10.5, color: C.text4, fontFamily: 'var(--mono)' }}>{role}</div>
                  </Td>
                  <Td>
                    <Select
                      value={mapValue(role)}
                      disabled={!isAdmin}
                      onChange={e => mapMut.mutate({ role, coa_account_id: e.target.value })}
                      style={{ minWidth: 240 }}
                    >
                      <option value="">{t.coaNone}</option>
                      {postable.map(a => <option key={a.id} value={a.id}>{a.code} · {nameOf(a)}</option>)}
                    </Select>
                  </Td>
                </TrHover>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
