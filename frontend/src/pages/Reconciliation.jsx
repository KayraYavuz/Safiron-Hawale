import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reconciliationApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, CardHeader, Table, Th, Td, Badge, Btn, Input, Info, TrHover, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { STATUS_LABEL } from '../constants'

export default function Reconciliation() {
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
        <Input label="Tarih" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ width: 180 }} />
        <Btn variant="ghost" onClick={() => refetch()}>Yenile</Btn>
        {data && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.text3 }}>Toplam İşlem</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20 }}>{data.transaction_count}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.amber }}>Bekliyor</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20, color: C.amber }}>{data.pending_count}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.green }}>Tamamlandı</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20, color: C.green }}>{data.completed_count}</div>
            </div>
          </div>
        )}
      </div>

      {isLoading && <Info>Yükleniyor...</Info>}

      {data && (
        <>
          {/* PnL summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Hacim (USD)',    value: `$${fmt(pnl?.total_volume_usd ?? 0, 0)}`, sub: `${pnl?.fx_tx_count ?? 0} FX/Havale işlemi`, color: C.navy  },
              { label: 'Kur Farkı Kârı', value: `+$${fmt(pnl?.total_profit_usd ?? 0)}`,   sub: null,                                          color: C.green },
              { label: 'Net Kâr (USD)',  value: `${parseFloat(pnl?.net_pnl_usd ?? 0) >= 0 ? '+' : ''}${fmt(pnl?.net_pnl_usd ?? 0)}`, sub: null, color: parseFloat(pnl?.net_pnl_usd ?? 0) >= 0 ? C.green : C.red },
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
              <CardHeader>Kasa Hareketleri Özeti</CardHeader>
              <Table>
                <thead><tr><Th>Lokasyon</Th><Th>Kasa</Th><Th>Döviz</Th><Th right>Giriş</Th><Th right>Çıkış</Th><Th right>Net</Th></tr></thead>
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
            <CardHeader>{reportDate} — Tüm İşlemler</CardHeader>
            <Table>
              <thead><tr><Th>İşlem No</Th><Th>Tür</Th><Th>Karşı Taraf</Th><Th>Çıkan</Th><Th>Giren</Th><Th right>USD</Th><Th right>Kâr</Th><Th>Durum</Th></tr></thead>
              <tbody>
                {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
                {data.transactions?.map((t, i) => (
                  <TrHover key={i}>
                    <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3 }}>{t.txn_number}</span></Td>
                    <Td style={{ fontSize: 12.5 }}>{t.txn_type}</Td>
                    <Td style={{ fontSize: 12.5, color: C.text2 }}>{t.counterparty}</Td>
                    <Td mono style={{ color: C.red,   fontSize: 12.5 }}>{t.from}</Td>
                    <Td mono style={{ color: C.green, fontSize: 12.5 }}>{t.to}</Td>
                    <Td right mono>${fmt(t.usd_amount)}</Td>
                    <Td right mono style={{ color: parseFloat(t.profit_usd) >= 0 ? C.green : C.red }}>
                      {parseFloat(t.profit_usd) > 0 ? '+' : ''}{fmt(t.profit_usd)}
                    </Td>
                    <Td><Badge type={t.status} dot>{STATUS_LABEL[t.status] ?? t.status}</Badge></Td>
                  </TrHover>
                ))}
                {!data.transactions?.length && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.text4 }}>Bu tarihte işlem yok</td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
