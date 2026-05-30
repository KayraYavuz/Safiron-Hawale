import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { OptimizedImage } from '../components/OptimizedImage'
import SEO from '../components/SEO'
import StructuredData, { organizationSchema } from '../components/StructuredData'
import { createSeoMetadata } from '../utils/seo'

const NAV_H = 68
const GOLD = '#C9A84C'
const NAVY = '#0D1F3C'

const COPY = {
  tr: {
    dir: 'ltr',
    badge: 'Hakkımızda',
    h1: 'Para Hizmetleri Sektörünün İhtiyaçlarından Doğan Bir Çözüm',
    sub: 'Safiron Global Solutions; havale ofisleri ve döviz bürolarının günlük operasyonlarını tek bir profesyonel platformda birleştirmek için geliştirildi.',
    missionH2: 'Misyonumuz',
    missionP: 'Havale, döviz ve SWIFT operasyonlarını yürüten işletmelere; çok şubeli yönetim, gerçek zamanlı pozisyon takibi ve yapay zeka destekli analizleri tek ekranda sunarak operasyonel verimlilik ve şeffaflık kazandırmak.',
    visionH2: 'Vizyonumuz',
    visionP: 'Türkiye, Körfez ülkeleri ve Orta Doğu pazarlarında para hizmetleri yazılımında referans platform olmak; çok dilli ve çok para birimli mimarimizle bölgesel liderliği hedeflemek.',
    valuesH2: 'Değerlerimiz',
    values: [
      ['Güvenlik Önceliği', 'İki faktörlü doğrulama, rol bazlı yetkilendirme ve eksiksiz denetim kaydı ile veri güvenliği temel önceliğimizdir.'],
      ['Şeffaflık', 'Her işlemde kur farkı, komisyon ve kâr/zarar net biçimde görüntülenir; gizli hesaplama yoktur.'],
      ['Çok Dillilik', 'Türkçe, Arapça ve İngilizce arayüz ile bölgenin tüm operatörlerine hitap ederiz.'],
      ['Sürekli Gelişim', 'Sahanın geri bildirimleriyle ürünü düzenli olarak geliştirir, yeni entegrasyonlar ekleriz.'],
    ],
    statsH2: 'Rakamlarla Safiron',
    stats: [['6+', 'İşlem Türü'], ['22+', 'Para Birimi'], ['3', 'Arayüz Dili'], ['7/24', 'Telegram Bot']],
    ctaH2: 'Operasyonunuzu bir sonraki seviyeye taşıyın',
    ctaP: 'Safiron\'un işletmenize nasıl değer katacağını görmek için demo talep edin.',
    ctaBtn: 'Demo Talep Et',
    backHome: 'Ana Sayfa', features: 'Özellikler', pricing: 'Fiyatlandırma', contact: 'İletişim',
    loginBtn: 'Giriş Yap', rights: 'Tüm hakları saklıdır.',
  },
  ar: {
    dir: 'rtl',
    badge: 'من نحن',
    h1: 'حل نابع من احتياجات قطاع خدمات الأموال',
    sub: 'طُوّرت Safiron Global Solutions لتوحيد العمليات اليومية لمكاتب الحوالة وصرافات العملات في منصة احترافية واحدة.',
    missionH2: 'مهمتنا',
    missionP: 'تمكين الشركات التي تدير عمليات الحوالة وصرف العملات و SWIFT من تحقيق الكفاءة التشغيلية والشفافية عبر إدارة متعددة الفروع وتتبع المراكز الفوري وتحليلات الذكاء الاصطناعي في شاشة واحدة.',
    visionH2: 'رؤيتنا',
    visionP: 'أن نكون المنصة المرجعية لبرمجيات خدمات الأموال في الأسواق التركية والخليجية والشرق أوسطية، مستهدفين الريادة الإقليمية بهيكلنا متعدد اللغات والعملات.',
    valuesH2: 'قيمنا',
    values: [
      ['الأمان أولاً', 'أمان البيانات أولوية أساسية عبر التحقق بخطوتين والوصول حسب الدور وسجل تدقيق كامل.'],
      ['الشفافية', 'يظهر فرق الصرف والعمولة والأرباح بوضوح في كل معاملة؛ لا حسابات خفية.'],
      ['تعدد اللغات', 'نخدم جميع المشغّلين في المنطقة بواجهة عربية وتركية وإنجليزية.'],
      ['التطوير المستمر', 'نطوّر المنتج بانتظام بناءً على ملاحظات الميدان ونضيف تكاملات جديدة.'],
    ],
    statsH2: 'Safiron بالأرقام',
    stats: [['+6', 'نوع معاملة'], ['+22', 'عملة'], ['3', 'لغات الواجهة'], ['24/7', 'بوت تيليغرام']],
    ctaH2: 'انقل عملياتك إلى المستوى التالي',
    ctaP: 'اطلب عرضاً تجريبياً لترى كيف تضيف Safiron قيمة لأعمالك.',
    ctaBtn: 'اطلب عرضاً تجريبياً',
    backHome: 'الصفحة الرئيسية', features: 'المميزات', pricing: 'الأسعار', contact: 'تواصل',
    loginBtn: 'تسجيل الدخول', rights: 'جميع الحقوق محفوظة.',
  },
  en: {
    dir: 'ltr',
    badge: 'About Us',
    h1: 'A Solution Born from the Needs of the Money Services Industry',
    sub: 'Safiron Global Solutions was built to unify the daily operations of hawala offices and currency exchange bureaus on a single professional platform.',
    missionH2: 'Our Mission',
    missionP: 'To bring operational efficiency and transparency to businesses running hawala, forex, and SWIFT operations — delivering multi-branch management, real-time position tracking, and AI-powered analysis on a single screen.',
    visionH2: 'Our Vision',
    visionP: 'To become the reference platform for money services software across Turkey, the Gulf, and Middle Eastern markets — targeting regional leadership with our multilingual, multi-currency architecture.',
    valuesH2: 'Our Values',
    values: [
      ['Security First', 'Data security is our core priority, with two-factor authentication, role-based access, and a complete audit log.'],
      ['Transparency', 'Exchange margin, commission, and profit/loss are shown clearly on every transaction — no hidden calculations.'],
      ['Multilingual', 'We serve every operator in the region with a Turkish, Arabic, and English interface.'],
      ['Continuous Improvement', 'We regularly improve the product based on field feedback and add new integrations.'],
    ],
    statsH2: 'Safiron in Numbers',
    stats: [['6+', 'Transaction Types'], ['22+', 'Currencies'], ['3', 'Interface Languages'], ['24/7', 'Telegram Bot']],
    ctaH2: 'Take your operations to the next level',
    ctaP: 'Request a demo to see how Safiron adds value to your business.',
    ctaBtn: 'Request a Demo',
    backHome: 'Home', features: 'Features', pricing: 'Pricing', contact: 'Contact',
    loginBtn: 'Sign In', rights: 'All rights reserved.',
  },
}

