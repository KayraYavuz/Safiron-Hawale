import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { authApi } from '../utils/api'
import { useAuthStore } from '../store'
import { useLang } from '../hooks/useLang'
import toast from 'react-hot-toast'

const NAV_H = 70

/* ─────────────────────────────────────────────────────────
   LOGIN PANELİ — sağdan kayan drawer
───────────────────────────────────────────────────────── */
function LoginPanel({ open, onClose }) {
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const { setToken, setUser } = useAuthStore()
  const { lang, setLang, t }  = useLang()
  const navigate  = useNavigate()
  const emailRef  = useRef(null)

  useEffect(() => { if (open) setTimeout(() => emailRef.current?.focus(), 300) }, [open])
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' }, [open])

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data }     = await authApi.login(email, pass)
      setToken(data.access_token)
      const { data: me } = await authApi.me()
      setUser(me)
      navigate(me?.role === 'super_admin' ? '/companies' : '/dashboard')
    } catch {
      toast.error(t.loginError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(5,12,24,0.7)', backdropFilter: 'blur(6px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }} />

      {/* Drawer */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: '#040D1C', zIndex: 1000,
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, "Segoe UI", sans-serif',
      }}>
        {/* Başlık */}
        <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/emblem.png" alt="Safiron" style={{ width: 38, height: 38, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1 }}>Safiron</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Havale</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            color: '#64748B', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748B' }}
          >✕</button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 28px' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 6 }}>
            Giriş Yap
          </h2>
          <p style={{ fontSize: 14, color: '#64748B', marginBottom: 28, lineHeight: 1.5 }}>
            Yönetim paneline erişmek için hesap bilgilerinizi girin.
          </p>

          {/* Dil */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {[['tr','TR'], ['ar','ع'], ['en','EN']].map(([l, lbl]) => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: l === lang ? 700 : 500,
                background: l === lang ? '#C9A84C' : 'rgba(255,255,255,0.04)',
                color: l === lang ? '#0D1F3C' : '#64748B',
                border: l === lang ? 'none' : '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.15s',
              }}>{lbl}</button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
                {t.email}
              </label>
              <input ref={emailRef} type="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} required
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 14px',
                  borderRadius: 10, background: 'rgba(255,255,255,0.05)',
                  border: '1.5px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#2B6CB0'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
                {t.password}
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} autoComplete="current-password"
                  value={pass} onChange={e => setPass(e.target.value)} required
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '11px 44px 11px 14px',
                    borderRadius: 10, background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#2B6CB0'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748B',
                  fontSize: 15, padding: 0, fontFamily: 'inherit',
                }}>{showPwd ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '13px', borderRadius: 10,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg, #C9A84C, #E8C56B)',
              color: '#0D1F3C', fontSize: 14, fontWeight: 700,
              fontFamily: 'inherit', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading
                ? <><Spinner /> {t.loggingIn}</>
                : <>{t.loginBtn} →</>
              }
            </button>
          </form>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '28px 0' }} />

          <p style={{ fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 1.6 }}>
            Hesap veya teknik destek için<br />
            <a href="mailto:dp.finex@gmail.com" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>
              dp.finex@gmail.com
            </a>
          </p>
        </div>

        {/* Alt */}
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
          {[['5', 'Aktif Şube'], ['22+', 'Para Birimi'], ['7/24', 'Bot Erişimi']].map(([v, l]) => (
            <div key={l} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#C9A84C', lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 10.5, color: '#475569', marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </aside>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}

function Spinner() {
  return (
    <svg style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────
   ANA SAYFA
───────────────────────────────────────────────────────── */
export default function Landing() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [scrolled,  setScrolled]  = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif', color: '#0F172A', lineHeight: 1, overflowX: 'hidden' }}>

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* ══════════════ NAVBAR ══════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: NAV_H, zIndex: 800,
        background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: scrolled ? '1px solid #E2E8F0' : '1px solid transparent',
        boxShadow: scrolled ? '0 1px 16px rgba(0,0,0,0.06)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 max(5%, 28px)', transition: 'all 0.25s',
      }}>
        {/* Logo */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src="/emblem.png" alt="Safiron" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0D1F3C', letterSpacing: '-0.4px', lineHeight: 1.1 }}>Safiron</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Havale</div>
          </div>
        </a>

        {/* Linkler */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 14, fontWeight: 500 }}>
          {[['Hakkımızda', '#about'], ['Özellikler', '#features'], ['Nasıl Çalışır', '#how'], ['İletişim', '#contact']].map(([l, h]) => (
            <a key={l} href={h} style={{ color: '#64748B', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color = '#0D1F3C'}
              onMouseLeave={e => e.target.style.color = '#64748B'}>{l}</a>
          ))}
          <button onClick={() => setLoginOpen(true)} style={{
            padding: '9px 20px', borderRadius: 9,
            background: '#0D1F3C', color: '#fff',
            fontWeight: 600, fontSize: 13.5, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: 'inherit', transition: 'all 0.2s',
            boxShadow: '0 2px 10px rgba(13,31,60,0.2)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1C3152'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0D1F3C'; e.currentTarget.style.transform = '' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            Giriş Yap
          </button>
        </div>
      </nav>

      {/* ══════════════ HERO ══════════════ */}
      <section style={{
        minHeight: '100vh', paddingTop: NAV_H,
        background: 'linear-gradient(160deg, #050C1A 0%, #0C1D38 55%, #10243F 100%)',
        display: 'flex', alignItems: 'center',
        padding: `${NAV_H + 64}px max(5%, 28px) 80px`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Işık efektleri */}
        <div style={{ position: 'absolute', top: '15%', left: '3%',  width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,108,176,0.14) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '0',  right: '2%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.09) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1160, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>

          {/* Sol */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 30,
              padding: '5px 14px', borderRadius: 100,
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)',
              fontSize: 12.5, fontWeight: 600, color: '#E8C56B', letterSpacing: '0.04em',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.7)' }} />
              Havale Ofisi Yönetim Yazılımı
            </div>

            <h1 style={{
              fontSize: 'clamp(36px, 4.2vw, 58px)', fontWeight: 900,
              color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.09, marginBottom: 22,
            }}>
              Döviz İşlemlerinizi<br />
              <span style={{
                background: 'linear-gradient(90deg, #C9A84C 0%, #E8C56B 50%, #F0D27E 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Tam Kontrol Altında
              </span><br />
              Tutun
            </h1>

            <p style={{ fontSize: 16.5, color: '#8899AA', lineHeight: 1.78, marginBottom: 38, maxWidth: 460 }}>
              Çok şubeli havale ofisleri ve döviz büroları için geliştirilmiş, yapay zeka destekli
              profesyonel muhasebe ve yönetim platformu. İstanbul'dan Dubai'ye, Riyad'dan Kahire'ye —
              tüm operasyonunuz tek ekranda.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 52 }}>
              <button onClick={() => setLoginOpen(true)} style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                background: 'linear-gradient(135deg, #C9A84C, #E8C56B)',
                color: '#0D1F3C', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(201,168,76,0.3)',
                transition: 'all 0.2s', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(201,168,76,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.3)' }}
              >
                Platforma Giriş Yap
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
              <a href="#features" style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', color: '#CBD5E1',
                border: '1px solid rgba(255,255,255,0.12)',
                textDecoration: 'none', transition: 'all 0.2s',
                display: 'inline-flex', alignItems: 'center', fontFamily: 'inherit',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                Özellikleri İncele
              </a>
            </div>

            {/* Desteklenen işlemler */}
            <div>
              <p style={{ fontSize: 11.5, color: '#475569', fontWeight: 600, marginBottom: 10, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Desteklenen İşlem Türleri
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Havale', 'Döviz Alım-Satım', 'SWIFT', 'Yatırma', 'Çekme', 'Virman'].map(item => (
                  <span key={item} style={{
                    padding: '5px 11px', borderRadius: 7,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#8899AA', fontSize: 12.5, fontWeight: 500,
                  }}>{item}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ — panel mockup */}
          <div style={{ position: 'relative' }}>
            <div style={{
              background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 18, padding: 26,
              boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
            }}>
              {/* Üst */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 4 }}>TOPLAM POZİSYON</p>
                  <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>$392,844</p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 12, fontWeight: 700, color: '#22C55E' }}>▲ +2.4%</span>
              </div>

              {/* Şubeler */}
              {[
                { city: 'İstanbul', flag: '🇹🇷', usd: '$284,500', pnl: '+$1,240' },
                { city: 'Dubai',    flag: '🇦🇪', usd: '$95,000',  pnl: '+$760' },
                { city: 'Riyad',    flag: '🇸🇦', usd: '$13,344',  pnl: '+$88' },
              ].map((loc, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 13px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: 8,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>
                    {loc.flag} {loc.city}
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{loc.usd}</div>
                    <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>{loc.pnl}</div>
                  </div>
                </div>
              ))}

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '18px 0' }} />

              {/* Son işlemler */}
              <p style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Son İşlemler</p>
              {[
                { type: 'Havale',        party: 'Al-Rashidi',  amount: '+$8,200',  color: '#22C55E' },
                { type: 'Döviz Al/Sat', party: 'Hassan Bey',   amount: '-$5,400',  color: '#F59E0B' },
                { type: 'SWIFT',         party: 'GCC Trading', amount: '+$12,000', color: '#60A5FA' },
              ].map((tx, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💸</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{tx.type}</div>
                      <div style={{ fontSize: 11.5, color: '#475569' }}>{tx.party}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tx.color }}>{tx.amount}</span>
                </div>
              ))}
            </div>

            {/* Bot kartı */}
            <div style={{
              position: 'absolute', bottom: -20, right: -14,
              background: '#0D1B2E', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 13, padding: '12px 15px', minWidth: 180,
              boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 5px rgba(34,197,94,0.7)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Safiron Bot</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                💰 <span style={{ color: '#E2E8F0' }}>$392,844</span><br />
                📊 Bugün: <span style={{ color: '#22C55E', fontWeight: 600 }}>+$2,088</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ RAKAMLAR ══════════════ */}
      <section style={{ background: '#fff', borderBottom: '1px solid #E8EDF5' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '0 max(5%, 28px)' }}>
          {[
            { val: '6+',   lbl: 'İşlem Türü',       sub: 'Havale · Döviz · SWIFT · Yatırma' },
            { val: '3',    lbl: 'Arayüz Dili',       sub: 'Türkçe · العربية · English' },
            { val: '7/24', lbl: 'Telegram Erişimi',  sub: 'Bot ile kesintisiz sorgulama' },
            { val: 'AI',   lbl: 'Analiz Desteği',    sub: 'Groq tabanlı finansal asistan' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '34px 20px', textAlign: 'center', borderRight: i < 3 ? '1px solid #E8EDF5' : 'none' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#0D1F3C', letterSpacing: '-1px', marginBottom: 6 }}>{s.val}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0D1F3C', marginBottom: 4 }}>{s.lbl}</div>
              <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════ HAKKIMIZDA ══════════════ */}
      <section id="about" style={{ padding: '96px max(5%, 28px)', background: '#F8FAFD' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <Tag>Hakkımızda</Tag>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, color: '#0D1F3C', letterSpacing: '-0.8px', lineHeight: 1.18, marginBottom: 18 }}>
              Havale sektörü için<br />
              <span style={{ color: '#2B6CB0' }}>sıfırdan tasarlandı</span>
            </h2>
            <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.82, marginBottom: 18 }}>
              Safiron Havale, çok şubeli havale ofisleri ve döviz bürolarının operasyonel ihtiyaçlarını
              karşılamak üzere geliştirilmiş bir SaaS platformudur. İşlem takibi, kur yönetimi,
              kâr/zarar hesaplama ve raporlama tek çatı altında toplanmıştır.
            </p>
            <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.82, marginBottom: 32 }}>
              Platform; Türkiye, Körfez ülkeleri ve Orta Doğu pazarları gözetilerek çok dilli
              ve çok para birimli mimariye sahiptir. Sahadan anlık erişim için
              her şirkete özel Telegram botu mevcuttur.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {[
                'İstanbul · Dubai · Riyad · Kahire lokasyon desteği',
                'Havale, döviz bürosu ve SWIFT işlem türleri',
                'Rol bazlı erişim kontrolü ve tam denetim kaydı',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(43,108,176,0.1)', border: '1.5px solid rgba(43,108,176,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2B6CB0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <span style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { icon: '💸', title: 'Havale',              desc: 'Para transferi, komisyon hesaplama, müşteri ve muhabir yönetimi.' },
              { icon: '💱', title: 'Döviz Alım-Satım',    desc: 'Kur farkı kârı, spread hesaplama ve anlık PnL takibi.' },
              { icon: '🏛️', title: 'Muhabir Uzlaşması',   desc: 'Karşı taraf bazlı mutabakat, alacak ve borç yönetimi.' },
              { icon: '📋', title: 'Denetim Kaydı',       desc: 'Her işlem için iz kaydı ve kullanıcı bazlı erişim kontrolü.' },
            ].map((c, i) => (
              <div key={i} style={{ padding: '20px 18px', borderRadius: 13, background: '#fff', border: '1px solid #E8EDF5', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(13,31,60,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
              >
                <div style={{ fontSize: 24, marginBottom: 10 }}>{c.icon}</div>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#0D1F3C', marginBottom: 6 }}>{c.title}</h4>
                <p style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.65 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ ÖZELLİKLER ══════════════ */}
      <section id="features" style={{ padding: '96px max(5%, 28px)', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Tag>Özellikler</Tag>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, color: '#0D1F3C', letterSpacing: '-0.8px', marginBottom: 14 }}>
              İhtiyacınız olan her şey tek yerde
            </h2>
            <p style={{ fontSize: 16, color: '#64748B', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
              Havale ofislerinin karmaşık operasyonlarını basitleştiren, entegre bir yönetim platformu.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {[
              { bg: '#EFF6FF', border: '#DBEAFE', icon: '🏢', title: 'Çoklu Şube Yönetimi',    desc: 'Her şirket ve şube tamamen izole çalışır. Tüm lokasyonlarınızı tek panelden takip edin.' },
              { bg: '#FFFBEB', border: '#FEF3C7', icon: '💱', title: 'Kur Takibi ve Yönetimi', desc: 'Otomatik kur güncellemesi (ECB & Frankfurter API). Anlık kur farkı kârı hesaplama.' },
              { bg: '#F0FDF4', border: '#D1FAE5', icon: '📊', title: 'Kâr/Zarar Raporlama',    desc: 'İşlem bazında PnL, müşteri ekstresi, gelir tablosu ve nakit akışı raporu.' },
              { bg: '#FAF5FF', border: '#EDE9FE', icon: '🤖', title: 'Yapay Zeka Asistan',     desc: 'Groq tabanlı finansal asistan. Verilerinizi sorgulayın, trend analizi yaptırın.' },
              { bg: '#F0F9FF', border: '#E0F2FE', icon: '📱', title: 'Telegram Bot',            desc: 'Şirkete özel bot ile sahadan bakiye sorgulama, işlem girişi ve müşteri kaydı.' },
              { bg: '#FFF1F2', border: '#FFE4E6', icon: '🔐', title: 'Güvenlik ve Roller',      desc: 'Rol bazlı yetkilendirme, oturum zaman aşımı, denetim kaydı ve PIN doğrulama.' },
            ].map((f, i) => (
              <div key={i} style={{
                padding: '26px 24px', borderRadius: 14,
                border: `1px solid ${f.border}`, background: f.bg,
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(13,31,60,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15.5, fontWeight: 800, color: '#0D1F3C', marginBottom: 9, letterSpacing: '-0.2px' }}>{f.title}</h3>
                <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ NASIL ÇALIŞIR ══════════════ */}
      <section id="how" style={{ padding: '96px max(5%, 28px)', background: '#F8FAFD' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <Tag>Başlangıç</Tag>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, color: '#0D1F3C', letterSpacing: '-0.8px', marginBottom: 14 }}>
              4 adımda operasyonel olun
            </h2>
            <p style={{ fontSize: 16, color: '#64748B', maxWidth: 420, margin: '0 auto', lineHeight: 1.7 }}>
              Kurulumdan ilk işleme kadar tüm süreç sade ve hızlı tasarlanmıştır.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            {/* Bağlantı çizgisi */}
            <div style={{ position: 'absolute', top: 38, left: '12.5%', right: '12.5%', height: 1, background: 'linear-gradient(90deg, transparent, #CBD5E1 20%, #CBD5E1 80%, transparent)', zIndex: 0 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, position: 'relative', zIndex: 1 }}>
              {[
                { n: '01', icon: '🏗️', title: 'Şirketinizi Kurun',         desc: 'Hesabınızı açın, şirket bilgilerini ve şubelerinizi tanımlayın.' },
                { n: '02', icon: '⚙️', title: 'Kasaları Yapılandırın',     desc: 'Lokasyonlar, hesap türleri ve başlangıç kurlarını ayarlayın.' },
                { n: '03', icon: '📝', title: 'İşlemleri Kaydedin',         desc: 'Havale, döviz alım-satım, yatırma-çekme — tüm türler desteklenir.' },
                { n: '04', icon: '📊', title: 'Raporları Takip Edin',       desc: 'Anlık pozisyon, kâr/zarar raporu ve müşteri ekstresi.' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 58, height: 58, borderRadius: '50%', margin: '0 auto 18px',
                    background: '#fff', border: '2px solid #2B6CB0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    boxShadow: '0 0 0 5px #F8FAFD, 0 4px 14px rgba(43,108,176,0.15)',
                  }}>{s.icon}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#2B6CB0', letterSpacing: '0.07em', marginBottom: 7 }}>{s.n}</div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0D1F3C', marginBottom: 7, lineHeight: 1.3 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.65 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ TELEGRAM ══════════════ */}
      <section style={{ padding: '96px max(5%, 28px)', background: 'linear-gradient(160deg, #0A1628 0%, #071020 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', right: '4%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,108,176,0.13) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '5px 14px', borderRadius: 100, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', fontSize: 12, fontWeight: 700, color: '#E8C56B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Telegram Entegrasyonu
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.7px', lineHeight: 1.2, marginBottom: 18 }}>
              Sahadan anlık erişim,<br />her şirkete özel bot
            </h2>
            <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.8, marginBottom: 30 }}>
              Şubenizdeki yöneticiler Telegram üzerinden bakiye sorgulayabilir, işlem açabilir
              ve yeni müşteri kaydedebilir. PIN ile güvenli bağlantı.
              Türkçe, Arapça ve İngilizce dil seçeneğiyle.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['💰', 'Anlık Bakiye',       'Kasa bazında döviz pozisyonu'],
                ['📊', 'Kâr/Zarar Raporu',  'Günlük ve haftalık PnL'],
                ['➕', 'İşlem Oluşturma',    "Telegram'dan direkt kayıt"],
                ['👤', 'Müşteri Ekleme',     'Tam müşteri kayıt akışı'],
                ['📈', 'Kur Sorgulama',      'Güncel piyasa kurları'],
                ['🌐', 'Çok Dilli',          'TR · العربية · EN'],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E2E8F0', marginBottom: 1 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: '#475569' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mock Telegram */}
          <div>
            <div style={{ background: '#17212B', borderRadius: 20, overflow: 'hidden', boxShadow: '0 28px 80px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ background: '#232E3C', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #2B6CB0, #1C3152)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🤖</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Safiron Bot</div>
                  <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>● çevrimiçi</div>
                </div>
              </div>
              <div style={{ padding: '16px 14px', minHeight: 320 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ background: '#182533', borderRadius: '4px 12px 12px 12px', padding: '10px 13px', maxWidth: '80%', display: 'inline-block', fontSize: 13, color: '#CBD5E1', lineHeight: 1.6 }}>
                    👋 Merhaba! Safiron Bot'a hoş geldiniz.<br />Aşağıdan bir seçenek belirleyin.
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginBottom: 12 }}>
                  <div style={{ background: '#2B5278', borderRadius: '12px 4px 12px 12px', padding: '9px 13px', display: 'inline-block', fontSize: 13, color: '#fff' }}>
                    💰 Bakiye
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ background: '#182533', borderRadius: '4px 12px 12px 12px', padding: '12px 14px', maxWidth: '86%', display: 'inline-block' }}>
                    <div style={{ fontSize: 12.5, color: '#CBD5E1', lineHeight: 1.9, fontFamily: 'monospace' }}>
                      💰 <strong>Kasa Bakiyeleri</strong><br />
                      <span style={{ color: '#C9A84C' }}>📍 İstanbul</span><br />
                      &nbsp; USD: +284,500.00 ≈ $284,500<br />
                      <span style={{ color: '#C9A84C' }}>📍 Dubai</span><br />
                      &nbsp; USD: +95,000.00 ≈ $95,000<br /><br />
                      💵 <strong>Toplam: $392,844</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: '#232E3C', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {['💰 Bakiye', '📊 Rapor', '📈 Kurlar', '➕ Yeni İşlem'].map(b => (
                  <div key={b} style={{ padding: '8px', borderRadius: 8, textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#8899AA', fontSize: 12, fontWeight: 600 }}>{b}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ İLETİŞİM ══════════════ */}
      <section id="contact" style={{ padding: '96px max(5%, 28px)', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <Tag>İletişim</Tag>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 900, color: '#0D1F3C', letterSpacing: '-0.8px', marginBottom: 14 }}>
              Bizimle iletişime geçin
            </h2>
            <p style={{ fontSize: 16, color: '#64748B', maxWidth: 460, margin: '0 auto', lineHeight: 1.7 }}>
              Demo talep etmek, fiyat bilgisi almak veya sistemi mevcut operasyonunuza entegre etmek için yazın.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { icon: '📧', lbl: 'E-posta',  val: 'dp.finex@gmail.com',  sub: '1 iş günü içinde yanıt',          href: 'mailto:dp.finex@gmail.com', bg: '#EFF6FF', border: '#DBEAFE', hover: '#2B6CB0' },
                { icon: '💬', lbl: 'Telegram', val: '@safiron_support',     sub: 'Genellikle birkaç saat içinde',   href: 'https://t.me/safiron_support', bg: '#F0F9FF', border: '#BAE6FD', hover: '#0284C7' },
              ].map(c => (
                <a key={c.lbl} href={c.href} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 22px', borderRadius: 14, border: `1.5px solid ${c.border}`, background: c.bg, textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = c.hover; e.currentTarget.style.boxShadow = `0 4px 20px ${c.hover}18`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: '#fff', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{c.lbl}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0D1F3C', marginBottom: 2 }}>{c.val}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>{c.sub}</div>
                  </div>
                </a>
              ))}
              <div style={{ padding: '18px 22px', borderRadius: 14, border: '1px solid #E8EDF5', background: '#F8FAFD' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1F3C', marginBottom: 10 }}>🕐 Destek Saatleri</p>
                {[['Pazartesi – Cuma', '09:00 – 18:00'], ['Cumartesi', '10:00 – 14:00'], ['Pazar', '—']].map(([g, s], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B', padding: '6px 0', borderBottom: i < 2 ? '1px solid #E8EDF5' : 'none' }}>
                    <span>{g}</span><span style={{ fontWeight: 600, color: '#0D1F3C' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ background: 'linear-gradient(160deg, #0C1D38 0%, #071020 100%)', borderRadius: 18, padding: 32, boxShadow: '0 12px 40px rgba(13,31,60,0.2)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 14 }}>Platforma Başlayın</p>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.25, marginBottom: 14 }}>
                Operasyonunuzu dijitalleştirin
              </h3>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.78, marginBottom: 24 }}>
                Demo hesabı oluşturmak veya mevcut sisteminizi Safiron'a taşımak için iletişime geçin.
                Kurulum ve onboarding süreci <strong style={{ color: '#94A3B8' }}>1 iş günü</strong> içinde tamamlanır.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['Çoklu şube ve lokasyon desteği', 'Telegram bot entegrasyonu dahil', 'Türkçe, Arapça ve İngilizce arayüz', 'Tam teknik destek ve onboarding'].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#CBD5E1' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => setLoginOpen(true)} style={{
                width: '100%', padding: '13px', borderRadius: 10, fontSize: 14.5, fontWeight: 800,
                background: 'linear-gradient(135deg, #C9A84C, #E8C56B)',
                color: '#0D1F3C', border: 'none', cursor: 'pointer',
                transition: 'all 0.2s', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(201,168,76,0.35)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                Giriş Yap
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer style={{ background: '#070E1C', padding: '52px max(5%, 28px) 28px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 44 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
                <img src="/emblem.png" alt="Safiron" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1 }}>Safiron</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Havale</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.75, maxWidth: 260 }}>
                Çok şubeli havale ofisleri ve döviz büroları için geliştirilmiş profesyonel yönetim platformu.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {[{ icon: '📧', href: 'mailto:dp.finex@gmail.com', title: 'E-posta' }, { icon: '💬', href: 'https://t.me/safiron_support', title: 'Telegram' }].map(s => (
                  <a key={s.title} href={s.href} title={s.title} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, textDecoration: 'none', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  >{s.icon}</a>
                ))}
              </div>
            </div>
            {[
              { title: 'Platform', links: [['Özellikler', '#features'], ['Nasıl Çalışır', '#how'], ['Telegram Bot', '#features']] },
              { title: 'Şirket',   links: [['Hakkımızda', '#about'], ['İletişim', '#contact']] },
              { title: 'Dil',      links: [['🇹🇷 Türkçe', ''], ['🇸🇦 العربية', ''], ['🇬🇧 English', '']] },
            ].map(col => (
              <div key={col.title}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>{col.title}</p>
                {col.links.map(([l, h]) => (
                  h ? (
                    <a key={l} href={h} style={{ display: 'block', fontSize: 13.5, color: '#374151', textDecoration: 'none', marginBottom: 9, transition: 'color 0.15s' }}
                      onMouseEnter={e => e.target.style.color = '#94A3B8'}
                      onMouseLeave={e => e.target.style.color = '#374151'}>{l}</a>
                  ) : (
                    <div key={l} style={{ fontSize: 13.5, color: '#374151', marginBottom: 9 }}>{l}</div>
                  )
                ))}
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 24 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 13, color: '#374151' }}>© {new Date().getFullYear()} Safiron Global Solutions. Tüm hakları saklıdır.</p>
            <div style={{ display: 'flex', gap: 20, fontSize: 12.5, color: '#374151' }}>
              <span style={{ cursor: 'default' }}>Gizlilik Politikası</span>
              <span style={{ cursor: 'default' }}>Kullanım Koşulları</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Tag({ children }) {
  return (
    <div style={{
      display: 'inline-block', padding: '4px 13px', borderRadius: 100, marginBottom: 16,
      background: 'rgba(43,108,176,0.07)', border: '1px solid rgba(43,108,176,0.14)',
      fontSize: 12, fontWeight: 700, color: '#2B6CB0', letterSpacing: '0.07em', textTransform: 'uppercase',
    }}>{children}</div>
  )
}
