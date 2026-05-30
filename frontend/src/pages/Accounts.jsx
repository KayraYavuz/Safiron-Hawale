import { useState, useMemo, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountsApi, locationsApi, currenciesApi, reportsApi } from '../utils/api'
import { fmt } from '../utils/format'
import { useAuthStore } from '../store'
import { Card, Table, Th, Td, Btn, Input, Select, TrHover, C } from '../components/UI'
import { SkeletonRow } from '../components/Skeleton'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'
import { ACC_ICONS, STALE_2MIN, STALE_5MIN, STALE_30S } from '../constants'
import { useLang } from '../hooks/useLang'

const BLANK_ACC = {
  location_id: '', currency_id: '', account_type: 'cash',
  name: '', bank_name: '', account_number: '', swift_code: '',
  wallet_address: '', opening_balance: 0,
}
const BLANK_LOC = { code: '', name_tr: '', name_ar: '', name_en: '', country: '' }

export default function Accounts() {
  const { t } = useLang()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'super_admin'].includes(user?.role)

  const [selLoc,      setSelLoc]      = useState(null)
  const [showAccForm, setShowAccForm] = useState(false)
  const [showLocForm, setShowLocForm] = useState(false)
  const [editingLoc,  setEditingLoc]  = useState(null)
  const [accForm,     setAccForm]     = useState(BLANK_ACC)
  const [locForm,     setLocForm]     = useState(BLANK_LOC)

  const { data: accs = [] } = useQuery({ queryKey: ['accounts'],   queryFn: () => accountsApi.list({}).then(r => r.data),    staleTime: STALE_2MIN  })
  const { data: locs = [] } = useQuery({ queryKey: ['locations'],  queryFn: () => locationsApi.list().then(r => r.data),     staleTime: STALE_5MIN  })
  const { data: curs = [] } = useQuery({ queryKey: ['currencies'], queryFn: () => currenciesApi.list().then(r => r.data),    staleTime: STALE_5MIN  })
  const { data: pos }       = useQuery({ queryKey: ['position'],   queryFn: () => reportsApi.position().then(r => r.data),   staleTime: STALE_30S   })

  const accMut = useMutation({
    mutationFn: accountsApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['accounts', 'position'] }); setShowAccForm(false); toast.success(t.accountCreated) },
    onError:    e  => toast.error(e.response?.data?.detail || t.error),
  })
  const delAccMut = useMutation({
    mutationFn: accountsApi.delete,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['accounts', 'position'] }); toast.success(t.accountDeleted) },
    onError:    e  => toast.error(e.response?.data?.detail || t.cannotDeleteBalance),
  })
  const createLocMut = useMutation({
    mutationFn: locationsApi.create,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['locations'] }); setShowLocForm(false); setLocForm(BLANK_LOC); toast.success(t.locationCreated) },
    onError:    e  => toast.error(e.response?.data?.detail || t.cannotCreateLoc),
  })
  const updateLocMut = useMutation({
    mutationFn: ({ id, data }) => locationsApi.update(id, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['locations'] }); setEditingLoc(null); toast.success(t.locationUpdated) },
    onError:    e  => toast.error(e.response?.data?.detail || t.cannotUpdateLoc),
  })
  const deleteLocMut = useMutation({
    mutationFn: locationsApi.delete,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['locations', 'accounts', 'position'] }); toast.success(t.locationDeleted) },
    onError:    e  => toast.error(e.response?.data?.detail || t.cannotDeleteLocAccounts),
  })

  const handleDeleteAcc = useCallback((e, acc) => {
    e.stopPropagation()
    if (window.confirm(`"${acc.name}" ${t.deleteAccountConfirm}`))
      delAccMut.mutate(acc.id)
  }, [delAccMut, t])

  const handleDeleteLoc = useCallback((e, loc) => {
    e.stopPropagation()
    if (window.confirm(`"${loc.name_tr}" ${t.deleteLocConfirm}`))
      deleteLocMut.mutate(loc.id)
  }, [deleteLocMut, t])

  const handleEditLoc = useCallback((e, loc) => {
    e.stopPropagation()
    setEditingLoc({ id: loc.id, name_tr: loc.name_tr, name_ar: loc.name_ar || '', name_en: loc.name_en || '', country: loc.country || '' })
  }, [])

  const posMap = useMemo(() => {
    const map = {}
    pos?.accounts?.forEach(a => { map[a.account_id] = a })
    return map
  }, [pos])

  const byLoc = useMemo(() =>
    locs.map(l => ({ ...l, accounts: accs.filter(a => a.location_id === l.id) })),
    [locs, accs]
  )

  const sortedCurs = useMemo(() => [...curs].sort((a, b) => a.code.localeCompare(b.code)), [curs])

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {isAdmin && (
          <Btn variant="ghost" onClick={() => { setShowLocForm(!showLocForm); setShowAccForm(false) }}>
            <Icon name="plus" size={14} color={C.navy} /> {t.newLocation}
          </Btn>
        )}
        <Btn onClick={() => { setShowAccForm(!showAccForm); setShowLocForm(false) }}>
          <Icon name="plus" size={14} color="white" /> {t.newAccount}
        </Btn>
      </div>

      {isAdmin && showLocForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>{t.newLocation}</div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label={t.codeMax10}  value={locForm.code}    onChange={e => setLocForm(x => ({ ...x, code: e.target.value.toUpperCase() }))}    placeholder="LDN" maxLength={10} />
              <Input label={t.countryCode} value={locForm.country} onChange={e => setLocForm(x => ({ ...x, country: e.target.value.toUpperCase() }))} placeholder="GBR" maxLength={3} />
              <Input label={t.nameTr}     value={locForm.name_tr} onChange={e => setLocForm(x => ({ ...x, name_tr: e.target.value }))}               placeholder="Londra" />
              <Input label={t.nameAr}     value={locForm.name_ar} onChange={e => setLocForm(x => ({ ...x, name_ar: e.target.value }))}               placeholder="لندن" />
              <Input label={t.nameEn}     value={locForm.name_en} onChange={e => setLocForm(x => ({ ...x, name_en: e.target.value }))}               placeholder="London" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn onClick={() => createLocMut.mutate(locForm)} disabled={createLocMut.isPending || !locForm.code.trim() || !locForm.name_tr.trim()}>
                {createLocMut.isPending ? t.saving : t.save}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowLocForm(false)}>{t.cancel}</Btn>
            </div>
          </div>
        </Card>
      )}

      {isAdmin && editingLoc && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditingLoc(null)}
        >
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: C.navy }}>{t.editLocation}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label={t.nameTr} value={editingLoc.name_tr} onChange={e => setEditingLoc(x => ({ ...x, name_tr: e.target.value }))} />
              <Input label={t.nameAr} value={editingLoc.name_ar} onChange={e => setEditingLoc(x => ({ ...x, name_ar: e.target.value }))} />
              <Input label={t.nameEn} value={editingLoc.name_en} onChange={e => setEditingLoc(x => ({ ...x, name_en: e.target.value }))} />
              <Input label={t.countryCode} value={editingLoc.country} onChange={e => setEditingLoc(x => ({ ...x, country: e.target.value.toUpperCase() }))} maxLength={3} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Btn
                onClick={() => updateLocMut.mutate({ id: editingLoc.id, data: { name_tr: editingLoc.name_tr, name_ar: editingLoc.name_ar, name_en: editingLoc.name_en, country: editingLoc.country } })}
                disabled={updateLocMut.isPending || !editingLoc.name_tr.trim()}
              >
                {updateLocMut.isPending ? t.saving : t.save}
              </Btn>
              <Btn variant="ghost" onClick={() => setEditingLoc(null)}>{t.cancel}</Btn>
            </div>
          </div>
        </div>
      )}

      {showAccForm && (
        <Card>
          <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>{t.newAccount}</div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Select label={t.locationSelect} value={accForm.location_id} onChange={e => setAccForm(x => ({ ...x, location_id: e.target.value }))}>
                <option value="">{t.selectPlaceholder}</option>
                {locs.map(l => <option key={l.id} value={l.id}>{l.name_tr}</option>)}
              </Select>
              <Select label={t.currencySelect} value={accForm.currency_id} onChange={e => setAccForm(x => ({ ...x, currency_id: e.target.value }))}>
                <option value="">{t.selectPlaceholder}</option>
                {sortedCurs.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name_tr}</option>)}
              </Select>
              <Select label={t.accountType} value={accForm.account_type} onChange={e => setAccForm(x => ({ ...x, account_type: e.target.value }))}>
                <option value="cash">{t.cash}</option>
                <option value="bank">{t.bank}</option>
                <option value="crypto">{t.crypto}</option>
              </Select>
              <Input label={t.accountName} value={accForm.name} onChange={e => setAccForm(x => ({ ...x, name: e.target.value }))}
                placeholder={accForm.account_type === 'cash' ? 'Ana Kasa' : accForm.account_type === 'bank' ? 'Garanti USD' : 'Binance USDT'} />
            </div>
            {accForm.account_type === 'bank' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                <Input label={t.bankName}      value={accForm.bank_name}      onChange={e => setAccForm(x => ({ ...x, bank_name: e.target.value }))} />
                <Input label={t.accountNoIban} value={accForm.account_number} onChange={e => setAccForm(x => ({ ...x, account_number: e.target.value }))} placeholder="TR12..." />
                <Input label="SWIFT"           value={accForm.swift_code}     onChange={e => setAccForm(x => ({ ...x, swift_code: e.target.value }))} />
              </div>
            )}
            {accForm.account_type === 'crypto' && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                <Input label={t.walletAddress} value={accForm.wallet_address} onChange={e => setAccForm(x => ({ ...x, wallet_address: e.target.value }))} placeholder="0x1234..." style={{ fontFamily: 'var(--mono)' }} />
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <Input label={t.openingBalance} type="number" value={accForm.opening_balance} onChange={e => setAccForm(x => ({ ...x, opening_balance: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn onClick={() => accMut.mutate(accForm)} disabled={accMut.isPending || !accForm.location_id || !accForm.currency_id || !accForm.name}>
                {accMut.isPending ? t.saving : t.save}
              </Btn>
              <Btn variant="ghost" onClick={() => setShowAccForm(false)}>{t.cancel}</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Location list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {byLoc.map(loc => (
          <Card key={loc.id}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setSelLoc(selLoc === loc.id ? null : loc.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', flex: 1, textAlign: 'start', padding: 0, fontFamily: 'var(--font)' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {loc.code}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{loc.name_tr}</div>
                  <div style={{ fontSize: 11, color: C.text3, direction: 'rtl' }}>{loc.name_ar}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: C.navy, color: 'white', marginInlineStart: 4 }}>
                  {loc.accounts.length} {t.nAccounts}
                </span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {isAdmin && (
                  <>
                    <button onClick={e => handleEditLoc(e, loc)} className="icon-btn"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: C.text3, fontSize: 11.5, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="edit" size={13} color="currentColor" /> {t.edit}
                    </button>
                    <button onClick={e => handleDeleteLoc(e, loc)} disabled={deleteLocMut.isPending} className="icon-btn-danger"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: C.red, fontSize: 11.5, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4, opacity: deleteLocMut.isPending ? 0.5 : 1 }}>
                      <Icon name="trash" size={13} color="currentColor" /> {t.delete}
                    </button>
                  </>
                )}
                <span onClick={() => setSelLoc(selLoc === loc.id ? null : loc.id)}
                  style={{ color: C.text3, display: 'inline-block', transform: selLoc === loc.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', cursor: 'pointer', padding: '4px 6px' }}>▼</span>
              </div>
            </div>

            {selLoc === loc.id && (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                {!loc.accounts.length
                  ? <div style={{ padding: 32, textAlign: 'center', color: C.text3 }}>{t.noAccountInLoc}</div>
                  : <Table>
                      <thead><tr><Th>{t.accountType}</Th><Th>{t.currencyCol}</Th><Th>{t.name}</Th><Th>{t.bankCol}</Th><Th right>{t.instantBalance}</Th><Th right>USD</Th><Th /></tr></thead>
                      <tbody>
                        {loc.accounts.map(acc => {
                          const p      = posMap[acc.id]
                          const bal    = parseFloat(p?.balance     ?? acc.opening_balance)
                          const balUsd = parseFloat(p?.balance_usd ?? 0)
                          return (
                            <tr key={acc.id}>
                              <Td>{ACC_ICONS[acc.account_type]}</Td>
                              <Td><span style={{ fontWeight: 600, color: C.navy }}>{acc.currency?.code}</span></Td>
                              <Td style={{ fontWeight: 500 }}>{acc.name}</Td>
                              <Td style={{ fontSize: 12, color: C.text3 }}>{acc.bank_name || acc.wallet_address || '—'}</Td>
                              <Td right mono style={{ color: bal >= 0 ? C.text1 : C.red }}>{fmt(bal)} {acc.currency?.code}</Td>
                              <Td right mono style={{ color: balUsd >= 0 ? C.green : C.red, fontWeight: 500 }}>{balUsd >= 0 ? '+' : ''}{fmt(balUsd)}</Td>
                              <Td>
                                {isAdmin && (
                                  <button onClick={e => handleDeleteAcc(e, acc)} disabled={delAccMut.isPending}
                                    style={{ fontSize: 11.5, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', padding: '2px 6px', borderRadius: 5, opacity: delAccMut.isPending ? 0.5 : 1 }}
                                  >{t.delete}</button>
                                )}
                              </Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </Table>
                }
              </div>
            )}
          </Card>
        ))}
      </div>
      </div>
    </>
  )
}
