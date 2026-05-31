import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { OptimizedImage } from '../components/OptimizedImage'
import SEO from '../components/SEO'
import StructuredData, { softwareApplicationSchema } from '../components/StructuredData'
import { createSeoMetadata } from '../utils/seo'
import { normalizeLang, langPath } from '../utils/lang'

const NAV_H = 68

/* ── Marka renkleri ──────────────────────────────────────────────────────── */
const GOLD = '#C9A84C'
const NAVY = '#0D1F3C'

/* ── Çeviri tablosu ──────────────────────────────────────────────────────── */
const COPY = {
  tr: {
    dir: 'ltr',
    badge: 'Özellikler',
    h1: 'Para Hizmetleri Operasyonu İçin Eksiksiz Özellik Seti',
    sub: 'Havale, döviz alım-satım ve SWIFT işlemlerini tek platformda yönetin. Çok şubeli mimari, gerçek zamanlı pozisyon takibi, yapay zeka destekli analiz ve şirkete özel Telegram bot entegrasyonu.',
    ctaPrimary: 'Platforma Giriş Yap',
    ctaSecondary: 'Fiyatlandırmayı Gör',
    sectionsIntro: 'Tüm modüller tek bir profesyonel arayüzde birleşir.',
    sections: [
      {
        h2: 'Çok Şubeli Havale Yönetimi',
        p: 'Her şirket ve şube tamamen izole çalışır. Tüm lokasyonları konsolide USD bazında tek panelden izleyin.',
        items: [
          ['Gerçek Zamanlı İşlem Takibi', 'Havale, yatırma, çekme ve virman işlemleri anlık olarak kaydedilir ve panele yansır.'],
          ['Otomatik Kâr Hesaplama', 'Her işlemde kur farkı ve komisyon otomatik hesaplanır.'],
          ['Denetim Kayıtları', 'Tüm işlemler kullanıcı, zaman ve değişiklik bazında denetim kaydına yazılır.'],
        ],
      },
      {
        h2: 'Döviz Alım-Satım ve Kur Yönetimi',
        p: 'ECB / Frankfurter API ile otomatik kur güncellemesi. Spread hesaplama ve anlık kâr/zarar takibi.',
        items: [
          ['Gerçek Zamanlı Kurlar', 'Piyasa kurları otomatik güncellenir, manuel override desteklenir.'],
          ['Spread ve Marj Takibi', 'Alış-satış spread\'i ve kâr marjı her işlemde görüntülenir.'],
          ['22+ Para Birimi', 'Çoklu para birimi desteği ile uluslararası operasyon.'],
        ],
      },
      {
        h2: 'SWIFT Entegrasyonu ve Uluslararası Transfer',
        p: 'Sorunsuz SWIFT ödeme işleme. Çoklu para birimli hesaplar ve küresel transferler için ISO 20022 uyumu.',
        items: [
          ['ISO 20022 Uyumu', 'Modern SWIFT mesajlaşma standardına uygun transfer kayıtları.'],
          ['Çoklu Para Birimli Hesaplar', 'Her şube için ayrı kasa ve para birimi yönetimi.'],
          ['Uluslararası Transfer İzleme', 'Gönderilen ve alınan transferlerin durumu tek ekranda.'],
        ],
      },
      {
        h2: 'Yapay Zeka Destekli Finansal Analiz',
        p: 'Groq tabanlı finansal chat asistanı. Verilerinizi sorgulayın, trend analizi ve rapor özetleri alın.',
        items: [
          ['İşlem Örüntü Analizi', 'Anormal işlem davranışlarını tespit eden örüntü tanıma.'],
          ['Doğal Dil Sorgulama', 'Verilerinizi sade dille sorgulayın, anında yanıt alın.'],
          ['Otomatik Rapor Özetleri', 'Günlük ve haftalık operasyon özetleri yapay zeka ile.'],
        ],
      },
      {
        h2: 'Güvenlik ve Yetkilendirme',
        p: '2FA e-posta doğrulama, rol bazlı yetkilendirme, denetim kaydı ve 30 dakika otomatik oturum kapatma.',
        items: [
          ['İki Faktörlü Doğrulama', 'E-posta tabanlı 2FA ile güvenli giriş.'],
          ['Rol Bazlı Erişim', 'Admin, muhasebe ve görüntüleyici rolleriyle yetki kontrolü.'],
          ['Otomatik Oturum Kapatma', '30 dakika hareketsizlikte oturum otomatik kapanır.'],
        ],
      },
      {
        h2: 'Telegram Bot Entegrasyonu',
        p: 'Şirkete özel bot ile bakiye sorgulama, işlem açma ve müşteri kaydı. Türkçe, Arapça ve İngilizce.',
        items: [
          ['Anlık Bakiye Sorgulama', 'Kasa bazında döviz pozisyonuna Telegram\'dan erişim.'],
          ['İşlem Oluşturma', 'Telegram üzerinden doğrudan işlem kaydı.'],
          ['Çok Dilli Destek', 'TR · AR · EN dillerinde bot arayüzü.'],
        ],
      },
    ],
    ctaH2: 'Operasyonunuzu Safiron ile dijitalleştirin',
    ctaP: 'Demo hesabı oluşturmak veya mevcut sisteminizi taşımak için iletişime geçin. Kurulum 1 iş günü içinde tamamlanır.',
    backHome: 'Ana Sayfa',
    pricing: 'Fiyatlandırma',
    loginBtn: 'Giriş Yap',
    rights: 'Tüm hakları saklıdır.',
  },
  ar: {
    dir: 'rtl',
    badge: 'المميزات',
    h1: 'مجموعة ميزات متكاملة لعمليات خدمات الأموال',
    sub: 'أدر عمليات الحوالة وصرف العملات والتحويلات SWIFT في منصة واحدة. هيكل متعدد الفروع، تتبع المراكز الفوري، تحليلات بالذكاء الاصطناعي، وبوت Telegram خاص بكل شركة.',
    ctaPrimary: 'الدخول إلى المنصة',
    ctaSecondary: 'عرض الأسعار',
    sectionsIntro: 'تتوحد جميع الوحدات في واجهة احترافية واحدة.',
    sections: [
      {
        h2: 'إدارة الحوالة متعددة الفروع',
        p: 'تعمل كل شركة وفرع بشكل مستقل تماماً. راقب جميع المواقع بمركز موحد بالدولار من لوحة واحدة.',
        items: [
          ['تتبع المعاملات الفوري', 'تُسجّل معاملات الحوالة والإيداع والسحب والتحويل فوراً وتظهر في اللوحة.'],
          ['حساب الأرباح التلقائي', 'يُحسب فرق الصرف والعمولة تلقائياً في كل معاملة.'],
          ['سجلات التدقيق', 'تُسجّل جميع المعاملات حسب المستخدم والوقت والتغيير.'],
        ],
      },
      {
        h2: 'صرف العملات وإدارة الأسعار',
        p: 'تحديث تلقائي للأسعار عبر ECB / Frankfurter API. حساب الهامش وتتبع الأرباح والخسائر فوراً.',
        items: [
          ['أسعار فورية', 'تُحدّث أسعار السوق تلقائياً مع دعم التعديل اليدوي.'],
          ['تتبع الهامش', 'يظهر هامش البيع والشراء والربح في كل معاملة.'],
          ['أكثر من 22 عملة', 'دعم متعدد العملات للعمليات الدولية.'],
        ],
      },
      {
        h2: 'تكامل SWIFT والتحويلات الدولية',
        p: 'معالجة سلسة لمدفوعات SWIFT. حسابات متعددة العملات وتوافق ISO 20022 للتحويلات العالمية.',
        items: [
          ['توافق ISO 20022', 'سجلات تحويل متوافقة مع معيار رسائل SWIFT الحديث.'],
          ['حسابات متعددة العملات', 'إدارة صندوق وعملة منفصلة لكل فرع.'],
          ['تتبع التحويلات الدولية', 'حالة التحويلات المرسلة والمستلمة في شاشة واحدة.'],
        ],
      },
      {
        h2: 'تحليل مالي بالذكاء الاصطناعي',
        p: 'مساعد محادثة مالي بتقنية Groq. استعلم عن بياناتك واحصل على تحليل الاتجاهات وملخصات التقارير.',
        items: [
          ['تحليل أنماط المعاملات', 'تعرّف على الأنماط لاكتشاف السلوكيات غير الطبيعية.'],
          ['استعلام بلغة طبيعية', 'استعلم عن بياناتك بلغة بسيطة واحصل على إجابة فورية.'],
          ['ملخصات تقارير تلقائية', 'ملخصات عمليات يومية وأسبوعية بالذكاء الاصطناعي.'],
        ],
      },
      {
        h2: 'الأمان والصلاحيات',
        p: 'تحقق بخطوتين عبر البريد، تحكم بالوصول حسب الدور، سجل تدقيق، وتسجيل خروج تلقائي بعد 30 دقيقة.',
        items: [
          ['التحقق بخطوتين', 'دخول آمن عبر 2FA بالبريد الإلكتروني.'],
          ['وصول حسب الدور', 'تحكم بالصلاحيات بأدوار المدير والمحاسبة والمشاهد.'],
          ['تسجيل خروج تلقائي', 'يُغلق الجلسة تلقائياً بعد 30 دقيقة من الخمول.'],
        ],
      },
      {
        h2: 'تكامل بوت تيليغرام',
        p: 'بوت خاص بكل شركة للاستعلام عن الأرصدة وفتح المعاملات وتسجيل العملاء. بالعربية والتركية والإنجليزية.',
        items: [
          ['استعلام الرصيد الفوري', 'الوصول إلى موقف العملات لكل صندوق عبر تيليغرام.'],
          ['إنشاء المعاملات', 'تسجيل المعاملات مباشرة عبر تيليغرام.'],
          ['دعم متعدد اللغات', 'واجهة البوت بالعربية والتركية والإنجليزية.'],
        ],
      },
    ],
    ctaH2: 'رقمن عملياتك مع Safiron',
    ctaP: 'تواصل معنا لإنشاء حساب تجريبي أو نقل نظامك الحالي. يكتمل الإعداد خلال يوم عمل واحد.',
    backHome: 'الصفحة الرئيسية',
    pricing: 'الأسعار',
    loginBtn: 'تسجيل الدخول',
    rights: 'جميع الحقوق محفوظة.',
  },
  en: {
    dir: 'ltr',
    badge: 'Features',
    h1: 'A Complete Feature Set for Money Services Operations',
    sub: 'Manage hawala, forex, and SWIFT transactions on a single platform. Multi-branch architecture, real-time position tracking, AI-powered analysis, and a company-specific Telegram bot integration.',
    ctaPrimary: 'Start Free Trial',
    ctaSecondary: 'View Pricing',
    sectionsIntro: 'Every module unified in one professional interface.',
    sections: [
      {
        h2: 'Multi-Currency Hawala Management',
        p: 'Each company and branch operates in full isolation. Monitor all locations on a single USD-consolidated dashboard.',
        items: [
          ['Real-Time Transaction Tracking', 'Remittance, deposit, withdrawal, and transfer entries are recorded and reflected instantly.'],
          ['Automated Profit Calculation', 'Exchange-rate margin and commission are calculated automatically on every transaction.'],
          ['Compliance Audit Logs', 'All transactions are logged by user, timestamp, and change for compliance.'],
        ],
      },
      {
        h2: 'Forex Trading & Exchange Rate Management',
        p: 'Automated rate updates via ECB / Frankfurter API. Spread calculation and real-time profit/loss tracking.',
        items: [
          ['Real-Time Exchange Rates', 'Market rates update automatically, with manual override support.'],
          ['Spread & Margin Tracking', 'Buy/sell spread and profit margin are shown on every transaction.'],
          ['22+ Currencies', 'Multi-currency support for international operations.'],
        ],
      },
      {
        h2: 'SWIFT Integration & International Transfers',
        p: 'Seamless SWIFT payment processing. Multi-currency accounts and ISO 20022 compliance for global transfers.',
        items: [
          ['ISO 20022 Compliance', 'Transfer records aligned with the modern SWIFT messaging standard.'],
          ['Multi-Currency Accounts', 'Separate safe and currency management per branch.'],
          ['International Transfer Tracking', 'Status of sent and received transfers on a single screen.'],
        ],
      },
      {
        h2: 'AI-Powered Financial Analysis',
        p: 'Groq-powered financial chat assistant. Query your data, get trend analysis and report summaries.',
        items: [
          ['Transaction Pattern Recognition', 'Pattern recognition that detects anomalous transaction behavior.'],
          ['Natural Language Queries', 'Query your data in plain language and get instant answers.'],
          ['Automated Report Summaries', 'AI-generated daily and weekly operational summaries.'],
        ],
      },
      {
        h2: 'Security & Access Control',
        p: '2FA email verification, role-based access control, audit logging, and 30-minute auto logout.',
        items: [
          ['Two-Factor Authentication', 'Secure sign-in via email-based 2FA.'],
          ['Role-Based Access', 'Permission control with admin, accounting, and viewer roles.'],
          ['Automatic Session Timeout', 'Sessions close automatically after 30 minutes of inactivity.'],
        ],
      },
      {
        h2: 'Telegram Bot Integration',
        p: 'Company-specific bot for balance queries, transaction entry, and customer registration. In Turkish, Arabic, and English.',
        items: [
          ['Live Balance Queries', 'Access per-safe FX positions directly from Telegram.'],
          ['Transaction Entry', 'Record transactions directly via Telegram.'],
          ['Multilingual Support', 'Bot interface in TR, AR, and EN.'],
        ],
      },
    ],
    ctaH2: 'Digitise your operations with Safiron',
    ctaP: 'Contact us to create a demo account or migrate your existing system. Setup is completed within 1 business day.',
    backHome: 'Home',
    pricing: 'Pricing',
    loginBtn: 'Sign In',
    rights: 'All rights reserved.',
  },
}

