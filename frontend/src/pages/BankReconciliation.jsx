import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountingApi } from '../utils/api'
import { acct } from '../utils/format'
import { Card, CardHeader, Table, Th, Td, TrHover, Select, Info, C } from '../components/UI'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'

const n = (v) => { const x = Number(v); return isFinite(x) ? x : 0 }

export default function BankReconciliation() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [account, setAccount] = useState('')

  const { data: accounts = [] } = useQuery({ queryKey: ['postable-accounts'], queryFn: () => accountingApi.postableAccounts().then(r => r.data) })
  const { data: view } = useQuery({
    queryKey: ['recon', account], queryFn: () => accountingApi.reconcileView(account).then(r => r.data), enabled: !!account,
  })
  const toggleMut = useMutation({
    mutationFn: ({ line_id, reconciled }) => accountingApi.reconcileToggle({ line_id, reconciled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recon', account] }),
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const Stat = ({ label, value, color }) => (
    <div style={{ flex: 1, padding: '12px 16px', border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: C.text3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--mono)', color: color || C.text1 }}>{acct(value, { dashZero: false })}</div>
    </div>
  )

  return (
    <>
      <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t.reconTitle}</h2>
        <Info type="info">{t.reconIntro}</Info>

        <Card>
          <div style={{ padding: 16 }}>
            <Select label={t.reconAccount} value={account} onChange={e => setAccount(e.target.value)} style={{ maxWidth: 380 }}>
              <option value="">{t.coaNone}</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </Select>
          </div>
          {view && (
            <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
              <Stat label={t.reconBook} value={view.book_balance} />
              <Stat label={t.reconReconciled} value={view.reconciled_balance} color={C.green} />
              <Stat label={t.reconUnreconciled} value={view.unreconciled_balance} color={n(view.unreconciled_balance) === 0 ? C.green : C.amber} />
            </div>
          )}
        </Card>

        {view && (
          <Card>
            <CardHeader>{t.reconLines}</CardHeader>
            <Table>
              <thead><tr>
                <Th>{t.reconDone}</Th><Th>{t.jeDate}</Th><Th>{t.fsEntryNo}</Th><Th>{t.jeMemo}</Th>
                <Th right>{t.fsDebit}</Th><Th right>{t.fsCredit}</Th>
              </tr></thead>
              <tbody>
                {view.lines.map(l => (
                  <TrHover key={l.line_id} style={{ background: l.reconciled ? C.greenBg : 'transparent' }}>
                    <Td>
                      <input type="checkbox" checked={l.reconciled}
                        onChange={e => toggleMut.mutate({ line_id: l.line_id, reconciled: e.target.checked })} />
                    </Td>
                    <Td>{l.entry_date}</Td>
                    <Td mono>{l.entry_number}</Td>
                    <Td>{l.memo}</Td>
                    <Td right mono>{n(l.debit_usd) ? acct(l.debit_usd) : ''}</Td>
                    <Td right mono>{n(l.credit_usd) ? acct(l.credit_usd) : ''}</Td>
                  </TrHover>
                ))}
                {view.lines.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: C.text3 }}>—</td></tr>}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </>
  )
}
