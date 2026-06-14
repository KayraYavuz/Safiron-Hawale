import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountingApi, downloadBlob } from '../utils/api'
import { acct } from '../utils/format'
import { useAuthStore } from '../store'
import { Card, Btn, Input, Select, Badge, Info, C } from '../components/UI'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'

const yearStart = () => `${new Date().getFullYear()}-01-01`
const today = () => new Date().toISOString().slice(0, 10)
const n = (v) => { const x = Number(v); return isFinite(x) ? x : 0 }

const TABS = ['trialBalance', 'balanceSheet', 'incomeStatement', 'generalLedger', 'periods']

// ── Accounting report styling ────────────────────────────────────────────────
const REPORT_MAX = 900
const cTxt = { padding: '6px 14px', fontSize: 13, color: C.text1, verticalAlign: 'top' }
const cNum = { ...cTxt, textAlign: 'right', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }
const cCode = { ...cTxt, fontFamily: 'var(--mono)', color: C.text2, width: 90 }
const thStyle = { padding: '8px 14px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text3, borderBottom: `2px solid ${C.text1}` }
const sectionRow = { background: C.surface3, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text2 }
const subtotalRow = { borderTop: `1px solid ${C.border2}`, fontWeight: 700, background: C.surface2 }
const totalRow = { borderTop: `2.5px double ${C.text1}`, borderBottom: `2.5px double ${C.text1}`, fontWeight: 800 }

function ReportFrame({ title, lines = [], chip, children }) {
  return (
    <Card>
      <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', position: 'relative' }}>
        {chip && <div style={{ position: 'absolute', insetInlineEnd: 14, top: 14 }}>{chip}</div>}
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text1 }}>{title}</div>
        {lines.filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{l}</div>)}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ maxWidth: REPORT_MAX, margin: '0 auto' }}>{children}</div>
      </div>
    </Card>
  )
}

const RT = ({ children }) => <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font)' }}>{children}</table>

