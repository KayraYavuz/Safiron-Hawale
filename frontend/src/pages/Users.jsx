import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../utils/api'
import { Card, Table, Th, Td, Btn, Input, Select, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { ROLE_INFO } from '../constants'

const BLANK_FORM = { name: '', email: '', password: '', role: 'accounting' }

export default function Users() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [resetId,  setResetId]  = useState(null)
  const [newPass,  setNewPass]  = useState('')
  const [form,     setForm]     = useState(BLANK_FORM)

  const { data = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: usersApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); setForm(BLANK_FORM); toast.success('Kullanıcı oluşturuldu') },
    onError:    e  => toast.error(e.response?.data?.detail || 'Hata'),
  })
  const deleteMut = useMutation({
    mutationFn: usersApi.delete,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Silindi') },
    onError:    e  => toast.error(e.response?.data?.detail || 'Hata'),
  })
  const resetMut = useMutation({
    mutationFn: ({ id, password }) => usersApi.resetPassword(id, password),
    onSuccess:  () => { setResetId(null); setNewPass(''); toast.success('Şifre güncellendi') },
    onError:    e  => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const handleDelete = useCallback((u) => {
    if (window.confirm(`${u.name} silinsin mi?`)) deleteMut.mutate(u.id)
  }, [deleteMut])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => setShowForm(!showForm)}>
          <Icon name="plus" size={14} color="white" /> Yeni Kullanıcı
        </Btn>
      </div>

      {showForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>Yeni Kullanıcı</div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label="Ad Soyad"  value={form.name}     onChange={e => setForm(x => ({ ...x, name: e.target.value }))}     placeholder="Ahmed Al-Rashidi" />
              <Input label="E-posta"   type="email" value={form.email}    onChange={e => setForm(x => ({ ...x, email: e.target.value }))}    placeholder="ahmed@sirket.com" />
              <Input label="Şifre"     type="password" value={form.password} onChange={e => setForm(x => ({ ...x, password: e.target.value }))} placeholder="En az 6 karakter" />
              <Select label="Rol"      value={form.role}     onChange={e => setForm(x => ({ ...x, role: e.target.value }))}>
                <option value="admin">Admin — her şeyi yapabilir</option>
                <option value="accounting">Muhasebe — işlem girer ve onaylar</option>
                <option value="viewer">Görüntüleyici — sadece görür</option>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name || !form.email || !form.password}>
                {createMut.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>İptal</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <thead><tr><Th>Ad</Th><Th>E-posta</Th><Th>Rol</Th><Th>Durum</Th><Th right>İşlem</Th></tr></thead>
          <tbody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
            {data.map(u => {
              const ri = ROLE_INFO[u.role] ?? ROLE_INFO.viewer
              return (
                <tr key={u.id}>
                  <Td style={{ fontWeight: 500 }}>{u.name}</Td>
                  <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: C.text2 }}>{u.email}</span></Td>
                  <Td><span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 100, background: ri.bg, color: ri.color }}>{ri.label}</span></Td>
                  <Td><span style={{ fontSize: 12, fontWeight: 500, color: u.is_active ? C.green : C.red }}>{u.is_active ? '● Aktif' : '○ Pasif'}</span></Td>
                  <Td>
                    {resetId === u.id ? (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Yeni şifre" style={{ width: 140, padding: '6px 10px' }} />
                        <Btn style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => resetMut.mutate({ id: u.id, password: newPass })} disabled={!newPass || resetMut.isPending}>Kaydet</Btn>
                        <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => { setResetId(null); setNewPass('') }}>İptal</Btn>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Btn variant="ghost"  style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setResetId(u.id)}>Şifre</Btn>
                        <Btn variant="danger" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => handleDelete(u)}>Sil</Btn>
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
