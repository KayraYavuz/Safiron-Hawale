import { useState, useCallback } from 'react'
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
const BLANK_CO   = { name: '', code: '' }

export default function Users() {
  const { t } = useLang()
  const { user: me } = useAuthStore()
  const isSuperAdmin = me?.role === 'super_admin'
  const ROLE_INFO = getRoleInfo(t)
  const qc = useQueryClient()
  const [showForm,   setShowForm]   = useState(false)
  const [showCo,     setShowCo]     = useState(false)
  const [resetId,    setResetId]    = useState(null)
  const [newPass,    setNewPass]    = useState('')
  const [form,       setForm]       = useState(BLANK_USER)
  const [coForm,     setCoForm]     = useState(BLANK_CO)

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
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); setForm(BLANK_USER); toast.success(t.userCreated) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
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
  const createCoMut = useMutation({
    mutationFn: companiesApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['companies'] }); setShowCo(false); setCoForm(BLANK_CO); toast.success('Şirket oluşturuldu') },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const approveMut = useMutation({
    mutationFn: usersApi.approve,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Kullanıcı onaylandı') },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const regenPinMut = useMutation({
    mutationFn: usersApi.regeneratePin,
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      navigator.clipboard.writeText(`bağla ${res.data.new_pin}`)
      toast.success(`Yeni PIN: ${res.data.new_pin} — panoya kopyalandı`)
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const handleDelete = useCallback((u) => {
    if (window.confirm(`${u.name} ${t.deleteUserConfirm}`)) deleteMut.mutate(u.id)
  }, [deleteMut, t])

  const companyName = (id) => companies.find(c => c.id === id)?.name || '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Üst butonlar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {isSuperAdmin && (
          <Btn variant="ghost" onClick={() => setShowCo(!showCo)}>
            <Icon name="building" size={14} color={C.navy} /> Şirket Ekle
          </Btn>
        )}
        <Btn onClick={() => setShowForm(!showForm)}>
          <Icon name="plus" size={14} color="white" /> {t.newUser}
        </Btn>
      </div>

      {/* Şirket oluşturma formu (sadece super_admin) */}
      {isSuperAdmin && showCo && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>Yeni Şirket</div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label="Şirket Adı"  value={coForm.name} onChange={e => setCoForm(x => ({ ...x, name: e.target.value }))} placeholder="Örn: ZaimFinx" />
              <Input label="Kod (benzersiz)" value={coForm.code} onChange={e => setCoForm(x => ({ ...x, code: e.target.value.toUpperCase() }))} placeholder="Örn: ZAIMFINX" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn onClick={() => createCoMut.mutate(coForm)} disabled={createCoMut.isPending || !coForm.name || !coForm.code}>
                {createCoMut.isPending ? t.creating : t.create}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowCo(false)}>{t.cancel}</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Kullanıcı oluşturma formu */}
      {showForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>{t.newUser}</div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label={t.fullName}      value={form.name}     onChange={e => setForm(x => ({ ...x, name: e.target.value }))}     placeholder="Ahmed Al-Rashidi" />
              <Input label={t.email}         type="email" value={form.email} onChange={e => setForm(x => ({ ...x, email: e.target.value }))} placeholder="ahmed@sirket.com" />
              <Input label={t.passwordLabel} type="password" value={form.password} onChange={e => setForm(x => ({ ...x, password: e.target.value }))} placeholder={t.minChars} />
              <Select label={t.role} value={form.role} onChange={e => setForm(x => ({ ...x, role: e.target.value }))}>
                <option value="admin">{t.adminDesc}</option>
                <option value="accounting">{t.accountingDesc}</option>
                <option value="viewer">{t.viewerDesc}</option>
              </Select>
              {isSuperAdmin && (
                <Select label="Şirket" value={form.company_id} onChange={e => setForm(x => ({ ...x, company_id: e.target.value }))}
                  style={{ gridColumn: '1 / -1' }}>
                  <option value="">— Seç —</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </Select>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name || !form.email || !form.password || (isSuperAdmin && !form.company_id)}>
                {createMut.isPending ? t.creating : t.create}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>{t.cancel}</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Kullanıcı listesi */}
      <Card>
        <Table>
          <thead><tr>
            <Th>{t.nameLabel}</Th>
            <Th>{t.email}</Th>
            <Th>{t.role}</Th>
            {isSuperAdmin && <Th>Şirket</Th>}
            <Th>Telegram PIN</Th>
            <Th>{t.status}</Th>
            <Th right>{t.action}</Th>
          </tr></thead>
          <tbody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={isSuperAdmin ? 7 : 6} />)}
            {users.map(u => {
              const ri = ROLE_INFO[u.role] ?? ROLE_INFO.viewer
              return (
                <tr key={u.id}>
                  <Td style={{ fontWeight: 500 }}>{u.name}</Td>
                  <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: C.text2 }}>{u.email}</span></Td>
                  <Td><span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 100, background: ri.bg, color: ri.color }}>{ri.label}</span></Td>
                  {isSuperAdmin && <Td><span style={{ fontSize: 12, color: C.text2 }}>{companyName(u.company_id)}</span></Td>}
                  <Td>
                    {u.bot_pin ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 6,
                          background: u.telegram_id ? '#E8F5E9' : '#F3F4F6',
                          color: u.telegram_id ? C.green : C.text2,
                          letterSpacing: '0.05em',
                        }}>
                          {u.bot_pin}
                        </span>
                        {u.telegram_id
                          ? <span title="Telegram'a bağlı" style={{ fontSize: 14 }}>🔗</span>
                          : <span title="Henüz bağlı değil" style={{ fontSize: 14 }}>💬</span>
                        }
                        <button
                          title="Kopyala"
                          onClick={() => { navigator.clipboard.writeText(`bağla ${u.bot_pin}`); toast.success('Kopyalandı!') }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: C.text3, fontSize: 13 }}
                        >📋</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: C.text4 }}>—</span>
                    )}
                  </Td>
                  <Td>
                    <span style={{ fontSize: 12, fontWeight: 500, color: u.is_active ? C.green : C.red }}>{u.is_active ? t.active : t.inactive}</span>
                    {!u.is_approved && (
                      <span style={{ fontSize: 11, marginLeft: 6, padding: '2px 7px', borderRadius: 100, background: '#FFF3CD', color: '#856404' }}>Onay Bekliyor</span>
                    )}
                  </Td>
                  <Td>
                    {resetId === u.id ? (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder={t.newPassword} style={{ width: 140, padding: '6px 10px' }} />
                        <Btn style={{ fontSize: 12, padding: '6px 12px' }} disabled={!newPass || resetMut.isPending}
                          onClick={() => {
                            if (window.confirm(`${u.name} için şifre değiştirilsin mi?`))
                              resetMut.mutate({ id: u.id, password: newPass })
                          }}
                        >{t.save}</Btn>
                        <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => { setResetId(null); setNewPass('') }}>{t.cancel}</Btn>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {!u.is_approved && (
                          <Btn style={{ fontSize: 12, padding: '6px 12px', background: C.green }} onClick={() => approveMut.mutate(u.id)} disabled={approveMut.isPending}>Onayla</Btn>
                        )}
                        <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setResetId(u.id)}>{t.passwordBtn}</Btn>
                        <button
                          title="PIN yenile — Telegram bağlantısı sıfırlanır"
                          disabled={regenPinMut.isPending}
                          onClick={() => {
                            if (window.confirm(`${u.name} için yeni PIN oluşturulsun mu?\nEski PIN ve Telegram bağlantısı silinir.`))
                              regenPinMut.mutate(u.id)
                          }}
                          style={{ fontSize: 13, background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: C.text2, opacity: regenPinMut.isPending ? 0.5 : 1 }}
                        >🔄 PIN</button>
                        <Btn variant="danger" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => handleDelete(u)}>{t.delete}</Btn>
                      </div>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
