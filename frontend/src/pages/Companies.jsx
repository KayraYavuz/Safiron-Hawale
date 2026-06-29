import { Fragment, useState, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi, usersApi } from '../utils/api'
import { Card, Table, Th, Td, Btn, Input, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { useLang } from '../hooks/useLang'
import { getRoleInfo } from '../constants'

function WhatsAppNumberForm({ company, t }) {
  const qc = useQueryClient()
  const [val, setVal] = useState(company.whatsapp_phone_id || '')
  const mut = useMutation({
    mutationFn: () => companiesApi.updateWhatsapp(company.id, { phone_id: val }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success(t.saved) },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })
  return (
    <div style={{
      margin: '0 16px 14px 16px', padding: '12px 20px', borderRadius: 8,
      border: `1.5px solid ${company.whatsapp_phone_id ? '#BBF7D0' : C.border}`,
      background: company.whatsapp_phone_id ? '#F0FDF4' : 'white',
      display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: C.navy, marginBottom: 6 }}>
          💬 {t.whatsappNumberTitle}
        </div>
        <Input value={val} onChange={e => setVal(e.target.value)}
               placeholder={t.whatsappPhoneIdPlaceholder}
               style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
      </div>
      <Btn onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? '...' : t.save}
      </Btn>
    </div>
  )
}

function TelegramBotForm({ company, t }) {
  const qc = useQueryClient()
  const [tokenInput, setTokenInput] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const isSet = !!company.telegram_bot_token

  const botMut = useMutation({
    mutationFn: ({ token }) => companiesApi.updateTelegramBot(company.id, token),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success(data.data.status === 'bot_started' ? t.botStarted : t.tokenCleared)
      setIsEditing(false)
      setTokenInput('')
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const handleSave = () => {
    botMut.mutate({ token: tokenInput })
  }

  const handleClear = () => {
    if (window.confirm(t.confirmDeleteBot)) {
      botMut.mutate({ token: '' })
    }
  }

  return (
    <div style={{
      margin: '8px 16px 14px 16px',
      padding: '16px 20px',
      borderRadius: 8,
      border: `1.5px solid ${isSet ? '#BAE6FD' : C.border}`,
      background: isSet ? '#F0F9FF' : 'white',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>✈️</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: C.navy }}>{t.telegramBotTitle}</span>
            {isSet ? (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
                background: '#BAE6FD', color: '#0369A1', letterSpacing: '0.04em',
              }}>
                {t.botActive}
              </span>
            ) : (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
                background: '#F1F5F9', color: C.text3, letterSpacing: '0.04em',
              }}>
                {t.botNotConnected}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>
            {t.telegramBotDesc}
          </div>
        </div>
      </div>

      {!isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, background: '#F8FAFC',
            border: `1px solid ${C.border}`, fontFamily: 'var(--mono)', fontSize: 12, color: C.text2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {isSet ? '••••••••••••••••••••••••••••••••' : t.noApiToken}
          </div>
          <Btn
            variant="ghost"
            style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0 }}
            onClick={() => { setIsEditing(true); setTokenInput('') }}
          >
            <Icon name="key" size={13} color={C.navy} />
            {isSet ? t.update : t.addToken}
          </Btn>
          {isSet && (
            <Btn
              variant="danger"
              style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}
              onClick={handleClear}
              disabled={botMut.isPending}
            >
              <Icon name="trash" size={13} color="white" />
            </Btn>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <Input
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder={t.enterBotToken}
            style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12 }}
            autoFocus
          />
          <Btn
            style={{ fontSize: 12, padding: '7px 16px', flexShrink: 0 }}
            onClick={handleSave}
            disabled={botMut.isPending || !tokenInput.trim()}
          >
            {botMut.isPending ? '...' : t.save}
          </Btn>
          <Btn
            variant="ghost"
            style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}
            onClick={() => setIsEditing(false)}
          >
            {t.cancel}
          </Btn>
        </div>
      )}
    </div>
  )
}

const BLANK = {
  name: '', code: '',
  admin_name: '', admin_email: '', admin_password: '',
}

