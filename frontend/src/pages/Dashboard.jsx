import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, CardHeader, Table, Th, Td, Badge, StatCard, TrHover, C } from '../components/UI'
import { Skeleton, SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import { STALE_30S, STALE_2MIN, getStatusLabel, getTxnTypeLabel } from '../constants'
import { useLang } from '../hooks/useLang'

// ── ViewLink — stable, no props that change per render ────────────────────────
function ViewLink({ to, label }) {
  return (
    <Link
      to={to}
      className="view-link"
      style={{
        fontSize: 12, color: C.text3, textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 500,
      }}
    >
      {label} <Icon name="arrowRight" size={12} color="currentColor" />
    </Link>
  )
}

export default function Dashboard() {
  const { t } = useLang()
  const STATUS_LABEL   = getStatusLabel(t)
  const TXN_TYPE_LABEL = getTxnTypeLabel(t)

  const { data: pos,     isLoading: posLoading  } = useQuery({ queryKey: ['position'],    queryFn: () => reportsApi.position().then(r => r.data),          staleTime: STALE_30S  })
  const { data: income,  isLoading: incLoading  } = useQuery({ queryKey: ['income'],      queryFn: () => reportsApi.incomeStatement({}).then(r => r.data), staleTime: STALE_2MIN })
  const { data: locPnl,  isLoading: locLoading  } = useQuery({ queryKey: ['locPnl'],      queryFn: () => reportsApi.locationPnl({}).then(r => r.data),     staleTime: STALE_2MIN })
  const { data: cashMov, isLoading: cashLoading } = useQuery({ queryKey: ['cashMovDash'], queryFn: () => reportsApi.cashMovements({}).then(r => r.data),   staleTime: STALE_2MIN })

  // Flatten all account movements, take last 10, memoize
  const recentMoves = useMemo(() => {
    if (!cashMov) return []
    const all = []
    cashMov.forEach(acc =>
      acc.movements.forEach(m => all.push({
        ...m,
        account_name:  acc.account_name,
        currency_code: acc.currency_code,
        location:      acc.location_name_tr,
      }))
    )
    return all.slice(-10).reverse()
  }, [cashMov])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── KPI Cards — stagger grid ── */}
      <div
        className="stat-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}
      >
        {posLoading || incLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={96} radius={10} />)
        ) : (
          <>
            <StatCard
              label={t.totalCapital}
              value={`$${fmt(pos?.total_usd ?? 0, 0)}`}
              sub={t.usdConsolidated}
              color={C.navy}
              icon={({ size, color }) => <Icon name="building"   size={size} color={color} />}
            />
            <StatCard
              label={t.fxProfit}
              value={`$${fmt(income?.fx_gain_usd ?? 0, 0)}`}
              sub={t.periodTotal}
              color={C.green}
              icon={({ size, color }) => <Icon name="trendUp"    size={size} color={color} />}
            />
            <StatCard
              label={t.commissionIncome}
              value={`$${fmt(income?.commission_usd ?? 0, 0)}`}
              sub={t.periodTotal}
              color={C.accent}
              icon={({ size, color }) => <Icon name="briefcase"  size={size} color={color} />}
            />
            <StatCard
              label={t.netProfit}
              value={`$${fmt(income?.net_pnl_usd ?? 0, 0)}`}
              sub={`${income?.transaction_count ?? 0} ${t.nTransactions}`}
              color={C.green}
              icon={({ size, color }) => <Icon name="dollarSign" size={size} color={color} />}
            />
          </>
        )}
      </div>

      {/* ── Two-column section ── */}
      <div
        className="section-enter"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
      >
        {/* Location PnL */}
        <Card>
          <CardHeader action={<ViewLink to="/reports" label={t.viewAll} />}>
            {t.locationProfit}
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>{t.location}</Th>
                <Th right>{t.volume}</Th>
                <Th right>{t.fxGain}</Th>
                <Th right>{t.netProfit}</Th>
              </tr>
            </thead>
            <tbody className={!locLoading ? 'tbody-stagger' : ''}>
              {locLoading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
                : locPnl?.map(l => (
                    <TrHover key={l.location_id}>
                      <Td>
                        <div style={{ fontWeight: 500 }}>{l.location_name_tr}</div>
                        <div style={{ fontSize: 11, color: C.text3, direction: 'rtl' }}>{l.location_name_ar}</div>
                      </Td>
                      <Td right mono>${fmt(l.volume_usd, 0)}</Td>
                      <Td right mono style={{ color: C.green }}>+${fmt(l.fx_gain_usd, 0)}</Td>
                      <Td right mono style={{ color: C.green, fontWeight: 600 }}>+${fmt(l.net_pnl_usd, 0)}</Td>
                    </TrHover>
                  ))
              }
              {!locLoading && !locPnl?.length && (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: C.text4, fontSize: 13 }}>
                    {t.noDataYet}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>

        {/* Instant Position */}
        <Card>
          <CardHeader action={<ViewLink to="/accounts" label={t.accountsLink} />}>
            {t.instantPosition}
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>{t.safe}</Th>
                <Th right>{t.balance}</Th>
                <Th right>USD</Th>
              </tr>
            </thead>
            <tbody className={!posLoading ? 'tbody-stagger' : ''}>
              {posLoading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={3} />)
                : pos?.accounts?.map(a => (
                    <TrHover key={a.account_id}>
                      <Td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{a.account_name}</div>
                        <div style={{ fontSize: 11, color: C.text3 }}>{a.location_name_tr} · {a.currency_code}</div>
                      </Td>
                      <Td right mono style={{ color: parseFloat(a.balance) >= 0 ? C.text1 : C.red }}>
                        {fmt(a.balance)} {a.currency_code}
                      </Td>
                      <Td right mono style={{ color: parseFloat(a.balance_usd) >= 0 ? C.green : C.red, fontWeight: 500 }}>
                        {parseFloat(a.balance_usd) >= 0 ? '+' : ''}{fmt(a.balance_usd)}
                      </Td>
                    </TrHover>
                  ))
              }
              {!posLoading && !pos?.accounts?.length && (
                <tr>
                  <td colSpan={3} style={{ padding: 40, textAlign: 'center', color: C.text4, fontSize: 13 }}>
                    {t.noAccountYet}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* ── Recent Movements ── */}
      <div style={{ animation: 'fadeUp 0.4s ease 0.25s both' }}>
        <Card>
          <CardHeader action={<ViewLink to="/reports" label={t.allMovements} />}>
            {t.recentMovements}
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>{t.date}</Th>
                <Th>{t.txnNo}</Th>
                <Th>{t.safe}</Th>
                <Th>{t.type}</Th>
                <Th>{t.counterparty}</Th>
                <Th>{t.direction}</Th>
                <Th right>{t.amount}</Th>
                <Th>{t.status}</Th>
              </tr>
            </thead>
            <tbody className={!cashLoading ? 'tbody-stagger' : ''}>
              {cashLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                : recentMoves.map((m, i) => {
                    const isIn = m.direction === 'incoming'
                    return (
                      <TrHover key={i}>
                        <Td style={{ color: C.text2, fontSize: 12.5 }}>{m.txn_date}</Td>
                        <Td>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3 }}>
                            {m.txn_number}
                          </span>
                        </Td>
                        <Td style={{ fontSize: 12.5 }}>
                          <span style={{ fontWeight: 500 }}>{m.account_name}</span>
                          <span style={{ color: C.text3, fontSize: 11, marginInlineStart: 4 }}>{m.location}</span>
                        </Td>
                        <Td style={{ fontSize: 12.5 }}>{TXN_TYPE_LABEL[m.type] ?? m.type}</Td>
                        <Td style={{ fontSize: 12.5, color: C.text2 }}>{m.counterparty}</Td>
                        <Td>
                          <span style={{
                            fontSize: 11.5, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
                            background: isIn ? C.greenBg : C.redBg,
                            color:      isIn ? C.green   : C.red,
                          }}>
                            {isIn ? t.incoming : t.outgoing}
                          </span>
                        </Td>
                        <Td right mono style={{ fontWeight: 600, color: isIn ? C.green : C.red }}>
                          {m.amount} {m.currency_code}
                        </Td>
                        <Td>
                          <Badge type={m.status} dot>{STATUS_LABEL[m.status] ?? m.status}</Badge>
                        </Td>
                      </TrHover>
                    )
                  })
              }
              {!cashLoading && !recentMoves.length && (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: C.text4, fontSize: 13 }}>
                    {t.noMovementYet}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