export default function About() {
  const [uiLang, setUiLang] = useState('tr')
  const c = COPY[uiLang]
  const isRTL = c.dir === 'rtl'
  const navigate = useNavigate()
  const seoData = createSeoMetadata('about', uiLang)

  return (
    <>
      <SEO {...seoData} />
      <StructuredData schema={organizationSchema} />
      <div dir={c.dir} style={{
        fontFamily: isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'DM Sans', -apple-system, 'Segoe UI', sans-serif",
        color: '#0F172A', background: '#fff', minHeight: '100vh',
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..900;1,9..40,300..900&display=swap');
          .ab-link { color: #64748B; text-decoration: none; transition: color 0.15s; font-weight: 500; }
          .ab-link:hover { color: ${NAVY}; }
          .ab-card { transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
          .ab-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(13,31,60,0.10); border-color: #CBD5E1; }
          @media (max-width: 820px) {
            .ab-grid { grid-template-columns: 1fr !important; }
            .ab-stats { grid-template-columns: repeat(2,1fr) !important; }
            .ab-nav-links { display: none !important; }
          }
        `}</style>

        {/* NAVBAR */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 800, height: NAV_H,
          background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 max(5%, 24px)',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <OptimizedImage src="/emblem.png" alt="Safiron" width={42} height={42} loading="eager" style={{ objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, letterSpacing: '-0.5px', lineHeight: 1.05 }}>Safiron</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.4 }}>Global Solutions</div>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13.5 }}>
            <div className="ab-nav-links" style={{ display: 'flex', gap: 24 }}>
              <Link to="/features" className="ab-link">{c.features}</Link>
              <Link to="/pricing" className="ab-link">{c.pricing}</Link>
              <Link to="/contact" className="ab-link">{c.contact}</Link>
            </div>
            <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              {[['tr', 'TR'], ['ar', 'ع'], ['en', 'EN']].map(([l, lbl]) => (
                <button key={l} onClick={() => setUiLang(l)} style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                  background: uiLang === l ? NAVY : 'transparent', color: uiLang === l ? '#fff' : '#94A3B8',
                  transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{lbl}</button>
              ))}
            </div>
            <button onClick={() => navigate('/login')} style={{
              padding: '9px 20px', borderRadius: 9, background: NAVY, color: '#fff',
              fontWeight: 600, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>{c.loginBtn}</button>
          </div>
        </nav>

        {/* HERO */}
        <header style={{
          background: 'linear-gradient(155deg, #050C1A 0%, #0B1C37 55%, #0F2346 100%)',
          padding: '88px max(5%, 24px) 72px', textAlign: isRTL ? 'right' : 'left',
        }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              style={{ display: 'inline-block', marginBottom: 22, padding: '6px 16px', borderRadius: 100,
                background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)',
                fontSize: 12, fontWeight: 700, color: '#E8C56B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.badge}</motion.span>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
              style={{ fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.4px', lineHeight: 1.12, marginBottom: 20 }}>{c.h1}</motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.16 }}
              style={{ fontSize: 17, color: '#8899AA', lineHeight: 1.75, maxWidth: 640 }}>{c.sub}</motion.p>
          </div>
        </header>

        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '72px max(5%, 24px)' }}>
          {/* Mission + Vision */}
          <div className="ab-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 64 }}>
            {[[c.missionH2, c.missionP], [c.visionH2, c.visionP]].map(([h, p]) => (
              <section key={h} style={{ padding: '32px 30px', borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ width: 36, height: 4, borderRadius: 4, background: `linear-gradient(90deg, ${GOLD}, #E8C56B)`, marginBottom: 18 }} />
                <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, letterSpacing: '-0.5px', marginBottom: 14 }}>{h}</h2>
                <p style={{ fontSize: 15.5, color: '#475569', lineHeight: 1.75 }}>{p}</p>
              </section>
            ))}
          </div>

          {/* Values */}
          <section style={{ marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', fontWeight: 800, color: NAVY, letterSpacing: '-0.6px', marginBottom: 28, textAlign: 'center' }}>{c.valuesH2}</h2>
            <div className="ab-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {c.values.map(([title, desc]) => (
                <article key={title} className="ab-card" style={{ padding: '24px 24px 26px', borderRadius: 14, background: '#fff', border: '1px solid #E2E8F0' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 10 }}>{title}</h3>
                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65 }}>{desc}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Stats */}
          <section>
            <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', fontWeight: 800, color: NAVY, letterSpacing: '-0.6px', marginBottom: 28, textAlign: 'center' }}>{c.statsH2}</h2>
            <div className="ab-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {c.stats.map(([v, l]) => (
                <div key={l} style={{ padding: '28px 16px', borderRadius: 14, background: 'linear-gradient(165deg, #0B1C37, #0F2346)', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: GOLD, letterSpacing: '-1px', lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 12.5, color: '#8899AA', marginTop: 8 }}>{l}</div>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* CTA */}
        <section style={{ background: 'linear-gradient(155deg, #050C1A 0%, #0B1C37 100%)', padding: '72px max(5%, 24px)', textAlign: 'center' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', marginBottom: 16 }}>{c.ctaH2}</h2>
            <p style={{ fontSize: 16, color: '#8899AA', lineHeight: 1.7, marginBottom: 32 }}>{c.ctaP}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/contact" style={{ padding: '13px 30px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                background: 'linear-gradient(135deg, #C9A84C, #E8C56B)', color: NAVY, textDecoration: 'none' }}>{c.ctaBtn}</Link>
              <Link to="/features" style={{ padding: '13px 30px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none' }}>{c.features}</Link>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: '#040D1C', padding: '40px max(5%, 24px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <OptimizedImage src="/emblem.png" alt="Safiron" width={36} height={36} loading="lazy" style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Safiron Global Solutions</span>
            </div>
            <nav style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Link to="/" style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.backHome}</Link>
              <Link to="/features" style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.features}</Link>
              <Link to="/pricing" style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.pricing}</Link>
              <Link to="/contact" style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.contact}</Link>
            </nav>
            <span style={{ fontSize: 12.5, color: '#475569' }}>© {new Date().getFullYear()} Safiron. {c.rights}</span>
          </div>
        </footer>
      </div>
    </>
  )
}
