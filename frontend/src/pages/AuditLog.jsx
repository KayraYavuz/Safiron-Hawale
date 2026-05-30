import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../utils/api'
import { useAuthStore } from '../store'
import { Card, CardHeader, Table, Th, Td, Info, Select, Input, TrHover, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { AUDIT_ACTION_COLOR } from '../constants'
import { useLang } from '../hooks/useLang'

export default function AuditLog() {
  const { t } = useLang()
  const { user } = useAuthStore()
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')
  const [action,   setAction]   = useState('')
  const [entity,   setEntity]   = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['audit', fromDate, toDate, action, entity],
    queryFn:  () => auditApi.list({
      from_date: fromDate || undefined,
      to_date:   toDate   || undefined,
      action:    action   || undefined,
      entity:    entity   || undefined,
      limit:     500,
    }).then(r => r.data),
    enabled:   ['admin', 'super_admin', 'auditor', 'manager'].includes(user?.role),
    staleTime: 30_000,
  })

  if (!['admin', 'super_admin', 'auditor', 'manager'].includes(user?.role)) {
    return <Info type="warning">{t.adminOnly}</Info>
  }

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Input type="date" label={t.startDate} value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 160 }} />
        <Input type="date" label={t.endDate}   value={toDate}   onChange={e => setToDate(e.target.value)}   style={{ width: 160 }} />
        <Select label={t.actionLabel} value={action} onChange={e => setAction(e.target.value)} style={{ width: 160 }}>
          <option value="">{t.allActions}</option>
          {['LOGIN', 'LOGIN_FAIL', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'].map(a => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select label={t.entityLabel} value={entity} onChange={e => setEntity(e.target.value)} style={{ width: 160 }}>
          <option value="">{t.allEntities}</option>
          {['Transaction', 'User', 'Counterparty', 'Account'].map(e => <option key={e} value={e}>{e}</option>)}
        </Select>
      </div>

      <Card>
        <CardHeader action={<span style={{ fontSize: 12, color: C.text3 }}>{data.length} {t.records}</span>}>
          {t.auditLogTitle}
        </CardHeader>
        <Table>
          <thead><tr><Th>{t.dateTime}</Th><Th>{t.user}</Th><Th>{t.actionLabel}</Th><Th>{t.entityLabel}</Th><Th>{t.detail}</Th><Th>{t.ip}</Th></tr></thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
            {data.map(l => {
              const ac = AUDIT_ACTION_COLOR[l.action] ?? { bg: C.surface3, color: C.text2 }
              let detail = ''
              try {
                const d = JSON.parse(l.detail || '{}')
                detail = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' · ')
              } catch {
                detail = l.detail || ''
              }
              return (
                <TrHover key={l.id}>
                  <Td style={{ fontSize: 11.5, color: C.text3, whiteSpace: 'nowrap' }}>{l.created_at?.replace('T', ' ').slice(0, 19)}</Td>
                  <Td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{l.user_name || t.system}</div>
                    {l.user_email && <div style={{ fontSize: 11, color: C.text3 }}>{l.user_email}</div>}
                  </Td>
                  <Td><span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, background: ac.bg, color: ac.color }}>{l.action}</span></Td>
                  <Td style={{ fontSize: 12.5, color: C.text2 }}>{l.entity || '—'}</Td>
                  <Td style={{ fontSize: 11.5, color: C.text3, maxWidth: 280 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
                  </Td>
                  <Td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: C.text4 }}>{l.ip_address || '—'}</Td>
                </TrHover>
              )
            })}
            {!isLoading && !data.length && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: C.text4 }}>{t.noRecords}</td></tr>
            )}
          </tbody>
        </Table>
      </Card>
      </div>
    </>
  )
}
