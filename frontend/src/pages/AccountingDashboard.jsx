import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { accountingApi, transactionsApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, CardHeader, Table, Th, Td, TrHover, Badge, StatCard, C } from '../components/UI'
import { Icon } from '../components/Icons'
import { STALE_2MIN } from '../constants'
import { useLang } from '../hooks/useLang'

const n = (v) => { const x = Number(v); return isFinite(x) ? x : 0 }

export default function AccountingDashboard() {
  const { t } = useLang()

  const { data: gl } = useQuery({ queryKey: ['glSummary'], queryFn: () => accountingApi.glSummary().then(r => r.data), staleTime: STALE_2MIN, retry: false })
  const { data: aged } = useQuery({ queryKey: ['agedDash'], queryFn: () => accountingApi.agedBalance({}).then(r => r.data), staleTime: STALE_2MIN, retry: false })
  const { data: entries = [] } = useQuery({ queryKey: ['journalDash'], queryFn: () => accountingApi.journal({ limit: 8 }).then(r => r.data), staleTime: STALE_2MIN, retry: false })
  const { data: pending = [] } = useQuery({ queryKey: ['pendingTxns'], queryFn: () => transactionsApi.list({ status: 'pending' }).then(r => r.data), staleTime: STALE_2MIN, retry: false })

  const { receivable, payable } = useMemo(() => {
    let r = 0, p = 0
    ;(aged?.rows || []).forEach(x => { const tot = n(x.total); if (tot >= 0) r += tot; else p += -tot })
    return { receivable: r, payable: p }
  }, [aged])

  const cards = [
    { to: '/financial-statements', key: 'fsTrialBalance', icon: 'reports' },
    { to: '/financial-statements', key: 'fsBalanceSheet', icon: 'building' },
    { to: '/financial-statements', key: 'fsIncomeStatement', icon: 'trendUp' },
    { to: '/journal', key: 'journal', icon: 'reports' },
    { to: '/chart-of-accounts', key: 'chartOfAccounts', icon: 'briefcase' },
    { to: '/financial-statements', key: 'fsAged', icon: 'calendar' },
  ]

  if (gl && !gl.initialised) {
    return (
      <>
        <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
        <Card><div style={{ padding: 28, textAlign: 'center', color: C.text3 }}>
          {t.coaInitDesc} <Link to="/chart-of-accounts" style={{ color: C.navy }}>{t.chartOfAccounts}</Link>
        </div></Card>
      </>
    )
  }

  return (
    <>
      <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t.accountingDash}</h2>

        {/* Metrics */}
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <StatCard label={t.glEntries} value={gl?.entry_count ?? 0}
            sub={gl?.balanced ? t.glBalanced : t.glUnbalanced} color={gl?.balanced ? C.green : C.red}
            icon={({ size, color }) => <Icon name="reports" size={size} color={color} />} />
          <StatCard label={t.fsNetIncome} value={`$${fmt(gl?.net_income ?? 0, 0)}`}
            sub={t.fsIncomeStatement} color={n(gl?.net_income) >= 0 ? C.green : C.red}
            icon={({ size, color }) => <Icon name="trendUp" size={size} color={color} />} />
          <StatCard label={t.fsReceivable} value={`$${fmt(receivable, 0)}`}
            sub={t.fsAged} color={C.blue}
            icon={({ size, color }) => <Icon name="dollarSign" size={size} color={color} />} />
          <StatCard label={t.fsPayable} value={`$${fmt(payable, 0)}`}
            sub={t.fsAged} color={C.amber}
            icon={({ size, color }) => <Icon name="briefcase" size={size} color={color} />} />
        </div>

        {/* Pending + quick access */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card>
            <CardHeader>{t.accountingQuick}</CardHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 16 }}>
              {cards.map((c, i) => (
                <Link key={i} to={c.to} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 10, textDecoration: 'none', color: C.text1, fontSize: 13, fontWeight: 500 }}>
                  <Icon name={c.icon} size={16} color={C.navy} /> {t[c.key]}
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader action={pending.length ? <Badge type="pending" dot>{pending.length}</Badge> : null}>{t.accountingPending}</CardHeader>
            {pending.length === 0
              ? <div style={{ padding: 20, color: C.text3, fontSize: 13 }}>{t.accountingNoPending}</div>
              : <Table>
                  <thead><tr><Th>{t.fsEntryNo}</Th><Th>{t.coaType}</Th><Th right>{t.jeDate}</Th></tr></thead>
                  <tbody>
                    {pending.slice(0, 6).map(p => (
                      <TrHover key={p.id}><Td mono>{p.txn_number}</Td><Td>{p.txn_type}</Td><Td right>{p.txn_date}</Td></TrHover>
                    ))}
                  </tbody>
                </Table>}
          </Card>
        </div>

        {/* Recent journal entries */}
        <Card>
          <CardHeader action={<Link to="/journal" style={{ fontSize: 12, color: C.text3, textDecoration: 'none' }}>{t.viewAll}</Link>}>{t.journal}</CardHeader>
          <Table>
            <thead><tr><Th>{t.fsEntryNo}</Th><Th>{t.jeDate}</Th><Th>{t.jeMemo}</Th><Th>{t.jeStatus || ''}</Th></tr></thead>
            <tbody>
              {entries.map(e => (
                <TrHover key={e.id}>
                  <Td mono>{e.entry_number}</Td>
                  <Td>{e.entry_date}</Td>
                  <Td>{e.memo}</Td>
                  <Td><Badge type={e.status === 'posted' ? 'completed' : 'cancelled'}>{e.status === 'posted' ? t.jePosted : t.jeVoided}</Badge></Td>
                </TrHover>
              ))}
              {entries.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: C.text3, fontSize: 13 }}>{t.jeEmpty}</td></tr>}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
