import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

/* ── Renkler ─────────────────────────────────────────────────────────── */
const NAVY   = '#0D1F3C'
const NAVY2  = '#1C3152'
const BLUE   = '#2B6CB0'
const GOLD   = '#C9A84C'
const GOLD2  = '#E8C56B'
const WHITE  = '#FFFFFF'
const SLATE  = '#64748B'
const SLATE2 = '#94A3B8'
const BG     = '#F8FAFD'
const NAV_H  = 72

/* ── Veri ────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: '🏢',
    color: '#EFF6FF',
    accent: '#2B6CB0',
    title: 'Çoklu Şirket & Şube',
    desc: 'Her şirket tamamen izole çalışır. İstanbul, Dubai, Kahire — tüm şubelerinizi tek panelden yönetin.',
  },
  {
    icon: '💱',
    color: '#FFFBEB',
    accent: '#D97706',
    title: 'Gerçek Zamanlı Kur',
    desc: 'ECB & Frankfurter API ile otomatik kur güncellemesi. Manuel düzeltme imkânı. Her işlemde USD bazında muhasebe.',
  },
  {
    icon: '📈',
    color: '#F0FDF4',
    accent: '#16A34A',
    title: 'Anlık PnL & Raporlama',
    desc: 'Her işlemde kâr/zarar hesabı. Müşteri ekstresi, gelir tablosu, nakit akışı tek tıkla.',
  },
  {
    icon: '🤖',
    color: '#FAF5FF',
    accent: '#7C3AED',
    title: 'AI Finansal Asistan',
    desc: 'Groq destekli yapay zeka. Verilerinizi sorgulayın, trend analizi yaptırın, öngörü alın.',
  },
  {
    icon: '📱',
    color: '#F0F9FF',
    accent: '#0284C7',
    title: 'Telegram Bot',
    desc: 'Her şirkete özel bot. Bakiye sorgulama, işlem oluşturma, müşteri ekleme — hepsi Telegram\'dan.',
  },
  {
    icon: '🔐',
    color: '#FFF1F2',
    accent: '#E11D48',
    title: 'Güvenlik & RBAC',
    desc: 'Rol bazlı erişim, audit log, otomatik oturum kapanma ve PIN tabanlı kimlik doğrulama.',
  },
]

const STATS = [
  { val: '6+',  label: 'İşlem Tipi',    sub: 'Havale · Döviz · SWIFT ve daha fazlası' },
  { val: '3',   label: 'Dil Desteği',   sub: 'Türkçe · العربية · English' },
  { val: '7/24',label: 'Telegram Bot',  sub: 'Kesintisiz erişim, anlık sorgulama' },
  { val: 'AI',  label: 'Destekli',      sub: 'Groq tabanlı finansal analiz' },
]

const STEPS = [
  { n: '01', icon: '🏗️', title: 'Şirketinizi kurun',        desc: 'Hesap açın, şirket bilgilerinizi ve şubelerinizi tanımlayın.' },
  { n: '02', icon: '⚙️', title: 'Kasa & kurları ayarlayın', desc: 'Lokasyonlar, hesap türleri ve başlangıç kurlarını yapılandırın.' },
  { n: '03', icon: '📝', title: 'İşlemleri girin',           desc: 'Havale, döviz alım-satım, yatırma-çekme — tüm tipler desteklenir.' },
  { n: '04', icon: '📊', title: 'Raporları takip edin',      desc: 'Gerçek zamanlı pozisyon, kâr/zarar raporu ve müşteri ekstresi.' },
]

const TX_TYPES = [
  { code: 'HAV', label: 'Havale',        color: '#EFF6FF', text: '#1D4ED8' },
  { code: 'FX',  label: 'Döviz Al/Sat', color: '#F0FDF4', text: '#15803D' },
  { code: 'SWT', label: 'SWIFT',         color: '#FAF5FF', text: '#6D28D9' },
  { code: 'DEP', label: 'Yatırma',       color: '#FFFBEB', text: '#B45309' },
  { code: 'WDR', label: 'Çekme',         color: '#FFF1F2', text: '#BE123C' },
  { code: 'TRF', label: 'Transfer',      color: '#F0F9FF', text: '#0369A1' },
]

/* ── Yardımcı bileşenler ─────────────────────────────────────────────── */
function SectionLabel({ children, light }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '5px 14px', borderRadius: 100,
      background: light ? 'rgba(201,168,76,0.15)' : 'rgba(43,108,176,0.08)',
      border: `1px solid ${light ? 'rgba(201,168,76,0.3)' : 'rgba(43,108,176,0.15)'}`,
      fontSize: 12.5, fontWeight: 700,
      color: light ? GOLD2 : BLUE,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      marginBottom: 18,
    }}>
      {children}
    </div>
  )
}