export default function Features({ lang }) {
  const uiLang = normalizeLang(lang)
  const c = COPY[uiLang]
  const isRTL = c.dir === 'rtl'
  const navigate = useNavigate()
  const seoData = createSeoMetadata('features', uiLang)

  return (
    <>
      <SEO {...seoData} />
      <StructuredData schema={softwareApplicationSchema} />
      <div dir={c.dir} style={{
        fontFamily: isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'DM Sans', -apple-system, 'Segoe UI', sans-serif",
        color: '#0F172A', background: '#fff', minHeight: '100vh',
      }}>
        <style>{`
          .ft-link { color: #64748B; text-decoration: none; transition: color 0.15s; font-weight: 500; }
          .ft-link:hover { color: ${NAVY}; }
          .ft-card { transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
          .ft-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(13,31,60,0.10); border-color: #CBD5E1; }
          @media (max-width: 820px) {
            .ft-grid { grid-template-columns: 1fr !important; }
            .ft-nav-links { display: none !important; }
          }
        `}</style>

        {/* ══ NAVBAR ══ */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 800, height: NAV_H,
          background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 max(5%, 24px)',
        }}>
          <Link to={langPath(uiLang)} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <OptimizedImage src="/emblem.png" alt="Safiron" width={42} height={42} loading="eager" style={{ objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, letterSpacing: '-0.5px', lineHeight: 1.05 }}>Safiron</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.4 }}>Global Solutions</div>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13.5 }}>
            <div className="ft-nav-links" style={{ display: 'flex', gap: 24 }}>
              <Link to={langPath(uiLang)} className="ft-link">{c.backHome}</Link>
              <Link to={langPath(uiLang, 'pricing')} className="ft-link">{c.pricing}</Link>
            </div>
            <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              {[['tr', 'TR'], ['ar', 'ع'], ['en', 'EN']].map(([l, lbl]) => (
                <button key={l} onClick={() => navigate(langPath(l, 'features'))} style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                  background: uiLang === l ? NAVY : 'transparent',
                  color: uiLang === l ? '#fff' : '#94A3B8',
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

        {/* ══ HERO ══ */}
        <header style={{
          background: 'linear-gradient(155deg, #050C1A 0%, #0B1C37 55%, #0F2346 100%)',
          padding: '88px max(5%, 24px) 80px', textAlign: isRTL ? 'right' : 'left',
        }}>
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <motion.span
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              style={{
                display: 'inline-block', marginBottom: 22, padding: '6px 16px', borderRadius: 100,
                background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)',
                fontSize: 12, fontWeight: 700, color: '#E8C56B', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>{c.badge}</motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
              style={{ fontSize: 'clamp(30px, 4vw, 50px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.4px', lineHeight: 1.1, marginBottom: 22 }}>
              {c.h1}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.16 }}
              style={{ fontSize: 17, color: '#8899AA', lineHeight: 1.75, marginBottom: 36, maxWidth: 640 }}>
              {c.sub}
            </motion.p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/login')} style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                background: 'linear-gradient(135deg, #C9A84C, #E8C56B)', color: NAVY,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 24px rgba(201,168,76,0.35)',
              }}>{c.ctaPrimary}</button>
              <Link to={langPath(uiLang, 'pricing')} style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', color: '#CBD5E1',
                border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center',
              }}>{c.ctaSecondary}</Link>
            </div>
          </div>
        </header>

        {/* ══ FEATURE SECTIONS ══ */}
        <main style={{ maxWidth: 1120, margin: '0 auto', padding: '72px max(5%, 24px)' }}>
          <p style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600, textAlign: 'center', marginBottom: 56, letterSpacing: '0.02em' }}>
            {c.sectionsIntro}
          </p>

          {c.sections.map((sec, i) => (
            <motion.section
              key={sec.h2}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              style={{ marginBottom: 64 }}
            >
              <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', fontWeight: 800, color: NAVY, letterSpacing: '-0.6px', marginBottom: 12 }}>
                {sec.h2}
              </h2>
              <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.7, marginBottom: 28, maxWidth: 720 }}>
                {sec.p}
              </p>
              <div className="ft-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                {sec.items.map(([title, desc]) => (
                  <article key={title} className="ft-card" style={{
                    padding: '22px 22px 24px', borderRadius: 14,
                    background: '#fff', border: '1px solid #E2E8F0',
                  }}>
                    <div style={{ width: 32, height: 4, borderRadius: 4, background: `linear-gradient(90deg, ${GOLD}, #E8C56B)`, marginBottom: 16 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8, lineHeight: 1.3 }}>{title}</h3>
                    <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6 }}>{desc}</p>
                  </article>
                ))}
              </div>
            </motion.section>
          ))}
        </main>

        {/* ══ CTA ══ */}
        <section style={{
          background: 'linear-gradient(155deg, #050C1A 0%, #0B1C37 100%)',
          padding: '72px max(5%, 24px)', textAlign: 'center',
        }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', marginBottom: 16 }}>
              {c.ctaH2}
            </h2>
            <p style={{ fontSize: 16, color: '#8899AA', lineHeight: 1.7, marginBottom: 32 }}>{c.ctaP}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/login')} style={{
                padding: '13px 30px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                background: 'linear-gradient(135deg, #C9A84C, #E8C56B)', color: NAVY,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>{c.ctaPrimary}</button>
              <Link to={langPath(uiLang, 'pricing')} style={{
                padding: '13px 30px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', color: '#CBD5E1',
                border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center',
              }}>{c.ctaSecondary}</Link>
            </div>
          </div>
        </section>

        {/* ══ FOOTER ══ */}
        <footer style={{ background: '#040D1C', padding: '40px max(5%, 24px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <OptimizedImage src="/emblem.png" alt="Safiron" width={36} height={36} loading="lazy" style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Safiron Global Solutions</span>
            </div>
            <nav style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Link to={langPath(uiLang)} style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.backHome}</Link>
              <Link to={langPath(uiLang, 'pricing')} style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.pricing}</Link>
              <Link to="/gizlilik-politikasi" style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>Privacy</Link>
            </nav>
            <span style={{ fontSize: 12.5, color: '#475569' }}>© {new Date().getFullYear()} Safiron. {c.rights}</span>
          </div>
        </footer>
      </div>
    </>
  )
}
