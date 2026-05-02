// ─── Pages ────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { reportsApi, counterpartiesApi, accountsApi, currenciesApi, locationsApi, ratesApi, transactionsApi, usersApi, supplierSettlementApi, auditApi, reconciliationApi } from '../utils/api'
import { fmt, stripCommas } from '../utils/format'
import { useAuthStore } from '../store'
import { Card, CardHeader, Table, Th, Td, Badge, Btn, StatCard, SumRow, Input, Select, C, Info, TrHover } from '../components/UI'
import { Icon } from '../components/Icons'
import TransactionForm from '../components/TransactionForm'
import SupplierSettlementModal from '../components/SupplierSettlementModal'
import toast from 'react-hot-toast'

export function Dashboard() {
  const { data: pos }    = useQuery({ queryKey:['position'],  queryFn: () => reportsApi.position().then(r=>r.data) })
  const { data: income } = useQuery({ queryKey:['income'],    queryFn: () => reportsApi.incomeStatement({}).then(r=>r.data) })
  const { data: locPnl } = useQuery({ queryKey:['locPnl'],   queryFn: () => reportsApi.locationPnl({}).then(r=>r.data) })
  const { data: cashMov }= useQuery({ queryKey:['cashMovDash'], queryFn: () => reportsApi.cashMovements({}).then(r=>r.data), staleTime: 60_000 })

  // Son 10 hareketi düzleştir (tüm kasalardan)
  const recentMoves = (() => {
    if (!cashMov) return []
    const all = [];
    (cashMov??[]).forEach(acc => acc.movements.forEach(m => all.push({ ...m, account_name: acc.account_name, currency_code: acc.currency_code, location: acc.location_name_tr })))
    return all.slice(-10).reverse()
  })()

  const ViewLink = ({ to, label }) => (
    <Link to={to} style={{
      fontSize: 12, color: C.text3, textDecoration: 'none',
      display: 'flex', alignItems: 'center', gap: 3,
      fontWeight: 500, transition: 'color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.color = C.accent}
    onMouseLeave={e => e.currentTarget.style.color = C.text3}>
      {label} <Icon name="arrowRight" size={12} color="currentColor" />
    </Link>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        <StatCard
          label="Toplam Sermaye"
          value={`$${fmt(pos?.total_usd ?? 0, 0)}`}
          sub="USD konsolide"
          color={C.navy}
          icon={({ size, color }) => <Icon name="building" size={size} color={color} />}
        />
        <StatCard
          label="Kur Farkı Kârı"
          value={`$${fmt(income?.fx_gain_usd ?? 0, 0)}`}
          sub="Dönem toplamı"
          color={C.green}
          icon={({ size, color }) => <Icon name="trendUp" size={size} color={color} />}
        />
        <StatCard
          label="Komisyon Geliri"
          value={`$${fmt(income?.commission_usd ?? 0, 0)}`}
          sub="Dönem toplamı"
          color={C.accent}
          icon={({ size, color }) => <Icon name="briefcase" size={size} color={color} />}
        />
        <StatCard
          label="Net Kâr"
          value={`$${fmt(income?.net_pnl_usd ?? 0, 0)}`}
          sub={`${income?.transaction_count ?? 0} işlem`}
          color={C.green}
          icon={({ size, color }) => <Icon name="dollarSign" size={size} color={color} />}
        />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardHeader action={<ViewLink to="/reports" label="Tümü" />}>
            Lokasyon Kârı
          </CardHeader>
          <Table>
            <thead><tr>
              <Th>Lokasyon</Th>
              <Th right>Hacim</Th>
              <Th right>Kur Kârı</Th>
              <Th right>Net Kâr</Th>
            </tr></thead>
            <tbody>
              {locPnl?.map(l => (
                <TrHover key={l.location_id}>
                  <Td>
                    <div style={{ fontWeight:500 }}>{l.location_name_tr}</div>
                    <div style={{ fontSize:11, color:C.text3, direction:'rtl' }}>{l.location_name_ar}</div>
                  </Td>
                  <Td right mono>${fmt(l.volume_usd, 0)}</Td>
                  <Td right mono style={{ color:C.green }}>+${fmt(l.fx_gain_usd, 0)}</Td>
                  <Td right mono style={{ color:C.green, fontWeight:600 }}>+${fmt(l.net_pnl_usd, 0)}</Td>
                </TrHover>
              ))}
              {!locPnl?.length && <tr><td colSpan={4} style={{ padding:40, textAlign:'center', color:C.text4, fontSize:13 }}>Henüz veri yok</td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader action={<ViewLink to="/accounts" label="Hesaplar" />}>
            Anlık Pozisyon
          </CardHeader>
          <Table>
            <thead><tr>
              <Th>Kasa</Th>
              <Th right>Bakiye</Th>
              <Th right>USD</Th>
            </tr></thead>
            <tbody>
              {pos?.accounts?.map(a => (
                <TrHover key={a.account_id}>
                  <Td>
                    <div style={{ fontWeight:500, fontSize:13 }}>{a.account_name}</div>
                    <div style={{ fontSize:11, color:C.text3 }}>{a.location_name_tr} · {a.currency_code}</div>
                  </Td>
                  <Td right mono style={{ color: parseFloat(a.balance)>=0 ? C.text1 : C.red }}>
                    {fmt(a.balance)} {a.currency_code}
                  </Td>
                  <Td right mono style={{ color: parseFloat(a.balance_usd)>=0 ? C.green : C.red, fontWeight:500 }}>
                    {parseFloat(a.balance_usd)>=0?'+':''}{fmt(a.balance_usd)}
                  </Td>
                </TrHover>
              ))}
              {!pos?.accounts?.length && <tr><td colSpan={3} style={{ padding:40, textAlign:'center', color:C.text4, fontSize:13 }}>Henüz hesap yok</td></tr>}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* Son Kasa Hareketleri */}
      <Card>
        <CardHeader action={<ViewLink to="/reports" label="Tüm Hareketler →" />}>
          Son Kasa Hareketleri
        </CardHeader>
        <Table>
          <thead><tr>
            <Th>Tarih</Th><Th>İşlem No</Th><Th>Kasa</Th><Th>Tür</Th><Th>Karşı Taraf</Th><Th>Yön</Th><Th right>Tutar</Th><Th>Durum</Th>
          </tr></thead>
          <tbody>
            {recentMoves.map((m, i) => {
              const isIn = m.direction === 'Giriş'
              return (
                <TrHover key={i}>
                  <Td style={{ color:C.text2, fontSize:12.5 }}>{m.txn_date}</Td>
                  <Td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.text3 }}>{m.txn_number}</span></Td>
                  <Td style={{ fontSize:12.5 }}><span style={{ fontWeight:500 }}>{m.account_name}</span><span style={{ color:C.text3, fontSize:11, marginLeft:4 }}>{m.location}</span></Td>
                  <Td style={{ fontSize:12.5 }}>{m.type}</Td>
                  <Td style={{ fontSize:12.5, color:C.text2 }}>{m.counterparty}</Td>
                  <Td><span style={{ fontSize:11.5, fontWeight:500, padding:'2px 8px', borderRadius:99, background:isIn?C.greenBg:C.redBg, color:isIn?C.green:C.red }}>{m.direction}</span></Td>
                  <Td right mono style={{ fontWeight:600, color:isIn?C.green:C.red }}>{m.amount} {m.currency_code}</Td>
                  <Td><Badge type={m.status} dot>{{ pending:'Bekliyor', completed:'Tamamlandı', cancelled:'İptal' }[m.status]??m.status}</Badge></Td>
                </TrHover>
              )
            })}
            {!recentMoves.length && <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:C.text4, fontSize:13 }}>Henüz hareket yok</td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export function Transactions() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterType, setFilterType]       = useState('')
  const [settleTxn, setSettleTxn]         = useState(null)  // tedarikçi uzlaşması için

  const { data: txns=[], isLoading } = useQuery({ queryKey:['transactions'], queryFn: () => transactionsApi.list({}).then(r=>r.data) })
  const { data: cps=[] }  = useQuery({ queryKey:['counterparties'], queryFn: () => counterpartiesApi.list({}).then(r=>r.data), staleTime: 2*60*1000 })
  const { data: accs=[] } = useQuery({ queryKey:['accounts'], queryFn: () => accountsApi.list({}).then(r=>r.data) })

  const approveMutation = useMutation({
    mutationFn: transactionsApi.approve,
    onSuccess: () => { qc.invalidateQueries({queryKey:['transactions']}); toast.success('Onaylandı') },
    onError: e => toast.error(e.response?.data?.detail || 'Hata'),
  })
  const deleteMutation = useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess: () => { qc.invalidateQueries({queryKey:['transactions']}); toast.success('Silindi') },
    onError: e => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const isAdmin = user?.role === 'admin'
  const isAccounting = ['admin','accounting'].includes(user?.role)

  const TYPE_LABEL = { remittance:'Havale', fx:'Döviz (FX)', swift:'SWIFT', deposit:'Para Yatırma', withdrawal:'Para Çekme', internal_transfer:'İç Transfer' }
  const TYPE_COLOR = {
    remittance: { bg: C.blueBg, color: C.blue },
    fx:         { bg: 'rgba(107,70,193,0.1)', color: C.purple },
    swift:      { bg: C.surface3, color: C.text2 },
    deposit:    { bg: C.greenBg, color: C.green },
    withdrawal: { bg: C.redBg, color: C.red },
    internal_transfer: { bg: C.amberBg, color: C.amber },
  }

  const filtered = txns.filter(t =>
    (!filterStatus || t.status === filterStatus) &&
    (!filterType   || t.txn_type === filterType)
  )

  const pendingCount = txns.filter(t => t.status === 'pending').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        background: 'white', border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '10px 14px',
        boxShadow: C.shadowSm,
      }}>
        {/* Count */}
        <div style={{
          fontSize: 12, color: C.text3, fontWeight: 500,
          paddingRight: 10, borderRight: `1px solid ${C.border}`,
          marginRight: 2,
        }}>
          {filtered.length} kayıt
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8 }}>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '6px 11px', borderRadius: 7,
              border: `1.5px solid ${filterStatus ? C.navy3 : C.border}`,
              fontSize: 12.5, background: filterStatus ? 'rgba(28,49,82,0.04)' : 'white',
              fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer',
              color: filterStatus ? C.navy : C.text2,
              fontWeight: filterStatus ? 500 : 400,
            }}
          >
            <option value="">Tüm Durumlar</option>
            <option value="pending">Bekliyor</option>
            <option value="completed">Tamamlandı</option>
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{
              padding: '6px 11px', borderRadius: 7,
              border: `1.5px solid ${filterType ? C.navy3 : C.border}`,
              fontSize: 12.5, background: filterType ? 'rgba(28,49,82,0.04)' : 'white',
              fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer',
              color: filterType ? C.navy : C.text2,
              fontWeight: filterType ? 500 : 400,
            }}
          >
            <option value="">Tüm Türler</option>
            {Object.entries(TYPE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Toplu onayla */}
        {isAccounting && pendingCount > 0 && (
          <Btn
            variant="ghost"
            size="sm"
            style={{ color: C.green, borderColor: 'rgba(14,164,114,0.3)', background: C.greenBg }}
            onClick={() => txns.filter(t => t.status==='pending').forEach(t => approveMutation.mutate(t.id))}
          >
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
              <Th>İşlem No</Th>
              <Th>Tarih</Th>
              <Th>Karşı Taraf</Th>
              <Th>Tür</Th>
              <Th>Özet</Th>
              <Th right>Net Kâr</Th>
              <Th>Durum</Th>
              <Th>Tedarikçi</Th>
              {isAccounting && <Th></Th>}

            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} style={{ padding:48, textAlign:'center', color:C.text3 }}>Yükleniyor...</td></tr>}
            {filtered.map(txn => {
              const outs = txn.legs?.filter(l=>l.leg_type==='out') ?? []
              const ins  = txn.legs?.filter(l=>l.leg_type==='in')  ?? []
              const tcol = TYPE_COLOR[txn.txn_type] || { bg: C.surface3, color: C.text2 }
              return (
                <TrHover key={txn.id}>
                  <Td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.text3, letterSpacing:'0.02em' }}>{txn.txn_number}</span></Td>
                  <Td style={{ color:C.text2, fontSize:12.5 }}>{txn.txn_date}</Td>
                  <Td>
                    {txn.counterparty?.name
                      ? <div>
                          <Link
                            to={`/reports?tab=statement&cp=${txn.counterparty_id}`}
                            onClick={e => e.stopPropagation()}
                            style={{ fontWeight:500, fontSize:13, color:C.text1, textDecoration:'none' }}
                            onMouseEnter={e => e.currentTarget.style.color=C.blue}
                            onMouseLeave={e => e.currentTarget.style.color=C.text1}
                          >
                            {txn.counterparty.name}
                          </Link>
                          {txn.counterparty.name_ar && <div style={{ fontSize:11, color:C.text3, direction:'rtl' }}>{txn.counterparty.name_ar}</div>}
                        </div>
                      : <span style={{ color:C.text4 }}>—</span>}
                  </Td>
                  <Td>
                    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:99, fontSize:11.5, fontWeight:500, ...tcol }}>
                      {TYPE_LABEL[txn.txn_type]}
                    </span>
                  </Td>
                  <Td>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      {outs[0] && <span style={{ fontFamily:'var(--mono)', fontSize:12, color:C.red }}>−{fmt(outs[0].amount)} {outs[0].account?.currency?.code}</span>}
                      {outs[0] && ins[0] && <span style={{ color:C.text4, fontSize:11 }}>›</span>}
                      {ins[0]  && <span style={{ fontFamily:'var(--mono)', fontSize:12, color:C.green }}>+{fmt(ins[0].amount)} {ins[0].account?.currency?.code}</span>}
                    </div>
                  </Td>
                  <Td right>
                    {txn.pnl && parseFloat(txn.pnl.net_pnl_usd) !== 0
                      ? <span style={{ fontFamily:'var(--mono)', fontWeight:600, fontSize:13, color: parseFloat(txn.pnl?.net_pnl_usd??0)>0 ? C.green : C.red }}>
                          {parseFloat(txn.pnl?.net_pnl_usd??0)>0?'+':''}\${fmt(txn.pnl?.net_pnl_usd??0)}
                        </span>
                      : <span style={{ color:C.text4 }}>—</span>}
                  </Td>
                  <Td><Badge type={txn.status} dot>{txn.status==='pending'?'Bekliyor':txn.status==='completed'?'Tamamlandı':'İptal'}</Badge></Td>
                  <Td>
                    {(() => {
                        const ss = txn.supplier_settlement
                        if (!ss) return <span style={{ fontSize:11.5, color:C.text4 }}>Atanmadı</span>
                        const isInternal = ss.settlement_type === 'internal'
                        const name = ss.settlement_type === 'registered'
                          ? (ss.counterparty?.name ?? '—')
                          : ss.settlement_type === 'external'
                            ? (ss.external_name ?? '—')
                            : 'İç Kasa'
                        return (
                          <div>
                            <span style={{ fontSize:11.5, fontWeight:500, color: isInternal ? C.text3 : C.blue }}>
                              {name}
                            </span>
                            {ss.supplier_rate && (
                              <div style={{ fontSize:10.5, color:C.text3, fontFamily:'var(--mono)' }}>
                                {ss.supplier_rate}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                  </Td>
                  {isAccounting && (
                    <Td>
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <Btn variant="ghost" size="sm"
                          style={{ color:C.purple, borderColor:'rgba(107,70,193,0.25)', background:C.purpleBg }}
                          onClick={() => setSettleTxn(txn)}>
                          Tedarikçi Ata
                        </Btn>
                        {txn.status==='pending' && (
                          <Btn variant="ghost" size="sm" style={{ color:C.blue, borderColor:'rgba(43,108,176,0.25)', background:C.blueBg }}
                            onClick={() => approveMutation.mutate(txn.id)}>
                            <Icon name="check" size={12} color={C.blue} /> Onayla
                          </Btn>
                        )}
                        {isAdmin && (
                          <Btn variant="danger" size="sm"
                            onClick={() => window.confirm('Silinsin mi?') && deleteMutation.mutate(txn.id)}>
                            <Icon name="trash" size={12} color={C.red} />
                          </Btn>
                        )}
                      </div>
                    </Td>
                  )}
                </TrHover>
              )
            })}
            {!isLoading && !filtered.length && (
              <tr><td colSpan={9} style={{ padding:52, textAlign:'center', color:C.text4, fontSize:13 }}>Kayıt bulunamadı</td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      {showForm && <TransactionForm onClose={() => setShowForm(false)} accounts={accs} counterparties={cps} />}
      {settleTxn && <SupplierSettlementModal txn={settleTxn} counterparties={cps} onClose={() => setSettleTxn(null)} />}
    </div>
  )
}

// ─── Counterparties ───────────────────────────────────────────────────────────
const BLANK_CP = { name:'', name_ar:'', type:'customer', country:'', phone:'', credit_limit_usd:0 }
const CP_TYPE  = { customer:'Müşteri', supplier:'Tedarikçi', both:'Her ikisi', founder:'Ortak' }

export function Counterparties() {
  const qc = useQueryClient()
  const [editId,   setEditId]   = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK_CP)
  const [search, setSearch] = useState('')

  const { data=[], isLoading } = useQuery({ queryKey:['counterparties'], queryFn: () => counterpartiesApi.list({}).then(r=>r.data), staleTime: 2*60*1000 })

  const onSuccess = () => {
    qc.invalidateQueries({queryKey:['counterparties']})
    setShowForm(false); setEditId(null); setForm(BLANK_CP)
    toast.success('Kaydedildi')
  }
  const createMut = useMutation({ mutationFn: counterpartiesApi.create,          onSuccess, onError: e=>toast.error(e.response?.data?.detail||'Hata') })
  const updateMut = useMutation({ mutationFn: ({id,...d})=>counterpartiesApi.update(id,d), onSuccess, onError: e=>toast.error(e.response?.data?.detail||'Hata') })
  const deleteMut = useMutation({
    mutationFn: counterpartiesApi.delete,
    onSuccess: () => { qc.invalidateQueries({queryKey:['counterparties']}); toast.success('Silindi') },
    onError: e => toast.error(e.response?.data?.detail || 'Silinemedi'),
  })

  const handleDelete = (e, cp) => {
    e.stopPropagation()
    if (window.confirm(`"${cp.name}" pasife alınsın mı?\nBağlı işlemi varsa silinemez.`)) {
      deleteMut.mutate(cp.id)
    }
  }

  const openNew  = () => { setForm(BLANK_CP); setEditId(null); setShowForm(true) }
  const openEdit = (cp) => { setForm({ name:cp.name, name_ar:cp.name_ar||'', type:cp.type, country:cp.country||'', phone:cp.phone||'', credit_limit_usd:cp.credit_limit_usd||0 }); setEditId(cp.id); setShowForm(true) }
  const handleSave = () => editId ? updateMut.mutate({id:editId,...form}) : createMut.mutate(form)
  const isPending  = createMut.isPending || updateMut.isPending

  const filtered = search ? data.filter(cp =>
    cp.name?.toLowerCase().includes(search.toLowerCase()) ||
    (cp.name_ar||'').includes(search) ||
    cp.code?.toLowerCase().includes(search.toLowerCase())
  ) : data

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <input
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="İsim, Arapça veya kod ara..."
          style={{ flex:1, padding:'8px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:13.5, fontFamily:'var(--font)', outline:'none' }}
        />
        <Btn onClick={openNew}><Icon name="plus" size={14} color="white"/> Yeni</Btn>
      </div>

      {showForm && (
        <Card>
          <CardHeader>{editId ? 'Düzenle' : 'Yeni Karşı Taraf'}</CardHeader>
          <div style={{ padding:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <Input label="Ad" value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder="Ahmed Al-Rashidi" />
              <Input label="Ad (Arapça)" value={form.name_ar} onChange={e=>setForm(x=>({...x,name_ar:e.target.value}))} placeholder="أحمد الراشدي" style={{ direction:'rtl' }} />
              <Select label="Tür" value={form.type} onChange={e=>setForm(x=>({...x,type:e.target.value}))}>
                <option value="customer">Müşteri</option><option value="supplier">Tedarikçi</option>
                <option value="both">Her ikisi</option><option value="founder">Ortak</option>
              </Select>
              <Input label="Ülke (3 harf)" value={form.country} onChange={e=>setForm(x=>({...x,country:e.target.value.toUpperCase()}))} placeholder="EGY" maxLength={3} />
              <Input label="Telefon" value={form.phone} onChange={e=>setForm(x=>({...x,phone:e.target.value}))} placeholder="+20 123 456 7890" />
              <Input label="Kredi Limiti (USD)" type="number" value={form.credit_limit_usd} onChange={e=>setForm(x=>({...x,credit_limit_usd:e.target.value}))} min={0} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <Btn onClick={handleSave} disabled={isPending||!form.name.trim()}>
                {isPending ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Kaydet'}
              </Btn>
              <Btn variant="ghost" onClick={() => { setShowForm(false); setEditId(null) }}>İptal</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <thead><tr><Th>Kod</Th><Th>Ad</Th><Th>Arapça</Th><Th>Tür</Th><Th>Ülke</Th><Th right>Kredi Limiti</Th><Th></Th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:C.text3 }}>Yükleniyor...</td></tr>}
            {filtered.map(cp => (
              <TrHover key={cp.id} onClick={() => openEdit(cp)}>
                <Td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.text3 }}>{cp.code}</span></Td>
                <Td style={{ fontWeight:500 }}>{cp.name}</Td>
                <Td style={{ direction:'rtl', color:C.text2 }}>{cp.name_ar||'—'}</Td>
                <Td><Badge type={cp.type} dot>{CP_TYPE[cp.type]??cp.type}</Badge></Td>
                <Td style={{ color:C.text2 }}>{cp.country||'—'}</Td>
                <Td right mono>${fmt(cp.credit_limit_usd,0)}</Td>
                <Td>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:11.5, color:C.text3 }}>Düzenle</span>
                    <span style={{ color:C.border }}>·</span>
                    <Link
                      to={`/reports?tab=statement&cp=${cp.id}`}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize:11.5, color:C.blue, textDecoration:'none' }}
                    >Ekstre</Link>
                    <span style={{ color:C.border }}>·</span>
                    <button
                      onClick={e => handleDelete(e, cp)}
                      disabled={deleteMut.isPending}
                      style={{
                        fontSize:11.5, color:C.red, background:'none', border:'none',
                        cursor:'pointer', fontFamily:'var(--font)', padding:0,
                        opacity: deleteMut.isPending ? 0.5 : 1,
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </Td>
              </TrHover>
            ))}
            {!isLoading && !filtered.length && <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:C.text4 }}>
              {search ? 'Arama sonucu yok' : 'Henüz kayıt yok'}
            </td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

// ─── Accounts ─────────────────────────────────────────────────────────────────
export function Accounts() {
  const qc = useQueryClient()
  const [selLoc, setSelLoc] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ location_id:'', currency_id:'', account_type:'cash', name:'', bank_name:'', account_number:'', swift_code:'', wallet_address:'', opening_balance:0 })

  const { data:accs=[] }  = useQuery({ queryKey:['accounts'],    queryFn: () => accountsApi.list({}).then(r=>r.data), staleTime: 2*60*1000 })
  const { data:locs=[] }  = useQuery({ queryKey:['locations'],   queryFn: () => locationsApi.list().then(r=>r.data) })
  const { data:curs=[] }  = useQuery({ queryKey:['currencies'],  queryFn: () => currenciesApi.list().then(r=>r.data), staleTime: 5*60*1000 })
  const { data:pos }      = useQuery({ queryKey:['position'],    queryFn: () => reportsApi.position().then(r=>r.data) })

  const mut = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => { qc.invalidateQueries({queryKey:['accounts','position']}); setShowForm(false); toast.success('Hesap oluşturuldu') },
    onError: e => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const delMut = useMutation({
    mutationFn: accountsApi.delete,
    onSuccess: () => { qc.invalidateQueries({queryKey:['accounts','position']}); toast.success('Hesap silindi') },
    onError: e => toast.error(e.response?.data?.detail || 'Silinemedi — bakiye sıfır değil veya işlem var'),
  })

  const handleDeleteAcc = (e, acc) => {
    e.stopPropagation()
    window.confirm(`"${acc.name}" hesabı silinsin mi?\nBakiye sıfır değilse veya işlem bacağı varsa silinemez.`)
      && delMut.mutate(acc.id)
  }

  const getPos = (id) => pos?.accounts?.find(a => a.account_id === id)
  const byLoc = locs.map(l => ({ ...l, accounts: accs.filter(a => a.location_id === l.id) }))
  const icons = { cash:'💵', bank:'🏦', crypto:'₿' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <Btn onClick={() => setShowForm(!showForm)}><Icon name="plus" size={14} color="white"/> Yeni Hesap</Btn>
      </div>

      {showForm && (
        <Card>
          <CardHeader>Yeni Hesap</CardHeader>
          <div style={{ padding:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <Select label="Lokasyon" value={form.location_id} onChange={e=>setForm(x=>({...x,location_id:e.target.value}))}>
                <option value="">— seç —</option>
                {locs.map(l => <option key={l.id} value={l.id}>{l.name_tr}</option>)}
              </Select>
              <Select label="Para Birimi" value={form.currency_id} onChange={e=>setForm(x=>({...x,currency_id:e.target.value}))}>
                <option value="">— seç —</option>
                {curs.sort((a,b)=>a.code.localeCompare(b.code)).map(c => <option key={c.id} value={c.id}>{c.code} — {c.name_tr}</option>)}
              </Select>
              <Select label="Tür" value={form.account_type} onChange={e=>setForm(x=>({...x,account_type:e.target.value}))}>
                <option value="cash">💵 Nakit</option>
                <option value="bank">🏦 Banka</option>
                <option value="crypto">₿ Kripto</option>
              </Select>
              <Input label="Hesap Adı" value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder={form.account_type==='cash'?'Ana Kasa':form.account_type==='bank'?'Garanti USD':'Binance USDT'} />
            </div>
            {form.account_type==='bank' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
                <Input label="Banka Adı" value={form.bank_name} onChange={e=>setForm(x=>({...x,bank_name:e.target.value}))} placeholder="Garanti Bankası" />
                <Input label="Hesap No / IBAN" value={form.account_number} onChange={e=>setForm(x=>({...x,account_number:e.target.value}))} placeholder="TR12..." />
                <Input label="SWIFT" value={form.swift_code} onChange={e=>setForm(x=>({...x,swift_code:e.target.value}))} placeholder="TGBATRISXXX" />
              </div>
            )}
            {form.account_type==='crypto' && (
              <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
                <Input label="Cüzdan Adresi" value={form.wallet_address} onChange={e=>setForm(x=>({...x,wallet_address:e.target.value}))} placeholder="0x1234..." style={{ fontFamily:'var(--mono)' }} />
              </div>
            )}
            <div style={{ marginTop:14 }}>
              <Input label="Açılış Bakiyesi" type="number" value={form.opening_balance} onChange={e=>setForm(x=>({...x,opening_balance:e.target.value}))} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <Btn onClick={() => mut.mutate(form)} disabled={mut.isPending||!form.location_id||!form.currency_id||!form.name}>{mut.isPending?'Kaydediliyor...':'Kaydet'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>İptal</Btn>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {byLoc.map(loc => (
          <Card key={loc.id}>
            <button onClick={() => setSelLoc(selLoc===loc.id ? null : loc.id)}
              style={{ width:'100%', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--sans)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:C.navy, display:'flex', alignItems:'center', justifyContent:'center', color:C.accent, fontSize:12, fontWeight:700 }}>{loc.code}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{loc.name_tr}</div>
                  <div style={{ fontSize:11, color:C.text3, direction:'rtl' }}>{loc.name_ar}</div>
                </div>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:C.navy, color:'white', marginLeft:4 }}>{loc.accounts.length} hesap</span>
              </div>
              <span style={{ color:C.text3, display:'inline-block', transform: selLoc===loc.id ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
            </button>
            {selLoc===loc.id && (
              <div style={{ borderTop:`1px solid ${C.border}` }}>
                {!loc.accounts.length
                  ? <div style={{ padding:32, textAlign:'center', color:C.text3 }}>Bu lokasyonda hesap yok</div>
                  : <Table>
                      <thead><tr><Th>Tür</Th><Th>Döviz</Th><Th>Ad</Th><Th>Banka</Th><Th right>Anlık Bakiye</Th><Th right>USD</Th><Th></Th></tr></thead>
                      <tbody>
                        {loc.accounts.map(acc => {
                          const p = getPos(acc.id)
                          const bal    = parseFloat(p?.balance    ?? acc.opening_balance)
                          const balUsd = parseFloat(p?.balance_usd ?? 0)
                          return (
                            <tr key={acc.id}>
                              <Td>{icons[acc.account_type]}</Td>
                              <Td><span style={{ fontWeight:600, color:C.navy }}>{acc.currency?.code}</span></Td>
                              <Td style={{ fontWeight:500 }}>{acc.name}</Td>
                              <Td style={{ fontSize:12, color:C.text3 }}>{acc.bank_name||acc.wallet_address||'—'}</Td>
                              <Td right mono style={{ color: bal>=0 ? C.text1 : C.red }}>{fmt(bal)} {acc.currency?.code}</Td>
                              <Td right mono style={{ color: balUsd>=0 ? C.green : C.red, fontWeight:500 }}>{balUsd>=0?'+':''}{fmt(balUsd)}</Td>
                              <Td>
                                <button
                                  onClick={e => handleDeleteAcc(e, acc)}
                                  disabled={delMut.isPending}
                                  style={{
                                    fontSize:11.5, color:C.red, background:'none', border:'none',
                                    cursor:'pointer', fontFamily:'var(--font)', padding:'2px 6px',
                                    borderRadius:5, opacity: delMut.isPending ? 0.5 : 1,
                                  }}
                                  title="Sil (bakiye sıfır ve işlem yoksa)"
                                >
                                  Sil
                                </button>
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
  )
}

// ─── Rates ────────────────────────────────────────────────────────────────────
export function Rates() {
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date:today, currency_code:'', rate_per_usd:'' })

  const { data:rates=[] }  = useQuery({ queryKey:['rates'],      queryFn: () => ratesApi.list({}).then(r=>r.data) })
  const { data:curs=[] }   = useQuery({ queryKey:['currencies'], queryFn: () => currenciesApi.list().then(r=>r.data) })

  const saveMut = useMutation({
    mutationFn: ratesApi.create,
    onSuccess: () => { qc.invalidateQueries({queryKey:['rates','position']}); setShowForm(false); toast.success('Kur kaydedildi') },
    onError: e => toast.error(e.response?.data?.detail || 'Hata'),
  })
  const autoMut = useMutation({
    mutationFn: ratesApi.autoUpdate,
    onSuccess: r => { qc.invalidateQueries({queryKey:['rates','position']}); toast.success(`✅ ${r.data.saved} kur güncellendi`) },
    onError: e => toast.error(e.response?.data?.detail || 'API bağlantı hatası'),
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:10, alignItems:'center', padding:'14px 18px', background:'white', borderRadius:12, border:`1px solid ${C.border}` }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:13.5 }}>Otomatik Kur Güncelleme</div>
          <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>Frankfurter API (ECB) · Her sabah 07:00'de otomatik · EUR, GBP, SAR, AED, TRY, CNY ve daha fazlası</div>
        </div>
        <Btn variant="accent" onClick={() => autoMut.mutate()} disabled={autoMut.isPending}>
          {autoMut.isPending
            ? <><div style={{width:13,height:13,border:'2px solid rgba(13,27,46,0.3)',borderTopColor:C.navy,borderRadius:'50%'}} className="spinning"/> Güncelleniyor...</>
            : <><Icon name="refresh" size={14} color={C.navy}/> Şimdi Güncelle</>}
        </Btn>
        <Btn onClick={() => setShowForm(!showForm)}><Icon name="plus" size={14} color="white"/> Manuel Kur</Btn>
      </div>

      <Info type="warning">⚠ EGP, SDG, NGN, LBP, ETB gibi para birimleri otomatik güncellenmez — piyasa kuru resmi kurdan farklıdır. Manuel olarak girin.</Info>

      {showForm && (
        <Card>
          <CardHeader>Manuel Kur Girişi</CardHeader>
          <div style={{ padding:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <Input label="Tarih" type="date" value={form.date} onChange={e=>setForm(x=>({...x,date:e.target.value}))} />
              <Select label="Para Birimi" value={form.currency_code} onChange={e=>setForm(x=>({...x,currency_code:e.target.value}))}>
                <option value="">— seç —</option>
                {curs.filter(c=>c.code!=='USD').sort((a,b)=>a.code.localeCompare(b.code)).map(c => <option key={c.id} value={c.code}>{c.code} — {c.name_tr}</option>)}
              </Select>
              <div style={{ gridColumn:'1/-1' }}>
                <Input label={`Kur${form.currency_code ? ` — 1 USD = ? ${form.currency_code}` : ''}`} type="text" inputMode="decimal"
                  value={form.rate_per_usd} onChange={e=>setForm(x=>({...x,rate_per_usd:e.target.value.replace(',','.')}))}
                  placeholder={form.currency_code==='EGP'?'52.80':form.currency_code==='SAR'?'3.75':'0.0000'}
                  style={{ fontFamily:'var(--mono)', fontSize:16 }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <Btn onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending||!form.currency_code||!form.rate_per_usd}>{saveMut.isPending?'Kaydediliyor...':'Kaydet'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>İptal</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Para Birimi</Th><Th right>1 USD =</Th><Th>Kaynak</Th></tr></thead>
          <tbody>
            {rates.map(r => (
              <tr key={r.id}>
                <Td style={{ color:C.text2 }}>{r.date}</Td>
                <Td><span style={{ fontWeight:600, color:C.navy, marginRight:6 }}>{r.currency_code}</span><span style={{ fontSize:12, color:C.text3 }}>{curs.find(c=>c.code===r.currency_code)?.name_tr}</span></Td>
                <Td right mono style={{ fontSize:15, fontWeight:600, color:C.accent }}>{fmt(r.rate_per_usd,4)} {r.currency_code}</Td>
                <Td><Badge type={r.source?.includes('auto')?'auto':'manual'}>{r.source?.includes('auto')?'🤖 Otomatik':'✍ Manuel'}</Badge></Td>
              </tr>
            ))}
            {!rates.length && <tr><td colSpan={4} style={{ padding:32, textAlign:'center', color:C.text3 }}>Kur girilmemiş</td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function downloadPDF(title, headers, rows, filename) {
  const { jsPDF } = window.jspdf
  if (!jsPDF) { alert('PDF kütüphanesi yüklenemedi'); return }
  const doc = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 16)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(new Date().toLocaleDateString('tr-TR', { dateStyle: 'long' }), pageW - 14, 16, { align: 'right' })
  const colW = Math.floor((pageW - 28) / headers.length)
  let y = 24; const rowH = 8
  doc.setFillColor(13, 27, 46); doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  doc.rect(14, y, pageW - 28, rowH, 'F')
  headers.forEach((h, i) => doc.text(String(h), 16 + i * colW, y + 5.5))
  y += rowH
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal')
  rows.forEach((row, ri) => {
    if (y > doc.internal.pageSize.getHeight() - 18) { doc.addPage(); y = 18 }
    if (ri % 2 === 0) { doc.setFillColor(245, 247, 250); doc.rect(14, y, pageW - 28, rowH, 'F') }
    row.forEach((cell, i) => doc.text(String(cell ?? ''), 16 + i * colW, y + 5.5))
    y += rowH
  })
  doc.save(filename)
}

function downloadExcel(title, headers, rows, filename) {
  const XLSX = window.XLSX
  if (!XLSX) { alert('Excel kütüphanesi yüklenemedi'); return }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  XLSX.writeFile(wb, filename)
}

function DownloadButtons({ onPDF, onExcel }) {
  return (
    <div style={{ display:'flex', gap:8 }}>
      <button onClick={onPDF} style={{
        padding:'7px 13px', borderRadius:7,
        border:`1px solid rgba(229,62,62,0.3)`, background:'rgba(229,62,62,0.06)',
        color:'#E53E3E', fontSize:12.5, fontWeight:500, cursor:'pointer', fontFamily:'var(--font)',
      }}>↓ PDF</button>
      <button onClick={onExcel} style={{
        padding:'7px 13px', borderRadius:7,
        border:`1px solid rgba(14,164,114,0.3)`, background:'rgba(14,164,114,0.06)',
        color:'#0EA472', fontSize:12.5, fontWeight:500, cursor:'pointer', fontFamily:'var(--font)',
      }}>↓ Excel</button>
    </div>
  )
}

export function Reports() {
  const [searchParams] = useSearchParams()
  const [tab,      setTab]      = useState(searchParams.get('tab') || 'position')
  const [cpId,     setCpId]     = useState(searchParams.get('cp')  || '')
  const [locId,    setLocId]    = useState('')
  const [accId,    setAccId]    = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')

  const { data:pos }      = useQuery({ queryKey:['position'],                 queryFn: () => reportsApi.position().then(r=>r.data),                                                                                enabled: tab==='position' })
  const { data:locPnl }   = useQuery({ queryKey:['locPnl',fromDate,toDate],   queryFn: () => reportsApi.locationPnl({from_date:fromDate||undefined, to_date:toDate||undefined}).then(r=>r.data),                    enabled: tab==='location' })
  const { data:income }   = useQuery({ queryKey:['income',fromDate,toDate],    queryFn: () => reportsApi.incomeStatement({from_date:fromDate||undefined, to_date:toDate||undefined}).then(r=>r.data),               enabled: tab==='income' })
  const { data:stmt }     = useQuery({ queryKey:['stmt',cpId,fromDate,toDate], queryFn: () => reportsApi.statement(cpId,{from_date:fromDate||undefined, to_date:toDate||undefined}).then(r=>r.data),                enabled: tab==='statement' && !!cpId })
  const { data:cashMov }  = useQuery({ queryKey:['cashMov',locId,accId,fromDate,toDate], queryFn: () => reportsApi.cashMovements({location_id:locId||undefined, account_id:accId||undefined, from_date:fromDate||undefined, to_date:toDate||undefined}).then(r=>r.data), enabled: tab==='cash' })
  const { data:cps=[] }   = useQuery({ queryKey:['counterparties'], queryFn: () => counterpartiesApi.list({}).then(r=>r.data), staleTime: 2*60*1000 })
  const { data:locs=[] }  = useQuery({ queryKey:['locations'],      queryFn: () => locationsApi.list().then(r=>r.data),        staleTime: 5*60*1000 })
  const { data:accs=[] }  = useQuery({ queryKey:['accounts'],       queryFn: () => accountsApi.list({}).then(r=>r.data),        staleTime: 2*60*1000 })

  const filteredAccs = locId ? accs.filter(a => a.location_id === locId) : accs

  const TABS = [
    { k:'position',  label:'Pozisyon'        },
    { k:'cash',      label:'Kasa Hareketleri'},
    { k:'location',  label:'Lokasyon Kârı'   },
    { k:'income',    label:'Gelir Tablosu'   },
    { k:'statement', label:'Hesap Ekstresi'  },
    { k:'ai',        label:'AI Analiz'       },
  ]

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportFns = {
    position: (type) => {
      const h = ['Lokasyon','Kasa','Döviz','Bakiye','≈ USD']
      const r = (pos?.accounts ?? []).map(a => [a.location_name_tr, a.account_name, a.currency_code, `${fmt(a.balance)} ${a.currency_code}`, `$${fmt(a.balance_usd)}`])
      r.push(['','','TOPLAM','',`$${fmt(pos?.total_usd??0)}`])
      const t = `Anlık Pozisyon — ${new Date().toLocaleDateString('tr-TR')}`
      type==='pdf' ? downloadPDF(t,h,r,'pozisyon.pdf') : downloadExcel(t,h,r,'pozisyon.xlsx')
    },
    cash: (type) => {
      const h = ['Kasa','Lokasyon','Tarih','İşlem No','Tür','Karşı Taraf','Yön','Tutar','Bakiye']
      const r = []
      ;(cashMov??[]).forEach(acc => acc.movements.forEach(m => r.push([acc.account_name, acc.location_name_tr, m.txn_date, m.txn_number, m.type, m.counterparty, m.direction, `${m.amount} ${acc.currency_code}`, `${m.balance} ${acc.currency_code}`])))
      type==='pdf' ? downloadPDF('Kasa Hareketleri',h,r,'kasa-hareketleri.pdf') : downloadExcel('Kasa Hareketleri',h,r,'kasa-hareketleri.xlsx')
    },
    location: (type) => {
      const h = ['Lokasyon','İşlem','Hacim (USD)','Kur Kârı','Komisyon','Net Kâr']
      const r = (locPnl??[]).map(l => [l.location_name_tr, l.transaction_count, `$${fmt(l.volume_usd,0)}`, `$${fmt(l.fx_gain_usd)}`, `$${fmt(l.commission_usd)}`, `$${fmt(l.net_pnl_usd)}`])
      type==='pdf' ? downloadPDF('Lokasyon Kârı',h,r,'lokasyon-kar.pdf') : downloadExcel('Lokasyon Kârı',h,r,'lokasyon-kar.xlsx')
    },
    income: (type) => {
      const h = ['Kalem','Tutar (USD)']
      const r = [['Kur Farkı Kârı',`$${fmt(income?.fx_gain_usd)}`],['Komisyon',`$${fmt(income?.commission_usd)}`],['Brüt Gelir',`$${fmt(income?.gross_income_usd)}`],['Net Kâr',`$${fmt(income?.net_pnl_usd)}`]]
      type==='pdf' ? downloadPDF('Gelir Tablosu',h,r,'gelir-tablosu.pdf') : downloadExcel('Gelir Tablosu',h,r,'gelir-tablosu.xlsx')
    },
    statement: (type) => {
      if (!stmt) return
      const h = ['İşlem No','Tarih','Tür','Açıklama','Borç','Alacak','USD','Bakiye (USD)','Durum']
      const r = (stmt?.rows??[]).map(s => [s.txn_number, s.txn_date, s.type, s.description, s.debit, s.credit, `$${fmt(s.amount_usd)}`, `$${fmt(s.balance_usd)}`, s.status])
      type==='pdf' ? downloadPDF(`Ekstre — ${stmt.counterparty?.name??''}`,h,r,'ekstre.pdf') : downloadExcel(`Ekstre`,h,r,'ekstre.xlsx')
    },
    ai: (type) => {
      if (!aiData?.analysis) return
      const t = "AI Finansal Analiz Raporu"
      const h = ["Analiz Sonucu"]
      const r = [[aiData.analysis]]
      type==='pdf' ? downloadPDF(t,h,r,'ai-analiz.pdf') : downloadExcel(t,h,r,'ai-analiz.xlsx')
    }
  }

  const { data:aiData, refetch:refetchAI, isFetching:isAiLoading } = useQuery({
    queryKey: ['aiAnalysis'],
    queryFn: () => reportsApi.aiAnalysis().then(r => r.data),
    enabled: false // Manuel çalışacak
  })

  const clearDates = () => { setFromDate(''); setToDate('') }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Tab bar + İndir */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, background:'white', border:`1px solid ${C.border}`, borderRadius:10, padding:4 }}>
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding:'7px 14px', borderRadius:7, fontSize:13, cursor:'pointer', fontFamily:'var(--font)',
              border:'none', transition:'all 0.15s', fontWeight: tab===t.k ? 600 : 400,
              background: tab===t.k ? C.navy : 'transparent',
              color:      tab===t.k ? 'white' : C.text2,
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <DownloadButtons onPDF={() => exportFns[tab]?.('pdf')} onExcel={() => exportFns[tab]?.('excel')} />
      </div>

      {/* Filtreler */}
      <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
        {tab === 'ai' && (
          <Btn onClick={() => refetchAI()} disabled={isAiLoading}>
            {isAiLoading ? 'Analiz Ediliyor...' : 'Yapay Zeka Analizini Başlat'}
          </Btn>
        )}
        {tab === 'statement' && (
...
      {/* ── AI Analiz ── */}
      {tab === 'ai' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <CardHeader>AI Finansal Analiz (Gemini 1.5 Flash)</CardHeader>
            <div style={{ padding:20, minHeight:200, whiteSpace:'pre-wrap', lineHeight:1.6, fontSize:14, color:C.text1 }}>
              {isAiLoading ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:40 }}>
                  <div className="spinning" style={{ width:30, height:30, border:'3px solid rgba(0,0,0,0.1)', borderTopColor:C.navy, borderRadius:'50%' }} />
                  <div style={{ color:C.text3, fontWeight:500 }}>Son 30 günlük veriler analiz ediliyor...</div>
                </div>
              ) : aiData?.analysis ? (
                <div>{aiData.analysis}</div>
              ) : (
                <div style={{ textAlign:'center', color:C.text4, padding:40 }}>
                  <Icon name="refresh" size={32} color={C.border2} style={{ marginBottom:12 }} />
                  <div>Analiz başlatmak için yukarıdaki butona tıklayın.</div>
                </div>
              )}
            </div>
          </Card>
          <Info type="info">
            <strong>Güvenlik Notu:</strong> Yapay zeka sadece anonimleştirilmiş rakamları görür. Müşteri isimleri, telefonları veya özel bilgiler AI modeline gönderilmez. AI sadece "okuma" yetkisine sahiptir, işlem yapamaz.
          </Info>
        </div>
      )}
          <Select value={cpId} onChange={e => setCpId(e.target.value)} style={{ width:200 }}>
            <option value="">— karşı taraf seç —</option>
            {cps.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
          </Select>
        )}
        {tab === 'cash' && (
          <>
            <Select value={locId} onChange={e => { setLocId(e.target.value); setAccId('') }} style={{ width:160 }}>
              <option value="">Tüm Lokasyonlar</option>
              {locs.map(l => <option key={l.id} value={l.id}>{l.name_tr}</option>)}
            </Select>
            <Select value={accId} onChange={e => setAccId(e.target.value)} style={{ width:180 }}>
              <option value="">Tüm Kasalar</option>
              {filteredAccs.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency?.code})</option>)}
            </Select>
          </>
        )}
        {['cash','location','income','statement'].includes(tab) && (
          <>
            <Input type="date" label="Başlangıç" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width:150 }} />
            <Input type="date" label="Bitiş"     value={toDate}   onChange={e => setToDate(e.target.value)}   style={{ width:150 }} />
            {(fromDate || toDate) && (
              <button onClick={clearDates} style={{ padding:'7px 12px', borderRadius:7, border:`1px solid ${C.border}`, background:'white', color:C.text3, cursor:'pointer', fontSize:12.5, fontFamily:'var(--font)', marginBottom:1 }}>
                × Temizle
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Pozisyon ── */}
      {tab === 'position' && (
        <Card>
          <CardHeader action={<span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:16, color:C.green }}>Toplam: ${fmt(pos?.total_usd??0,0)}</span>}>
            Anlık Pozisyon
          </CardHeader>
          <Table>
            <thead><tr><Th>Lokasyon</Th><Th>Kasa</Th><Th>Döviz</Th><Th right>Bakiye</Th><Th right>≈ USD</Th></tr></thead>
            <tbody>
              {pos?.accounts?.map(a => {
                const bal = parseFloat(a.balance), busd = parseFloat(a.balance_usd)
                return (
                  <TrHover key={a.account_id}>
                    <Td style={{ fontWeight:500 }}>{a.location_name_tr}</Td>
                    <Td>{a.account_name}</Td>
                    <Td><span style={{ display:'inline-block', padding:'2px 8px', borderRadius:99, background:C.surface3, fontWeight:600, fontSize:12, color:C.navy }}>{a.currency_code}</span></Td>
                    <Td right mono style={{ color: bal>=0 ? C.text1 : C.red, fontWeight:500 }}>{fmt(a.balance)} {a.currency_code}</Td>
                    <Td right mono style={{ color: busd>=0 ? C.green : C.red, fontWeight:600 }}>{busd>=0?'+':''}{fmt(a.balance_usd)}</Td>
                  </TrHover>
                )
              })}
              {!pos?.accounts?.length && <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:C.text4 }}>Veri yok</td></tr>}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ── Kasa Hareketleri ── */}
      {tab === 'cash' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {!cashMov?.length && <Info>Filtre seçin veya bekleyin...</Info>}
          {cashMov?.map(acc => (
            <Card key={acc.account_id}>
              <CardHeader action={
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <span style={{ fontSize:12, color:C.text3 }}>Açılış: <span style={{ fontFamily:'var(--mono)', color:C.text2 }}>{fmt(acc.opening_balance)} {acc.currency_code}</span></span>
                  <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: parseFloat(acc.closing_balance)>=0 ? C.green : C.red }}>
                    Kapanış: {fmt(acc.closing_balance)} {acc.currency_code}
                  </span>
                </div>
              }>
                {acc.location_name_tr} — {acc.account_name}
                <span style={{ marginLeft:8, padding:'2px 8px', borderRadius:99, background:C.surface3, fontSize:11.5, fontWeight:600, color:C.navy }}>{acc.currency_code}</span>
              </CardHeader>
              {acc.movements.length === 0 ? (
                <div style={{ padding:24, textAlign:'center', color:C.text4, fontSize:13 }}>Bu dönemde hareket yok</div>
              ) : (
                <Table>
                  <thead><tr><Th>Tarih</Th><Th>İşlem No</Th><Th>Tür</Th><Th>Karşı Taraf</Th><Th>Yön</Th><Th right>Tutar</Th><Th right>Bakiye</Th><Th>Durum</Th></tr></thead>
                  <tbody>
                    {acc.movements.map((m, i) => {
                      const isIn = m.direction === 'Giriş'
                      return (
                        <TrHover key={i}>
                          <Td style={{ color:C.text2, fontSize:12.5 }}>{m.txn_date}</Td>
                          <Td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.text3 }}>{m.txn_number}</span></Td>
                          <Td style={{ fontSize:12.5 }}>{m.type}</Td>
                          <Td style={{ fontSize:12.5, color:C.text2 }}>{m.counterparty}</Td>
                          <Td>
                            <span style={{ fontSize:11.5, fontWeight:500, padding:'2px 8px', borderRadius:99, background: isIn ? C.greenBg : C.redBg, color: isIn ? C.green : C.red }}>
                              {m.direction}
                            </span>
                          </Td>
                          <Td right mono style={{ fontWeight:600, color: isIn ? C.green : C.red }}>
                            {m.amount} {acc.currency_code}
                          </Td>
                          <Td right mono style={{ fontWeight:500 }}>{fmt(m.balance)} {acc.currency_code}</Td>
                          <Td><Badge type={m.status} dot>{{ pending:'Bekliyor', completed:'Tamamlandı', cancelled:'İptal' }[m.status]??m.status}</Badge></Td>
                        </TrHover>
                      )
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ── Lokasyon Kârı ── */}
      {tab === 'location' && (
        <Card>
          <CardHeader>Lokasyon Kâr/Zarar — Tamamlanan FX & Havale</CardHeader>
          <Table>
            <thead><tr><Th>Lokasyon</Th><Th right>İşlem</Th><Th right>Hacim (USD)</Th><Th right>Kur Kârı</Th><Th right>Komisyon</Th><Th right>Net Kâr</Th></tr></thead>
            <tbody>
              {locPnl?.map(l => {
                const net = parseFloat(l.net_pnl_usd)
                return (
                  <TrHover key={l.location_id}>
                    <Td><div style={{ fontWeight:500 }}>{l.location_name_tr}</div><div style={{ fontSize:11, color:C.text3, direction:'rtl' }}>{l.location_name_ar}</div></Td>
                    <Td right mono>{l.transaction_count}</Td>
                    <Td right mono style={{ color:C.text2 }}>${fmt(l.volume_usd,0)}</Td>
                    <Td right mono style={{ color: parseFloat(l.fx_gain_usd)>=0 ? C.green : C.red }}>{parseFloat(l.fx_gain_usd)>=0?'+':''}{fmt(l.fx_gain_usd)}</Td>
                    <Td right mono style={{ color:C.green }}>+${fmt(l.commission_usd)}</Td>
                    <Td right mono style={{ fontWeight:700, color: net>=0 ? C.green : C.red }}>{net>=0?'+':''}{fmt(l.net_pnl_usd)}</Td>
                  </TrHover>
                )
              })}
              {!locPnl?.length && <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:C.text4 }}>Tamamlanan FX/Havale işlemi yok</td></tr>}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ── Gelir Tablosu ── */}
      {tab === 'income' && (
        <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:16, alignItems:'start' }}>
          <Card>
            <CardHeader>Gelir Tablosu</CardHeader>
            <div style={{ padding:'16px 20px' }}>
              {income ? (
                <>
                  {[
                    { label:'Kur Farkı Kârı',  value:`+$${fmt(income?.fx_gain_usd??0)}`,      color:C.green },
                    { label:'Komisyon Geliri',  value:`+$${fmt(income?.commission_usd??0)}`,   color:C.green },
                    { label:'Brüt Gelir',       value:`$${fmt(income?.gross_income_usd??0)}`,  color:C.navy,  bold:true, hr:true },
                    { label:'Net Kâr (USD)',    value:`$${fmt(income?.net_pnl_usd??0)}`,       color: parseFloat(income?.net_pnl_usd??0)>=0?C.green:C.red, bold:true, hr:true },
                  ].map((r,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderTop:r.hr?`1px solid ${C.border}`:'none', marginTop:r.hr?6:0 }}>
                      <span style={{ fontSize:14, color:r.bold?C.text1:C.text2, fontWeight:r.bold?600:400 }}>{r.label}</span>
                      <span style={{ fontFamily:'var(--mono)', fontSize:15, fontWeight:r.bold?700:500, color:r.color }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:14, paddingTop:10, borderTop:`1px solid ${C.border}`, fontSize:12, color:C.text3 }}>
                    {income.transaction_count} tamamlanan FX/Havale{(income.from_date||income.to_date) && ` · ${income.from_date??'…'} – ${income.to_date??'…'}`}
                  </div>
                </>
              ) : (
                <div style={{ padding:24, textAlign:'center', color:C.text4 }}>Yükleniyor...</div>
              )}
            </div>
          </Card>
          <Info type="info">
            <strong>Not:</strong> Sadece <strong>tamamlanan</strong> Havale, Döviz ve SWIFT işlemleri dahildir.
            Para yatırma/çekme ve iç transferler kâr hesabına dahil edilmez.
          </Info>
        </div>
      )}

      {/* ── Hesap Ekstresi ── */}
      {tab === 'statement' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {!cpId && <Info>Ekstreyi görüntülemek için bir karşı taraf seçin.</Info>}
          {stmt && (
            <>
              <Card>
                <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:16 }}>{stmt.counterparty?.name}</div>
                    <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>
                      {stmt.counterparty?.code} · {{ customer:'Müşteri', supplier:'Tedarikçi', both:'Müşteri & Tedarikçi', founder:'Ortak' }[stmt.counterparty?.type]??stmt.counterparty?.type}
                      {stmt.counterparty?.name_ar && <span style={{ marginLeft:10, direction:'rtl' }}>{stmt.counterparty.name_ar}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11, color:C.text3, marginBottom:3 }}>Net Bakiye (USD)</div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:24, fontWeight:700, color: parseFloat(stmt.closing_balance_usd)>=0?C.green:C.red }}>
                      {parseFloat(stmt.closing_balance_usd)>=0?'+':''}{fmt(stmt.closing_balance_usd)}
                    </div>
                    <div style={{ fontSize:11, color:C.text3, marginTop:3 }}>
                      {parseFloat(stmt.closing_balance_usd)>0 ? '→ Müşteri borçlu' : parseFloat(stmt.closing_balance_usd)<0 ? '→ Biz borçluyuz' : '→ Sıfır'}
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <Table>
                  <thead><tr><Th>İşlem No</Th><Th>Tarih</Th><Th>Tür</Th><Th>Açıklama</Th><Th>Borç</Th><Th>Alacak</Th><Th right>USD</Th><Th right>Bakiye</Th><Th>Durum</Th></tr></thead>
                  <tbody>
                    {stmt.rows?.map((r,i) => (
                      <TrHover key={i}>
                        <Td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.text3 }}>{r.txn_number}</span></Td>
                        <Td style={{ color:C.text2, fontSize:12.5 }}>{r.txn_date}</Td>
                        <Td style={{ fontSize:12.5 }}>{r.type}</Td>
                        <Td style={{ fontSize:12, color:C.text3 }}>{r.description}</Td>
                        <Td mono style={{ color:C.red, fontSize:12.5 }}>{r.debit!=='—'?r.debit:<span style={{ color:C.text4 }}>—</span>}</Td>
                        <Td mono style={{ color:C.green, fontSize:12.5 }}>{r.credit!=='—'?r.credit:<span style={{ color:C.text4 }}>—</span>}</Td>
                        <Td right mono style={{ fontSize:12.5 }}>${fmt(r.amount_usd)}</Td>
                        <Td right mono style={{ fontWeight:600, color:parseFloat(r.balance_usd)>=0?C.text1:C.red }}>${fmt(r.balance_usd)}</Td>
                        <Td><Badge type={r.status} dot>{{ pending:'Bekliyor', completed:'Tamamlandı', cancelled:'İptal' }[r.status]??r.status}</Badge></Td>
                      </TrHover>
                    ))}
                    {!stmt.rows?.length && <tr><td colSpan={9} style={{ padding:40, textAlign:'center', color:C.text4 }}>İşlem bulunamadı</td></tr>}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Users ────────────────────────────────────────────────────────────────────
export function Users() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [resetId, setResetId]   = useState(null)
  const [newPass, setNewPass]   = useState('')
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'accounting' })

  const { data=[], isLoading } = useQuery({ queryKey:['users'], queryFn: () => usersApi.list().then(r=>r.data) })
  const createMut = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => { qc.invalidateQueries({queryKey:['users']}); setShowForm(false); setForm({ name:'', email:'', password:'', role:'accounting' }); toast.success('Kullanıcı oluşturuldu') },
    onError: e => toast.error(e.response?.data?.detail || 'Hata'),
  })
  const deleteMut = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => { qc.invalidateQueries({queryKey:['users']}); toast.success('Silindi') },
    onError: e => toast.error(e.response?.data?.detail || 'Hata'),
  })
  const resetMut = useMutation({
    mutationFn: ({id,password}) => usersApi.resetPassword(id,password),
    onSuccess: () => { setResetId(null); setNewPass(''); toast.success('Şifre güncellendi') },
    onError: e => toast.error(e.response?.data?.detail || 'Hata'),
  })

  const ROLE_INFO = {
    admin:      { label:'Admin',        color: { background:C.redBg, color:C.red } },
    accounting: { label:'Muhasebe',     color: { background:C.blueBg, color:C.blue } },
    viewer:     { label:'Görüntüleyici',color: { background:C.surface2, color:C.text2 } },
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <Btn onClick={() => setShowForm(!showForm)}><Icon name="plus" size={14} color="white"/> Yeni Kullanıcı</Btn>
      </div>

      {showForm && (
        <Card>
          <CardHeader>Yeni Kullanıcı</CardHeader>
          <div style={{ padding:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <Input label="Ad Soyad" value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder="Ahmed Al-Rashidi" />
              <Input label="E-posta" type="email" value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))} placeholder="ahmed@sirket.com" />
              <Input label="Şifre" type="password" value={form.password} onChange={e=>setForm(x=>({...x,password:e.target.value}))} placeholder="En az 6 karakter" />
              <Select label="Rol" value={form.role} onChange={e=>setForm(x=>({...x,role:e.target.value}))}>
                <option value="admin">Admin — her şeyi yapabilir</option>
                <option value="accounting">Muhasebe — işlem girer ve onaylar</option>
                <option value="viewer">Görüntüleyici — sadece görür</option>
              </Select>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <Btn onClick={() => createMut.mutate(form)} disabled={createMut.isPending||!form.name||!form.email||!form.password}>{createMut.isPending?'Oluşturuluyor...':'Oluştur'}</Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>İptal</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <thead><tr><Th>Ad</Th><Th>E-posta</Th><Th>Rol</Th><Th>Durum</Th><Th right>İşlem</Th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:C.text3 }}>Yükleniyor...</td></tr>}
            {data.map(u => {
              const ri = ROLE_INFO[u.role] || ROLE_INFO.viewer
              return (
                <tr key={u.id}>
                  <Td style={{ fontWeight:500 }}>{u.name}</Td>
                  <Td><span style={{ fontFamily:'var(--mono)', fontSize:12, color:C.text2 }}>{u.email}</span></Td>
                  <Td><span style={{ fontSize:11.5, padding:'3px 10px', borderRadius:100, ...ri.color }}>{ri.label}</span></Td>
                  <Td><span style={{ fontSize:12, fontWeight:500, color: u.is_active ? C.green : C.red }}>{u.is_active ? '● Aktif' : '○ Pasif'}</span></Td>
                  <Td>
                    {resetId===u.id ? (
                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', alignItems:'center' }}>
                        <Input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Yeni şifre" style={{ width:140, padding:'6px 10px' }} />
                        <Btn style={{ fontSize:12, padding:'6px 12px' }} onClick={() => resetMut.mutate({id:u.id,password:newPass})} disabled={!newPass}>Kaydet</Btn>
                        <Btn variant="ghost" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => setResetId(null)}>İptal</Btn>
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <Btn variant="ghost" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => setResetId(u.id)}>Şifre</Btn>
                        <Btn variant="danger" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => window.confirm(`${u.name} silinsin mi?`) && deleteMut.mutate(u.id)}>Sil</Btn>
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

export default Dashboard

// ─── Reconciliation (Günlük Mutabakat) ────────────────────────────────────────
export function Reconciliation() {
  const today = new Date().toISOString().split('T')[0]
  const [reportDate, setReportDate] = useState(today)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reconciliation', reportDate],
    queryFn:  () => reconciliationApi.daily({ report_date: reportDate }).then(r => r.data),
    staleTime: 60_000,
  })

  const pnl = data?.pnl_summary

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Tarih seçici */}
      <div style={{ display:'flex', gap:12, alignItems:'flex-end' }}>
        <Input label="Tarih" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ width:180 }} />
        <Btn variant="ghost" onClick={() => refetch()}>Yenile</Btn>
        {data && (
          <div style={{ marginLeft:'auto', display:'flex', gap:16 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.text3 }}>Toplam İşlem</div>
              <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:20 }}>{data.transaction_count}</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.amber }}>Bekliyor</div>
              <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:20, color:C.amber }}>{data.pending_count}</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.green }}>Tamamlandı</div>
              <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:20, color:C.green }}>{data.completed_count}</div>
            </div>
          </div>
        )}
      </div>

      {isLoading && <Info>Yükleniyor...</Info>}

      {data && (
        <>
          {/* Kâr özeti */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            <div style={{ background:'white', border:`1px solid ${C.border}`, borderRadius:10, padding:'16px 20px' }}>
              <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Hacim (USD)</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:22, fontWeight:700, color:C.navy }}>${fmt(pnl?.total_volume_usd??0,0)}</div>
              <div style={{ fontSize:12, color:C.text3, marginTop:4 }}>{pnl?.fx_tx_count??0} FX/Havale işlemi</div>
            </div>
            <div style={{ background:'white', border:`1px solid ${C.border}`, borderRadius:10, padding:'16px 20px' }}>
              <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Kur Farkı Kârı</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:22, fontWeight:700, color:C.green }}>+${fmt(pnl?.total_profit_usd??0)}</div>
            </div>
            <div style={{ background:'white', border:`1px solid ${C.border}`, borderRadius:10, padding:'16px 20px' }}>
              <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Net Kâr (USD)</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:22, fontWeight:700, color: parseFloat(pnl?.net_pnl_usd??0)>=0 ? C.green : C.red }}>
                {parseFloat(pnl?.net_pnl_usd??0)>=0?'+':''}{fmt(pnl?.net_pnl_usd??0)}
              </div>
            </div>
          </div>

          {/* Kasa hareketi özeti */}
          {data.cash_summary?.length > 0 && (
            <Card>
              <CardHeader>Kasa Hareketleri Özeti</CardHeader>
              <Table>
                <thead><tr><Th>Lokasyon</Th><Th>Kasa</Th><Th>Döviz</Th><Th right>Giriş</Th><Th right>Çıkış</Th><Th right>Net</Th></tr></thead>
                <tbody>
                  {data.cash_summary.map((s, i) => (
                    <TrHover key={i}>
                      <Td style={{ color:C.text2 }}>{s.location}</Td>
                      <Td style={{ fontWeight:500 }}>{s.account}</Td>
                      <Td><span style={{ fontWeight:600, fontSize:12, color:C.navy }}>{s.currency}</span></Td>
                      <Td right mono style={{ color:C.green }}>+{fmt(s.in)} {s.currency}</Td>
                      <Td right mono style={{ color:C.red }}>-{fmt(s.out)} {s.currency}</Td>
                      <Td right mono style={{ fontWeight:700, color: parseFloat(s.net)>=0 ? C.green : C.red }}>
                        {parseFloat(s.net)>=0?'+':''}{fmt(s.net)} {s.currency}
                      </Td>
                    </TrHover>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {/* İşlem listesi */}
          <Card>
            <CardHeader>{reportDate} — Tüm İşlemler</CardHeader>
            <Table>
              <thead><tr><Th>İşlem No</Th><Th>Tür</Th><Th>Karşı Taraf</Th><Th>Çıkan</Th><Th>Giren</Th><Th right>USD</Th><Th right>Kâr</Th><Th>Durum</Th></tr></thead>
              <tbody>
                {data.transactions?.map((t, i) => (
                  <TrHover key={i}>
                    <Td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.text3 }}>{t.txn_number}</span></Td>
                    <Td style={{ fontSize:12.5 }}>{t.txn_type}</Td>
                    <Td style={{ fontSize:12.5, color:C.text2 }}>{t.counterparty}</Td>
                    <Td mono style={{ color:C.red, fontSize:12.5 }}>{t.from}</Td>
                    <Td mono style={{ color:C.green, fontSize:12.5 }}>{t.to}</Td>
                    <Td right mono>${fmt(t.usd_amount)}</Td>
                    <Td right mono style={{ color: parseFloat(t.profit_usd)>=0 ? C.green : C.red }}>
                      {parseFloat(t.profit_usd)>0?'+':''}{fmt(t.profit_usd)}
                    </Td>
                    <Td><Badge type={t.status} dot>{{ pending:'Bekliyor', completed:'Tamamlandı', cancelled:'İptal' }[t.status]??t.status}</Badge></Td>
                  </TrHover>
                ))}
                {!data.transactions?.length && (
                  <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:C.text4 }}>Bu tarihte işlem yok</td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}

// ─── AuditLog ─────────────────────────────────────────────────────────────────
export function AuditLog() {
  const { user } = useAuthStore()
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')
  const [action,   setAction]   = useState('')
  const [entity,   setEntity]   = useState('')

  const { data=[], isLoading } = useQuery({
    queryKey: ['audit', fromDate, toDate, action, entity],
    queryFn:  () => auditApi.list({ from_date:fromDate||undefined, to_date:toDate||undefined, action:action||undefined, entity:entity||undefined, limit:500 }).then(r => r.data),
    enabled:  user?.role === 'admin',
    staleTime: 30_000,
  })

  if (user?.role !== 'admin') {
    return <Info type="warning">Bu sayfa sadece admin kullanıcılara açıktır.</Info>
  }

  const ACTION_COLOR = {
    LOGIN: { bg:C.greenBg, color:C.green },
    LOGIN_FAIL: { bg:C.redBg, color:C.red },
    CREATE: { bg:C.blueBg, color:C.blue },
    DELETE: { bg:C.redBg, color:C.red },
    UPDATE: { bg:C.amberBg, color:C.amber },
    APPROVE: { bg:C.greenBg, color:C.green },
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Filtreler */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
        <Input type="date" label="Başlangıç" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{ width:160 }} />
        <Input type="date" label="Bitiş"     value={toDate}   onChange={e=>setToDate(e.target.value)}   style={{ width:160 }} />
        <Select label="Eylem" value={action} onChange={e=>setAction(e.target.value)} style={{ width:160 }}>
          <option value="">Tüm Eylemler</option>
          {['LOGIN','LOGIN_FAIL','CREATE','UPDATE','DELETE','APPROVE'].map(a => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select label="Varlık" value={entity} onChange={e=>setEntity(e.target.value)} style={{ width:160 }}>
          <option value="">Tüm Varlıklar</option>
          {['Transaction','User','Counterparty','Account'].map(e => <option key={e} value={e}>{e}</option>)}
        </Select>
      </div>

      <Card>
        <CardHeader action={<span style={{ fontSize:12, color:C.text3 }}>{data.length} kayıt</span>}>
          Denetim Kaydı (Audit Log)
        </CardHeader>
        <Table>
          <thead><tr><Th>Tarih/Saat</Th><Th>Kullanıcı</Th><Th>Eylem</Th><Th>Varlık</Th><Th>Detay</Th><Th>IP</Th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:C.text3 }}>Yükleniyor...</td></tr>}
            {data.map(l => {
              const ac = ACTION_COLOR[l.action] ?? { bg:C.surface3, color:C.text2 }
              let detail = ''
              try { const d = JSON.parse(l.detail||'{}'); detail = Object.entries(d).map(([k,v])=>`${k}: ${v}`).join(' · ') } catch(e) { detail = l.detail||'' }
              return (
                <TrHover key={l.id}>
                  <Td style={{ fontSize:11.5, color:C.text3, whiteSpace:'nowrap' }}>{l.created_at?.replace('T',' ').slice(0,19)}</Td>
                  <Td>
                    <div style={{ fontWeight:500, fontSize:13 }}>{l.user_name||'Sistem'}</div>
                    {l.user_email && <div style={{ fontSize:11, color:C.text3 }}>{l.user_email}</div>}
                  </Td>
                  <Td>
                    <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600, ...ac }}>{l.action}</span>
                  </Td>
                  <Td style={{ fontSize:12.5, color:C.text2 }}>{l.entity||'—'}</Td>
                  <Td style={{ fontSize:11.5, color:C.text3, maxWidth:280 }}>
                    <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{detail}</span>
                  </Td>
                  <Td style={{ fontFamily:'var(--mono)', fontSize:11, color:C.text4 }}>{l.ip_address||'—'}</Td>
                </TrHover>
              )
            })}
            {!isLoading && !data.length && <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:C.text4 }}>Kayıt bulunamadı</td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
