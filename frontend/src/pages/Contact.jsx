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

const SALES_EMAIL = 'sales@safironpay.com'
const INFO_EMAIL = 'info@safironpay.com'

const COPY = {
  tr: {
    dir: 'ltr',
    badge: 'İletişim',
    h1: 'Bizimle İletişime Geçin',
    sub: 'Demo talebi, fiyat bilgisi veya mevcut sisteminizi Safiron\'a taşımak için ekibimize ulaşın. Genellikle 1 iş günü içinde yanıt veriyoruz.',
    methodsH2: 'İletişim Kanalları',
    methods: [
      ['Satış & Demo', 'Demo hesabı ve fiyatlandırma için satış ekibimize yazın.', SALES_EMAIL, `mailto:${SALES_EMAIL}`],
      ['Genel & Destek', 'Sorularınız ve teknik destek için bize ulaşın.', INFO_EMAIL, `mailto:${INFO_EMAIL}`],
    ],
    supportH2: 'Destek Saatleri',
    supportNote: 'E-postalara genellikle birkaç saat içinde, en geç 1 iş günü içinde dönüş yapılır.',
    days: [['Pazartesi – Cuma', '09:00 – 18:00'], ['Cumartesi', '10:00 – 14:00'], ['Pazar', 'Kapalı']],
    ctaH2: 'Operasyonunuzu dijitalleştirmeye hazır mısınız?',
    ctaP: 'Kurulum ve onboarding süreci 1 iş günü içinde tamamlanır.',
    ctaBtn: 'Platforma Giriş Yap',
    backHome: 'Ana Sayfa', features: 'Özellikler', pricing: 'Fiyatlandırma', about: 'Hakkımızda',
    loginBtn: 'Giriş Yap', rights: 'Tüm hakları saklıdır.', writeUs: 'Yaz',
  },
  ar: {
    dir: 'rtl',
    badge: 'تواصل معنا',
    h1: 'تواصل معنا',
    sub: 'تواصل مع فريقنا لطلب عرض تجريبي أو معلومات الأسعار أو نقل نظامك الحالي إلى Safiron. نرد عادةً خلال يوم عمل واحد.',
    methodsH2: 'قنوات التواصل',
    methods: [
      ['المبيعات والعرض التجريبي', 'راسل فريق المبيعات للحصول على حساب تجريبي والأسعار.', SALES_EMAIL, `mailto:${SALES_EMAIL}`],
      ['عام ودعم', 'تواصل معنا لأسئلتك والدعم الفني.', INFO_EMAIL, `mailto:${INFO_EMAIL}`],
    ],
    supportH2: 'ساعات الدعم',
    supportNote: 'يتم الرد على رسائل البريد عادةً خلال ساعات، وبحد أقصى يوم عمل واحد.',
    days: [['الاثنين – الجمعة', '09:00 – 18:00'], ['السبت', '10:00 – 14:00'], ['الأحد', 'مغلق']],
    ctaH2: 'هل أنت مستعد لرقمنة عملياتك؟',
    ctaP: 'يكتمل الإعداد والتأهيل خلال يوم عمل واحد.',
    ctaBtn: 'الدخول إلى المنصة',
    backHome: 'الصفحة الرئيسية', features: 'المميزات', pricing: 'الأسعار', about: 'من نحن',
    loginBtn: 'تسجيل الدخول', rights: 'جميع الحقوق محفوظة.', writeUs: 'راسلنا',
  },
  en: {
    dir: 'ltr',
    badge: 'Contact',
    h1: 'Get in Touch With Us',
    sub: 'Reach our team to request a demo, get pricing information, or migrate your existing system to Safiron. We usually respond within 1 business day.',
    methodsH2: 'Contact Channels',
    methods: [
      ['Sales & Demo', 'Write to our sales team for a demo account and pricing.', SALES_EMAIL, `mailto:${SALES_EMAIL}`],
      ['General & Support', 'Reach out for questions and technical support.', INFO_EMAIL, `mailto:${INFO_EMAIL}`],
    ],
    supportH2: 'Support Hours',
    supportNote: 'Emails are usually answered within hours, and within 1 business day at the latest.',
    days: [['Monday – Friday', '09:00 – 18:00'], ['Saturday', '10:00 – 14:00'], ['Sunday', 'Closed']],
    ctaH2: 'Ready to digitise your operations?',
    ctaP: 'Setup and onboarding are completed within 1 business day.',
    ctaBtn: 'Start Free Trial',
    backHome: 'Home', features: 'Features', pricing: 'Pricing', about: 'About',
    loginBtn: 'Sign In', rights: 'All rights reserved.', writeUs: 'Write',
  },
}

