import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { OptimizedImage } from '../components/OptimizedImage'
import SEO from '../components/SEO'
import StructuredData from '../components/StructuredData'
import { createSeoMetadata } from '../utils/seo'
import { normalizeLang, langPath } from '../utils/lang'
import { getPosts, SITE } from '../data/blogPosts'

const NAV_H = 68
const GOLD = '#C9A84C'
const NAVY = '#0D1F3C'

const UI = {
  tr: { dir: 'ltr', badge: 'Blog', h1: 'Havale, Döviz ve Fintech Üzerine İçgörüler', sub: 'Para hizmetleri operasyonlarını yürütenler için rehberler, en iyi uygulamalar ve sektör notları.', read: 'Yazıyı Oku', backHome: 'Ana Sayfa', features: 'Özellikler', pricing: 'Fiyatlandırma', loginBtn: 'Giriş Yap', rights: 'Tüm hakları saklıdır.' },
  ar: { dir: 'rtl', badge: 'المدونة', h1: 'رؤى حول الحوالة والصرف والتكنولوجيا المالية', sub: 'أدلة وأفضل ممارسات وملاحظات قطاعية لمن يديرون عمليات خدمات الأموال.', read: 'اقرأ المقال', backHome: 'الصفحة الرئيسية', features: 'المميزات', pricing: 'الأسعار', loginBtn: 'تسجيل الدخول', rights: 'جميع الحقوق محفوظة.' },
  en: { dir: 'ltr', badge: 'Blog', h1: 'Insights on Hawala, Forex, and Fintech', sub: 'Guides, best practices, and industry notes for the people running money services operations.', read: 'Read Article', backHome: 'Home', features: 'Features', pricing: 'Pricing', loginBtn: 'Sign In', rights: 'All rights reserved.' },
}

const LOCALE = { tr: 'tr-TR', ar: 'ar-AE', en: 'en-US' }

