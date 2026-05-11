import { memo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../hooks/useLang'
import { useAuthStore } from '../store'
import { Icon } from './Icons'

// ── Design tokens (match CSS variables) ──────────────────────────────────────
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

// ── Navigation config (stable reference — outside component) ─────────────────
const BASE_NAV = [
  { path: '/',               key: 'dashboard',      icon: 'dashboard'     },
  { path: '/transactions',   key: 'transactions',   icon: 'transactions'  },
  { path: '/counterparties', key: 'counterparties', icon: 'counterparties'},
  { path: '/accounts',       key: 'accounts',       icon: 'accounts'      },
  { path: '/rates',          key: 'rates',          icon: 'rates'         },
  { path: '/reconciliation', key: 'reconciliation', icon: 'calendar'      },
  { path: '/reports',        key: 'reports',        icon: 'reports'       },
  { path: '/analysis',       key: 'aiAnalysis',     icon: 'sparkles'      },
]

const ADMIN_NAV = [
  { path: '/users', key: 'users', icon: 'users'  },
  { path: '/audit', key: 'audit', icon: 'shield' },
]

function Layout({ children }) {
  const { lang, setLang, t, dir } = useLang()
  const { user, logout }       = useAuthStore()
  const location  = useLocation()
  const navigate  = useNavigate()

  const isRtl = dir === 'rtl'
  const nav = user?.role === 'admin' ? [...BASE_NAV, ...ADMIN_NAV] : BASE_NAV

  const ROLE_LABEL = { admin: t.roleAdmin, accounting: t.roleAccounting, viewer: t.roleViewer }

  const pageLabel  = t[nav.find(i => i.path === location.pathname)?.key] || ''
  const handleLogout = () => { logout(); navigate('/login') }
  const initials   = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const roleLabel  = ROLE_LABEL[user?.role] || user?.role

  return (
    <div style={{ display: 'flex', height: '100%', background: S.bg, fontFamily: 'var(--font)', direction: dir }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 232, background: S.navy,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        zIndex: 20,
        borderRight: isRtl ? 'none' : '1px solid rgba(255,255,255,0.04)',
        borderLeft:  isRtl ? '1px solid rgba(255,255,255,0.04)' : 'none',
      }}>

        {/* Wordmark */}
        <div style={{ padding: '22px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7, background: S.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {/* Inline SVG — no external image request */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill={S.navy} fillOpacity="0.95"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke={S.navy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', lineHeight: 1 }}>Hawala</div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 3, letterSpacing: '0.01em' }}>نظام الحوالة</div>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }} aria-label={t.dashboard}>
          {nav.map((item, idx) => {
            const active  = location.pathname === item.path
            // Visual separator before "rates"
            const addSep  = idx > 0 && item.path === '/rates'

            return (
              <div key={item.path}>
                {addSep && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 6px 8px' }} />}
                <Link
                  to={item.path}
                  className={`nav-link${active ? ' nav-link-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '8px 11px', borderRadius: 7, marginBottom: 1,
                    textDecoration: 'none', fontSize: 13,
                    fontWeight: active ? 500 : 400, letterSpacing: '-0.005em',
                    color:      active ? 'white' : 'rgba(255,255,255,0.42)',
                    background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                    position: 'relative',
                  }}
                >
                  {/* Active indicator bar — GPU-composited, no reflow */}
                  {active && (
                    <div style={{
                      position: 'absolute',
                      ...(isRtl
                        ? { right: -10, borderRadius: '2px 0 0 2px' }
                        : { left: -10, borderRadius: '0 2px 2px 0' }
                      ),
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3, height: 16, background: S.accent,
                    }} />
                  )}
                  <Icon name={item.icon} size={15} color={active ? S.accent : 'rgba(255,255,255,0.35)'} />
                  <span>{t[item.key]}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        {/* User block */}
        <div style={{ padding: '10px 10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 11px', borderRadius: 7,
            background: 'rgba(255,255,255,0.04)', marginBottom: 6,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: S.navy3,
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10.5, fontWeight: 700, color: S.accent,
              flexShrink: 0, letterSpacing: '0.02em',
            }} aria-hidden="true">
              {initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                {user?.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, marginTop: 1 }}>{roleLabel}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="sidebar-btn"
            style={{
              width: '100%', padding: '7px 11px', borderRadius: 7, border: 'none',
              background: 'transparent', color: 'rgba(255,255,255,0.28)',
              fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)',
              display: 'flex', alignItems: 'center', gap: 7,
              letterSpacing: '-0.005em',
              textAlign: isRtl ? 'right' : 'left',
            }}
          >
            <Icon name="logout" size={13} color="currentColor" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          background: 'white', borderBottom: `1px solid ${S.border}`,
          height: 50, padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: S.text1, letterSpacing: '-0.02em' }}>
            {pageLabel}
          </span>

          {/* Language switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} role="group" aria-label={t.langLabel}>
            {['tr', 'ar', 'en'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className="lang-btn"
                aria-pressed={lang === l}
                style={{
                  padding: '3px 8px', borderRadius: 5,
                  fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  background: lang === l ? S.navy : 'transparent',
                  color:      lang === l ? 'white' : S.text3,
                  border: 'none', letterSpacing: '0.02em',
                }}
              >
                {l === 'tr' ? 'TR' : l === 'ar' ? 'ع' : 'EN'}
              </button>
            ))}
          </div>
        </header>

        <main
          style={{ flex: 1, overflowY: 'auto', padding: '24px', background: S.bg }}
          className="fade-up"
          id="main-content"
        >
          {children}
        </main>
      </div>
    </div>
  )
}

// memo: Layout only re-renders when children change (path change) — not on every query update
export default memo(Layout)