const MAIL_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" />
  </svg>
)

export default function Contact() {
  const [uiLang, setUiLang] = useState('tr')
  const c = COPY[uiLang]
  const isRTL = c.dir === 'rtl'
  const navigate = useNavigate()
  const seoData = createSeoMetadata('contact', uiLang)

  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    'name': seoData.title,
    'url': seoData.canonicalUrl,
    'mainEntity': {
      '@type': 'Organization',
      'name': 'Safiron Global Solutions',
      'email': SALES_EMAIL,
      'url': 'https://safironpay.com',
    },
  }

  return (
    <>
      <SEO {...seoData} />
      <StructuredData schema={organizationSchema} />
      <StructuredData schema={contactSchema} />
      <div dir={c.dir} style={{
        fontFamily: isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'DM Sans', -apple-system, 'Segoe UI', sans-serif",
        color: '#0F172A', background: '#fff', minHeight: '100vh',
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..900;1,9..40,300..900&display=swap');
          .ct-link { color: #64748B; text-decoration: none; transition: color 0.15s; font-weight: 500; }
          .ct-link:hover { color: ${NAVY}; }
          .ct-card { transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
          .ct-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(13,31,60,0.10); border-color: #CBD5E1; }
          @media (max-width: 820px) {
            .ct-grid { grid-template-columns: 1fr !important; }
            .ct-nav-links { display: none !important; }
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
            <div className="ct-nav-links" style={{ display: 'flex', gap: 24 }}>
              <Link to="/features" className="ct-link">{c.features}</Link>
              <Link to="/pricing" className="ct-link">{c.pricing}</Link>
              <Link to="/about" className="ct-link">{c.about}</Link>
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
          padding: '88px max(5%, 24px) 72px', textAlign: 'center',
        }}>
          <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ display: 'inline-block', marginBottom: 22, padding: '6px 16px', borderRadius: 100,
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)',
              fontSize: 12, fontWeight: 700, color: '#E8C56B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.badge}</motion.span>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
            style={{ fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.4px', lineHeight: 1.12, marginBottom: 18 }}>{c.h1}</motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.16 }}
            style={{ fontSize: 17, color: '#8899AA', lineHeight: 1.75, maxWidth: 600, margin: '0 auto' }}>{c.sub}</motion.p>
        </header>

        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '72px max(5%, 24px)' }}>
          {/* Contact methods */}
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', fontWeight: 800, color: NAVY, letterSpacing: '-0.6px', marginBottom: 28, textAlign: 'center' }}>{c.methodsH2}</h2>
            <div className="ct-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {c.methods.map(([title, desc, email, href]) => (
                <article key={email} className="ct-card" style={{ padding: '28px 26px', borderRadius: 16, background: '#fff', border: '1px solid #E2E8F0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{MAIL_ICON}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 8 }}>{title}</h3>
                  <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 18 }}>{desc}</p>
                  <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, color: NAVY, textDecoration: 'none' }}>
                    {email} →
                  </a>
                </article>
              ))}
            </div>
          </section>

          {/* Support hours */}
          <section style={{ maxWidth: 560, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 800, color: NAVY, letterSpacing: '-0.5px', marginBottom: 8, textAlign: 'center' }}>{c.supportH2}</h2>
            <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, marginBottom: 24, textAlign: 'center' }}>{c.supportNote}</p>
            <div style={{ borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              {c.days.map(([day, hours], i) => (
                <div key={day} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 22px', fontSize: 14.5,
                  background: i % 2 === 0 ? '#F8FAFC' : '#fff',
                  borderTop: i === 0 ? 'none' : '1px solid #E2E8F0',
                }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{day}</span>
                  <span style={{ color: '#64748B' }}>{hours}</span>
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
            <button onClick={() => navigate('/login')} style={{
              padding: '13px 30px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: 'linear-gradient(135deg, #C9A84C, #E8C56B)', color: NAVY,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>{c.ctaBtn}</button>
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
              <Link to="/about" style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{c.about}</Link>
            </nav>
            <span style={{ fontSize: 12.5, color: '#475569' }}>© {new Date().getFullYear()} Safiron. {c.rights}</span>
          </div>
        </footer>
      </div>
    </>
  )
}
