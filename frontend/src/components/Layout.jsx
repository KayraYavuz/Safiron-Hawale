import { memo, useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../hooks/useLang'
import { useAuthStore } from '../store'
import { Icon } from './Icons'
import { getRoleInfo } from '../constants'

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
  { path: '/dashboard',      key: 'dashboard',      icon: 'dashboard'      },
  { path: '/transactions',   key: 'transactions',   icon: 'transactions'   },
  { path: '/counterparties', key: 'counterparties', icon: 'counterparties' },
  { path: '/accounts',       key: 'accounts',       icon: 'accounts'       },
  { path: '/chart-of-accounts', key: 'chartOfAccounts', icon: 'briefcase'  },
  { path: '/rates',          key: 'rates',          icon: 'rates'          },
  { path: '/reconciliation', key: 'reconciliation', icon: 'calendar'       },
  { path: '/reports',        key: 'reports',        icon: 'reports'        },
  { path: '/analysis',       key: 'aiAnalysis',     icon: 'sparkles'       },
  { path: '/cashflow',       key: 'cashFlow',       icon: 'cashflow'       },
]

const ADMIN_NAV = [
  { path: '/users',        key: 'users',        icon: 'users'  },
  { path: '/audit',        key: 'audit',        icon: 'shield' },
  { path: '/integrations', key: 'integrations', icon: 'plug'   },
]

const AUDIT_ONLY_NAV = [
  { path: '/audit', key: 'audit', icon: 'shield' },
]

const SUPER_ADMIN_NAV = [
  { path: '/companies',    key: 'companies',    icon: 'building' },
  { path: '/users',        key: 'users',        icon: 'users'    },
  { path: '/integrations', key: 'integrations', icon: 'plug'     },
]

function Layout({ children }) {
  const { lang, setLang, t, dir } = useLang()
  const { user, logout }  = useAuthStore()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isRtl       = dir === 'rtl'
  const isSuperAdmin = user?.role === 'super_admin'
  const role = user?.role
  const nav  = isSuperAdmin
    ? SUPER_ADMIN_NAV
    : role === 'admin'
      ? [...BASE_NAV, ...ADMIN_NAV]
      : ['auditor', 'manager'].includes(role)
        ? [...BASE_NAV, ...AUDIT_ONLY_NAV]
        : BASE_NAV

  const ROLE_INFO  = getRoleInfo(t)
  const pageLabel  = t[nav.find(i => i.path === location.pathname)?.key] || ''
  const handleLogout = () => { logout(); navigate('/') }
  const initials   = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const roleLabel  = ROLE_INFO[role]?.label || role

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div style={{ display: 'flex', height: '100%', background: S.bg, fontFamily: 'var(--font)', direction: dir }}>

      {/* ── Mobile Overlay ── */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(13,27,46,0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 90,
            animation: 'fadeIn 0.2s ease both',
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`app-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}
        style={{
          width: 232, background: S.navy,
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          zIndex: 100,
          borderRight: isRtl ? 'none' : '1px solid rgba(255,255,255,0.05)',
          borderLeft:  isRtl ? '1px solid rgba(255,255,255,0.05)' : 'none',
          boxShadow: '4px 0 24px rgba(0,0,0,0.18)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s ease',
        }}
      >

        {/* Logo */}
        <div
          style={{
            padding: '16px 20px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'fadeUp 0.4s ease both',
          }}
        >
          <img
            src="/emblem.png"
            alt="Safiron"
            className="logo-sweep"
            style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }}
          />
          <div className="logo-text">
            <div style={{
              color: 'white', fontWeight: 700, fontSize: 16,
              letterSpacing: '-0.01em', lineHeight: 1.1,
            }}>
              Safiron
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.28)', fontSize: 9.5,
              letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2,
            }}>
              Global Solutions
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="mobile-close-btn"
            style={{
              marginLeft: isRtl ? 0 : 'auto',
              marginRight: isRtl ? 'auto' : 0,
              background: 'rgba(255,255,255,0.05)',
              border: 'none', borderRadius: 6,
              color: 'white', padding: 6, cursor: 'pointer',
              display: 'none', // Shown via CSS
            }}
          >
            <Icon name="close" size={18} color="white" />
          </button>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />

        {/* Navigation */}
        <nav
          className="nav-stagger"
          style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}
          aria-label={t.dashboard}
        >
          {nav.map((item, idx) => {
            const active = location.pathname === item.path
            const addSep = idx > 0 && item.path === '/rates'

            return (
              <div key={item.path}>
                {addSep && (
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 6px 8px' }} />
                )}
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
                    background: active
                      ? 'rgba(255,255,255,0.09)'
                      : 'transparent',
                    position: 'relative',
                    transition: 'background 0.15s ease, color 0.15s ease, transform 0.15s ease',
                  }}
                >
                  {/* Active accent bar */}
                  {active && (
                    <div style={{
                      position: 'absolute',
                      ...(isRtl
                        ? { right: -10, borderRadius: '2px 0 0 2px' }
                        : { left:  -10, borderRadius: '0 2px 2px 0' }
                      ),
                      top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 18,
                      background: `linear-gradient(180deg, ${S.accent}, #E8C76A)`,
                      borderRadius: 2,
                      boxShadow: `0 0 8px ${S.accent}66`,
                    }} />
                  )}
                  <Icon
                    name={item.icon}
                    size={15}
                    color={active ? S.accent : 'rgba(255,255,255,0.35)'}
                  />
                  <span className="nav-label">{t[item.key]}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        {/* User block */}
        <div
          style={{
            padding: '10px 10px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            animation: 'fadeUp 0.4s ease 0.3s both',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 11px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 6,
          }}>
            {/* Avatar */}
            <div
              className="avatar-glow"
              style={{
                width: 30, height: 30, borderRadius: 7,
                background: 'linear-gradient(135deg, #1A2E48, #243D5A)',
                border: `1.5px solid ${S.accent}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 700, color: S.accent,
                flexShrink: 0, letterSpacing: '0.02em',
              }}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="user-info" style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                color: 'rgba(255,255,255,0.84)', fontSize: 12.5, fontWeight: 500,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
              }}>
                {user?.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11, marginTop: 1 }}>
                {roleLabel}
              </div>
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
            <span className="logout-label">{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid rgba(228,233,242,0.8)`,
          height: 50, padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          boxShadow: '0 1px 6px rgba(13,27,46,0.04)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Hamburger Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="mobile-toggle-btn"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: S.navy, padding: 6, borderRadius: 6,
                display: 'none', // Shown via CSS
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="menu" size={20} color={S.navy} />
            </button>

            <span style={{ fontSize: 14, fontWeight: 600, color: S.text1, letterSpacing: '-0.02em' }}>
              {pageLabel}
            </span>
          </div>

          {/* Language switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} role="group" aria-label={t.langLabel}>
            {['tr', 'ar', 'en'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className="lang-btn"
                aria-pressed={lang === l}
                style={{
                  padding: '3px 9px', borderRadius: 5,
                  fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  background: lang === l ? S.navy : 'transparent',
                  color:      lang === l ? 'white' : S.text3,
                  border: 'none', letterSpacing: '0.02em',
                  transition: 'background 0.15s, color 0.15s',
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

export default memo(Layout)
