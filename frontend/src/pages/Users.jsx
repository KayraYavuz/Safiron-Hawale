import { useState, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, companiesApi } from '../utils/api'
import { Card, Table, Th, Td, Btn, Input, Select, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { getRoleInfo } from '../constants'
import { useLang } from '../hooks/useLang'
import { useAuthStore } from '../store'

const BLANK_USER = { name: '', email: '', password: '', role: 'accounting', company_id: '' }

export default function Users() {
  const { t } = useLang()
  const { user: me } = useAuthStore()
  const isSuperAdmin = me?.role === 'super_admin'
  const ROLE_INFO = getRoleInfo(t)
  const qc = useQueryClient()

  const [showForm,    setShowForm]    = useState(false)
  const [resetId,     setResetId]     = useState(null)
  const [newPass,     setNewPass]     = useState('')
  const [form,        setForm]        = useState(BLANK_USER)
  const [filterCo,    setFilterCo]    = useState('all')  // super admin şirket filtresi

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list().then(r => r.data),
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn:  () => companiesApi.list().then(r => r.data),
    enabled:  isSuperAdmin,
  })

  const createMut = useMutation({
    mutationFn: usersApi.create,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      setShowForm(false); setForm(BLANK_USER)
      toast.success(t.userCreated)
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  const deleteMut = useMutation({
    mutationFn: usersApi.delete,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(t.deleted) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const resetMut = useMutation({
    mutationFn: ({ id, password }) => usersApi.resetPassword(id, password),
    onSuccess:  () => { setResetId(null); setNewPass(''); toast.success(t.passwordUpdated) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const approveMut = useMutation({
    mutationFn: usersApi.approve,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(t.userApproved) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const regenPinMut = useMutation({
    mutationFn: usersApi.regeneratePin,
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      navigator.clipboard.writeText(`bağla ${res.data.new_pin}`)
      toast.success(`${t.newPinLabel} ${res.data.new_pin} — ${t.copiedToClipboard}`)
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const handleDelete = useCallback((u) => {
    if (window.confirm(`${u.name} ${t.deleteUserConfirm}`)) deleteMut.mutate(u.id)
  }, [deleteMut, t])

  const companyName = (id) => companies.find(c => c.id === id)?.name || '—'

  // Süper admin: şirkete göre filtrele + şirket bazlı grupla
  const filteredUsers = useMemo(() => {
    if (!isSuperAdmin) return users
    if (filterCo === 'all') return users
    return users.filter(u => u.company_id === filterCo)
  }, [users, filterCo, isSuperAdmin])

  // Şirket bazlı kullanıcı sayısı (tab'daki badge için)
  const countByCompany = useMemo(() => {
    const map = {}
    users.forEach(u => { map[u.company_id] = (map[u.company_id] || 0) + 1 })
    return map
  }, [users])

  const colCount = isSuperAdmin ? 7 : 6

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Üst bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={() => setShowForm(!showForm)}>
          <Icon name="plus" size={14} color="white" /> {t.newUser}
        </Btn>
      </div>

      {/* Kullanıcı oluşturma formu */}
      {showForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>
            {t.newUser}
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label={t.fullName}      value={form.name}     onChange={e => setForm(x => ({ ...x, name: e.target.value }))}     placeholder="Ahmed Al-Rashidi" />
              <Input label={t.email}         type="email" value={form.email} onChange={e => setForm(x => ({ ...x, email: e.target.value }))} placeholder="ahmed@sirket.com" />
              <Input label={t.passwordLabel} type="password" value={form.password} onChange={e => setForm(x => ({ ...x, password: e.target.value }))} placeholder={t.minChars} />
              <Select label={t.role} value={form.role} onChange={e => setForm(x => ({ ...x, role: e.target.value }))}>
                <option value="admin">{t.adminDesc}</option>
                <option value="manager">{t.managerDesc}</option>
                <option value="branch_manager">{t.branchManagerDesc}</option>
                <option value="accounting">{t.accountingDesc}</option>
                <option value="data_entry">{t.dataEntryDesc}</option>
                <option value="auditor">{t.auditorDesc}</option>
                <option value="viewer">{t.viewerDesc}</option>
              </Select>
              {isSuperAdmin && (
                <Select
                  label={t.companyCol}
                  value={form.company_id}
                  onChange={e => setForm(x => ({ ...x, company_id: e.target.value }))}
                  style={{ gridColumn: '1 / -1' }}
                >
                  <option value="">{t.selectCompany}</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </Select>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn
                onClick={() => createMut.mutate(form)}
                disabled={createMut.isPending || !form.name || !form.email || !form.password || (isSuperAdmin && !form.company_id)}
              >
                {createMut.isPending ? t.creating : t.create}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>{t.cancel}</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Süper admin: şirket filtre tab'ları */}
      {isSuperAdmin && companies.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCo('all')}
            style={{
              padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${filterCo === 'all' ? C.navy : C.border}`,
              background: filterCo === 'all' ? C.navy : 'white',
              color: filterCo === 'all' ? 'white' : C.text2,
              fontSize: 12.5, fontFamily: 'var(--font)', cursor: 'pointer', fontWeight: 500,
            }}
          >
            {t.allFilter} <span style={{ opacity: 0.7, fontSize: 11 }}>({users.length})</span>
          </button>
          {companies.map(co => (
            <button
              key={co.id}
              onClick={() => setFilterCo(co.id)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${filterCo === co.id ? C.navy : C.border}`,
                background: filterCo === co.id ? C.navy : 'white',
                color: filterCo === co.id ? 'white' : C.text2,
                fontSize: 12.5, fontFamily: 'var(--font)', cursor: 'pointer', fontWeight: 500,
              }}
            >
              {co.name}{' '}
              <span style={{ opacity: 0.65, fontSize: 11 }}>({countByCompany[co.id] || 0})</span>
            </button>
          ))}
        </div>
      )}

      {/* Kullanıcı listesi */}
      <Card>
        <Table>
          <thead><tr>
            <Th>{t.nameLabel}</Th>
            <Th>{t.email}</Th>
            <Th>{t.role}</Th>
            {isSuperAdmin && <Th>{t.companyCol}</Th>}
            <Th>Telegram PIN</Th>
            <Th>{t.status}</Th>
            <Th right>{t.action}</Th>
          </tr></thead>
          <tbody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)}
            {filteredUsers.map(u => {
              const ri = ROLE_INFO[u.role] ?? ROLE_INFO.viewer
              return (
                <tr key={u.id}>
                  <Td style={{ fontWeight: 500 }}>{u.name}</Td>
                  <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: C.text2 }}>{u.email}</span></Td>
                  <Td>
                    <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 100, background: ri.bg, color: ri.color }}>
                      {ri.label}
                    </span>
                  </Td>
                  {isSuperAdmin && (
                    <Td>
                      <span style={{ fontSize: 12, color: C.text2 }}>{companyName(u.company_id)}</span>
                    </Td>
                  )}
                  <Td>
                    {u.bot_pin ? (
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <span style={{
                          fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 6,
                          background: u.telegram_id ? '#E8F5E9' : '#F3F4F6',
                          color: u.telegram_id ? C.green : C.text2,
                          letterSpacing: '0.05em',
                        }}>
                          {u.bot_pin}
                        </span>
                        <span title={u.telegram_id ? t.telegramConnected : t.telegramNotConnected} style={{ fontSize: 13 }}>
                          {u.telegram_id ? '🔗' : '💬'}
                        </span>
                        <button
                          title={t.copied}
                          onClick={() => { navigator.clipboard.writeText(`bağla ${u.bot_pin}`); toast.success(t.copied) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: C.text3, fontSize: 13 }}
                        >📋</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: C.text4 }}>—</span>
                    )}
                  </Td>
                  <Td>
                    <span style={{ fontSize: 12, fontWeight: 500, color: u.is_active ? C.green : C.red }}>
                      {u.is_active ? t.active : t.inactive}
                    </span>
                    {!u.is_approved && (
                      <span style={{ fontSize: 11, marginLeft: 6, padding: '2px 7px', borderRadius: 100, background: '#FFF3CD', color: '#856404' }}>
                        {t.pendingApproval}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {resetId === u.id ? (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Input
                          type="password" value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          placeholder={t.newPassword}
                          style={{ width: 140, padding: '6px 10px' }}
                        />
                        <Btn
                          style={{ fontSize: 12, padding: '6px 12px' }}
                          disabled={!newPass || resetMut.isPending}
                          onClick={() => {
                            if (window.confirm(`${u.name} ${t.confirmPasswordReset}`))
                              resetMut.mutate({ id: u.id, password: newPass })
                          }}
                        >{t.save}</Btn>
                        <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => { setResetId(null); setNewPass('') }}>{t.cancel}</Btn>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {!u.is_approved && (
                          <Btn style={{ fontSize: 12, padding: '5px 10px', background: C.green }} onClick={() => approveMut.mutate(u.id)} disabled={approveMut.isPending}>
                            {t.approve}
                          </Btn>
                        )}
                        <Btn variant="ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setResetId(u.id)}>{t.passwordBtn}</Btn>
                        <button
                          title={t.regenPinTooltip}
                          disabled={regenPinMut.isPending}
                          onClick={() => {
                            if (window.confirm(`${u.name} ${t.confirmRegenPin}`))
                              regenPinMut.mutate(u.id)
                          }}
                          style={{
                            fontSize: 13, background: 'none', border: `1px solid ${C.border}`,
                            borderRadius: 6, cursor: 'pointer', padding: '4px 8px',
                            color: C.text2, opacity: regenPinMut.isPending ? 0.5 : 1,
                          }}
                        >🔄 PIN</button>
                        <Btn variant="danger" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => handleDelete(u)}>{t.delete}</Btn>
                      </div>
                    )}
                  </Td>
                </tr>
              )
            })}
            {!isLoading && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 32, textAlign: 'center', color: C.text4, fontSize: 13 }}>
                  {filterCo !== 'all' ? t.noUsersInThisCompany : t.noUsersYet}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      </div>
    </>
  )
}
