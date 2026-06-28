import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { reportsApi, accountingApi, transactionsApi } from '../utils/api'
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
  const { data: glSum } = useQuery({ queryKey: ['glSummary'], queryFn: () => accountingApi.glSummary().then(r => r.data), staleTime: STALE_2MIN, retry: false })
  const { data: txns = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => transactionsApi.list({}).then(r => r.data), staleTime: STALE_30S })

  const pendingCount = useMemo(() => txns.filter(t => t.status === 'pending').length, [txns])

  // Consolidated cash position per currency — the morning glance
  const byCurrency = useMemo(() => {
    if (!pos?.accounts) return []
    const m = {}
    pos.accounts.forEach(a => {
      const c = a.currency_code || 'USD'
      const e = m[c] || (m[c] = { code: c, native: 0, usd: 0 })
      e.native += parseFloat(a.balance) || 0
      e.usd    += parseFloat(a.balance_usd) || 0
    })
    return Object.values(m).sort((a, b) => Math.abs(b.usd) - Math.abs(a.usd))
  }, [pos])

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
    <>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
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

      {/* ── Pending approvals nudge ── */}
      {pendingCount > 0 && (
        <Link
          to="/transactions?status=pending"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
            padding: '12px 18px', borderRadius: 10,
            background: C.accentBg ?? C.greenBg, border: `1px solid ${C.accent ?? C.green}33`,
            animation: 'fadeUp 0.3s ease both',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 7, background: C.navy, color: 'white',
            fontWeight: 700, fontSize: 13,
          }}>{pendingCount}</span>
          <span style={{ flex: 1, fontSize: 13.5, color: C.text1, fontWeight: 500 }}>
            {pendingCount} {t.pendingApprovalsMsg}
          </span>
          <span style={{ fontSize: 12.5, color: C.navy, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {t.reviewNow} <Icon name="arrowRight" size={13} color={C.navy} />
          </span>
        </Link>
      )}

      {/* ── Currency position — consolidated by currency ── */}
      {!posLoading && byCurrency.length > 0 && (
        <Card>
          <CardHeader action={<ViewLink to="/accounts" label={t.accountsLink} />}>
            {t.currencyPosition}
          </CardHeader>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 1, background: C.border,
          }}>
            {byCurrency.map(c => (
              <div key={c.code} style={{ background: 'white', padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.03em' }}>{c.code}</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 15, color: c.native >= 0 ? C.text1 : C.red }}>
                  {fmt(c.native)}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: c.usd >= 0 ? C.green : C.red }}>
                  {c.usd >= 0 ? '+' : ''}${fmt(c.usd, 0)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── General Ledger summary ── */}
      {glSum?.initialised && (
        <Card>
          <CardHeader action={<ViewLink to="/financial-statements" label={t.viewAll} />}>{t.glSummaryTitle}</CardHeader>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '14px 18px', alignItems: 'center' }}>
            <Badge type={glSum.balanced ? 'completed' : 'cancelled'} dot>
              {glSum.balanced ? t.glBalanced : t.glUnbalanced}
            </Badge>
            <div><div style={{ fontSize: 11, color: C.text3 }}>{t.glEntries}</div><div style={{ fontWeight: 700 }}>{glSum.entry_count}</div></div>
            <div><div style={{ fontSize: 11, color: C.text3 }}>{t.fsAssets}</div><div style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>${fmt(glSum.total_assets)}</div></div>
            <div><div style={{ fontSize: 11, color: C.text3 }}>{t.fsNetIncome}</div><div style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: Number(glSum.net_income) >= 0 ? C.green : C.red }}>${fmt(glSum.net_income)}</div></div>
          </div>
        </Card>
      )}

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
    </>
  )
}