function Tag({ children, color, text }) {
  return (
    <span style={{
      padding: '4px 11px', borderRadius: 7,
      background: color, color: text,
      fontSize: 12, fontWeight: 600,
    }}>
      {children}
    </span>
  )
}

/* ── Ana bileşen ─────────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const btnPrimary = {
    padding: '13px 28px', borderRadius: 11, fontSize: 15, fontWeight: 700,
    background: `linear-gradient(135deg, ${NAVY2}, ${BLUE})`,
    color: WHITE, border: 'none', cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(28,49,82,0.28)',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif', color: NAVY, overflowX: 'hidden', lineHeight: 1 }}>

      {/* ════════════════════════════════════════════
          NAVİGASYON
      ════════════════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: NAV_H,
        background: scrolled ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: scrolled ? '1px solid rgba(15,23,42,0.10)' : '1px solid transparent',
        boxShadow: scrolled ? '0 2px 24px rgba(15,23,42,0.08)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 max(5%, 24px)', zIndex: 1000,
        transition: 'all 0.3s',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'default' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 900, color: GOLD, letterSpacing: '-0.5px',
            boxShadow: '0 2px 12px rgba(28,49,82,0.3)',
          }}>S</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, letterSpacing: '-0.4px', lineHeight: 1 }}>Safiron</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Hawale</div>
          </div>
        </div>

        {/* Linkler */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 14, fontWeight: 500 }}>
          {[['Hakkımızda', '#about'], ['Özellikler', '#features'], ['Nasıl Çalışır', '#how'], ['İletişim', '#contact']].map(([label, href]) => (
            <a key={label} href={href}
              style={{ color: SLATE, textDecoration: 'none', transition: 'color 0.15s', padding: '4px 0' }}
              onMouseEnter={e => e.target.style.color = NAVY}
              onMouseLeave={e => e.target.style.color = SLATE}>
              {label}
            </a>
          ))}
          <button
            onClick={() => navigate('/login')}
            style={{
              ...btnPrimary,
              padding: '9px 22px', fontSize: 13.5,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(28,49,82,0.36)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(28,49,82,0.28)' }}
          >
            Giriş Yap
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <section ref={heroRef} style={{
        minHeight: '100vh',
        background: `linear-gradient(150deg, #050D1A 0%, #0D1F3C 45%, #0F2847 100%)`,
        display: 'flex', alignItems: 'center',
        padding: `${NAV_H + 60}px max(5%, 24px) 80px`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Arka plan ışıkları */}
        <div style={{ position: 'absolute', top: '20%', left: '5%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,108,176,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '8%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,108,176,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

          {/* Sol — metin */}
          <div>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100,
              background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)',
              fontSize: 12.5, fontWeight: 700, color: GOLD2, marginBottom: 28,
              letterSpacing: '0.05em',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.6)', display: 'inline-block' }} />
              Hawala & Döviz Yönetim Platformu
            </div>

            <h1 style={{
              fontSize: 'clamp(38px, 4.5vw, 64px)', fontWeight: 900, lineHeight: 1.07,
              color: WHITE, letterSpacing: '-1.8px', marginBottom: 26,
            }}>
              Döviz Ofisini<br />
              <span style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 50%, #F4D98A 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Profesyonelce
              </span>
              <br />Yönet
            </h1>

            <p style={{ fontSize: 17, color: '#94A3B8', lineHeight: 1.75, marginBottom: 36, maxWidth: 480 }}>
              Çok şubeli havale ofisleri ve döviz büroları için özel olarak geliştirilmiş,
              <strong style={{ color: SLATE2 }}> AI destekli</strong> profesyonel muhasebe ve yönetim platformu.
            </p>

            {/* CTA */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 52 }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '14px 30px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`,
                  color: NAVY, border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 24px rgba(201,168,76,0.35)',
                  transition: 'all 0.2s', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(201,168,76,0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,168,76,0.35)' }}
              >
                Hemen Başla
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
              <a
                href="#features"
                style={{
                  padding: '14px 30px', borderRadius: 12, fontSize: 15, fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', color: WHITE,
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer', textDecoration: 'none',
                  transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              >
                Özellikleri Keşfet
              </a>
            </div>

            {/* İşlem tipleri etiketleri */}
            <div>
              <div style={{ fontSize: 11.5, color: SLATE2, fontWeight: 600, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Desteklenen İşlem Tipleri</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TX_TYPES.map(t => (
                  <span key={t.code} style={{
                    padding: '5px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    color: SLATE2, fontSize: 12.5, fontWeight: 600,
                  }}>{t.label}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ — dashboard kartları */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            {/* Ana kart */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 20, padding: 28, width: '100%', maxWidth: 420,
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
            }}>
              {/* Üst bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <div>
                  <div style={{ fontSize: 11, color: SLATE2, fontWeight: 600, marginBottom: 2 }}>TOPLAM POZİSYON</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: WHITE, letterSpacing: '-1px' }}>$392,844</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, marginBottom: 2 }}>▲ +2.4%</div>
                  <div style={{ fontSize: 11, color: SLATE2 }}>bugün</div>
                </div>
              </div>

              {/* Lokasyon satırları */}
              {[
                { city: '🇹🇷 İstanbul', usd: '284,500', eur: '12,300', pnl: '+1,240' },
                { city: '🇦🇪 Dubai',    usd: '95,000',  eur: '3,100',  pnl: '+760' },
                { city: '🇸🇦 Riyad',    usd: '13,344',  eur: '—',      pnl: '+88' },
              ].map((loc, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{loc.city}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: SLATE2 }}>USD <span style={{ color: WHITE, fontWeight: 600 }}>{loc.usd}</span></div>
                    <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>+{loc.pnl}</div>
                  </div>
                </div>
              ))}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '16px 0' }} />

              {/* Son işlemler */}
              <div style={{ fontSize: 11, color: SLATE2, fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Son İşlemler</div>
              {[
                { type: 'Havale', amount: '+$8,200', cp: 'Al-Rashidi', color: '#22C55E' },
                { type: 'FX Al/Sat', amount: '-$5,400', cp: 'Hassan Bey',  color: '#F59E0B' },
                { type: 'SWIFT',  amount: '+$12,000', cp: 'GCC Trading',  color: '#60A5FA' },
              ].map((tx, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: SLATE2,
                    }}>💸</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: WHITE }}>{tx.type}</div>
                      <div style={{ fontSize: 11, color: SLATE2 }}>{tx.cp}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tx.color }}>{tx.amount}</div>
                </div>
              ))}
            </div>

            {/* Yüzen Telegram kartı */}
            <div style={{
              position: 'absolute', bottom: -24, right: -16,
              background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14, padding: '12px 16px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
              minWidth: 190,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.7)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>Safiron Bot</span>
              </div>
              <div style={{ fontSize: 11.5, color: SLATE2, lineHeight: 1.5 }}>
                💰 Bakiye: <span style={{ color: WHITE, fontWeight: 600 }}>$392,844</span><br/>
                📊 Bugün P&L: <span style={{ color: '#22C55E', fontWeight: 600 }}>+$2,088</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          İSTATİSTİKLER ŞERİDİ
      ════════════════════════════════════════════ */}
      <section style={{
        background: WHITE,
        borderBottom: '1px solid #E2E8F0',
        padding: '0 max(5%, 24px)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {STATS.map((s, i) => (
            <div key={i} style={{
              padding: '36px 20px', textAlign: 'center',
              borderRight: i < 3 ? '1px solid #E2E8F0' : 'none',
            }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: NAVY2, letterSpacing: '-1px', marginBottom: 4 }}>{s.val}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11.5, color: SLATE, lineHeight: 1.5 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          HAKKIMIZDA
      ════════════════════════════════════════════ */}
      <section id="about" style={{ padding: '100px max(5%, 24px)', background: BG }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          {/* Sol — içerik */}
          <div>
            <SectionLabel>Hakkımızda</SectionLabel>
            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 900, color: NAVY, letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 20 }}>
              Hawale sektörünün<br />
              <span style={{ color: BLUE }}>dijital omurgası</span>
            </h2>
            <p style={{ fontSize: 16, color: SLATE, lineHeight: 1.8, marginBottom: 20 }}>
              Safiron Hawale, çok şubeli hawala ve döviz ofislerinin karmaşık muhasebe ihtiyaçlarını
              çözmek için sıfırdan tasarlanmış bir SaaS platformudur. Yıllarca sektörde yaşanan
              sorunları gözlemleyerek geliştirilen platform; işlem takibi, kur yönetimi,
              PnL hesaplama ve raporlamayı tek çatı altında toplar.
            </p>
            <p style={{ fontSize: 16, color: SLATE, lineHeight: 1.8, marginBottom: 32 }}>
              Türkiye, BAE, Suudi Arabistan ve çevre ülkelerdeki hawale ofislerine hizmet vermek
              üzere çok dilli ve çok para birimli yapısıyla tasarlanmıştır.
              Telegram bot entegrasyonu sayesinde sahadan erişim kesintisizdir.
            </p>
            {[
              { icon: '🌍', text: 'İstanbul · Dubai · Riyad · Kahire ve daha fazlası' },
              { icon: '🏦', text: 'Hawala, döviz bürosu ve SWIFT işlemlerine destek' },
              { icon: '🛡️', text: 'RBAC, audit log ve tam izlenebilirlik' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: 'rgba(43,108,176,0.08)', border: '1px solid rgba(43,108,176,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>{item.icon}</div>
                <span style={{ fontSize: 14.5, color: '#334155', fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Sağ — kart grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { icon: '💸', title: 'Havale İşlemleri',      desc: 'Uluslararası para transferi, komisyon hesaplama, müşteri & tedarikçi yönetimi.' },
              { icon: '💱', title: 'Döviz Al/Sat',           desc: 'Spread hesaplama, anlık PnL, çapraz kur desteği.' },
              { icon: '🏛️', title: 'Tedarikçi Uzlaşması',   desc: 'Karşı taraf bazlı mutabakat, alacak-borç takibi.' },
              { icon: '📋', title: 'Audit & Uyum',           desc: 'Her işlem için tam iz kaydı, kullanıcı bazlı erişim kontrolü.' },
            ].map((card, i) => (
              <div key={i} style={{
                padding: '22px 20px', borderRadius: 14,
                background: WHITE, border: '1px solid #E2E8F0',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(28,49,82,0.09)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
              >
                <div style={{ fontSize: 26, marginBottom: 10 }}>{card.icon}</div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{card.title}</h4>
                <p style={{ fontSize: 12.5, color: SLATE, lineHeight: 1.6 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          ÖZELLİKLER
      ════════════════════════════════════════════ */}
      <section id="features" style={{ padding: '100px max(5%, 24px)', background: WHITE }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <SectionLabel>Özellikler</SectionLabel>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: NAVY, letterSpacing: '-1px', marginBottom: 16 }}>
              Tek platformda her şey
            </h2>
            <p style={{ fontSize: 16.5, color: SLATE, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              Hawale ofislerinin ihtiyaç duyduğu tüm araçlar, modern ve kullanımı kolay arayüzde.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                padding: '30px 28px', borderRadius: 16,
                border: '1px solid #E8EDF5', background: WHITE,
                transition: 'all 0.22s', position: 'relative', overflow: 'hidden',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(28,49,82,0.1)'; e.currentTarget.style.borderColor = '#C7D7F5' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = '#E8EDF5' }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: f.color, border: `1.5px solid ${f.accent}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, marginBottom: 18,
                }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 10, letterSpacing: '-0.3px' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: SLATE, lineHeight: 1.7 }}>{f.desc}</p>
                <div style={{
                  position: 'absolute', top: 0, right: 0, width: 80, height: 80,
                  borderRadius: '0 16px 0 80px',
                  background: `${f.color}`,
                  opacity: 0.6,
                  pointerEvents: 'none',
                }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          NASIL ÇALIŞIR
      ════════════════════════════════════════════ */}
      <section id="how" style={{ padding: '100px max(5%, 24px)', background: BG }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <SectionLabel>Başlangıç</SectionLabel>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: NAVY, letterSpacing: '-1px', marginBottom: 16 }}>
              4 adımda operasyonel
            </h2>
            <p style={{ fontSize: 16, color: SLATE, maxWidth: 440, margin: '0 auto', lineHeight: 1.7 }}>
              Kurulumdan ilk işleme kadar her adım basit ve hızlı tasarlanmıştır.
            </p>
          </div>

          {/* Adımlar */}
          <div style={{ position: 'relative' }}>
            {/* Bağlantı çizgisi */}
            <div style={{
              position: 'absolute', top: 42, left: '12.5%', right: '12.5%', height: 2,
              background: `linear-gradient(90deg, ${BLUE}44, ${BLUE}88, ${BLUE}44)`,
              zIndex: 0,
            }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, position: 'relative', zIndex: 1 }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%', margin: '0 auto 20px',
                    background: WHITE, border: `2.5px solid ${BLUE}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, boxShadow: `0 0 0 6px ${BG}, 0 4px 16px rgba(43,108,176,0.18)`,
                  }}>{s.icon}</div>
                  <div style={{
                    fontSize: 12, fontWeight: 800, color: BLUE,
                    letterSpacing: '0.08em', marginBottom: 8,
                  }}>{s.n}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 8, lineHeight: 1.3 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.65 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          TELEGRAM BOT SHOWCASE
      ════════════════════════════════════════════ */}
      <section style={{ padding: '100px max(5%, 24px)', background: `linear-gradient(160deg, ${NAVY} 0%, #071428 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', right: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,108,176,0.15) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          {/* Sol */}
          <div>
            <SectionLabel light>Telegram Entegrasyonu</SectionLabel>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 900, color: WHITE, letterSpacing: '-0.8px', marginBottom: 20, lineHeight: 1.2 }}>
              Her şirkete özel bot,<br />her an erişim
            </h2>
            <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.8, marginBottom: 32 }}>
              Şubenizdeki yöneticiler, Telegram üzerinden anlık bakiye sorgulayabilir,
              yeni işlem açabilir, müşteri ekleyebilir. PIN tabanlı güvenli bağlantı.
              Üç dil desteği dahil.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { icon: '💰', title: 'Anlık Bakiye',       desc: 'Kasa bazında USD/EUR/TRY' },
                { icon: '📊', title: 'Kâr/Zarar Raporu',  desc: 'Günlük & haftalık PnL' },
                { icon: '➕', title: 'İşlem Oluştur',      desc: 'Telegram\'dan direkt giriş' },
                { icon: '👤', title: 'Müşteri Ekle',       desc: 'Tam müşteri kayıt akışı' },
                { icon: '📈', title: 'Kur Sorgulama',      desc: 'Güncel döviz kurları' },
                { icon: '🌐', title: 'Çok Dilli',          desc: 'TR · العربية · EN' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 11.5, color: SLATE2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sağ — Mock Telegram UI */}
          <div>
            <div style={{
              background: '#17212B',
              borderRadius: 22, overflow: 'hidden',
              boxShadow: '0 32px 100px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              {/* Telegram üst bar */}
              <div style={{
                background: '#232E3C', padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #2B6CB0, #1C3152)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>Safiron Bot</div>
                  <div style={{ fontSize: 11.5, color: '#22C55E', fontWeight: 600 }}>● çevrimiçi</div>
                </div>
              </div>

              {/* Mesajlar */}
              <div style={{ padding: '18px 16px', minHeight: 360 }}>
                {/* Bot mesajı */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    background: '#182533', borderRadius: '4px 12px 12px 12px',
                    padding: '11px 14px', maxWidth: '82%', display: 'inline-block',
                  }}>
                    <div style={{ fontSize: 13, color: '#E4E6EB', lineHeight: 1.6 }}>
                      👋 Merhaba! Ben Safiron Bot.<br/>
                      Bir seçenek belirleyin:
                    </div>
                  </div>
                </div>

                {/* Kullanıcı */}
                <div style={{ textAlign: 'right', marginBottom: 14 }}>
                  <div style={{
                    background: '#2B5278', borderRadius: '12px 4px 12px 12px',
                    padding: '10px 14px', display: 'inline-block',
                  }}>
                    <div style={{ fontSize: 13, color: WHITE }}>💰 Bakiye</div>
                  </div>
                </div>

                {/* Bot yanıtı */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    background: '#182533', borderRadius: '4px 12px 12px 12px',
                    padding: '13px 15px', maxWidth: '88%', display: 'inline-block',
                  }}>
                    <div style={{ fontSize: 12.5, color: '#E4E6EB', lineHeight: 1.8, fontFamily: 'monospace' }}>
                      💰 <strong>Kasa Bakiyeleri</strong><br/>
                      <span style={{ color: GOLD2 }}>📍 İstanbul</span><br/>
                      {'  '}USD: <strong>+284,500.00</strong> ≈ $284,500<br/>
                      {'  '}EUR: <strong>+12,300.00</strong> ≈ $13,344<br/>
                      <span style={{ color: GOLD2 }}>📍 Dubai</span><br/>
                      {'  '}USD: <strong>+95,000.00</strong> ≈ $95,000<br/>
                      <br/>
                      💵 <strong>Toplam: $392,844</strong>
                    </div>
                  </div>
                </div>

                {/* Kullanıcı */}
                <div style={{ textAlign: 'right', marginBottom: 14 }}>
                  <div style={{
                    background: '#2B5278', borderRadius: '12px 4px 12px 12px',
                    padding: '10px 14px', display: 'inline-block',
                  }}>
                    <div style={{ fontSize: 13, color: WHITE }}>➕ Yeni İşlem</div>
                  </div>
                </div>

                {/* Butonlar */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['💸 Havale', '💱 Döviz Al/Sat', '📥 Yatırma', '🏛️ SWIFT'].map(b => (
                    <div key={b} style={{
                      padding: '8px 14px', borderRadius: 8,
                      background: '#212D3B', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#A8B5C4', fontSize: 12, cursor: 'pointer',
                    }}>{b}</div>
                  ))}
                </div>
              </div>

              {/* Keyboard */}
              <div style={{
                background: '#232E3C', padding: '12px 16px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              }}>
                {['💰 Bakiye', '📊 Rapor', '📈 Kurlar', '➕ Yeni İşlem'].map(b => (
                  <div key={b} style={{
                    padding: '8px', borderRadius: 8, textAlign: 'center',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94A3B8', fontSize: 12, fontWeight: 600,
                  }}>{b}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          İLETİŞİM
      ════════════════════════════════════════════ */}
      <section id="contact" style={{ padding: '100px max(5%, 24px)', background: WHITE }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <SectionLabel>İletişim</SectionLabel>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: NAVY, letterSpacing: '-1px', marginBottom: 16 }}>
              Demo veya bilgi almak için
            </h2>
            <p style={{ fontSize: 16.5, color: SLATE, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
              Safiron Hawale'yi işletmenize entegre etmek, fiyatlandırma almak
              veya demo talep etmek için bizimle iletişime geçin.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
            {/* Sol — iletişim kartları */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { icon: '📧', label: 'E-posta', value: 'dp.finex@gmail.com', sub: 'En geç 24 saat içinde yanıt', href: 'mailto:dp.finex@gmail.com', color: '#EFF6FF', accent: BLUE },
                { icon: '💬', label: 'Telegram', value: '@safiron_support', sub: 'Genellikle birkaç saat içinde', href: 'https://t.me/safiron_support', color: '#F0F9FF', accent: '#0284C7' },
              ].map(c => (
                <a key={c.label} href={c.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    padding: '22px 24px', borderRadius: 16,
                    border: '1.5px solid #E2E8F0', background: c.color,
                    textDecoration: 'none', color: NAVY,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.boxShadow = `0 6px 24px ${c.accent}20`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
                >
                  <div style={{
                    width: 50, height: 50, borderRadius: 13,
                    background: WHITE, border: `1.5px solid ${c.accent}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                  }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize: 11.5, color: SLATE, fontWeight: 700, marginBottom: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{c.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: NAVY2, marginBottom: 2 }}>{c.value}</div>
                    <div style={{ fontSize: 12, color: SLATE }}>{c.sub}</div>
                  </div>
                </a>
              ))}

              {/* Çalışma saatleri */}
              <div style={{
                padding: '20px 24px', borderRadius: 16,
                border: '1.5px solid #E2E8F0', background: BG,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>🕐 Çalışma Saatleri</div>
                {[
                  ['Pazartesi – Cuma', '09:00 – 18:00'],
                  ['Cumartesi',        '10:00 – 14:00'],
                  ['Pazar',            '—'],
                ].map(([day, hours], i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, color: SLATE, marginBottom: 6,
                    paddingBottom: 6, borderBottom: i < 2 ? '1px solid #E2E8F0' : 'none',
                  }}>
                    <span>{day}</span>
                    <span style={{ fontWeight: 600, color: NAVY }}>{hours}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sağ — CTA kutusu */}
            <div style={{
              background: `linear-gradient(160deg, ${NAVY} 0%, #0D2547 100%)`,
              borderRadius: 20, padding: 36,
              boxShadow: '0 12px 48px rgba(13,31,60,0.25)',
            }}>
              <div style={{ fontSize: 11.5, color: GOLD2, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Hemen Başla</div>
              <h3 style={{ fontSize: 26, fontWeight: 900, color: WHITE, letterSpacing: '-0.6px', lineHeight: 1.2, marginBottom: 16 }}>
                Platformu bugün deneyin
              </h3>
              <p style={{ fontSize: 14.5, color: '#94A3B8', lineHeight: 1.75, marginBottom: 28 }}>
                Demo hesabı oluşturmak veya mevcut sisteminizi Safiron Hawale'ye taşımak için
                bizimle iletişime geçin. Onboarding süreci <strong style={{ color: SLATE2 }}>1 iş günü</strong> içinde tamamlanır.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Sınırsız işlem girişi',
                  'Çoklu şube & lokasyon',
                  'Telegram bot dahil',
                  'Türkçe / Arapça / İngilizce destek',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#CBD5E1' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', border: '1.5px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 800,
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`,
                  color: NAVY, border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 24px rgba(201,168,76,0.3)',
                  transition: 'all 0.2s', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(201,168,76,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,168,76,0.3)' }}
              >
                Giriş Yap
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════ */}
      <footer style={{ background: '#070F1C', padding: '56px max(5%, 24px) 32px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Üst */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: `linear-gradient(135deg, ${NAVY2}, ${BLUE})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 900, color: GOLD,
                }}>S</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, lineHeight: 1 }}>Safiron</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Hawale</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.75, maxWidth: 260 }}>
                Çok şubeli hawale ofisleri ve döviz büroları için tasarlanmış profesyonel yönetim platformu.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                {[
                  { label: 'E-posta', href: 'mailto:dp.finex@gmail.com', icon: '📧' },
                  { label: 'Telegram', href: 'https://t.me/safiron_support', icon: '💬' },
                ].map(s => (
                  <a key={s.label} href={s.href} style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, textDecoration: 'none', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    title={s.label}
                  >{s.icon}</a>
                ))}
              </div>
            </div>

            {/* Ürün */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: SLATE2, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Platform</div>
              {[['Özellikler', '#features'], ['Nasıl Çalışır', '#how'], ['Telegram Bot', '#features'], ['Güvenlik', '#features']].map(([l, h]) => (
                <a key={l} href={h} style={{ display: 'block', fontSize: 13.5, color: '#4B5563', textDecoration: 'none', marginBottom: 10, transition: 'color 0.15s' }}
                  onMouseEnter={e => e.target.style.color = '#94A3B8'}
                  onMouseLeave={e => e.target.style.color = '#4B5563'}>{l}</a>
              ))}
            </div>

            {/* Şirket */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: SLATE2, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Şirket</div>
              {[['Hakkımızda', '#about'], ['İletişim', '#contact']].map(([l, h]) => (
                <a key={l} href={h} style={{ display: 'block', fontSize: 13.5, color: '#4B5563', textDecoration: 'none', marginBottom: 10, transition: 'color 0.15s' }}
                  onMouseEnter={e => e.target.style.color = '#94A3B8'}
                  onMouseLeave={e => e.target.style.color = '#4B5563'}>{l}</a>
              ))}
            </div>

            {/* Dil desteği */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: SLATE2, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Dil Desteği</div>
              {[['🇹🇷 Türkçe', ''], ['🇸🇦 العربية', ''], ['🇬🇧 English', '']].map(([l]) => (
                <div key={l} style={{ fontSize: 13.5, color: '#4B5563', marginBottom: 10 }}>{l}</div>
              ))}
            </div>
          </div>

          {/* Alt çizgi */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 28 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#374151' }}>
              © {new Date().getFullYear()} Safiron Global Solutions. Tüm hakları saklıdır.
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 12.5 }}>
              {['Gizlilik Politikası', 'Kullanım Koşulları'].map(l => (
                <span key={l} style={{ color: '#374151', cursor: 'default' }}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
