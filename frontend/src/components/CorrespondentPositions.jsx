/**
 * CorrespondentPositions — muhabir netting worklist + tek-tıkla mutabakat.
 *
 * Her muhabirin GL üzerinden net USD bakiyesini gösterir (alacak/borç) ve
 * seçilen bir kasa/banka üzerinden dengeli bir mutabakat kaydı (settlement)
 * oluşturmayı sağlar. Backend: /api/accounting/correspondent-positions + /settle.
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountingApi, accountsApi } from '../utils/api'
import { fmt } from '../utils/format'
import { Card, Table, Th, Td, Btn, Modal, Input, Select, C } from './UI'
import { Icon } from '../components/Icons'
import { STALE_2MIN } from '../constants'
import { useLang } from '../hooks/useLang'
import toast from 'react-hot-toast'

const TILL_TYPES = new Set(['cash', 'bank', 'crypto'])

export default function CorrespondentPositions() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [settleRow, setSettleRow] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['correspondentPositions'],
    queryFn:  () => accountingApi.correspondentPositions().then(r => r.data),
    staleTime: STALE_2MIN,
  })

  const rows = data?.rows ?? []
  const totalRecv = Number(data?.total_receivable_usd ?? 0)
  const totalPay  = Number(data?.total_payable_usd ?? 0)

  if (!isLoading && rows.length === 0) {
    return (
      <Card style={{ padding: '18px 20px', color: C.text4, fontSize: 13 }}>
        <strong style={{ color: C.text2, fontSize: 13.5 }}>{t.nettingTitle}</strong>
        <span style={{ marginInlineStart: 10 }}>— {t.nettingNone}</span>
      </Card>
    )
  }

  return (
    <Card style={{ overflow: 'hidden' }}>
      {/* Header + totals */}
      <div style={{
        padding: '13px 18px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: C.text1 }}>{t.nettingTitle}</div>
          <div style={{ fontSize: 11.5, color: C.text3 }}>{t.nettingSubtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: 10.5, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.nettingTotalRecv}</div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: C.green }}>${fmt(totalRecv)}</div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: 10.5, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.nettingTotalPay}</div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: C.red }}>${fmt(totalPay)}</div>
          </div>
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>{t.nameLabel}</Th>
            <Th right>{t.settleNet}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const net = Number(r.net_usd)
            const isRecv = r.direction === 'receivable'
            const color = isRecv ? C.green : C.red
            return (
              <tr key={r.counterparty_id} style={{ borderTop: `1px solid ${C.border}` }}>
                <Td style={{ fontWeight: 500 }}>{r.name}</Td>
                <Td right>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13, color }}>
                    {isRecv ? '+' : '−'}${fmt(Math.abs(net))}
                  </span>
                  <span style={{
                    marginInlineStart: 8, fontSize: 10.5, fontWeight: 600,
                    padding: '2px 7px', borderRadius: 99,
                    color, background: isRecv ? C.greenBg : C.redBg,
                  }}>
                    {isRecv ? t.nettingReceivable : t.nettingPayable}
                  </span>
                </Td>
                <Td right>
                  <Btn variant="ghost" size="sm" onClick={() => setSettleRow(r)}>
                    <Icon name="check" size={12} color={C.navy} /> {t.nettingSettle}
                  </Btn>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>

      {settleRow && (
        <SettleModal
          row={settleRow}
          onClose={() => setSettleRow(null)}
          onDone={() => {
            setSettleRow(null)
            qc.invalidateQueries({ queryKey: ['correspondentPositions'] })
            qc.invalidateQueries({ queryKey: ['position'] })
            qc.invalidateQueries({ queryKey: ['transactions'] })
            toast.success(t.settleDone)
          }}
        />
      )}
    </Card>
  )
}

function SettleModal({ row, onClose, onDone }) {
  const { t } = useLang()
  const [tillId, setTillId] = useState('')
  const [amount, setAmount] = useState('')

  const { data: accs = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn:  () => accountsApi.list({}).then(r => r.data),
    staleTime: STALE_2MIN,
  })
  const tills = useMemo(() => accs.filter(a => TILL_TYPES.has(a.account_type)), [accs])

  const net = Math.abs(Number(row.net_usd))
  const isRecv = row.direction === 'receivable'

  const mut = useMutation({
    mutationFn: () => accountingApi.settle({
      counterparty_id: row.counterparty_id,
      till_account_id: tillId,
      amount_usd: amount === '' ? undefined : Number(amount),
    }),
    onSuccess: onDone,
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  return (
    <Modal
      title={`${t.settleTitle} — ${row.name}`}
      subtitle={`${t.settleNet}: ${isRecv ? '+' : '−'}$${fmt(net)} (${isRecv ? t.nettingReceivable : t.nettingPayable})`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>{t.cancel}</Btn>
          <Btn onClick={() => mut.mutate()} disabled={!tillId || mut.isPending}>
            {mut.isPending ? t.saving : t.settleConfirm}
          </Btn>
        </div>
      }
    >
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Select label={t.settleTill} value={tillId} onChange={e => setTillId(e.target.value)}>
          <option value="">{t.selectSafe}</option>
          {tills.map(a => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency?.code})
            </option>
          ))}
        </Select>
        <Input
          label={t.settleAmount}
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={fmt(net)}
          min={0}
          max={net}
        />
        <div style={{ fontSize: 11.5, color: C.text3 }}>{t.settleFullHint}</div>
      </div>
    </Modal>
  )
}