export default function Companies() {
  const { t } = useLang()
  const ROLE_INFO = getRoleInfo(t)
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [expandedId, setExpandedId] = useState(null)

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn:  () => companiesApi.list().then(r => r.data),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: companiesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowForm(false)
      setForm(BLANK)
      toast.success(t.companyCreated)
    },
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const toggleMut = useMutation({
    mutationFn: companiesApi.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
    onError: e => toast.error(e.response?.data?.detail || t.error),
  })

  const handleSubmit = useCallback(() => {
    if (!form.name || !form.code || !form.admin_name || !form.admin_email || !form.admin_password) {
      toast.error(t.allFieldsRequired || 'Tüm alanlar zorunlu')
      return
    }
    if (form.admin_password.length < 6) {
      toast.error(t.minChars || 'En az 6 karakter')
      return
    }
    createMut.mutate(form)
  }, [form, createMut, t])

  const companyUsers = (companyId) => users.filter(u => u.company_id === companyId)

  const S = {
    badge: (active) => ({
      fontSize: 11, padding: '2px 9px', borderRadius: 100,
      background: active ? '#D1FAE5' : '#FEE2E2',
      color: active ? '#065F46' : '#991B1B',
      fontWeight: 500,
    }),
    statBox: {
      background: '#F8FAFC', border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '14px 20px',
      display: 'flex', flexDirection: 'column', gap: 3,
    },
    statVal: { fontSize: 22, fontWeight: 700, color: C.navy },
    statLbl: { fontSize: 11.5, color: C.text3, marginTop: 1 },
  }

  const activeCount   = companies.filter(c => c.is_active).length
  const inactiveCount = companies.filter(c => !c.is_active).length
  const totalUsers    = users.filter(u => u.role !== 'super_admin').length

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <div style={S.statBox}>
          <div style={S.statVal}>{companies.length}</div>
          <div style={S.statLbl}>{t.totalCompanies || 'Toplam Şirket'}</div>
        </div>
        <div style={S.statBox}>
          <div style={{ ...S.statVal, color: '#059669' }}>{activeCount}</div>
          <div style={S.statLbl}>{t.activeCompanies || 'Aktif Şirket'}</div>
        </div>
        <div style={S.statBox}>
          <div style={S.statVal}>{totalUsers}</div>
          <div style={S.statLbl}>{t.totalCompanyUsers || 'Toplam Kullanıcı'}</div>
        </div>
      </div>

      {/* Header + New button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: C.text3 }}>
          {companies.length} {t.companies || 'şirket'}
          {inactiveCount > 0 && ` · ${inactiveCount} ${t.inactive || 'pasif'}`}
        </div>
        <Btn onClick={() => setShowForm(v => !v)}>
          <Icon name="plus" size={14} color="white" />
          {t.newCompany || 'Yeni Şirket'}
        </Btn>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>
            {t.newCompany || 'Yeni Şirket'}
          </div>
          <div style={{ padding: 20 }}>

            {/* Company info */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              {t.companyInfo || 'Şirket Bilgileri'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label={t.companyName || 'Şirket Adı'}
                value={form.name}
                onChange={e => setForm(x => ({ ...x, name: e.target.value }))}
                placeholder="Örn: ZaimFinx"
              />
              <Input
                label={t.companyCode || 'Şirket Kodu (benzersiz)'}
                value={form.code}
                onChange={e => setForm(x => ({ ...x, code: e.target.value.toUpperCase() }))}
                placeholder="Örn: ZAIMFINX"
              />
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: C.border, margin: '18px 0' }} />

            {/* Admin info */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              {t.firstAdminInfo || 'İlk Admin Bilgileri'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input
                label={t.fullName || 'Ad Soyad'}
                value={form.admin_name}
                onChange={e => setForm(x => ({ ...x, admin_name: e.target.value }))}
                placeholder="Ali Yılmaz"
              />
              <Input
                label={t.email || 'E-posta'}
                type="email"
                value={form.admin_email}
                onChange={e => setForm(x => ({ ...x, admin_email: e.target.value }))}
                placeholder="ali@sirket.com"
              />
              <Input
                label={t.passwordLabel || 'Şifre'}
                type="password"
                value={form.admin_password}
                onChange={e => setForm(x => ({ ...x, admin_password: e.target.value }))}
                placeholder={t.minChars || 'En az 6 karakter'}
                style={{ gridColumn: '1 / -1' }}
              />
            </div>

            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 8,
              background: '#EFF6FF', border: '1px solid #BFDBFE',
              fontSize: 12, color: '#1E40AF',
            }}>
              {t.companyAdminNote || 'Bu admin yalnızca kendi şirketinin verilerine erişebilir. Başka şirketlerin verilerini göremez.'}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn
                onClick={handleSubmit}
                disabled={createMut.isPending || !form.name || !form.code || !form.admin_name || !form.admin_email || !form.admin_password}
              >
                {createMut.isPending ? (t.creating || 'Oluşturuluyor...') : (t.create || 'Oluştur')}
              </Btn>
              <Btn variant="ghost" onClick={() => { setShowForm(false); setForm(BLANK) }}>
                {t.cancel || 'İptal'}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Company list */}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t.companyName || 'Şirket'}</Th>
              <Th>{t.companyCode || 'Kod'}</Th>
              <Th>{t.users || 'Kullanıcılar'}</Th>
              <Th>{t.createdAt || 'Oluşturulma'}</Th>
              <Th>{t.status || 'Durum'}</Th>
              <Th right>{t.action || 'İşlem'}</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
            {companies.map(co => {
              const coUsers = companyUsers(co.id)
              const admin   = coUsers.find(u => u.role === 'admin')
              const isExpanded = expandedId === co.id

              return (
                <Fragment key={co.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : co.id)}>
                    <Td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 7,
                          background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#C9A84C', flexShrink: 0,
                        }}>
                          {co.code.slice(0, 2)}
                        </div>
                        {co.name}
                      </div>
                    </Td>
                    <Td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: C.text2 }}>{co.code}</span>
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12 }}>{coUsers.length} {t.users || 'kullanıcı'}</span>
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: C.text3 }}>
                        {co.created_at ? new Date(co.created_at).toLocaleDateString('tr-TR') : '—'}
                      </span>
                    </Td>
                    <Td>
                      <span style={S.badge(co.is_active)}>
                        {co.is_active ? (t.active || '● Aktif') : (t.inactive || '○ Pasif')}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Btn
                          variant={co.is_active ? 'danger' : 'ghost'}
                          style={{ fontSize: 12, padding: '5px 12px' }}
                          onClick={e => { e.stopPropagation(); if (window.confirm(co.is_active ? (t.deactivateCompanyConfirm || `${co.name} pasife alınsın mı?`) : (t.activateCompanyConfirm || `${co.name} aktife alınsın mı?`))) toggleMut.mutate(co.id) }}
                          disabled={toggleMut.isPending}
                        >
                          {co.is_active ? (t.deactivate || 'Pasife Al') : (t.activate || 'Aktife Al')}
                        </Btn>
                      </div>
                    </Td>
                  </tr>

                  {/* Expanded detail section */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} style={{ padding: '4px 0 16px 0', background: '#F8FAFC' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          
                          {/* Telegram bot token settings */}
                          <TelegramBotForm company={co} t={t} />
                          <WhatsAppNumberForm company={co} t={t} />

                          {/* Company users list */}
                          <div style={{ margin: '0 16px 8px 16px', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', background: 'white' }}>
                            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 12, color: C.navy, background: '#F8FAFC' }}>
                              {t.users || 'Kullanıcılar'} ({coUsers.length})
                            </div>
                            {coUsers.length === 0 ? (
                              <div style={{ padding: '16px 20px', color: C.text3, fontSize: 13 }}>
                                {t.noUsersInCompany || 'Bu şirkette kullanıcı yok'}
                              </div>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: '#F1F5F9' }}>
                                    <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: C.text3 }}>{t.nameLabel || 'Ad'}</th>
                                    <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: C.text3 }}>{t.email || 'E-posta'}</th>
                                    <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: C.text3 }}>{t.role || 'Rol'}</th>
                                    <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: C.text3 }}>{t.status || 'Durum'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {coUsers.map(u => {
                                    const ri = ROLE_INFO[u.role] ?? ROLE_INFO.viewer
                                    return (
                                    <tr key={u.id} style={{ borderTop: `1px solid ${C.border}` }}>
                                      <td style={{ padding: '9px 16px', fontSize: 13, fontWeight: ['admin', 'super_admin', 'manager'].includes(u.role) ? 600 : 400 }}>{u.name}</td>
                                      <td style={{ padding: '9px 16px', fontSize: 12, color: C.text2, fontFamily: 'var(--mono)' }}>{u.email}</td>
                                      <td style={{ padding: '9px 16px', fontSize: 12 }}>
                                        <span style={{
                                          padding: '2px 9px', borderRadius: 100, fontSize: 11,
                                          background: ri.bg, color: ri.color,
                                          fontWeight: 500,
                                        }}>
                                          {ri.label}
                                        </span>
                                      </td>
                                      <td style={{ padding: '9px 16px', fontSize: 12 }}>
                                        <span style={{ color: u.is_active ? '#059669' : '#DC2626' }}>
                                          {u.is_active ? (t.active || '● Aktif') : (t.inactive || '○ Pasif')}
                                        </span>
                                      </td>
                                    </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!isLoading && companies.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: C.text3, fontSize: 13 }}>
                  {t.noCompaniesYet || 'Henüz şirket yok. Yeni Şirket butonuna tıklayın.'}
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
