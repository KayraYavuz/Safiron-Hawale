import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reconciliationApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, CardHeader, Table, Th, Td, Badge, Btn, Input, Info, TrHover, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { getStatusLabel, getTxnTypeLabel } from '../constants'
import { useLang } from '../hooks/useLang'

export default function Reconciliation() {
  const { t } = useLang()
  const STATUS_LABEL   = getStatusLabel(t)
  const TXN_TYPE_LABEL = getTxnTypeLabel(t)
  const today = new Date().toISOString().split('T')[0]
  const [reportDate, setReportDate] = useState(today)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reconciliation', reportDate],
    queryFn:  () => reconciliationApi.daily({ report_date: reportDate }).then(r => r.data),
    staleTime: 60_000,
  })

  const pnl = data?.pnl_summary

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Date picker */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <Input label={t.date} type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ width: 180 }} />
        <Btn variant="ghost" onClick={() => refetch()}>{t.refresh}</Btn>
        {data && (
          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.text3 }}>{t.totalTransactions}</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20 }}>{data.transaction_count}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.amber }}>{t.pending}</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20, color: C.amber }}>{data.pending_count}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.green }}>{t.completed}</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20, color: C.green }}>{data.completed_count}</div>
            </div>
          </div>
        )}
      </div>

      {isLoading && <Info>{t.loading}</Info>}

      {data && (
        <>
          {/* PnL summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: `${t.volume} (USD)`,  value: `$${fmt(pnl?.total_volume_usd ?? 0, 0)}`, sub: `${pnl?.fx_tx_count ?? 0} ${t.fxTxnCount}`, color: C.navy  },
              { label: t.fxProfit,            value: `+$${fmt(pnl?.total_profit_usd ?? 0)}`,   sub: null,                                         color: C.green },
              { label: t.netProfitUsd,        value: `${parseFloat(pnl?.net_pnl_usd ?? 0) >= 0 ? '+' : ''}${fmt(pnl?.net_pnl_usd ?? 0)}`, sub: null, color: parseFloat(pnl?.net_pnl_usd ?? 0) >= 0 ? C.green : C.red },
            ].map((card, i) => (
              <div key={i} style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
                {card.sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{card.sub}</div>}
              </div>
            ))}
          </div>

          {/* Cash summary */}
          {data.cash_summary?.length > 0 && (
            <Card>
              <CardHeader>{t.cashSummary}</CardHeader>
              <Table>
                <thead><tr><Th>{t.location}</Th><Th>{t.safe}</Th><Th>{t.currencyCol}</Th><Th right>{t.inflow}</Th><Th right>{t.outflow}</Th><Th right>{t.net}</Th></tr></thead>
                <tbody>
                  {data.cash_summary.map((s, i) => (
                    <TrHover key={i}>
                      <Td style={{ color: C.text2 }}>{s.location}</Td>
                      <Td style={{ fontWeight: 500 }}>{s.account}</Td>
                      <Td><span style={{ fontWeight: 600, fontSize: 12, color: C.navy }}>{s.currency}</span></Td>
                      <Td right mono style={{ color: C.green }}>+{fmt(s.in)} {s.currency}</Td>
                      <Td right mono style={{ color: C.red }}>-{fmt(s.out)} {s.currency}</Td>
                      <Td right mono style={{ fontWeight: 700, color: parseFloat(s.net) >= 0 ? C.green : C.red }}>
                        {parseFloat(s.net) >= 0 ? '+' : ''}{fmt(s.net)} {s.currency}
                      </Td>
                    </TrHover>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {/* Transaction list */}
          <Card>
            <CardHeader>{reportDate} — {t.allTransactions}</CardHeader>
            <Table>
              <thead><tr><Th>{t.txnNo}</Th><Th>{t.type}</Th><Th>{t.counterparty}</Th><Th>{t.outgoing}</Th><Th>{t.incoming}</Th><Th right>USD</Th><Th right>{t.profit}</Th><Th>{t.status}</Th></tr></thead>
              <tbody>
                {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
                {data.transactions?.map((txn, i) => (
                  <TrHover key={i}>
                    <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3 }}>{txn.txn_number}</span></Td>
                    <Td style={{ fontSize: 12.5 }}>{TXN_TYPE_LABEL[txn.txn_type] ?? txn.txn_type}</Td>
                    <Td style={{ fontSize: 12.5, color: C.text2 }}>{txn.counterparty}</Td>
                    <Td mono style={{ color: C.red,   fontSize: 12.5 }}>{txn.from}</Td>
                    <Td mono style={{ color: C.green, fontSize: 12.5 }}>{txn.to}</Td>
                    <Td right mono>${fmt(txn.usd_amount)}</Td>
                    <Td right mono style={{ color: parseFloat(txn.profit_usd) >= 0 ? C.green : C.red }}>
                      {parseFloat(txn.profit_usd) > 0 ? '+' : ''}{fmt(txn.profit_usd)}
                    </Td>
                    <Td><Badge type={txn.status} dot>{STATUS_LABEL[txn.status] ?? txn.status}</Badge></Td>
                  </TrHover>
                ))}
                {!data.transactions?.length && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.text4 }}>{t.noTxnOnDate}</td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
