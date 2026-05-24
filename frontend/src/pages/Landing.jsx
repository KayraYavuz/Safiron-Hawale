import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const NAV_H = 68

const FEATURES = [
  {
    icon: '🏦',
    title: 'Çoklu Şirket & Lokasyon',
    desc: 'Her şirket tamamen izole çalışır. İstanbul, Dubai, Kahire — tüm şubelerinizi tek panelden yönetin.',
  },
  {
    icon: '💱',
    title: 'Gerçek Zamanlı Kur Takibi',
    desc: 'ECB & Frankfurter API entegrasyonu ile otomatik kur güncellemesi. Manuel düzeltme imkânı.',
  },
  {
    icon: '📊',
    title: 'Anlık PnL & Raporlama',
    desc: 'Her işlemde kâr/zarar hesabı. Müşteri ekstresi, gelir tablosu, nakit akışı tek tıkla.',
  },
  {
    icon: '🤖',
    title: 'AI Finansal Asistan',
    desc: 'Groq destekli yapay zeka analizi. Verilerinizi sorgulayın, trend analizi yaptırın.',
  },
  {
    icon: '📱',
    title: 'Telegram Bot Entegrasyonu',
    desc: 'Her şirkete özel bot. Bakiye, rapor, işlem oluşturma — hepsi Telegram üzerinden.',
  },
  {
    icon: '🔐',
    title: 'Güvenlik & Yetki Kontrolü',
    desc: 'RBAC rol yönetimi, audit log, otomatik çıkış. Verileriniz her zaman güvende.',
  },
]

