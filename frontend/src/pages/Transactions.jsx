import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, counterpartiesApi, accountsApi } from '../utils/api'
import { fmt } from '../utils/format'
import { useAuthStore } from '../store'
import { Card, Table, Th, Td, Badge, Btn, TrHover, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import TransactionForm from '../components/TransactionForm'
import SupplierSettlementModal from '../components/SupplierSettlementModal'
import toast from 'react-hot-toast'
import { TXN_TYPE_LABEL, TXN_TYPE_COLOR, STATUS_LABEL, STALE_2MIN } from '../constants'

export default function Transactions() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm]     = useState(false)
  const [filterStatus, setStatus]   = useState('')
  const [filterType,   setType]     = useState('')
  const [settleTxn,    setSettleTxn]= useState(null)

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn:  () => transactionsApi.list({}).then(r => r.data),
  })
  const { data: cps  = [] } = useQuery({ queryKey: ['counterparties'], queryFn: () => counterpartiesApi.list({}).then(r => r.data), staleTime: STALE_2MIN })
  const { data: accs = [] } = useQuery({ queryKey: ['accounts'],       queryFn: () => accountsApi.list({}).then(r => r.data),        staleTime: STALE_2MIN })

  const approveMutation = useMutation({
    mutationFn: transactionsApi.approve,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['transactions'] }); toast.success('Onaylandı') },
    onError:    e  => toast.error(e.response?.data?.detail || 'Hata'),
  })
  const deleteMutation = useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['transactions'] }); toast.success('Silindi') },
    onError:    e  => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const isAdmin      = user?.role === 'admin'
  const isAccounting = user?.role === 'admin' || user?.role === 'accounting'

  // Memoize filter — avoids re-scan on every unrelated state change
  const filtered = useMemo(() =>
    txns.filter(t =>
      (!filterStatus || t.status   === filterStatus) &&
      (!filterType   || t.txn_type === filterType)
    ),
    [txns, filterStatus, filterType]
  )

  const pendingCount = useMemo(() => txns.filter(t => t.status === 'pending').length, [txns])

  const approveAll = useCallback(() => {
    txns.filter(t => t.status === 'pending').forEach(t => approveMutation.mutate(t.id))
  }, [txns, approveMutation])

  const handleDelete = useCallback((id) => {
    if (window.confirm('Bu işlem silinsin mi?')) deleteMutation.mutate(id)
  }, [deleteMutation])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        background: 'white', border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '10px 14px', boxShadow: C.shSm,
      }}>
        <div style={{ fontSize: 12, color: C.text3, fontWeight: 500, paddingRight: 10, borderRight: `1px solid ${C.border}`, marginRight: 2 }}>
          {filtered.length} kayıt
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={filterStatus} onChange={e => setStatus(e.target.value)}
            className="filter-select"
            style={{ padding: '6px 11px', borderRadius: 7, border: `1.5px solid ${filterStatus ? C.navy3 : C.border}`, fontSize: 12.5, background: filterStatus ? 'rgba(28,49,82,0.04)' : 'white', fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer', color: filterStatus ? C.navy : C.text2 }}
          >
            <option value="">Tüm Durumlar</option>
            <option value="pending">Bekliyor</option>
            <option value="completed">Tamamlandı</option>
          </select>
          <select
            value={filterType} onChange={e => setType(e.target.value)}
            className="filter-select"
            style={{ padding: '6px 11px', borderRadius: 7, border: `1.5px solid ${filterType ? C.navy3 : C.border}`, fontSize: 12.5, background: filterType ? 'rgba(28,49,82,0.04)' : 'white', fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer', color: filterType ? C.navy : C.text2 }}
          >
            <option value="">Tüm Türler</option>
            {Object.entries(TXN_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {isAccounting && pendingCount > 0 && (
          <Btn variant="ghost" size="sm" style={{ color: C.green, borderColor: 'rgba(14,164,114,0.3)', background: C.greenBg }} onClick={approveAll}>
            <Icon name="check" size={13} color={C.green} />
            Tümünü Onayla ({pendingCount})
          </Btn>
        )}

        <div style={{ flex: 1 }} />

        {isAccounting && (
          <Btn onClick={() => setShowForm(true)}>
            <Icon name="plus" size={14} color="white" />
            Yeni İşlem
          </Btn>
        )}
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>İşlem No</Th><Th>Tarih</Th><Th>Karşı Taraf</Th><Th>Tür</Th>
              <Th>Özet</Th><Th right>Net Kâr</Th><Th>Durum</Th><Th>Tedarikçi</Th>
              {isAccounting && <Th />}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={isAccounting ? 9 : 8} />)
              : filtered.map(txn => {
                  const outs = txn.legs?.filter(l => l.leg_type === 'out') ?? []
                  const ins  = txn.legs?.filter(l => l.leg_type === 'in')  ?? []
                  const tcol = TXN_TYPE_COLOR[txn.txn_type] ?? { bg: C.surface3, color: C.text2 }
                  const ss   = txn.supplier_settlement
                  const ssName = !ss ? null
                    : ss.settlement_type === 'registered' ? (ss.counterparty?.name ?? '—')
                    : ss.settlement_type === 'external'   ? (ss.external_name ?? '—')
                    : 'İç Kasa'

                  return (
                    <TrHover key={txn.id}>
                      <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3, letterSpacing: '0.02em' }}>{txn.txn_number}</span></Td>
                      <Td style={{ color: C.text2, fontSize: 12.5 }}>{txn.txn_date}</Td>
                      <Td>
                        {txn.counterparty?.name
                          ? <div>
                              <Link
                                to={`/reports?tab=statement&cp=${txn.counterparty_id}`}
                                onClick={e => e.stopPropagation()}
                                style={{ fontWeight: 500, fontSize: 13, color: C.text1, textDecoration: 'none' }}
                                className="row-link"
                              >
                                {txn.counterparty.name}
                              </Link>
                              {txn.counterparty.name_ar && <div style={{ fontSize: 11, color: C.text3, direction: 'rtl' }}>{txn.counterparty.name_ar}</div>}
                            </div>
                          : <span style={{ color: C.text4 }}>—</span>
                        }
                      </Td>
                      <Td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 500, ...tcol }}>
                          {TXN_TYPE_LABEL[txn.txn_type]}
                        </span>
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {outs[0] && <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: C.red }}>−{fmt(outs[0].amount)} {outs[0].account?.currency?.code}</span>}
                          {outs[0] && ins[0] && <span style={{ color: C.text4, fontSize: 11 }}>›</span>}
                          {ins[0]  && <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: C.green }}>+{fmt(ins[0].amount)} {ins[0].account?.currency?.code}</span>}
                        </div>
                      </Td>
                      <Td right>
                        {txn.pnl && parseFloat(txn.pnl.net_pnl_usd) !== 0
                          ? <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13, color: parseFloat(txn.pnl?.net_pnl_usd ?? 0) > 0 ? C.green : C.red }}>
                              {parseFloat(txn.pnl?.net_pnl_usd ?? 0) > 0 ? '+' : ''}${fmt(txn.pnl?.net_pnl_usd ?? 0)}
                            </span>
                          : <span style={{ color: C.text4 }}>—</span>
                        }
                      </Td>
                      <Td><Badge type={txn.status} dot>{STATUS_LABEL[txn.status] ?? txn.status}</Badge></Td>
                      <Td>
                        {!ss
                          ? <span style={{ fontSize: 11.5, color: C.text4 }}>Atanmadı</span>
                          : <div>
                              <span style={{ fontSize: 11.5, fontWeight: 500, color: ss.settlement_type === 'internal' ? C.text3 : C.blue }}>{ssName}</span>
                              {ss.supplier_rate && <div style={{ fontSize: 10.5, color: C.text3, fontFamily: 'var(--mono)' }}>{ss.supplier_rate}</div>}
                            </div>
                        }
                      </Td>
                      {isAccounting && (
                        <Td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Btn variant="ghost" size="sm" style={{ color: C.purple, borderColor: 'rgba(107,70,193,0.25)', background: C.purpleBg }} onClick={() => setSettleTxn(txn)}>
                              Tedarikçi Ata
                            </Btn>
                            {txn.status === 'pending' && (
                              <Btn variant="ghost" size="sm" style={{ color: C.blue, borderColor: 'rgba(43,108,176,0.25)', background: C.blueBg }} onClick={() => approveMutation.mutate(txn.id)}>
                                <Icon name="check" size={12} color={C.blue} /> Onayla
                              </Btn>
                            )}
                            {isAdmin && (
                              <Btn variant="danger" size="sm" onClick={() => handleDelete(txn.id)}>
                                <Icon name="trash" size={12} color={C.red} />
                              </Btn>
                            )}
                          </div>
                        </Td>
                      )}
                    </TrHover>
                  )
                })
            }
            {!isLoading && !filtered.length && (
              <tr><td colSpan={isAccounting ? 9 : 8} style={{ padding: 52, textAlign: 'center', color: C.text4, fontSize: 13 }}>Kayıt bulunamadı</td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      {showForm   && <TransactionForm onClose={() => setShowForm(false)} accounts={accs} counterparties={cps} />}
      {settleTxn  && <SupplierSettlementModal txn={settleTxn} counterparties={cps} onClose={() => setSettleTxn(null)} />}
    </div>
  )
}
