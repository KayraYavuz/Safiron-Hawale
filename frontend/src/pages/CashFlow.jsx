import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi, locationsApi, currenciesApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, CardHeader, StatCard, Select, Input, Btn, C } from '../components/UI'
import { Skeleton } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import { useLang } from '../hooks/useLang'
import { STALE_2MIN, STALE_5MIN } from '../constants'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart,
} from 'recharts'

// ── Chart color palette ──────────────────────────────────────────────────────
const COLORS = {
  inflow:   '#0EA472',
  outflow:  '#E53E3E',
  net:      '#2563EB',
  netArea:  'rgba(37,99,235,0.08)',
  grid:     '#EEF2F7',
  tooltip:  '#0D1B2E',
}

const PIE_COLORS = ['#0EA472', '#2563EB', '#C9A84C', '#6B46C1', '#E53E3E', '#0891B2', '#D97706', '#7C3AED']

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function FlowTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'white', border: `1px solid ${C.border}`, borderRadius: 9,
      padding: '12px 16px', boxShadow: C.shMd, minWidth: 180,
    }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: C.text1, marginBottom: 8, letterSpacing: '-0.01em' }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, fontSize: 12.5, marginBottom: 3 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.text2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            {p.name}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: C.text1 }}>
            ${fmt(Math.abs(p.value), 0)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Period Toggle ────────────────────────────────────────────────────────────
function PeriodToggle({ value, onChange, t }) {
  const opts = [
    { key: 'daily',   label: t.daily   },
    { key: 'weekly',  label: t.weekly  },
    { key: 'monthly', label: t.monthly },
  ]
  return (
    <div style={{ display: 'flex', gap: 2, background: C.surface3, borderRadius: 7, padding: 2 }}>
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            padding: '5px 14px', borderRadius: 6, border: 'none',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font)', letterSpacing: '-0.005em',
            background: value === o.key ? 'white' : 'transparent',
            color: value === o.key ? C.text1 : C.text3,
            boxShadow: value === o.key ? C.shSm : 'none',
            transition: 'all 0.15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Custom Pie Label ─────────────────────────────────────────────────────────
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (percent < 0.05) return null
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 500, fill: C.text2 }}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function CashFlow() {
  const { t } = useLang()

  // ── Filters ──
  const [period,   setPeriod]   = useState('daily')
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')
  const [locId,    setLocId]    = useState('')
  const [curCode,  setCurCode]  = useState('')

  // ── Data queries ──
  const params = useMemo(() => {
    const p = { period }
    if (fromDate) p.from_date = fromDate
    if (toDate)   p.to_date   = toDate
    if (locId)    p.location_id = locId
    if (curCode)  p.currency_code = curCode
    return p
  }, [period, fromDate, toDate, locId, curCode])

  const { data, isLoading } = useQuery({
    queryKey: ['cashflow', params],
    queryFn: () => reportsApi.cashflow(params).then(r => r.data),
    staleTime: STALE_2MIN,
  })

  const { data: locs = [] } = useQuery({ queryKey: ['locations'], queryFn: () => locationsApi.list().then(r => r.data), staleTime: STALE_5MIN })
  const { data: curs = [] } = useQuery({ queryKey: ['currencies'], queryFn: () => currenciesApi.list().then(r => r.data), staleTime: STALE_5MIN })

  // ── Parsed chart data ──
  const chartData = useMemo(() => {
    if (!data?.series) return []
    return data.series.map(s => ({
      date:    s.date.length > 7 ? s.date.slice(5) : s.date, // MM-DD or YYYY-MM
      inflow:  parseFloat(s.inflow),
      outflow: -Math.abs(parseFloat(s.outflow)), // negative for visual
      net:     parseFloat(s.net),
    }))
  }, [data])

  const pieData = useMemo(() => {
    if (!data?.location_breakdown) return []
    return data.location_breakdown.map(l => ({
      name:  l.location,
      value: Math.abs(parseFloat(l.inflow)) + Math.abs(parseFloat(l.outflow)),
    })).filter(d => d.value > 0)
  }, [data])

  const curBarData = useMemo(() => {
    if (!data?.currency_breakdown) return []
    return data.currency_breakdown.map(c => ({
      currency: c.currency,
      inflow:   parseFloat(c.inflow),
      outflow:  parseFloat(c.outflow),
    })).filter(d => d.inflow > 0 || d.outflow > 0)
  }, [data])

  const summary = data?.summary
  const hasData = chartData.length > 0

  const clearFilters = () => {
    setFromDate(''); setToDate(''); setLocId(''); setCurCode('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Filter Bar ── */}
      <Card>
        <div style={{
          padding: '14px 18px',
          display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineEnd: 4 }}>
            <Icon name="cashflow" size={18} color={C.accent} />
            <span style={{ fontWeight: 600, fontSize: 14, color: C.text1, letterSpacing: '-0.01em' }}>
              {t.cashFlowChart}
            </span>
          </div>

          <PeriodToggle value={period} onChange={setPeriod} t={t} />

          <Input
            type="date" value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            label={t.startDate}
            style={{ width: 140, fontSize: 12 }}
          />
          <Input
            type="date" value={toDate}
            onChange={e => setToDate(e.target.value)}
            label={t.endDate}
            style={{ width: 140, fontSize: 12 }}
          />

          <Select
            value={locId} onChange={e => setLocId(e.target.value)}
            label={t.location}
            style={{ width: 150, fontSize: 12 }}
          >
            <option value="">{t.allLocations}</option>
            {locs.map(l => <option key={l.id} value={l.id}>{l.name_tr}</option>)}
          </Select>

          <Select
            value={curCode} onChange={e => setCurCode(e.target.value)}
            label={t.currency}
            style={{ width: 120, fontSize: 12 }}
          >
            <option value="">{t.allCurrencies}</option>
            {curs.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
          </Select>

          {(fromDate || toDate || locId || curCode) && (
            <Btn variant="ghost" size="sm" onClick={clearFilters}>
              {t.clear}
            </Btn>
          )}
        </div>
      </Card>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={96} radius={10} />)
        ) : (
          <>
            <StatCard
              label={t.totalInflow}
              value={`$${fmt(summary?.total_inflow ?? 0, 0)}`}
              sub={`${summary?.num_days ?? 0} ${t.nDays}`}
              color={C.green}
              icon={({ size, color }) => <Icon name="trendUp" size={size} color={color} />}
            />
            <StatCard
              label={t.totalOutflow}
              value={`$${fmt(summary?.total_outflow ?? 0, 0)}`}
              sub={`${summary?.num_days ?? 0} ${t.nDays}`}
              color={C.red}
              icon={({ size, color }) => (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 18 13.5 8.5 8.5 13.5 2 7"/>
                  <polyline points="17 18 23 18 23 12"/>
                </svg>
              )}
            />
            <StatCard
              label={t.netFlow}
              value={`$${fmt(summary?.net_flow ?? 0, 0)}`}
              sub={parseFloat(summary?.net_flow ?? 0) >= 0 ? '↑ ' + t.inflow : '↓ ' + t.outflow}
              color={parseFloat(summary?.net_flow ?? 0) >= 0 ? C.green : C.red}
              icon={({ size, color }) => <Icon name="dollarSign" size={size} color={color} />}
            />
            <StatCard
              label={t.dailyAverage}
              value={`$${fmt(summary?.daily_avg ?? 0, 0)}`}
              sub={t.inflowVsOutflow}
              color={C.blue}
              icon={({ size, color }) => <Icon name="cashflow" size={size} color={color} />}
            />
          </>
        )}
      </div>

      {/* ── Main Chart — Combo Bar + Line ── */}
      <Card>
        <CardHeader>{t.inflowVsOutflow}</CardHeader>
        <div style={{ padding: '16px 10px 8px 0' }}>
          {isLoading ? (
            <Skeleton height={320} radius={0} />
          ) : !hasData ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.text4, fontSize: 13 }}>
              {t.noFlowData}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.inflow} stopOpacity={0.85} />
                    <stop offset="95%" stopColor={COLORS.inflow} stopOpacity={0.55} />
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="5%" stopColor={COLORS.outflow} stopOpacity={0.85} />
                    <stop offset="95%" stopColor={COLORS.outflow} stopOpacity={0.55} />
                  </linearGradient>
                  <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.net} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.net} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="date" tick={{ fontSize: 11, fill: C.text3 }}
                  axisLine={{ stroke: C.border }} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: C.text3 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `$${fmt(Math.abs(v), 0)}`}
                />
                <Tooltip content={<FlowTooltip t={t} />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(val) => <span style={{ color: C.text2, fontSize: 11.5 }}>{val}</span>}
                />
                <Bar dataKey="inflow" name={t.inflow} fill="url(#inflowGrad)" radius={[4, 4, 0, 0]} barSize={chartData.length > 20 ? 12 : 24} />
                <Bar dataKey="outflow" name={t.outflow} fill="url(#outflowGrad)" radius={[0, 0, 4, 4]} barSize={chartData.length > 20 ? 12 : 24} />
                <Area
                  type="monotone" dataKey="net" name={t.netTrend}
                  stroke={COLORS.net} strokeWidth={2.5}
                  fill="url(#netFill)" dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ── Bottom Section: Location Pie + Currency Bar ── */}
      {hasData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Location Distribution Pie */}
          <Card>
            <CardHeader>{t.flowByLocation}</CardHeader>
            <div style={{ padding: '16px 10px' }}>
              {pieData.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: C.text4, fontSize: 13 }}>
                  {t.noFlowData}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={renderPieLabel}
                      labelLine={{ stroke: C.border, strokeWidth: 1 }}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => `$${fmt(v, 0)}`}
                      contentStyle={{
                        background: 'white', border: `1px solid ${C.border}`,
                        borderRadius: 8, fontSize: 12, boxShadow: C.shSm,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Currency Distribution Bar */}
          <Card>
            <CardHeader>{t.flowByCurrency}</CardHeader>
            <div style={{ padding: '16px 10px 8px 0' }}>
              {curBarData.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: C.text4, fontSize: 13 }}>
                  {t.noFlowData}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={curBarData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                    <XAxis
                      dataKey="currency" tick={{ fontSize: 11, fill: C.text3, fontWeight: 600 }}
                      axisLine={{ stroke: C.border }} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: C.text3 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => `$${fmt(v, 0)}`}
                    />
                    <Tooltip
                      formatter={(v) => `$${fmt(v, 0)}`}
                      contentStyle={{
                        background: 'white', border: `1px solid ${C.border}`,
                        borderRadius: 8, fontSize: 12, boxShadow: C.shSm,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                    <Bar dataKey="inflow" name={t.inflow} fill={COLORS.inflow} radius={[4, 4, 0, 0]} barSize={28} />
                    <Bar dataKey="outflow" name={t.outflow} fill={COLORS.outflow} radius={[4, 4, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

        </div>
      )}

      {/* ── Location Breakdown Table ── */}
      {hasData && data?.location_breakdown?.length > 0 && (
        <Card>
          <CardHeader>{t.flowByLocation} — {t.detail || 'Detail'}</CardHeader>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[t.location, t.inflow, t.outflow, t.net].map((h, i) => (
                    <th key={i} style={{
                      padding: '9px 16px', textAlign: i === 0 ? 'left' : 'right',
                      fontSize: 11, fontWeight: 600, color: C.text3,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      background: C.surface2, borderBottom: `1px solid ${C.border}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.location_breakdown.map((l, i) => {
                  const netVal = parseFloat(l.net)
                  return (
                    <tr key={i}
                      style={{ transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 16px', fontSize: 13.5, fontWeight: 500, borderBottom: `1px solid ${C.border}`, color: C.text1 }}>
                        {l.location}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13.5, fontFamily: 'var(--mono)', textAlign: 'right', borderBottom: `1px solid ${C.border}`, color: C.green, fontWeight: 500 }}>
                        +${fmt(l.inflow, 0)}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13.5, fontFamily: 'var(--mono)', textAlign: 'right', borderBottom: `1px solid ${C.border}`, color: C.red, fontWeight: 500 }}>
                        -${fmt(l.outflow, 0)}
                      </td>
                      <td style={{
                        padding: '11px 16px', fontSize: 13.5, fontFamily: 'var(--mono)', textAlign: 'right',
                        borderBottom: `1px solid ${C.border}`, fontWeight: 600,
                        color: netVal >= 0 ? C.green : C.red,
                      }}>
                        {netVal >= 0 ? '+' : ''}{fmt(l.net, 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  )
}
