import { useState, useMemo, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountingApi } from '../utils/api'
import { fmt } from '../utils/format'
import { useAuthStore } from '../store'
import { Card, CardHeader, Table, Th, Td, Btn, Input, Select, TrHover, Badge, Info, C } from '../components/UI'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'

const BLANK_LINE = () => ({ coa_account_id: '', debit_usd: '', credit_usd: '' })
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0 }

export default function Journal() {
  const { t } = useLang()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'super_admin', 'accounting'].includes(user?.role)

  const [showForm, setShowForm] = useState(false)
  const [memo, setMemo] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState([BLANK_LINE(), BLANK_LINE()])

  const { data: entries = [] } = useQuery({
    queryKey: ['journal'], queryFn: () => accountingApi.journal().then(r => r.data),
  })
  const { data: postable = [] } = useQuery({
    queryKey: ['postable-accounts'], queryFn: () => accountingApi.postableAccounts().then(r => r.data),
  })

  const accName = useMemo(() => {
    const m = {}
    postable.forEach(a => { m[a.id] = `${a.code} · ${a.name}` })
    return m
  }, [postable])

  const createMut = useMutation({
    mutationFn: accountingApi.createJournal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal'] })
      setShowForm(false); setMemo(''); setLines([BLANK_LINE(), BLANK_LINE()])
      toast.success(t.jeSaved)
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const voidMut = useMutation({
    mutationFn: accountingApi.voidJournal,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journal'] }); toast.success(t.jeVoided) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const totalDr = useMemo(() => lines.reduce((s, l) => s + num(l.debit_usd), 0), [lines])
  const totalCr = useMemo(() => lines.reduce((s, l) => s + num(l.credit_usd), 0), [lines])
  const balanced = Math.abs(totalDr - totalCr) < 0.005 && totalDr > 0
  const validLines = lines.filter(l => l.coa_account_id && (num(l.debit_usd) > 0 || num(l.credit_usd) > 0))

  const setLine = useCallback((i, patch) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l)), [])
  const addLine = useCallback(() => setLines(ls => [...ls, BLANK_LINE()]), [])
  const removeLine = useCallback((i) => setLines(ls => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls), [])

  const submit = useCallback(() => {
    createMut.mutate({
      entry_date: entryDate,
      memo: memo || null,
      lines: validLines.map(l => ({
        coa_account_id: l.coa_account_id,
        debit_usd: num(l.debit_usd).toFixed(4),
        credit_usd: num(l.credit_usd).toFixed(4),
      })),
    })
  }, [createMut, entryDate, memo, validLines])

  return (
    <>
      <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t.jeTitle}</h2>
          {isAdmin && (
            <Btn onClick={() => setShowForm(s => !s)}>
              <Icon name="plus" size={14} color="white" /> {t.jeManualEntry}
            </Btn>
          )}
        </div>

        <Info type="info">{t.jeIntro}</Info>

        {isAdmin && showForm && (
          <Card>
            <CardHeader>{t.jeManualEntry}</CardHeader>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
                <Input label={t.jeDate} type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                <Input label={t.jeMemo} value={memo} onChange={e => setMemo(e.target.value)} />
              </div>
              <Table>
                <thead><tr><Th>{t.jeAccount}</Th><Th right>{t.jeDebit}</Th><Th right>{t.jeCredit}</Th><Th /></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <Td>
                        <Select value={l.coa_account_id} onChange={e => setLine(i, { coa_account_id: e.target.value })} style={{ minWidth: 220 }}>
                          <option value="">{t.coaNone}</option>
                          {postable.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                        </Select>
                      </Td>
                      <Td right><Input value={l.debit_usd} onChange={e => setLine(i, { debit_usd: e.target.value, credit_usd: '' })} placeholder="0.00" style={{ width: 110, textAlign: 'right' }} /></Td>
                      <Td right><Input value={l.credit_usd} onChange={e => setLine(i, { credit_usd: e.target.value, debit_usd: '' })} placeholder="0.00" style={{ width: 110, textAlign: 'right' }} /></Td>
                      <Td right>
                        <button onClick={() => removeLine(i)} disabled={lines.length <= 2} style={{ background: 'none', border: 'none', cursor: lines.length > 2 ? 'pointer' : 'not-allowed' }}>
                          <Icon name="trash" size={14} color={C.text3} />
                        </button>
                      </Td>
                    </tr>
                  ))}
                  <tr>
                    <Td><Btn variant="ghost" size="sm" onClick={addLine}><Icon name="plus" size={12} color={C.navy} /> {t.jeAddLine}</Btn></Td>
                    <Td right mono style={{ fontWeight: 700 }}>{fmt(totalDr)}</Td>
                    <Td right mono style={{ fontWeight: 700 }}>{fmt(totalCr)}</Td>
                    <Td />
                  </tr>
                </tbody>
              </Table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge type={balanced ? 'completed' : 'cancelled'}>{balanced ? t.jeBalanced : t.jeNotBalanced}</Badge>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn variant="ghost" onClick={() => setShowForm(false)}>{t.cancel}</Btn>
                  <Btn onClick={submit} disabled={!balanced || validLines.length < 2 || createMut.isPending}>{t.save}</Btn>
                </div>
              </div>
            </div>
          </Card>
        )}

        {entries.map(e => {
          const dr = e.lines.reduce((s, l) => s + num(l.debit_usd), 0)
          const cr = e.lines.reduce((s, l) => s + num(l.credit_usd), 0)
          return (
            <Card key={e.id}>
              <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{e.entry_number}</span>
                  <span style={{ fontSize: 12, color: C.text3 }}>{e.entry_date}</span>
                  <Badge type="customer">{t.jeSourceTypes?.[e.source_type] || e.source_type}</Badge>
                  <Badge type={e.status === 'posted' ? 'completed' : 'cancelled'}>{e.status === 'posted' ? t.jePosted : t.jeVoided}</Badge>
                  {e.memo && <span style={{ fontSize: 12, color: C.text2 }}>· {e.memo}</span>}
                </div>
                {isAdmin && e.status === 'posted' && (
                  <button onClick={() => window.confirm(t.jeVoidConfirm) && voidMut.mutate(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 12 }}>{t.jeVoid}</button>
                )}
              </div>
              <Table>
                <thead><tr><Th>{t.jeAccount}</Th><Th right>{t.jeDebit}</Th><Th right>{t.jeCredit}</Th></tr></thead>
                <tbody>
                  {e.lines.map(l => (
                    <TrHover key={l.id}>
                      <Td>{accName[l.coa_account_id] || l.coa_account_id}</Td>
                      <Td right mono>{num(l.debit_usd) ? fmt(l.debit_usd) : ''}</Td>
                      <Td right mono>{num(l.credit_usd) ? fmt(l.credit_usd) : ''}</Td>
                    </TrHover>
                  ))}
                  <tr>
                    <Td style={{ fontWeight: 700 }}>{t.jeTotal}</Td>
                    <Td right mono style={{ fontWeight: 700 }}>{fmt(dr)}</Td>
                    <Td right mono style={{ fontWeight: 700 }}>{fmt(cr)}</Td>
                  </tr>
                </tbody>
              </Table>
            </Card>
          )
        })}

        {entries.length === 0 && (
          <Card><div style={{ padding: 28, textAlign: 'center', color: C.text3, fontSize: 13 }}>{t.jeEmpty}</div></Card>
        )}
      </div>
    </>
  )
}
