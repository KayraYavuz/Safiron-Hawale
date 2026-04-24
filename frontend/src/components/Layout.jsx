import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../hooks/useLang'
import { useAuthStore } from '../store'
import { Icon } from './Icons'

const NAV = [
  { path:'/',               key:'dashboard',       icon:'dashboard'      },
  { path:'/transactions',   key:'transactions',    icon:'transactions'   },
  { path:'/counterparties', key:'counterparties',  icon:'counterparties' },
  { path:'/accounts',       key:'accounts',        icon:'accounts'       },
  { path:'/rates',          key:'rates',           icon:'rates'          },
  { path:'/reconciliation', key:'reconciliation',  icon:'calendar'       },
  { path:'/reports',        key:'reports',         icon:'reports'        },
]

const LABELS = {
  dashboard:'Ana Sayfa', transactions:'İşlemler', counterparties:'Karşı Taraflar',
  accounts:'Hesaplar', rates:'Kur Tablosu',
  reconciliation:'Günlük Mutabakat',
  reports:'Raporlar', audit:'Denetim Kaydı', users:'Kullanıcılar',
}

const S = {
  navy:   '#0D1B2E',
  navy2:  '#111F33',
  navy3:  '#1A2E48',
  accent: '#C9A84C',
  border: '#E4E9F2',
  text1:  '#0D1B2E',
  text3:  '#8898AA',
  bg:     '#F4F6FA',
}

export default function Layout({ children }) {
  const { lang, setLang, dir } = useLang()
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const nav = [
    ...NAV,
    ...(user?.role === 'admin' ? [{ path:'/users', key:'users', icon:'users' }, { path:'/audit', key:'audit', icon:'shield'  }] : [])
  ]

  const pageLabel = LABELS[nav.find(i => i.path === location.pathname)?.key] || ''
  const handleLogout = () => { logout(); navigate('/login') }
  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
  const roleLabel = { admin:'Yönetici', accounting:'Muhasebe', viewer:'Görüntüleyici' }[user?.role] || user?.role

  return (
    <div style={{ display:'flex', height:'100%', background:S.bg, fontFamily:'var(--font)' }} dir={dir}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 232,
        background: S.navy,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 20,
        // Subtle right border instead of harsh shadow
        borderRight: '1px solid rgba(255,255,255,0.04)',
      }}>

        {/* Wordmark */}
        <div style={{ padding:'22px 20px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:11 }}>
            <div style={{
              width:30, height:30, borderRadius:7,
              background: S.accent,
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill={S.navy} fillOpacity="0.95"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke={S.navy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ color:'white', fontWeight:700, fontSize:14, letterSpacing:'-0.02em', lineHeight:1 }}>
                Hawala
              </div>
              <div style={{ color:'rgba(255,255,255,0.25)', fontSize:10, marginTop:3, letterSpacing:'0.01em' }}>
                نظام الحوالة
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'0 16px' }} />

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto' }}>
          {nav.map((item, idx) => {
            const active = location.pathname === item.path
            // Visual group separator before "rates" (operational vs reporting)
            const addSep = idx > 0 && item.path === '/rates'

            return (
              <div key={item.path}>
                {addSep && (
                  <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'6px 6px 8px' }} />
                )}
                <Link
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '8px 11px',
                    borderRadius: 7,
                    marginBottom: 1,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    letterSpacing: '-0.005em',
                    // Active: subtle white fill, no garish highlight
                    color: active ? 'white' : 'rgba(255,255,255,0.42)',
                    background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                    position: 'relative',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.68)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.42)'
                    }
                  }}
                >
                  {/* Active left bar — the single elegant signal */}
                  {active && (
                    <div style={{
                      position: 'absolute',
                      left: -10, top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3, height: 16,
                      background: S.accent,
                      borderRadius: '0 2px 2px 0',
                    }} />
                  )}

                  <Icon
                    name={item.icon}
                    size={15}
                    color={active ? S.accent : 'rgba(255,255,255,0.35)'}
                  />

                  <span>{LABELS[item.key]}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        {/* User block */}
        <div style={{
          padding:'10px 10px 14px',
          borderTop:'1px solid rgba(255,255,255,0.05)',
        }}>
          {/* User row */}
          <div style={{
            display:'flex', alignItems:'center', gap:9,
            padding:'9px 11px', borderRadius:7,
            background:'rgba(255,255,255,0.04)',
            marginBottom:6,
          }}>
            <div style={{
              width:28, height:28, borderRadius:6,
              background: S.navy3,
              border:'1px solid rgba(255,255,255,0.08)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:10.5, fontWeight:700, color: S.accent,
              flexShrink:0, letterSpacing:'0.02em',
            }}>
              {initials}
            </div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{
                color:'rgba(255,255,255,0.82)', fontSize:12.5, fontWeight:500,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                letterSpacing:'-0.01em',
              }}>
                {user?.name}
              </div>
              <div style={{ color:'rgba(255,255,255,0.28)', fontSize:11, marginTop:1 }}>
                {roleLabel}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              width:'100%', padding:'7px 11px',
              borderRadius:7, border:'none',
              background:'transparent',
              color:'rgba(255,255,255,0.28)',
              fontSize:12.5, cursor:'pointer',
              fontFamily:'var(--font)',
              display:'flex', alignItems:'center', gap:7,
              transition:'background 0.12s, color 0.12s',
              letterSpacing:'-0.005em',
              textAlign:'left',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background='rgba(255,255,255,0.04)'
              e.currentTarget.style.color='rgba(255,255,255,0.58)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background='transparent'
              e.currentTarget.style.color='rgba(255,255,255,0.28)'
            }}
          >
            <Icon name="logout" size={13} color="currentColor"/>
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Topbar */}
        <header style={{
          background:'white',
          borderBottom:`1px solid ${S.border}`,
          height:50,
          padding:'0 24px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexShrink:0,
        }}>
          <span style={{
            fontSize:14, fontWeight:600,
            color:S.text1, letterSpacing:'-0.02em',
          }}>
            {pageLabel}
          </span>

          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
            {['tr','ar','en'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding:'3px 8px', borderRadius:5,
                fontSize:11, fontWeight:500,
                cursor:'pointer', fontFamily:'var(--font)',
                transition:'all 0.12s',
                background: lang===l ? S.navy : 'transparent',
                color: lang===l ? 'white' : S.text3,
                border:'none',
                letterSpacing:'0.02em',
              }}>
                {l==='tr'?'TR':l==='ar'?'ع':'EN'}
              </button>
            ))}
          </div>
        </header>

        <main style={{ flex:1, overflowY:'auto', padding:'24px', background:S.bg }} className="fade-up">
          {children}
        </main>
      </div>
    </div>
  )
}
