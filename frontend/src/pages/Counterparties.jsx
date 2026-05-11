import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { counterpartiesApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, Table, Th, Td, Badge, Btn, Input, Select, TrHover, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { getCpTypeLabel, STALE_2MIN } from '../constants'
import { useLang } from '../hooks/useLang'

const BLANK_CP = { name: '', name_ar: '', type: 'customer', country: '', phone: '', credit_limit_usd: 0 }

export default function Counterparties() {
  const { t } = useLang()
  const CP_TYPE_LABEL = getCpTypeLabel(t)
  const qc = useQueryClient()
  const [editId,   setEditId]   = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(BLANK_CP)
  const [search,   setSearch]   = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['counterparties'],
    queryFn:  () => counterpartiesApi.list({}).then(r => r.data),
    staleTime: STALE_2MIN,
  })

  const onSuccess = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['counterparties'] })
    setShowForm(false); setEditId(null); setForm(BLANK_CP)
    toast.success(t.saved)
  }, [qc, t])

  const createMut = useMutation({ mutationFn: counterpartiesApi.create,                          onSuccess, onError: e => toast.error(e.response?.data?.detail || t.error) })
  const updateMut = useMutation({ mutationFn: ({ id, ...d }) => counterpartiesApi.update(id, d), onSuccess, onError: e => toast.error(e.response?.data?.detail || t.error) })
  const deleteMut = useMutation({
    mutationFn: counterpartiesApi.delete,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['counterparties'] }); toast.success(t.deleted) },
    onError:    e  => toast.error(e.response?.data?.detail || t.cannotDelete),
  })

  const handleDelete = useCallback((e, cp) => {
    e.stopPropagation()
    if (window.confirm(`"${cp.name}" ${t.deactivateConfirm}`)) deleteMut.mutate(cp.id)
  }, [deleteMut, t])

  const openNew  = useCallback(() => { setForm(BLANK_CP); setEditId(null); setShowForm(true) }, [])
  const openEdit = useCallback((cp) => {
    setForm({ name: cp.name, name_ar: cp.name_ar || '', type: cp.type, country: cp.country || '', phone: cp.phone || '', credit_limit_usd: cp.credit_limit_usd || 0 })
    setEditId(cp.id); setShowForm(true)
  }, [])

  const handleSave = useCallback(() =>
    editId ? updateMut.mutate({ id: editId, ...form }) : createMut.mutate(form),
    [editId, form, updateMut, createMut]
  )
  const isPending = createMut.isPending || updateMut.isPending

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(cp =>
      cp.name?.toLowerCase().includes(q) ||
      (cp.name_ar || '').includes(search) ||
      cp.code?.toLowerCase().includes(q)
    )
  }, [data, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'var(--font)', outline: 'none' }}
        />
        <Btn onClick={openNew}><Icon name="plus" size={14} color="white" /> {t.new}</Btn>
      </div>

      {showForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>
            {editId ? t.edit : t.newCounterparty}
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label={t.nameLabel}      value={form.name}             onChange={e => setForm(x => ({ ...x, name: e.target.value }))}                         placeholder="Ahmed Al-Rashidi" />
              <Input label={t.nameArLabel}    value={form.name_ar}          onChange={e => setForm(x => ({ ...x, name_ar: e.target.value }))}                      placeholder="أحمد الراشدي" style={{ direction: 'rtl' }} />
              <Select label={t.typeLabel}     value={form.type}             onChange={e => setForm(x => ({ ...x, type: e.target.value }))}>
                <option value="customer">{t.customer}</option>
                <option value="supplier">{t.supplier}</option>
                <option value="both">{t.both}</option>
                <option value="founder">{t.founder}</option>
              </Select>
              <Input label={t.country3}      value={form.country}          onChange={e => setForm(x => ({ ...x, country: e.target.value.toUpperCase() }))}        placeholder="EGY" maxLength={3} />
              <Input label={t.phone}         value={form.phone}            onChange={e => setForm(x => ({ ...x, phone: e.target.value }))}                        placeholder="+20 123 456 7890" />
              <Input label={t.creditLimit}   type="number" value={form.credit_limit_usd} onChange={e => setForm(x => ({ ...x, credit_limit_usd: e.target.value }))} min={0} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn onClick={handleSave} disabled={isPending || !form.name.trim()}>
                {isPending ? t.saving : editId ? t.update : t.save}
              </Btn>
              <Btn variant="ghost" onClick={() => { setShowForm(false); setEditId(null) }}>{t.cancel}</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <thead><tr><Th>{t.code}</Th><Th>{t.nameLabel}</Th><Th>{t.arabic}</Th><Th>{t.typeLabel}</Th><Th>{t.countryCol}</Th><Th right>{t.creditLimitCol}</Th><Th /></tr></thead>
          <tbody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}
            {filtered.map(cp => (
              <TrHover key={cp.id} onClick={() => openEdit(cp)}>
                <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3 }}>{cp.code}</span></Td>
                <Td style={{ fontWeight: 500 }}>{cp.name}</Td>
                <Td style={{ direction: 'rtl', color: C.text2 }}>{cp.name_ar || '—'}</Td>
                <Td><Badge type={cp.type} dot>{CP_TYPE_LABEL[cp.type] ?? cp.type}</Badge></Td>
                <Td style={{ color: C.text2 }}>{cp.country || '—'}</Td>
                <Td right mono>${fmt(cp.credit_limit_usd, 0)}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, color: C.text3 }}>{t.edit}</span>
                    <span style={{ color: C.border }}>·</span>
                    <Link to={`/reports?tab=statement&cp=${cp.id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11.5, color: C.blue, textDecoration: 'none' }}>{t.statement}</Link>
                    <span style={{ color: C.border }}>·</span>
                    <button
                      onClick={e => handleDelete(e, cp)}
                      disabled={deleteMut.isPending}
                      style={{ fontSize: 11.5, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', padding: 0, opacity: deleteMut.isPending ? 0.5 : 1 }}
                    >{t.delete}</button>
                  </div>
                </Td>
              </TrHover>
            ))}
            {!isLoading && !filtered.length && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.text4 }}>
                {search ? t.noSearchResult : t.noRecordYet}
              </td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
