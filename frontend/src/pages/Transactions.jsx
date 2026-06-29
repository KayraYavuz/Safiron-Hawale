import { useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { getTxnTypeLabel, TXN_TYPE_COLOR, getStatusLabel, STALE_2MIN, CAN_CREATE_TXN, CAN_APPROVE_TXN, CAN_DELETE_TXN } from '../constants'
import { useLang } from '../hooks/useLang'

export default function Transactions() {
  const { t } = useLang()
  const TXN_TYPE_LABEL = getTxnTypeLabel(t)
  const STATUS_LABEL   = getStatusLabel(t)
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [showForm,    setShowForm]    = useState(false)
  const [filterStatus, setStatus]    = useState(searchParams.get('status') ?? '')
  const [filterType,   setType]      = useState('')
  const [settleTxn,    setSettleTxn] = useState(null)

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn:  () => transactionsApi.list({}).then(r => r.data),
  })
  const { data: cps  = [] } = useQuery({ queryKey: ['counterparties'], queryFn: () => counterpartiesApi.list({}).then(r => r.data), staleTime: STALE_2MIN })
  const { data: accs = [] } = useQuery({ queryKey: ['accounts'],       queryFn: () => accountsApi.list({}).then(r => r.data),        staleTime: STALE_2MIN })

  const _invalidateDashboard = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['income'] })
    qc.invalidateQueries({ queryKey: ['locPnl'] })
    qc.invalidateQueries({ queryKey: ['position'] })
    qc.invalidateQueries({ queryKey: ['cashMovDash'] })
  }

  const approveMutation = useMutation({
    mutationFn: transactionsApi.approve,
    onSuccess:  () => { _invalidateDashboard(); toast.success(t.approved) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const approveAllMutation = useMutation({
    mutationFn: transactionsApi.approveAll,
    onSuccess:  (res) => {
      _invalidateDashboard()
      toast.success(`${res.data.approved} ${t.approved}`)
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const deleteMutation = useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess:  () => { _invalidateDashboard(); toast.success(t.deleted) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })

  const isAdmin      = CAN_DELETE_TXN.has(user?.role)
  const isAccounting = CAN_CREATE_TXN.has(user?.role)
  const canApprove   = CAN_APPROVE_TXN.has(user?.role)

  const filtered = useMemo(() =>
    txns.filter(t =>
      (!filterStatus || t.status   === filterStatus) &&
      (!filterType   || t.txn_type === filterType)
    ),
    [txns, filterStatus, filterType]
  )

  const pendingCount = useMemo(() => txns.filter(t => t.status === 'pending').length, [txns])

  const approveAll  = useCallback(() => approveAllMutation.mutate(), [approveAllMutation])
  const handleDelete = useCallback((id) => {
    if (window.confirm(t.deleteConfirm)) deleteMutation.mutate(id)
  }, [deleteMutation, t])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Toolbar — glassmorphism ── */}
      <div
        className="glass"
        style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '10px 14px',
          position: 'sticky', top: 62, zIndex: 8,
          animation: 'fadeUp 0.3s ease both',
        }}
      >
        {/* Record count badge */}
        <div style={{
          fontSize: 12, color: C.text3, fontWeight: 500,
          paddingInlineEnd: 10,
          borderInlineEnd: `1px solid ${C.border}`,
          marginInlineEnd: 2,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20, borderRadius: 5,
            background: C.surface3, fontSize: 11, fontWeight: 600, color: C.text2,
          }}>
            {filtered.length}
          </span>
          {t.records}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={filterStatus} onChange={e => setStatus(e.target.value)}
            className="filter-select"
            style={{
              padding: '6px 11px', borderRadius: 7,
              border: `1.5px solid ${filterStatus ? C.navy3 : C.border}`,
              fontSize: 12.5,
              background: filterStatus ? 'rgba(28,49,82,0.05)' : 'rgba(255,255,255,0.8)',
              fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer',
              color: filterStatus ? C.navy : C.text2,
            }}
          >
            <option value="">{t.allStatuses}</option>
            <option value="pending">{t.pending}</option>
            <option value="completed">{t.completed}</option>
          </select>

          <select
            value={filterType} onChange={e => setType(e.target.value)}
            className="filter-select"
            style={{
              padding: '6px 11px', borderRadius: 7,
              border: `1.5px solid ${filterType ? C.navy3 : C.border}`,
              fontSize: 12.5,
              background: filterType ? 'rgba(28,49,82,0.05)' : 'rgba(255,255,255,0.8)',
              fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer',
              color: filterType ? C.navy : C.text2,
            }}
          >
            <option value="">{t.allTypes}</option>
            {Object.entries(TXN_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Approve-all */}
        {canApprove && pendingCount > 0 && (
          <Btn
            variant="ghost"
            size="sm"
            style={{ color: C.green, borderColor: 'rgba(14,164,114,0.3)', background: C.greenBg }}
            onClick={approveAll}
            disabled={approveAllMutation.isPending}
          >
            <Icon name="check" size={13} color={C.green} />
            {approveAllMutation.isPending ? '...' : `${t.approveAll} (${pendingCount})`}
          </Btn>
        )}

        <div style={{ flex: 1 }} />

        {/* New transaction — glow button */}
        {isAccounting && (
          <div className="btn-new">
            <Btn onClick={() => setShowForm(true)}>
              <Icon name="plus" size={14} color="white" />
              {t.newTransaction}
            </Btn>
          </div>
        )}
      </div>

      {/* ── Transactions table ── */}
      <Card style={{ animation: 'fadeUp 0.35s ease 0.08s both' }}>
        <Table>
          <thead>
            <tr>
              <Th>{t.txnNo}</Th>
              <Th>{t.date}</Th>
              <Th>{t.counterparty}</Th>
              <Th>{t.type}</Th>
              <Th>{t.summary}</Th>
              <Th right>{t.netProfit}</Th>
              <Th>{t.status}</Th>
              <Th>{t.supplierCol}</Th>
              {isAccounting && <Th />}
            </tr>
          </thead>
          <tbody className={!isLoading ? 'tbody-stagger' : ''}>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={isAccounting ? 9 : 8} />)
              : filtered.map(txn => {
                  const outs  = txn.legs?.filter(l => l.leg_type === 'out') ?? []
                  const ins   = txn.legs?.filter(l => l.leg_type === 'in')  ?? []
                  const tcol  = TXN_TYPE_COLOR[txn.txn_type] ?? { bg: C.surface3, color: C.text2 }
                  const ss    = txn.supplier_settlement
                  const ssName = !ss ? null
                    : ss.settlement_type === 'registered' ? (ss.counterparty?.name ?? '—')
                    : ss.settlement_type === 'external'   ? (ss.external_name ?? '—')
                    : t.internalSafe

                  return (
                    <TrHover key={txn.id}>
                      <Td>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text3, letterSpacing: '0.02em' }}>
                          {txn.txn_number}
                        </span>
                      </Td>
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
                              {txn.counterparty.name_ar && (
                                <div style={{ fontSize: 11, color: C.text3, direction: 'rtl' }}>{txn.counterparty.name_ar}</div>
                              )}
                            </div>
                          : <span style={{ color: C.text4 }}>—</span>
                        }
                      </Td>
                      <Td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '3px 9px', borderRadius: 99,
                          fontSize: 11.5, fontWeight: 500, ...tcol,
                        }}>
                          {TXN_TYPE_LABEL[txn.txn_type]}
                        </span>
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {outs[0] && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: C.red }}>
                              −{fmt(outs[0].amount)} {outs[0].account?.currency?.code}
                            </span>
                          )}
                          {outs[0] && ins[0] && <span style={{ color: C.text4, fontSize: 11 }}>›</span>}
                          {ins[0] && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: C.green }}>
                              +{fmt(ins[0].amount)} {ins[0].account?.currency?.code}
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td right>
                        {txn.pnl && parseFloat(txn.pnl.net_pnl_usd) !== 0
                          ? <span style={{
                              fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13,
                              color: parseFloat(txn.pnl?.net_pnl_usd ?? 0) > 0 ? C.green : C.red,
                            }}>
                              {parseFloat(txn.pnl?.net_pnl_usd ?? 0) > 0 ? '+' : ''}${fmt(txn.pnl?.net_pnl_usd ?? 0)}
                            </span>
                          : <span style={{ color: C.text4 }}>—</span>
                        }
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Badge type={txn.status} dot>{STATUS_LABEL[txn.status] ?? txn.status}</Badge>
                          {txn.compliance_flagged && (
                            <span title={t.riskFlag} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                              color: C.red, background: C.redBg,
                            }}>⚑ {t.riskFlag}</span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        {!ss
                          ? <span style={{ fontSize: 11.5, color: C.text4 }}>{t.notAssigned}</span>
                          : <div>
                              <span style={{
                                fontSize: 11.5, fontWeight: 500,
                                color: ss.settlement_type === 'internal' ? C.text3 : C.blue,
                              }}>
                                {ssName}
                              </span>
                              {ss.supplier_rate && (
                                <div style={{ fontSize: 10.5, color: C.text3, fontFamily: 'var(--mono)' }}>
                                  {ss.supplier_rate}
                                </div>
                              )}
                            </div>
                        }
                      </Td>
                      {isAccounting && (
                        <Td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Btn
                              variant="ghost" size="sm"
                              style={{ color: C.purple, borderColor: 'rgba(107,70,193,0.25)', background: C.purpleBg }}
                              onClick={() => setSettleTxn(txn)}
                            >
                              {t.assignSupplier}
                            </Btn>
                            {canApprove && txn.status === 'pending' && (
                              <Btn
                                variant="ghost" size="sm"
                                style={{ color: C.blue, borderColor: 'rgba(43,108,176,0.25)', background: C.blueBg }}
                                onClick={() => approveMutation.mutate(txn.id)}
                              >
                                <Icon name="check" size={12} color={C.blue} /> {t.approve}
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
              <tr>
                <td colSpan={isAccounting ? 9 : 8} style={{ padding: 52, textAlign: 'center', color: C.text4, fontSize: 13 }}>
                  {t.noRecords}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {showForm  && <TransactionForm onClose={() => setShowForm(false)} accounts={accs} counterparties={cps} />}
      {settleTxn && <SupplierSettlementModal txn={settleTxn} counterparties={cps} onClose={() => setSettleTxn(null)} />}
    </div>
  )
}