const STEPS = [
  { n: '01', title: 'Şirketinizi oluşturun', desc: 'Safiron hesabı açın, şirket bilgilerinizi girin. 2 dakika.' },
  { n: '02', title: 'Kasaları & kurları tanımlayın', desc: 'Lokasyonlar, hesap türleri ve döviz kurlarını yapılandırın.' },
  { n: '03', title: 'İşlem girmeye başlayın', desc: 'Havale, döviz, SWIFT — tüm işlem tiplerini destekler.' },
  { n: '04', title: 'Raporları takip edin', desc: 'Gerçek zamanlı pozisyon, kâr/zarar ve müşteri ekstresi.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const [mobileMenu, setMobileMenu] = useState(false)

  return (
    <div style={{ fontFamily: 'var(--font, system-ui, sans-serif)', color: '#0F172A', overflowX: 'hidden' }}>

      {/* ── NAVİGASYON ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: NAV_H,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(15,23,42,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 6%', zIndex: 100,
        boxShadow: '0 1px 20px rgba(15,23,42,0.06)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, #1C3152 0%, #2B6CB0 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#C9A84C', letterSpacing: '-0.5px',
          }}>S</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1C3152', letterSpacing: '-0.3px' }}>
            Safiron <span style={{ color: '#C9A84C' }}>Hawale</span>
          </span>
        </div>

        {/* Nav linkleri */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 14, fontWeight: 500 }}>
          {[['Özellikler', '#features'], ['Nasıl Çalışır', '#how'], ['İletişim', '#contact']].map(([label, href]) => (
            <a key={label} href={href} style={{ color: '#475569', textDecoration: 'none' }}
               onMouseEnter={e => e.target.style.color = '#1C3152'}
               onMouseLeave={e => e.target.style.color = '#475569'}>
              {label}
            </a>
          ))}
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '9px 22px', borderRadius: 9,
              background: 'linear-gradient(135deg, #1C3152 0%, #2B6CB0 100%)',
              color: 'white', fontWeight: 600, fontSize: 14,
              border: 'none', cursor: 'pointer', letterSpacing: '0.01em',
              boxShadow: '0 2px 12px rgba(28,49,82,0.25)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 4px 20px rgba(28,49,82,0.35)' }}
            onMouseLeave={e => { e.target.style.transform = ''; e.target.style.boxShadow = '0 2px 12px rgba(28,49,82,0.25)' }}
          >
            Giriş Yap →
          </button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh', paddingTop: NAV_H,
        background: 'linear-gradient(160deg, #F0F4FF 0%, #EEF2FF 40%, #FFF7ED 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: `${NAV_H + 60}px 6% 80px`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Dekoratif daireler */}
        <div style={{ position: 'absolute', top: '15%', left: '8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,108,176,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 760, position: 'relative' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 100,
            background: 'rgba(28,49,82,0.07)', border: '1px solid rgba(28,49,82,0.12)',
            fontSize: 13, fontWeight: 600, color: '#1C3152', marginBottom: 28,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            Hawala & Döviz Yönetim Platformu
          </div>

          {/* Başlık */}
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 62px)', fontWeight: 800, lineHeight: 1.1,
            color: '#0F172A', letterSpacing: '-1.5px', marginBottom: 24,
          }}>
            Döviz İşlemlerinizi{' '}
            <span style={{
              background: 'linear-gradient(135deg, #1C3152, #2B6CB0)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Akıllıca
            </span>{' '}
            Yönetin
          </h1>

          {/* Alt yazı */}
          <p style={{ fontSize: 18, color: '#475569', lineHeight: 1.7, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
            Çok şubeli havale ofisleri ve döviz büroları için tasarlanmış,
            yapay zeka destekli profesyonel muhasebe platformu.
          </p>

          {/* CTA butonları */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '14px 32px', borderRadius: 12, fontSize: 16, fontWeight: 700,
                background: 'linear-gradient(135deg, #1C3152, #2B6CB0)',
                color: 'white', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(28,49,82,0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 32px rgba(28,49,82,0.4)' }}
              onMouseLeave={e => { e.target.style.transform = ''; e.target.style.boxShadow = '0 4px 24px rgba(28,49,82,0.3)' }}
            >
              Hemen Başla →
            </button>
            <a
              href="#features"
              style={{
                padding: '14px 32px', borderRadius: 12, fontSize: 16, fontWeight: 600,
                background: 'white', color: '#1C3152', border: '1.5px solid rgba(28,49,82,0.15)',
                cursor: 'pointer', textDecoration: 'none',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'all 0.2s', display: 'inline-block',
              }}
              onMouseEnter={e => e.target.style.borderColor = '#1C3152'}
              onMouseLeave={e => e.target.style.borderColor = 'rgba(28,49,82,0.15)'}
            >
              Özellikleri İncele
            </a>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginTop: 64, flexWrap: 'wrap' }}>
            {[
              ['6+', 'İşlem Tipi'],
              ['3', 'Dil Desteği'],
              ['AI', 'Destekli Analiz'],
              ['7/24', 'Telegram Bot'],
            ].map(([val, lbl]) => (
              <div key={lbl} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1C3152' }}>{val}</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ÖZELLİKLER ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 6%', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Özellikler
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.8px', marginBottom: 16 }}>
              Tek platformda her şey
            </h2>
            <p style={{ fontSize: 17, color: '#475569', maxWidth: 520, margin: '0 auto' }}>
              Havale ofislerinin ihtiyaç duyduğu tüm araçlar, modern ve kullanımı kolay arayüzde.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {FEATURES.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: '28px 32px', borderRadius: 16,
                  border: '1px solid #E2E8F0', background: '#FAFBFF',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(28,49,82,0.1)'
                  e.currentTarget.style.borderColor = '#C7D7F5'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.borderColor = '#E2E8F0'
                }}
              >
                <div style={{ fontSize: 34, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NASIL ÇALIŞIR ───────────────────────────────────────────────────── */}
      <section id="how" style={{ padding: '100px 6%', background: 'linear-gradient(160deg, #F8FAFF 0%, #EEF2FF 100%)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Başlangıç
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.8px' }}>
              4 adımda hazır
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ position: 'relative' }}>
                {/* Bağlantı çizgisi */}
                {i < STEPS.length - 1 && (
                  <div style={{
                    position: 'absolute', top: 28, left: '70%', right: -20,
                    height: 2, background: 'linear-gradient(90deg, #CBD5E1, transparent)',
                    display: 'none', // Mobilde gizli
                  }} />
                )}
                <div style={{
                  padding: '28px 24px', borderRadius: 14,
                  background: 'white', border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 800, color: '#2B6CB0',
                    letterSpacing: '0.05em', marginBottom: 14,
                  }}>{s.n}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HAKKIMIZDA / TELEGRAM ───────────────────────────────────────────── */}
      <section style={{ padding: '100px 6%', background: '#0F172A' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              Telegram Entegrasyonu
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: 'white', letterSpacing: '-0.6px', marginBottom: 20, lineHeight: 1.2 }}>
              Her şirkete özel bot, her an erişim
            </h2>
            <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.75, marginBottom: 32 }}>
              Şubenizdeki yöneticiler Telegram üzerinden bakiye sorgulayabilir,
              yeni işlem açabilir, müşteri ekleyebilir.
              Üç dil desteği: Türkçe, Arapça, İngilizce.
            </p>
            {[
              '💰 Anlık kasa bakiyesi',
              '📊 Günlük kâr/zarar raporu',
              '➕ Telegram\'dan işlem oluşturma',
              '👤 Yeni müşteri ekleme',
              '🌐 Türkçe · العربية · English',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', flexShrink: 0 }} />
                <span style={{ fontSize: 15, color: '#CBD5E1' }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'linear-gradient(160deg, #1E293B, #0F172A)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: 32,
              fontFamily: 'monospace', fontSize: 14, color: '#94A3B8',
              textAlign: 'left', lineHeight: 2,
            }}>
              <div style={{ color: '#22C55E', marginBottom: 8 }}>● Safiron Bot — Çevrimiçi</div>
              <div><span style={{ color: '#C9A84C' }}>Siz:</span> 💰 Bakiye</div>
              <div style={{ marginTop: 8, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 10, borderLeft: '3px solid #2B6CB0' }}>
                <div style={{ color: '#E2E8F0', fontSize: 13 }}>
                  💰 <strong>Kasa Bakiyeleri</strong><br />
                  📍 <strong>İstanbul</strong><br />
                  {'  '}USD: +284,500.00 ≈ $284,500<br />
                  {'  '}EUR: +12,300.00 ≈ $13,344<br /><br />
                  📍 <strong>Dubai</strong><br />
                  {'  '}USD: +95,000.00 ≈ $95,000<br /><br />
                  💵 <strong>Toplam: $392,844.00</strong>
                </div>
              </div>
              <div style={{ marginTop: 8 }}><span style={{ color: '#C9A84C' }}>Siz:</span> ➕ Yeni İşlem</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['💸 Havale', '💱 Döviz', '📥 Yatırma'].map(b => (
                  <span key={b} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1', fontSize: 12 }}>{b}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── İLETİŞİM ────────────────────────────────────────────────────────── */}
      <section id="contact" style={{ padding: '100px 6%', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            İletişim
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.8px', marginBottom: 16 }}>
            Demoyu deneyin
          </h2>
          <p style={{ fontSize: 17, color: '#475569', lineHeight: 1.7, marginBottom: 48 }}>
            Safiron Hawale'yi işletmenize entegre etmek veya demo talep etmek için bizimle iletişime geçin.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: '📧', label: 'E-posta', value: 'dp.finex@gmail.com', href: 'mailto:dp.finex@gmail.com' },
              { icon: '💬', label: 'Telegram', value: '@safiron_support', href: 'https://t.me/safiron_support' },
            ].map(c => (
              <a
                key={c.label}
                href={c.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '20px 28px', borderRadius: 14,
                  border: '1.5px solid #E2E8F0', background: '#FAFBFF',
                  textDecoration: 'none', color: '#0F172A',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#2B6CB0'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(43,108,176,0.1)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E2E8F0'
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.transform = ''
                }}
              >
                <span style={{ fontSize: 24 }}>{c.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1C3152' }}>{c.value}</div>
                </div>
              </a>
            ))}
          </div>

          <button
            onClick={() => navigate('/login')}
            style={{
              marginTop: 40, padding: '15px 40px', borderRadius: 12, fontSize: 16, fontWeight: 700,
              background: 'linear-gradient(135deg, #1C3152, #2B6CB0)',
              color: 'white', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(28,49,82,0.25)',
              width: '100%', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 32px rgba(28,49,82,0.35)' }}
            onMouseLeave={e => { e.target.style.transform = ''; e.target.style.boxShadow = '0 4px 24px rgba(28,49,82,0.25)' }}
          >
            Giriş Yap →
          </button>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#0F172A', padding: '40px 6%', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'linear-gradient(135deg, #1C3152, #2B6CB0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: '#C9A84C',
            }}>S</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>
              Safiron <span style={{ color: '#C9A84C' }}>Hawale</span>
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            © {new Date().getFullYear()} Safiron Global Solutions. Tüm hakları saklıdır.
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
            {[['Özellikler', '#features'], ['Nasıl Çalışır', '#how'], ['İletişim', '#contact']].map(([l, h]) => (
              <a key={l} href={h} style={{ color: '#64748B', textDecoration: 'none' }}
                 onMouseEnter={e => e.target.style.color = '#94A3B8'}
                 onMouseLeave={e => e.target.style.color = '#64748B'}>{l}</a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}
