import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportsApi, counterpartiesApi, locationsApi, accountsApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, CardHeader, Table, Th, Td, Badge, Select, Input, Info, TrHover, C, Btn } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { STALE_2MIN, STALE_5MIN, STATUS_LABEL } from '../constants'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'

// ── PDF/Excel helpers ─────────────────────────────────────────────────────────
function downloadPDF(title, headers, rows, filename, t) {
  const { jsPDF } = window.jspdf ?? {}
  if (!jsPDF) { alert(t.pdfLibError); return }
  const doc  = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 16)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(new Date().toLocaleDateString('tr-TR', { dateStyle: 'long' }), pageW - 14, 16, { align: 'right' })
  const colW  = Math.floor((pageW - 28) / headers.length)
  let y = 24; const rowH = 8
  doc.setFillColor(13, 27, 46); doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  doc.rect(14, y, pageW - 28, rowH, 'F')
  headers.forEach((h, i) => doc.text(String(h), 16 + i * colW, y + 5.5))
  y += rowH
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal')
  rows.forEach((row, ri) => {
    if (y > doc.internal.pageSize.getHeight() - 18) { doc.addPage(); y = 18 }
    if (ri % 2 === 0) { doc.setFillColor(245, 247, 250); doc.rect(14, y, pageW - 28, rowH, 'F') }
    row.forEach((cell, i) => doc.text(String(cell ?? ''), 16 + i * colW, y + 5.5))
    y += rowH
  })
  doc.save(filename)
}

function downloadExcel(title, headers, rows, filename, t) {
  const XLSX = window.XLSX
  if (!XLSX) { alert(t.excelLibError); return }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  XLSX.writeFile(wb, filename)
}

function DownloadButtons({ onPDF, onExcel }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onPDF}   style={{ padding: '7px 13px', borderRadius: 7, border: '1px solid rgba(229,62,62,0.3)',  background: 'rgba(229,62,62,0.06)',  color: '#E53E3E', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}>↓ PDF</button>
      <button onClick={onExcel} style={{ padding: '7px 13px', borderRadius: 7, border: '1px solid rgba(14,164,114,0.3)', background: 'rgba(14,164,114,0.06)', color: '#0EA472', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}>↓ Excel</button>
    </div>
  )
}

