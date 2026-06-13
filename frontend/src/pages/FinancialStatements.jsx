import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { accountingApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, CardHeader, Table, Th, Td, Btn, Select, TrHover, C } from '../components/UI'
import { useLang } from '../hooks/useLang'

const yearStart = () => `${new Date().getFullYear()}-01-01`
const today = () => new Date().toISOString().slice(0, 10)
const n = (v) => { const x = Number(v); return isFinite(x) ? x : 0 }

const TABS = ['trialBalance', 'balanceSheet', 'incomeStatement', 'generalLedger']

export default function FinancialStatements() {
  const { t, lang } = useLang()
  const [tab, setTab] = useState('trialBalance')
  const [start, setStart] = useState(yearStart())
  const [end, setEnd] = useState(today())
  const [glAccount, setGlAccount] = useState('')

  const nm = (r) => r[`name_${lang}`] || r.name_tr

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

  const tabLabel = { trialBalance: t.fsTrialBalance, balanceSheet: t.fsBalanceSheet, incomeStatement: t.fsIncomeStatement, generalLedger: t.fsGeneralLedger }

  const dateRange = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: C.text2 }}>{t.fsFrom}<br /><input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label style={{ fontSize: 12, color: C.text2 }}>{t.fsTo}<br /><input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
    </div>
  )

  return (
    <>
      <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(tk => (
            <Btn key={tk} variant={tab === tk ? 'primary' : 'ghost'} size="sm" onClick={() => setTab(tk)}>{tabLabel[tk]}</Btn>
          ))}
        </div>

        {tab === 'trialBalance' && (
          <Card>
            <CardHeader>{t.fsTrialBalance}</CardHeader>
            <Table>
              <thead><tr><Th>{t.coaCode}</Th><Th>{t.coaName}</Th><Th right>{t.fsDebit}</Th><Th right>{t.fsCredit}</Th><Th right>{t.fsBalance}</Th></tr></thead>
              <tbody>
                {(tb?.rows || []).map(r => (
                  <TrHover key={r.account_id}>
                    <Td mono>{r.code}</Td><Td>{nm(r)}</Td>
                    <Td right mono>{n(r.debit_usd) ? fmt(r.debit_usd) : ''}</Td>
                    <Td right mono>{n(r.credit_usd) ? fmt(r.credit_usd) : ''}</Td>
                    <Td right mono>{fmt(r.balance_usd)}</Td>
                  </TrHover>
                ))}
                <tr>
                  <Td /><Td style={{ fontWeight: 700 }}>{t.fsTotal}</Td>
                  <Td right mono style={{ fontWeight: 700 }}>{fmt(tb?.total_debit || 0)}</Td>
                  <Td right mono style={{ fontWeight: 700 }}>{fmt(tb?.total_credit || 0)}</Td><Td />
                </tr>
              </tbody>
            </Table>
          </Card>
        )}

        {tab === 'balanceSheet' && bs && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Card>
              <CardHeader>{t.fsAssets}</CardHeader>
              <Table>
                <tbody>
                  {bs.assets.map(r => <TrHover key={r.account_id}><Td mono>{r.code}</Td><Td>{nm(r)}</Td><Td right mono>{fmt(r.balance_usd)}</Td></TrHover>)}
                  <tr><Td /><Td style={{ fontWeight: 700 }}>{t.fsTotal}</Td><Td right mono style={{ fontWeight: 700 }}>{fmt(bs.total_assets)}</Td></tr>
                </tbody>
              </Table>
            </Card>
            <Card>
              <CardHeader>{t.fsLiabilities} + {t.fsEquity}</CardHeader>
              <Table>
                <tbody>
                  {bs.liabilities.map(r => <TrHover key={r.account_id}><Td mono>{r.code}</Td><Td>{nm(r)}</Td><Td right mono>{fmt(r.balance_usd)}</Td></TrHover>)}
                  {bs.equity.map(r => <TrHover key={r.account_id}><Td mono>{r.code}</Td><Td>{nm(r)}</Td><Td right mono>{fmt(r.balance_usd)}</Td></TrHover>)}
                  <TrHover><Td /><Td>{t.fsNetIncome}</Td><Td right mono>{fmt(bs.net_income)}</Td></TrHover>
                  <tr><Td /><Td style={{ fontWeight: 700 }}>{t.fsTotal}</Td><Td right mono style={{ fontWeight: 700 }}>{fmt(n(bs.total_liabilities) + n(bs.total_equity) + n(bs.net_income))}</Td></tr>
                </tbody>
              </Table>
            </Card>
          </div>
        )}

        {tab === 'incomeStatement' && (
          <Card>
            <CardHeader>{t.fsIncomeStatement}</CardHeader>
            <div style={{ padding: '12px 18px 0' }}>{dateRange}</div>
            <Table>
              <tbody>
                <tr><Td style={{ fontWeight: 700, color: C.green }}>{t.fsRevenue}</Td><Td /></tr>
                {(inc?.revenue || []).map(r => <TrHover key={r.account_id}><Td style={{ paddingInlineStart: 24 }}>{r.code} · {nm(r)}</Td><Td right mono>{fmt(r.amount_usd)}</Td></TrHover>)}
                <tr><Td style={{ fontWeight: 600 }}>{t.fsTotal} {t.fsRevenue}</Td><Td right mono style={{ fontWeight: 600 }}>{fmt(inc?.total_revenue || 0)}</Td></tr>
                <tr><Td style={{ fontWeight: 700, color: C.red }}>{t.fsExpense}</Td><Td /></tr>
                {(inc?.expense || []).map(r => <TrHover key={r.account_id}><Td style={{ paddingInlineStart: 24 }}>{r.code} · {nm(r)}</Td><Td right mono>{fmt(r.amount_usd)}</Td></TrHover>)}
                <tr><Td style={{ fontWeight: 600 }}>{t.fsTotal} {t.fsExpense}</Td><Td right mono style={{ fontWeight: 600 }}>{fmt(inc?.total_expense || 0)}</Td></tr>
                <tr><Td style={{ fontWeight: 700 }}>{t.fsNetIncome}</Td><Td right mono style={{ fontWeight: 700 }}>{fmt(inc?.net || 0)}</Td></tr>
              </tbody>
            </Table>
          </Card>
        )}

        {tab === 'generalLedger' && (
          <Card>
            <CardHeader>{t.fsGeneralLedger}</CardHeader>
            <div style={{ padding: 18 }}>
              <Select label={t.fsAccount} value={glAccount} onChange={e => setGlAccount(e.target.value)} style={{ maxWidth: 360 }}>
                <option value="">{t.coaNone}</option>
                {(tb?.rows || []).map(r => <option key={r.account_id} value={r.account_id}>{r.code} · {nm(r)}</option>)}
              </Select>
              <div style={{ marginTop: 12 }}>{dateRange}</div>
            </div>
            {gl && (
              <Table>
                <thead><tr><Th>{t.fsEntryNo}</Th><Th>{t.jeDate}</Th><Th>{t.jeMemo}</Th><Th right>{t.fsDebit}</Th><Th right>{t.fsCredit}</Th><Th right>{t.fsRunning}</Th></tr></thead>
                <tbody>
                  {gl.lines.map((l, i) => (
                    <TrHover key={i}>
                      <Td mono>{l.entry_number}</Td><Td>{l.entry_date}</Td><Td>{l.memo}</Td>
                      <Td right mono>{n(l.debit_usd) ? fmt(l.debit_usd) : ''}</Td>
                      <Td right mono>{n(l.credit_usd) ? fmt(l.credit_usd) : ''}</Td>
                      <Td right mono>{fmt(l.running_usd)}</Td>
                    </TrHover>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </>
  )
}
