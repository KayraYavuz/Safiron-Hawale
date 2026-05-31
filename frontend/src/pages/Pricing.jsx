import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { OptimizedImage } from '../components/OptimizedImage'
import SEO from '../components/SEO'
import StructuredData, { softwareApplicationSchema } from '../components/StructuredData'
import { createSeoMetadata } from '../utils/seo'
import { normalizeLang, langPath } from '../utils/lang'

const NAV_H = 68
const GOLD = '#C9A84C'
const NAVY = '#0D1F3C'

/* ── Çeviri tablosu ──────────────────────────────────────────────────────── */
const COPY = {
  tr: {
    dir: 'ltr',
    badge: 'Fiyatlandırma',
    h1: 'Şeffaf, İhtiyaca Göre Fiyatlandırma',
    sub: 'Gizli ücret yok. Operasyon büyüklüğünüze göre planınızı seçin; kurulum ve onboarding süreci her planda dahildir.',
    billingNote: 'Tüm planlar 1 iş günü içinde devreye alınır.',
    plans: [
      {
        name: 'Başlangıç', price: 'İletişime geçin', period: '', highlight: false,
        desc: 'Tek şubeli havale ve döviz ofisleri için.',
        cta: 'Demo Talep Et',
        feats: ['Tek şube yönetimi', 'Havale · Döviz · Yatırma · Çekme', 'Temel finansal raporlar', 'E-posta destek'],
      },
      {
        name: 'Profesyonel', price: 'İletişime geçin', period: '', highlight: true,
        desc: 'Çok şubeli operasyonlar için en popüler plan.',
        cta: 'Demo Talep Et',
        feats: ['Çoklu şube ve lokasyon', 'SWIFT entegrasyonu', 'Telegram bot entegrasyonu', 'AI finansal asistan', 'PDF & Excel raporlama', 'Öncelikli destek'],
      },
      {
        name: 'Kurumsal', price: 'İletişime geçin', period: '', highlight: false,
        desc: 'Yüksek hacimli ve özel ihtiyaçlı kuruluşlar için.',
        cta: 'Satışla Görüş',
        feats: ['Sınırsız şube', 'Özel entegrasyonlar', 'Özel SLA ve onboarding', 'Adanmış hesap yöneticisi', 'Gelişmiş denetim ve uyum'],
      },
    ],
    faqH2: 'Sıkça Sorulan Sorular',
    faqs: [
      ['Safiron fiyatlandırması nasıl çalışır?', 'Fiyatlandırma operasyon büyüklüğünüze, şube sayınıza ve ihtiyaç duyduğunuz modüllere göre belirlenir. Net teklif için bizimle iletişime geçin.'],
      ['Birden fazla para birimini destekliyor mu?', 'Evet. Safiron 22+ para birimini ve çoklu kasa yönetimini destekler; tüm pozisyonlar konsolide USD bazında izlenir.'],
      ['SWIFT entegrasyonu hangi planlarda var?', 'SWIFT entegrasyonu Profesyonel ve Kurumsal planlarda yer alır ve ISO 20022 uyumludur.'],
      ['Kurulum ne kadar sürer?', 'Kurulum ve onboarding süreci genellikle 1 iş günü içinde tamamlanır.'],
    ],
    backHome: 'Ana Sayfa',
    features: 'Özellikler',
    loginBtn: 'Giriş Yap',
    rights: 'Tüm hakları saklıdır.',
  },
  ar: {
    dir: 'rtl',
    badge: 'الأسعار',
    h1: 'تسعير شفاف حسب الحاجة',
    sub: 'بدون رسوم خفية. اختر خطتك حسب حجم عملياتك؛ الإعداد والتأهيل مشمولان في كل خطة.',
    billingNote: 'تُفعّل جميع الخطط خلال يوم عمل واحد.',
    plans: [
      {
        name: 'مبتدئ', price: 'تواصل معنا', period: '', highlight: false,
        desc: 'لمكاتب الحوالة وصرف العملات ذات الفرع الواحد.',
        cta: 'اطلب عرضاً تجريبياً',
        feats: ['إدارة فرع واحد', 'حوالة · صرف · إيداع · سحب', 'تقارير مالية أساسية', 'دعم بالبريد الإلكتروني'],
      },
      {
        name: 'احترافي', price: 'تواصل معنا', period: '', highlight: true,
        desc: 'الخطة الأكثر شيوعاً للعمليات متعددة الفروع.',
        cta: 'اطلب عرضاً تجريبياً',
        feats: ['فروع ومواقع متعددة', 'تكامل SWIFT', 'تكامل بوت تيليغرام', 'مساعد مالي بالذكاء الاصطناعي', 'تقارير PDF و Excel', 'دعم بأولوية'],
      },
      {
        name: 'مؤسسات', price: 'تواصل معنا', period: '', highlight: false,
        desc: 'للمؤسسات ذات الحجم الكبير والاحتياجات الخاصة.',
        cta: 'تحدث مع المبيعات',
        feats: ['فروع غير محدودة', 'تكاملات مخصصة', 'اتفاقية مستوى خدمة وتأهيل مخصص', 'مدير حساب مخصص', 'تدقيق وامتثال متقدم'],
      },
    ],
    faqH2: 'الأسئلة الشائعة',
    faqs: [
      ['كيف يعمل تسعير Safiron؟', 'يُحدّد السعر حسب حجم عملياتك وعدد فروعك والوحدات التي تحتاجها. تواصل معنا للحصول على عرض دقيق.'],
      ['هل يدعم عملات متعددة؟', 'نعم. يدعم Safiron أكثر من 22 عملة وإدارة صناديق متعددة؛ وتُراقب جميع المراكز بالدولار الموحد.'],
      ['في أي خطط يتوفر تكامل SWIFT؟', 'يتوفر تكامل SWIFT في الخطتين الاحترافية والمؤسسات وهو متوافق مع ISO 20022.'],
      ['كم يستغرق الإعداد؟', 'يكتمل الإعداد والتأهيل عادةً خلال يوم عمل واحد.'],
    ],
    backHome: 'الصفحة الرئيسية',
    features: 'المميزات',
    loginBtn: 'تسجيل الدخول',
    rights: 'جميع الحقوق محفوظة.',
  },
  en: {
    dir: 'ltr',
    badge: 'Pricing',
    h1: 'Transparent, Needs-Based Pricing',
    sub: 'No hidden fees. Choose a plan based on your operation size; setup and onboarding are included with every plan.',
    billingNote: 'All plans go live within 1 business day.',
    plans: [
      {
        name: 'Starter', price: 'Contact us', period: '', highlight: false,
        desc: 'For single-branch hawala and currency exchange offices.',
        cta: 'Request a Demo',
        feats: ['Single-branch management', 'Remittance · FX · Deposit · Withdrawal', 'Core financial reports', 'Email support'],
      },
      {
        name: 'Professional', price: 'Contact us', period: '', highlight: true,
        desc: 'The most popular plan for multi-branch operations.',
        cta: 'Request a Demo',
        feats: ['Multi-branch and locations', 'SWIFT integration', 'Telegram bot integration', 'AI financial assistant', 'PDF & Excel reporting', 'Priority support'],
      },
      {
        name: 'Enterprise', price: 'Contact us', period: '', highlight: false,
        desc: 'For high-volume organizations with custom needs.',
        cta: 'Talk to Sales',
        feats: ['Unlimited branches', 'Custom integrations', 'Custom SLA and onboarding', 'Dedicated account manager', 'Advanced audit and compliance'],
      },
    ],
    faqH2: 'Frequently Asked Questions',
    faqs: [
      ['How does Safiron pricing work?', 'Pricing is based on your operation size, number of branches, and the modules you need. Contact us for an exact quote.'],
      ['Does it support multiple currencies?', 'Yes. Safiron supports 22+ currencies and multi-safe management; all positions are tracked in consolidated USD.'],
      ['Which plans include SWIFT integration?', 'SWIFT integration is available on the Professional and Enterprise plans and is ISO 20022 compliant.'],
      ['How long does setup take?', 'Setup and onboarding are typically completed within 1 business day.'],
    ],
    backHome: 'Home',
    features: 'Features',
    loginBtn: 'Sign In',
    rights: 'All rights reserved.',
  },
}

const CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function Pricing({ lang }) {
  const uiLang = normalizeLang(lang)
  const c = COPY[uiLang]
  const isRTL = c.dir === 'rtl'
  const navigate = useNavigate()
  const seoData = createSeoMetadata('pricing', uiLang)

  // FAQPage schema for rich snippets
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': c.faqs.map(([q, a]) => ({
      '@type': 'Question',
      'name': q,
      'acceptedAnswer': { '@type': 'Answer', 'text': a },
    })),
  }

  return (
    <>
      <SEO {...seoData} />
      <StructuredData schema={softwareApplicationSchema} />
      <StructuredData schema={faqSchema} />
      <div dir={c.dir} style={{
        fontFamily: isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'DM Sans', -apple-system, 'Segoe UI', sans-serif",
        color: '#0F172A', background: '#fff', minHeight: '100vh',
      }}>
        <style>{`
          .pr-link { color: #64748B; text-decoration: none; transition: color 0.15s; font-weight: 500; }
          .pr-link:hover { color: ${NAVY}; }
          .pr-card { transition: transform 0.2s, box-shadow 0.2s; }
          .pr-card:hover { transform: translateY(-5px); box-shadow: 0 20px 48px rgba(13,31,60,0.12); }
          .pr-faq { border-bottom: 1px solid #E2E8F0; }
          .pr-faq summary { cursor: pointer; list-style: none; padding: 20px 0; font-size: 16px; font-weight: 700; color: ${NAVY}; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
          .pr-faq summary::-webkit-details-marker { display: none; }
          .pr-faq summary::after { content: '+'; font-size: 22px; color: ${GOLD}; font-weight: 400; }
          .pr-faq[open] summary::after { content: '−'; }
          @media (max-width: 820px) {
            .pr-grid { grid-template-columns: 1fr !important; }
            .pr-nav-links { display: none !important; }
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
            <div className="pr-nav-links" style={{ display: 'flex', gap: 24 }}>
              <Link to={langPath(uiLang)} className="pr-link">{c.backHome}</Link>
              <Link to={langPath(uiLang, 'features')} className="pr-link">{c.features}</Link>
            </div>
            <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              {[['tr', 'TR'], ['ar', 'ع'], ['en', 'EN']].map(([l, lbl]) => (
                <button key={l} onClick={() => navigate(langPath(l, 'pricing'))} style={{
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
          padding: '80px max(5%, 24px) 64px', textAlign: 'center',
        }}>
          <motion.span
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{
              display: 'inline-block', marginBottom: 22, padding: '6px 16px', borderRadius: 100,
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)',
              fontSize: 12, fontWeight: 700, color: '#E8C56B', letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>{c.badge}</motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
            style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.4px', lineHeight: 1.1, marginBottom: 18, maxWidth: 760, marginInline: 'auto' }}>
            {c.h1}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.16 }}
            style={{ fontSize: 17, color: '#8899AA', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
            {c.sub}
          </motion.p>
        </header>

        {/* ══ PRICING PLANS ══ */}
        <main style={{ maxWidth: 1080, margin: '0 auto', padding: '64px max(5%, 24px)' }}>
          <div className="pr-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, alignItems: 'stretch' }}>
            {c.plans.map((plan) => (
              <motion.article
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5 }}
                className="pr-card"
                style={{
                  display: 'flex', flexDirection: 'column',
                  padding: '32px 28px', borderRadius: 18,
                  background: plan.highlight ? 'linear-gradient(165deg, #0B1C37, #0F2346)' : '#fff',
                  border: plan.highlight ? `1.5px solid ${GOLD}` : '1px solid #E2E8F0',
                  boxShadow: plan.highlight ? '0 24px 60px rgba(13,31,60,0.25)' : '0 4px 18px rgba(13,31,60,0.05)',
                  position: 'relative',
                }}>
                {plan.highlight && (
                  <span style={{
                    position: 'absolute', top: -12, [isRTL ? 'right' : 'left']: 28,
                    padding: '4px 14px', borderRadius: 100, background: `linear-gradient(135deg, ${GOLD}, #E8C56B)`,
                    color: NAVY, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>★</span>
                )}
                <h2 style={{ fontSize: 20, fontWeight: 800, color: plan.highlight ? '#fff' : NAVY, marginBottom: 6 }}>{plan.name}</h2>
                <p style={{ fontSize: 13.5, color: plan.highlight ? '#8899AA' : '#64748B', lineHeight: 1.55, marginBottom: 20, minHeight: 40 }}>{plan.desc}</p>
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: plan.highlight ? '#fff' : NAVY, letterSpacing: '-0.6px' }}>{plan.price}</span>
                  {plan.period && <span style={{ fontSize: 14, color: '#94A3B8' }}> {plan.period}</span>}
                </div>
                <button onClick={() => navigate('/login')} style={{
                  padding: '12px', borderRadius: 10, fontSize: 14.5, fontWeight: 700, marginBottom: 24,
                  background: plan.highlight ? 'linear-gradient(135deg, #C9A84C, #E8C56B)' : NAVY,
                  color: plan.highlight ? NAVY : '#fff',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>{plan.cta}</button>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {plan.feats.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, lineHeight: 1.5, color: plan.highlight ? '#CBD5E1' : '#475569' }}>
                      {CHECK}<span>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13.5, color: '#94A3B8', marginTop: 32 }}>{c.billingNote}</p>
        </main>

        {/* ══ FAQ ══ */}
        <section style={{ maxWidth: 760, margin: '0 auto', padding: '24px max(5%, 24px) 80px' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, color: NAVY, letterSpacing: '-0.6px', marginBottom: 28, textAlign: 'center' }}>
            {c.faqH2}
          </h2>
          {c.faqs.map(([q, a]) => (
            <details key={q} className="pr-faq">
              <summary>{q}</summary>
              <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, padding: '0 0 20px' }}>{a}</p>
            </details>
          ))}
        </section>

        {/* ══ FOOTER ══ */}
        <footer style={{ background: '#040D1C', padding: '40px max(5%, 24px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <OptimizedImage src="/emblem.png" alt="Safiron" width={36} height={36} loading="lazy" style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Safiron Global Solutions</span>
            </div>
            <nav style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Link to={langPath(uiLang)} style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.backHome}</Link>
              <Link to={langPath(uiLang, 'features')} style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.features}</Link>
              <Link to="/gizlilik-politikasi" style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>Privacy</Link>
            </nav>
            <span style={{ fontSize: 12.5, color: '#475569' }}>© {new Date().getFullYear()} Safiron. {c.rights}</span>
          </div>
        </footer>
      </div>
    </>
  )
}