export default function Blog({ lang }) {
  const uiLang = normalizeLang(lang)
  const t = UI[uiLang]
  const isRTL = t.dir === 'rtl'
  const navigate = useNavigate()
  const seoData = createSeoMetadata('blog', uiLang)
  const posts = getPosts(uiLang)

  const fmtDate = (d) => new Date(d).toLocaleDateString(LOCALE[uiLang], { year: 'numeric', month: 'long', day: 'numeric' })

  // Blog schema marks /blog as a listing of its posts so crawlers see the hub
  // as a collection rather than a generic page.
  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    'name': seoData.ogTitle || seoData.title,
    'description': seoData.description,
    'url': seoData.canonicalUrl,
    'inLanguage': uiLang,
    'blogPost': posts.map((post) => ({
      '@type': 'BlogPosting',
      'headline': post.title,
      'description': post.description,
      'datePublished': post.date,
      'dateModified': post.date,
      'image': post.image,
      'url': `${SITE}${langPath(uiLang, 'blog')}/${post.slug}`,
      'inLanguage': uiLang,
    })),
  }

  return (
    <>
      <SEO {...seoData} />
      <StructuredData schema={blogSchema} />
      <div dir={t.dir} style={{
        fontFamily: isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'DM Sans', -apple-system, 'Segoe UI', sans-serif",
        color: '#0F172A', background: '#fff', minHeight: '100vh',
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..900;1,9..40,300..900&display=swap');
          .bl-link { color: #64748B; text-decoration: none; transition: color 0.15s; font-weight: 500; }
          .bl-link:hover { color: ${NAVY}; }
          .bl-card { transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
          .bl-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(13,31,60,0.10); border-color: #CBD5E1; }
          @media (max-width: 820px) {
            .bl-grid { grid-template-columns: 1fr !important; }
            .bl-nav-links { display: none !important; }
          }
        `}</style>

        {/* NAVBAR */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 800, height: NAV_H,
          background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 max(5%, 24px)',
        }}>
          <Link to={langPath(uiLang)} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <OptimizedImage src="/emblem.png" alt="Safiron" width={42} height={42} loading="eager" style={{ objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, letterSpacing: '-0.5px', lineHeight: 1.05 }}>Safiron</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.4 }}>Global Solutions</div>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13.5 }}>
            <div className="bl-nav-links" style={{ display: 'flex', gap: 24 }}>
              <Link to={langPath(uiLang, 'features')} className="bl-link">{t.features}</Link>
              <Link to={langPath(uiLang, 'pricing')} className="bl-link">{t.pricing}</Link>
            </div>
            <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              {[['tr', 'TR'], ['ar', 'ع'], ['en', 'EN']].map(([l, lbl]) => (
                <button key={l} onClick={() => navigate(langPath(l, 'blog'))} style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                  background: uiLang === l ? NAVY : 'transparent', color: uiLang === l ? '#fff' : '#94A3B8',
                  transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{lbl}</button>
              ))}
            </div>
            <button onClick={() => navigate('/login')} style={{
              padding: '9px 20px', borderRadius: 9, background: NAVY, color: '#fff',
              fontWeight: 600, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>{t.loginBtn}</button>
          </div>
        </nav>

        {/* HERO */}
        <header style={{ background: 'linear-gradient(155deg, #050C1A 0%, #0B1C37 55%, #0F2346 100%)', padding: '80px max(5%, 24px) 64px', textAlign: 'center' }}>
          <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ display: 'inline-block', marginBottom: 22, padding: '6px 16px', borderRadius: 100,
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)',
              fontSize: 12, fontWeight: 700, color: '#E8C56B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t.badge}</motion.span>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
            style={{ fontSize: 'clamp(28px, 3.8vw, 44px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.4px', lineHeight: 1.12, marginBottom: 18, maxWidth: 760, marginInline: 'auto' }}>{t.h1}</motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.16 }}
            style={{ fontSize: 17, color: '#8899AA', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>{t.sub}</motion.p>
        </header>

        {/* POST GRID */}
        <main style={{ maxWidth: 1080, margin: '0 auto', padding: '64px max(5%, 24px) 80px' }}>
          <div className="bl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
            {posts.map((post) => (
              <motion.article key={post.slug}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }}
                className="bl-card" style={{ display: 'flex', flexDirection: 'column', padding: '28px 26px', borderRadius: 16, background: '#fff', border: '1px solid #E2E8F0' }}>
                <span style={{ alignSelf: 'flex-start', padding: '4px 12px', borderRadius: 100, background: 'rgba(201,168,76,0.12)', color: '#9a7d2e', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.03em', marginBottom: 16 }}>{post.category}</span>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: NAVY, letterSpacing: '-0.4px', lineHeight: 1.3, marginBottom: 12 }}>
                  <Link to={`${langPath(uiLang, 'blog')}/${post.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{post.title}</Link>
                </h2>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.65, marginBottom: 20, flexGrow: 1 }}>{post.excerpt}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: '#94A3B8', marginBottom: 16 }}>
                  <time dateTime={post.date}>{fmtDate(post.date)}</time>
                  <span>{post.readingTime}</span>
                </div>
                <Link to={`${langPath(uiLang, 'blog')}/${post.slug}`} style={{ fontSize: 14, fontWeight: 700, color: NAVY, textDecoration: 'none' }}>{t.read} →</Link>
              </motion.article>
            ))}
          </div>
        </main>

        {/* FOOTER */}
        <footer style={{ background: '#040D1C', padding: '40px max(5%, 24px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <OptimizedImage src="/emblem.png" alt="Safiron" width={36} height={36} loading="lazy" style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Safiron Global Solutions</span>
            </div>
            <nav style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Link to={langPath(uiLang)} style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{t.backHome}</Link>
              <Link to={langPath(uiLang, 'features')} style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{t.features}</Link>
              <Link to={langPath(uiLang, 'pricing')} style={{ fontSize: 13.5, color: '#94A3B8', textDecoration: 'none' }}>{t.pricing}</Link>
            </nav>
            <span style={{ fontSize: 12.5, color: '#475569' }}>© {new Date().getFullYear()} Safiron. {t.rights}</span>
          </div>
        </footer>
      </div>
    </>
  )
}