export default function FinancialStatements() {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'super_admin', 'accounting'].includes(user?.role)
  const [tab, setTab] = useState('trialBalance')
  const [start, setStart] = useState(yearStart())
  const [end, setEnd] = useState(today())
  const [glAccount, setGlAccount] = useState('')
  const [pStart, setPStart] = useState(yearStart())
  const [pEnd, setPEnd] = useState(`${new Date().getFullYear()}-12-31`)

  const nm = (r) => r[`name_${lang}`] || r.name_tr
  const money = (v, blankZero = false) => (blankZero && !n(v)) ? '' : acct(v, { dashZero: !blankZero })
  const exportCsv = (path, params, filename) =>
    accountingApi.exportCsv(path, params).then(r => downloadBlob(r, filename)).catch(() => toast.error(t.error))
  const ExportBtn = ({ path, params, filename }) => (
    <Btn variant="ghost" size="sm" onClick={() => exportCsv(path, params, filename)}>CSV</Btn>
  )

  const { data: tb } = useQuery({ queryKey: ['tb'], queryFn: () => accountingApi.trialBalance().then(r => r.data) })
  const { data: bs } = useQuery({ queryKey: ['bs'], queryFn: () => accountingApi.balanceSheet().then(r => r.data), enabled: tab === 'balanceSheet' })
  const { data: inc } = useQuery({
    queryKey: ['inc', start, end], queryFn: () => accountingApi.incomeStatement({ start, end }).then(r => r.data),
    enabled: tab === 'incomeStatement',
  })
  const { data: gl } = useQuery({
    queryKey: ['gl', glAccount, start, end],
    queryFn: () => accountingApi.generalLedger(glAccount, { start, end }).then(r => r.data),
    enabled: tab === 'generalLedger' && !!glAccount,
  })
  const { data: periods = [] } = useQuery({
    queryKey: ['periods'], queryFn: () => accountingApi.periods().then(r => r.data), enabled: tab === 'periods',
  })

  const closeMut = useMutation({
    mutationFn: () => accountingApi.closePeriod({ period_start: pStart, period_end: pEnd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] }); qc.invalidateQueries({ queryKey: ['tb'] })
      qc.invalidateQueries({ queryKey: ['bs'] }); toast.success(t.coaSaved || 'OK')
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const reopenMut = useMutation({
    mutationFn: accountingApi.reopenPeriod,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['periods'] }); toast.success(t.coaSaved || 'OK') },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const tabLabel = { trialBalance: t.fsTrialBalance, balanceSheet: t.fsBalanceSheet, incomeStatement: t.fsIncomeStatement, generalLedger: t.fsGeneralLedger, periods: t.fsPeriods }
  const periodLine = `${t.fsPeriodLabel}: ${start} — ${end}`
  const balancedChip = tb && (
    <Badge type={n(tb.total_debit) === n(tb.total_credit) ? 'completed' : 'cancelled'} dot>
      {n(tb.total_debit) === n(tb.total_credit) ? t.glBalanced : t.glUnbalanced}
    </Badge>
  )

  const dateRange = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '12px 18px', justifyContent: 'center' }}>
      <label style={{ fontSize: 12, color: C.text2 }}>{t.fsFrom}<br /><input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label style={{ fontSize: 12, color: C.text2 }}>{t.fsTo}<br /><input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
    </div>
  )

  return (
    <>
      <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Info type="info">{t.fsIntro}</Info>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TABS.map(tk => (
              <Btn key={tk} variant={tab === tk ? 'primary' : 'ghost'} size="sm" onClick={() => setTab(tk)}>{tabLabel[tk]}</Btn>
            ))}
          </div>
          {tab === 'trialBalance' && <ExportBtn path="trial-balance" filename="mizan.csv" />}
          {tab === 'balanceSheet' && <ExportBtn path="balance-sheet" filename="bilanco.csv" />}
          {tab === 'incomeStatement' && <ExportBtn path="income-statement-gl" params={{ start, end }} filename="gelir_tablosu.csv" />}
        </div>

        {/* ── MİZAN ── */}
        {tab === 'trialBalance' && (
          <ReportFrame title={t.fsTrialBalance} lines={[`${t.fsAsOf}: ${today()}`, t.fsUnitUsd]} chip={balancedChip}>
            <RT>
              <thead><tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>{t.coaCode}</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>{t.coaName}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{t.fsDebit}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{t.fsCredit}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{t.fsBalance}</th>
              </tr></thead>
              <tbody>
                {(tb?.rows || []).map(r => (
                  <tr key={r.account_id} style={{ borderBottom: `1px solid ${C.surface3}` }}>
                    <td style={cCode}>{r.code}</td>
                    <td style={cTxt}>{nm(r)}</td>
                    <td style={cNum}>{money(r.debit_usd, true)}</td>
                    <td style={cNum}>{money(r.credit_usd, true)}</td>
                    <td style={cNum}>{money(r.balance_usd)}</td>
                  </tr>
                ))}
                <tr style={totalRow}>
                  <td style={cTxt} colSpan={2}>{t.fsGrandTotal}</td>
                  <td style={cNum}>{money(tb?.total_debit, false)}</td>
                  <td style={cNum}>{money(tb?.total_credit, false)}</td>
                  <td style={cNum} />
                </tr>
              </tbody>
            </RT>
          </ReportFrame>
        )}

        {/* ── BİLANÇO ── */}
        {tab === 'balanceSheet' && bs && (() => {
          const passiveTotal = n(bs.total_liabilities) + n(bs.total_equity) + n(bs.net_income)
          const side = (titleKey, rows, extra, totalKey, totalVal) => (
            <RT>
              <thead><tr><th style={{ ...thStyle, textAlign: 'left' }} colSpan={2}>{titleKey}</th><th style={{ ...thStyle, textAlign: 'right' }}>{t.fsBalance}</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.account_id} style={{ borderBottom: `1px solid ${C.surface3}` }}>
                    <td style={cCode}>{r.code}</td><td style={cTxt}>{nm(r)}</td><td style={cNum}>{money(r.balance_usd)}</td>
                  </tr>
                ))}
                {extra}
                <tr style={totalRow}><td style={cTxt} colSpan={2}>{totalKey}</td><td style={cNum}>{money(totalVal, false)}</td></tr>
              </tbody>
            </RT>
          )
          return (
            <ReportFrame title={t.fsBalanceSheet} lines={[`${t.fsAsOf}: ${today()}`, t.fsUnitUsd]}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: `1px solid ${C.border}` }}>
                <div style={{ borderInlineEnd: `2px solid ${C.text1}` }}>{side(t.fsActive, bs.assets, null, t.fsAssetsTotal, bs.total_assets)}</div>
                <div>{side(t.fsPassive, [...bs.liabilities, ...bs.equity],
                  <tr style={subtotalRow}><td style={cTxt} colSpan={2}>{t.fsNetIncome}</td><td style={cNum}>{money(bs.net_income)}</td></tr>,
                  t.fsLiabEqTotal, passiveTotal)}</div>
              </div>
            </ReportFrame>
          )
        })()}

        {/* ── GELİR TABLOSU ── */}
        {tab === 'incomeStatement' && (
          <ReportFrame title={t.fsIncomeStatement} lines={[periodLine, t.fsUnitUsd]}>
            {dateRange}
            <RT>
              <tbody>
                <tr style={sectionRow}><td style={cTxt} colSpan={2}>A — {t.fsRevenue}</td></tr>
                {(inc?.revenue || []).map(r => (
                  <tr key={r.account_id} style={{ borderBottom: `1px solid ${C.surface3}` }}>
                    <td style={{ ...cTxt, paddingInlineStart: 28 }}><span style={{ fontFamily: 'var(--mono)', color: C.text3, marginInlineEnd: 8 }}>{r.code}</span>{nm(r)}</td>
                    <td style={cNum}>{money(r.amount_usd)}</td>
                  </tr>
                ))}
                <tr style={subtotalRow}><td style={cTxt}>{t.fsTotal} {t.fsRevenue}</td><td style={cNum}>{money(inc?.total_revenue, false)}</td></tr>
                <tr style={sectionRow}><td style={cTxt} colSpan={2}>B — {t.fsExpense}</td></tr>
                {(inc?.expense || []).map(r => (
                  <tr key={r.account_id} style={{ borderBottom: `1px solid ${C.surface3}` }}>
                    <td style={{ ...cTxt, paddingInlineStart: 28 }}><span style={{ fontFamily: 'var(--mono)', color: C.text3, marginInlineEnd: 8 }}>{r.code}</span>{nm(r)}</td>
                    <td style={cNum}>{money(r.amount_usd)}</td>
                  </tr>
                ))}
                <tr style={subtotalRow}><td style={cTxt}>{t.fsTotal} {t.fsExpense}</td><td style={cNum}>{money(inc?.total_expense, false)}</td></tr>
                <tr style={totalRow}><td style={cTxt}>{t.fsNetIncome}</td><td style={{ ...cNum, color: n(inc?.net) >= 0 ? C.green : C.red }}>{money(inc?.net, false)}</td></tr>
              </tbody>
            </RT>
          </ReportFrame>
        )}

        {/* ── DEFTER-İ KEBİR ── */}
        {tab === 'generalLedger' && (
          <ReportFrame title={t.fsGeneralLedger} lines={[periodLine, t.fsUnitUsd]}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', padding: '12px 18px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Select label={t.fsAccount} value={glAccount} onChange={e => setGlAccount(e.target.value)} style={{ minWidth: 320 }}>
                <option value="">{t.coaNone}</option>
                {(tb?.rows || []).map(r => <option key={r.account_id} value={r.account_id}>{r.code} · {nm(r)}</option>)}
              </Select>
              <label style={{ fontSize: 12, color: C.text2 }}>{t.fsFrom}<br /><input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
              <label style={{ fontSize: 12, color: C.text2 }}>{t.fsTo}<br /><input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
            </div>
            {gl && (
              <RT>
                <thead><tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>{t.jeDate}</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>{t.fsEntryNo}</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>{t.jeMemo}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t.fsDebit}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t.fsCredit}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t.fsRunning}</th>
                </tr></thead>
                <tbody>
                  {gl.lines.map((l, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.surface3}` }}>
                      <td style={cTxt}>{l.entry_date}</td>
                      <td style={cCode}>{l.entry_number}</td>
                      <td style={cTxt}>{l.memo}</td>
                      <td style={cNum}>{money(l.debit_usd, true)}</td>
                      <td style={cNum}>{money(l.credit_usd, true)}</td>
                      <td style={cNum}>{money(l.running_usd)}</td>
                    </tr>
                  ))}
                  {gl.lines.length === 0 && <tr><td style={{ ...cTxt, textAlign: 'center', color: C.text3 }} colSpan={6}>{t.jeEmpty}</td></tr>}
                </tbody>
              </RT>
            )}
          </ReportFrame>
        )}

        {/* ── DÖNEMLER ── */}
        {tab === 'periods' && (
          <Card>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13 }}>{t.fsPeriods}</div>
            {isAdmin && (
              <div style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'flex-end', borderBottom: `1px solid ${C.border}` }}>
                <Input label={t.fsPeriodStart} type="date" value={pStart} onChange={e => setPStart(e.target.value)} />
                <Input label={t.fsPeriodEnd} type="date" value={pEnd} onChange={e => setPEnd(e.target.value)} />
                <Btn onClick={() => window.confirm(t.fsCloseConfirm) && closeMut.mutate()} disabled={closeMut.isPending}>{t.fsClosePeriod}</Btn>
              </div>
            )}
            <RT>
              <thead><tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>{t.fsPeriodStart}</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>{t.fsPeriodEnd}</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>{t.fsStatusOpen}/{t.fsStatusClosed}</th>
                <th style={{ ...thStyle, textAlign: 'right' }} />
              </tr></thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.surface3}` }}>
                    <td style={cTxt}>{p.period_start}</td>
                    <td style={cTxt}>{p.period_end}</td>
                    <td style={cTxt}><Badge type={p.status === 'closed' ? 'cancelled' : 'completed'}>{p.status === 'closed' ? t.fsStatusClosed : t.fsStatusOpen}</Badge></td>
                    <td style={{ ...cNum }}>
                      {isAdmin && p.status === 'closed' && (
                        <button onClick={() => reopenMut.mutate(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.navy, fontSize: 12 }}>{t.fsReopen}</button>
                      )}
                    </td>
                  </tr>
                ))}
                {periods.length === 0 && <tr><td style={{ ...cTxt, textAlign: 'center', color: C.text3 }} colSpan={4}>—</td></tr>}
              </tbody>
            </RT>
          </Card>
        )}
      </div>
    </>
  )
}