export default function Reports() {
  const { t } = useLang()
  const [searchParams]         = useSearchParams()
  const [tab,      setTab]     = useState(searchParams.get('tab') || 'position')
  const [cpId,     setCpId]    = useState(searchParams.get('cp')  || '')
  const [locId,    setLocId]   = useState('')
  const [accId,    setAccId]   = useState('')
  const [fromDate, setFrom]    = useState('')
  const [toDate,   setTo]      = useState('')

  const TABS = [
    { k: 'position',  label: t.position  },
    { k: 'cash',      label: t.cashMovements },
    { k: 'location',  label: t.locationPnl },
    { k: 'income',    label: t.incomeStatement },
    { k: 'statement', label: t.accountStatement },
  ]

  const { data: pos }      = useQuery({ queryKey: ['position'],                          queryFn: () => reportsApi.position().then(r => r.data),                                                                                    enabled: tab === 'position'  })
  const { data: locPnl }   = useQuery({ queryKey: ['locPnl',  fromDate, toDate],          queryFn: () => reportsApi.locationPnl({ from_date: fromDate || undefined, to_date: toDate || undefined }).then(r => r.data),               enabled: tab === 'location'  })
  const { data: income }   = useQuery({ queryKey: ['income',  fromDate, toDate],          queryFn: () => reportsApi.incomeStatement({ from_date: fromDate || undefined, to_date: toDate || undefined }).then(r => r.data),           enabled: tab === 'income'    })
  const { data: stmt }     = useQuery({ queryKey: ['stmt',   cpId, fromDate, toDate],     queryFn: () => reportsApi.statement(cpId, { from_date: fromDate || undefined, to_date: toDate || undefined }).then(r => r.data),           enabled: tab === 'statement' && !!cpId })
  const { data: cashMov }  = useQuery({ queryKey: ['cashMov', locId, accId, fromDate, toDate], queryFn: () => reportsApi.cashMovements({ location_id: locId || undefined, account_id: accId || undefined, from_date: fromDate || undefined, to_date: toDate || undefined }).then(r => r.data), enabled: tab === 'cash' })
  const { data: cps  = [] }= useQuery({ queryKey: ['counterparties'], queryFn: () => counterpartiesApi.list({}).then(r => r.data), staleTime: STALE_2MIN })
  const { data: locs = [] }= useQuery({ queryKey: ['locations'],      queryFn: () => locationsApi.list().then(r => r.data),        staleTime: STALE_5MIN })
  const { data: accs = [] }= useQuery({ queryKey: ['accounts'],       queryFn: () => accountsApi.list({}).then(r => r.data),        staleTime: STALE_2MIN })

  const filteredAccs = useMemo(() =>
    locId ? accs.filter(a => a.location_id === locId) : accs,
    [accs, locId]
  )

  const clearDates = useCallback(() => { setFrom(''); setTo('') }, [])

  const exportFns = useMemo(() => ({
    position: (type) => {
      const h = [t.location, t.safe, t.currency, t.balance, '≈ USD']
      const r = (pos?.accounts ?? []).map(a => [a.location_name_tr, a.account_name, a.currency_code, `${fmt(a.balance)} ${a.currency_code}`, `$${fmt(a.balance_usd)}`])
      r.push(['', '', t.total, '', `$${fmt(pos?.total_usd ?? 0)}`])
      const title = `${t.position} — ${new Date().toLocaleDateString()}`
      type === 'pdf' ? downloadPDF(title, h, r, 'pozisyon.pdf', t) : downloadExcel(title, h, r, 'pozisyon.xlsx', t)
    },
    cash: (type) => {
      const h = [t.safe, t.location, t.date, t.txnNo, t.type, t.counterparty, t.direction, t.amount, t.balance]
      const r = []
      ;(cashMov ?? []).forEach(acc => acc.movements.forEach(m =>
        r.push([acc.account_name, acc.location_name_tr, m.txn_date, m.txn_number, m.type, m.counterparty, m.direction, `${m.amount} ${acc.currency_code}`, `${m.balance} ${acc.currency_code}`])
      ))
      type === 'pdf' ? downloadPDF(t.cashMovements, h, r, 'kasa-hareketleri.pdf', t) : downloadExcel(t.cashMovements, h, r, 'kasa-hareketleri.xlsx', t)
    },
    location: (type) => {
      const h = [t.location, t.action, t.volumeUsd, t.fxGain, t.commission, t.netProfit]
      const r = (locPnl ?? []).map(l => [l.location_name_tr, l.transaction_count, `$${fmt(l.volume_usd, 0)}`, `$${fmt(l.fx_gain_usd)}`, `$${fmt(l.commission_usd)}`, `$${fmt(l.net_pnl_usd)}`])
      type === 'pdf' ? downloadPDF(t.locationPnl, h, r, 'lokasyon-kar.pdf', t) : downloadExcel(t.locationPnl, h, r, 'lokasyon-kar.xlsx', t)
    },
    income: (type) => {
      const h = [t.type, `${t.amount} (USD)`]
      const r = [
        [t.fxGainProfit, `$${fmt(income?.fx_gain_usd)}`],
        [t.commissionRevenue, `$${fmt(income?.commission_usd)}`],
        [t.grossIncome, `$${fmt(income?.gross_income_usd)}`],
        [t.netProfitUsdLabel, `$${fmt(income?.net_pnl_usd)}`],
      ]
      type === 'pdf' ? downloadPDF(t.incomeStatement, h, r, 'gelir-tablosu.pdf', t) : downloadExcel(t.incomeStatement, h, r, 'gelir-tablosu.xlsx', t)
    },
    statement: (type) => {
      if (!stmt) return
      const h = [t.txnNo, t.date, t.type, t.description, t.debit, t.credit, 'USD', t.balance, t.status]
      const r = (stmt?.rows ?? []).map(s => [s.txn_number, s.txn_date, s.type, s.description, s.debit, s.credit, `$${fmt(s.amount_usd)}`, `$${fmt(s.balance_usd)}`, s.status])
      type === 'pdf' ? downloadPDF(`${t.statement} — ${stmt.counterparty?.name ?? ''}`, h, r, 'ekstre.pdf', t) : downloadExcel(t.statement, h, r, 'ekstre.xlsx', t)
    },
  }), [pos, cashMov, locPnl, income, stmt, t])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'white', border: `1px solid ${C.border}`, borderRadius: 10, padding: 4 }}>
          {TABS.map(t_item => (
            <button key={t_item.k} onClick={() => setTab(t_item.k)} style={{
              padding: '7px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
              border: 'none', transition: 'background 0.12s, color 0.12s', fontWeight: tab === t_item.k ? 600 : 400,
              background: tab === t_item.k ? C.navy : 'transparent',
              color:      tab === t_item.k ? 'white' : C.text2,
            }}>{t_item.label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <DownloadButtons onPDF={() => exportFns[tab]?.('pdf')} onExcel={() => exportFns[tab]?.('excel')} />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {tab === 'statement' && (
          <Select value={cpId} onChange={e => setCpId(e.target.value)} style={{ width: 200 }}>
            <option value="">{t.selectCounterparty}</option>
            {cps.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
          </Select>
        )}
        {tab === 'cash' && (
          <>
            <Select value={locId} onChange={e => { setLocId(e.target.value); setAccId('') }} style={{ width: 160 }}>
              <option value="">{t.allLocations}</option>
              {locs.map(l => <option key={l.id} value={l.id}>{l.name_tr}</option>)}
            </Select>
            <Select value={accId} onChange={e => setAccId(e.target.value)} style={{ width: 180 }}>
              <option value="">{t.allSafes}</option>
              {filteredAccs.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency?.code})</option>)}
            </Select>
          </>
        )}
        {['cash', 'location', 'income', 'statement'].includes(tab) && (
          <>
            <Input type="date" label={t.startDate} value={fromDate} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
            <Input type="date" label={t.endDate}     value={toDate}   onChange={e => setTo(e.target.value)}   style={{ width: 150 }} />
            {(fromDate || toDate) && (
              <button onClick={clearDates} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'white', color: C.text3, cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font)', marginBottom: 1 }}>
                {t.clear}
              </button>
            )}
          </>
        )}
      </div>

      {tab === 'position' && (
        <Card>
          <CardHeader action={<span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: C.green }}>{t.total}: ${fmt(pos?.total_usd ?? 0, 0)}</span>}>
            {t.position}
          </CardHeader>
          <Table>
            <thead><tr><Th>{t.location}</Th><Th>{t.safe}</Th><Th>{t.currency}</Th><Th right>{t.balance}</Th><Th right>≈ USD</Th></tr></thead>
            <tbody>
              {!pos && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
              {pos?.accounts?.map(a => {
                const bal  = parseFloat(a.balance)
                const busd = parseFloat(a.balance_usd)
                return (
                  <TrHover key={a.account_id}>
                    <Td style={{ fontWeight: 500 }}>{a.location_name_tr}</Td>
                    <Td>{a.account_name}</Td>
                    <Td><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: C.surface3, fontWeight: 600, fontSize: 12, color: C.navy }}>{a.currency_code}</span></Td>
                    <Td right mono style={{ color: bal  >= 0 ? C.text1 : C.red,  fontWeight: 500 }}>{fmt(a.balance)} {a.currency_code}</Td>
                    <Td right mono style={{ color: busd >= 0 ? C.green : C.red,  fontWeight: 600 }}>{busd >= 0 ? '+' : ''}{fmt(a.balance_usd)}</Td>
                  </TrHover>
                )
              })}
              {pos && !pos.accounts?.length && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: C.text4 }}>{t.noData}</td></tr>}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === 'cash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!cashMov?.length && <Info>{t.selectFilter}</Info>}
          {cashMov?.map(acc => (
            <Card key={acc.account_id}>
              <CardHeader action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 12, color: C.text3 }}>{t.opening}: <span style={{ fontFamily: 'var(--mono)', color: C.text2 }}>{fmt(acc.opening_balance)} {acc.currency_code}</span></span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: parseFloat(acc.closing_balance) >= 0 ? C.green : C.red }}>
                    {t.closing}: {fmt(acc.closing_balance)} {acc.currency_code}
                  </span>
                </div>
              }>
                {acc.location_name_tr} — {acc.account_name}
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 99, background: C.surface3, fontSize: 11.5, fontWeight: 600, color: C.navy }}>{acc.currency_code}</span>
              </CardHeader>
              {!acc.movements.length
                ? <div style={{ padding: 24, textAlign: 'center', color: C.text4, fontSize: 13 }}>{t.noMovementInPeriod}</div>
                : <Table>
                    <thead><tr><Th>{t.date}</Th><Th>{t.txnNo}</Th><Th>{t.type}</Th><Th>{t.counterparty}</Th><Th>{t.direction}</Th><Th right>{t.amount}</Th><Th right>{t.balance}</Th><Th>{t.status}</Th></tr></thead>
                    <tbody>
                      {acc.movements.map((m, i) => {
                        const isIn = m.direction === 'Giriş' || m.direction === 'Inflow'
                        return (
                          <TrHover key={i}>
                            <Td style={{ color: C.text2, fontSize: 12.5 }}>{m.txn_date}</Td>
                            <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3 }}>{m.txn_number}</span></Td>
                            <Td style={{ fontSize: 12.5 }}>{m.type}</Td>
                            <Td style={{ fontSize: 12.5, color: C.text2 }}>{m.counterparty}</Td>
                            <Td><span style={{ fontSize: 11.5, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: isIn ? C.greenBg : C.redBg, color: isIn ? C.green : C.red }}>{m.direction}</span></Td>
                            <Td right mono style={{ fontWeight: 600, color: isIn ? C.green : C.red }}>{m.amount} {acc.currency_code}</Td>
                            <Td right mono style={{ fontWeight: 500 }}>{fmt(m.balance)} {acc.currency_code}</Td>
                            <Td><Badge type={m.status} dot>{STATUS_LABEL[m.status] ?? m.status}</Badge></Td>
                          </TrHover>
                        )
                      })}
                    </tbody>
                  </Table>
              }
            </Card>
          ))}
        </div>
      )}

      {tab === 'location' && (
        <Card>
          <CardHeader>{t.locationPnlTitle}</CardHeader>
          <Table>
            <thead><tr><Th>{t.location}</Th><Th right>{t.txnCount}</Th><Th right>{t.volumeUsd}</Th><Th right>{t.fxGain}</Th><Th right>{t.commission}</Th><Th right>{t.netProfit}</Th></tr></thead>
            <tbody>
              {!locPnl && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
              {locPnl?.map(l => {
                const net = parseFloat(l.net_pnl_usd)
                return (
                  <TrHover key={l.location_id}>
                    <Td><div style={{ fontWeight: 500 }}>{l.location_name_tr}</div><div style={{ fontSize: 11, color: C.text3, direction: 'rtl' }}>{l.location_name_ar}</div></Td>
                    <Td right mono>{l.transaction_count}</Td>
                    <Td right mono style={{ color: C.text2 }}>${fmt(l.volume_usd, 0)}</Td>
                    <Td right mono style={{ color: parseFloat(l.fx_gain_usd) >= 0 ? C.green : C.red }}>{parseFloat(l.fx_gain_usd) >= 0 ? '+' : ''}{fmt(l.fx_gain_usd)}</Td>
                    <Td right mono style={{ color: C.green }}>+${fmt(l.commission_usd)}</Td>
                    <Td right mono style={{ fontWeight: 700, color: net >= 0 ? C.green : C.red }}>{net >= 0 ? '+' : ''}{fmt(l.net_pnl_usd)}</Td>
                  </TrHover>
                )
              })}
              {locPnl && !locPnl.length && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: C.text4 }}>{t.noCompletedFx}</td></tr>}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === 'income' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
          <Card>
            <CardHeader>{t.incomeStatementTitle}</CardHeader>
            <div style={{ padding: '16px 20px' }}>
              {income ? (
                <>
                  {[
                    { label: t.fxGainProfit,  value: `+$${fmt(income?.fx_gain_usd ?? 0)}`,     color: C.green },
                    { label: t.commissionRevenue,  value: `+$${fmt(income?.commission_usd ?? 0)}`,  color: C.green },
                    { label: t.grossIncome,       value: `$${fmt(income?.gross_income_usd ?? 0)}`, color: C.navy, bold: true, hr: true },
                    { label: t.netProfitUsd,     value: `$${fmt(income?.net_pnl_usd ?? 0)}`,     color: parseFloat(income?.net_pnl_usd ?? 0) >= 0 ? C.green : C.red, bold: true, hr: true },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: row.hr ? `1px solid ${C.border}` : 'none', marginTop: row.hr ? 6 : 0 }}>
                      <span style={{ fontSize: 14, color: row.bold ? C.text1 : C.text2, fontWeight: row.bold ? 600 : 400 }}>{row.label}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: row.bold ? 700 : 500, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.text3 }}>
                    {income.transaction_count} {t.completedFxRemittance}
                    {(income.from_date || income.to_date) && ` · ${income.from_date ?? '…'} – ${income.to_date ?? '…'}`}
                  </div>
                </>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: C.text4 }}>{t.loadingText}</div>
              )}
            </div>
          </Card>
          <Info type="info">
            <strong>{t.note}:</strong> {t.incomeNote}
          </Info>
        </div>
      )}

      {tab === 'statement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!cpId && <Info>{t.viewStatement}</Info>}
          {stmt && (
            <>
              <Card>
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{stmt.counterparty?.name}</div>
                    <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
                      {stmt.counterparty?.code} · {{ customer: t.customer, supplier: t.supplier, both: t.both, founder: t.founder }[stmt.counterparty?.type] ?? stmt.counterparty?.type}
                      {stmt.counterparty?.name_ar && <span style={{ marginLeft: 10, direction: 'rtl' }}>{stmt.counterparty.name_ar}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>{t.netBalanceUsd}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: parseFloat(stmt.closing_balance_usd) >= 0 ? C.green : C.red }}>
                      {parseFloat(stmt.closing_balance_usd) >= 0 ? '+' : ''}{fmt(stmt.closing_balance_usd)}
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>
                      {parseFloat(stmt.closing_balance_usd) > 0 ? t.customerOwes : parseFloat(stmt.closing_balance_usd) < 0 ? t.weOwe : t.zero}
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <Table>
                  <thead><tr><Th>{t.txnNo}</Th><Th>{t.date}</Th><Th>{t.type}</Th><Th>{t.description}</Th><Th>{t.debit}</Th><Th>{t.credit}</Th><Th right>USD</Th><Th right>{t.balance}</Th><Th>{t.status}</Th></tr></thead>
                  <tbody>
                    {stmt.rows?.map((r, i) => (
                      <TrHover key={i}>
                        <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3 }}>{r.txn_number}</span></Td>
                        <Td style={{ color: C.text2, fontSize: 12.5 }}>{r.txn_date}</Td>
                        <Td style={{ fontSize: 12.5 }}>{r.type}</Td>
                        <Td style={{ fontSize: 12, color: C.text3 }}>{r.description}</Td>
                        <Td mono style={{ color: C.red,  fontSize: 12.5 }}>{r.debit  !== '—' ? r.debit  : <span style={{ color: C.text4 }}>—</span>}</Td>
                        <Td mono style={{ color: C.green, fontSize: 12.5 }}>{r.credit !== '—' ? r.credit : <span style={{ color: C.text4 }}>—</span>}</Td>
                        <Td right mono style={{ fontSize: 12.5 }}>${fmt(r.amount_usd)}</Td>
                        <Td right mono style={{ fontWeight: 600, color: parseFloat(r.balance_usd) >= 0 ? C.text1 : C.red }}>${fmt(r.balance_usd)}</Td>
                        <Td><Badge type={r.status} dot>{STATUS_LABEL[r.status] ?? r.status}</Badge></Td>
                      </TrHover>
                    ))}
                    {!stmt.rows?.length && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.text4 }}>{t.noTransactionFound}</td></tr>}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
