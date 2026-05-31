import { Link, useNavigate, useParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { OptimizedImage } from '../components/OptimizedImage'
import SEO from '../components/SEO'
import StructuredData from '../components/StructuredData'
import { normalizeLang, langPath } from '../utils/lang'
import { getPost, getRelatedPosts, SITE } from '../data/blogPosts'

const NAV_H = 68
const GOLD = '#C9A84C'
const NAVY = '#0D1F3C'

const UI = {
  tr: { dir: 'ltr', home: 'Ana Sayfa', blog: 'Blog', backToBlog: '← Tüm Yazılar', related: 'İlgili Yazılar', ctaH2: 'Operasyonunuzu Safiron ile dijitalleştirin', ctaP: 'Demo talep edin veya özellikleri inceleyin.', ctaBtn: 'Demo Talep Et', features: 'Özellikler', loginBtn: 'Giriş Yap', rights: 'Tüm hakları saklıdır.' },
  ar: { dir: 'rtl', home: 'الرئيسية', blog: 'المدونة', backToBlog: '← جميع المقالات', related: 'مقالات ذات صلة', ctaH2: 'رقمن عملياتك مع Safiron', ctaP: 'اطلب عرضاً تجريبياً أو استعرض المميزات.', ctaBtn: 'اطلب عرضاً تجريبياً', features: 'المميزات', loginBtn: 'تسجيل الدخول', rights: 'جميع الحقوق محفوظة.' },
  en: { dir: 'ltr', home: 'Home', blog: 'Blog', backToBlog: '← All Articles', related: 'Related Articles', ctaH2: 'Digitise your operations with Safiron', ctaP: 'Request a demo or explore the features.', ctaBtn: 'Request a Demo', features: 'Features', loginBtn: 'Sign In', rights: 'All rights reserved.' },
}

const LOCALE = { tr: 'tr-TR', ar: 'ar-AE', en: 'en-US' }

function Block({ block, isRTL }) {
  if (block.t === 'h2') return <h2 style={{ fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 800, color: NAVY, letterSpacing: '-0.5px', margin: '36px 0 14px' }}>{block.x}</h2>
  if (block.t === 'h3') return <h3 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: '26px 0 10px' }}>{block.x}</h3>
  if (block.t === 'ul') return (
    <ul style={{ margin: '0 0 18px', paddingInlineStart: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {block.x.map((li, i) => <li key={i} style={{ fontSize: 16.5, color: '#334155', lineHeight: 1.7 }}>{li}</li>)}
    </ul>
  )
  return <p style={{ fontSize: 16.5, color: '#334155', lineHeight: 1.8, margin: '0 0 18px' }}>{block.x}</p>
}

export default function BlogPost({ lang }) {
  const uiLang = normalizeLang(lang)
  const t = UI[uiLang]
  const isRTL = t.dir === 'rtl'
  const navigate = useNavigate()
  const { slug } = useParams()
  const post = getPost(slug, uiLang)

  // Unknown slug → send the visitor to the blog hub in their language
  if (!post) return <Navigate to={langPath(uiLang, 'blog')} replace />

  const url = `${SITE}${langPath(uiLang, 'blog')}/${slug}`
  const related = getRelatedPosts(slug, uiLang, 2)
  const fmtDate = (d) => new Date(d).toLocaleDateString(LOCALE[uiLang], { year: 'numeric', month: 'long', day: 'numeric' })

  const seoData = {
    title: `${post.title} — Safiron Global Solutions`,
    description: post.description,
    keywords: post.keywords,
    ogTitle: post.title,
    ogDescription: post.description,
    ogImage: post.image,
    ogUrl: url,
    canonicalUrl: url,
    lang: uiLang,
  }

  const blogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': post.title,
    'description': post.description,
    'datePublished': post.date,
    'dateModified': post.date,
    'image': post.image,
    'inLanguage': uiLang,
    'author': { '@type': 'Organization', 'name': 'Safiron Global Solutions' },
    'publisher': {
      '@type': 'Organization',
      'name': 'Safiron Global Solutions',
      'logo': { '@type': 'ImageObject', 'url': `${SITE}/logo.png` },
    },
    'mainEntityOfPage': { '@type': 'WebPage', '@id': url },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': t.home, 'item': `${SITE}${langPath(uiLang)}` },
      { '@type': 'ListItem', 'position': 2, 'name': t.blog, 'item': `${SITE}${langPath(uiLang, 'blog')}` },
      { '@type': 'ListItem', 'position': 3, 'name': post.title, 'item': url },
    ],
  }

  return (
    <>
      <SEO {...seoData} />
      <StructuredData schema={blogPostingSchema} />
      <StructuredData schema={breadcrumbSchema} />
      <div dir={t.dir} style={{
        fontFamily: isRTL ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'DM Sans', -apple-system, 'Segoe UI', sans-serif",
        color: '#0F172A', background: '#fff', minHeight: '100vh',
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..900;1,9..40,300..900&display=swap');
          .bp-link { color: #64748B; text-decoration: none; transition: color 0.15s; font-weight: 500; }
          .bp-link:hover { color: ${NAVY}; }
          .bp-crumb a { color: #64748B; text-decoration: none; }
          .bp-crumb a:hover { color: ${NAVY}; }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13.5 }}>
            <Link to={langPath(uiLang, 'blog')} className="bp-link">{t.blog}</Link>
            <Link to={langPath(uiLang, 'features')} className="bp-link">{t.features}</Link>
            <button onClick={() => navigate('/login')} style={{
              padding: '9px 20px', borderRadius: 9, background: NAVY, color: '#fff',
              fontWeight: 600, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>{t.loginBtn}</button>
          </div>
        </nav>

        {/* ARTICLE */}
        <article style={{ maxWidth: 760, margin: '0 auto', padding: '48px max(6%, 24px) 72px' }}>
          {/* Breadcrumb */}
          <nav className="bp-crumb" aria-label="Breadcrumb" style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>
            <Link to={langPath(uiLang)}>{t.home}</Link>
            <span style={{ margin: '0 8px' }}>/</span>
            <Link to={langPath(uiLang, 'blog')}>{t.blog}</Link>
          </nav>

          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 100, background: 'rgba(201,168,76,0.12)', color: '#9a7d2e', fontSize: 11.5, fontWeight: 700, marginBottom: 18 }}>{post.category}</span>

          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: NAVY, letterSpacing: '-1.2px', lineHeight: 1.15, marginBottom: 18 }}>
            {post.title}
          </motion.h1>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13.5, color: '#94A3B8', marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid #E2E8F0' }}>
            <time dateTime={post.date}>{fmtDate(post.date)}</time>
            <span>·</span>
            <span>{post.readingTime}</span>
          </div>

          <div>
            {post.body.map((block, i) => <Block key={i} block={block} isRTL={isRTL} />)}
          </div>

          <div style={{ marginTop: 48, paddingTop: 28, borderTop: '1px solid #E2E8F0' }}>
            <Link to={langPath(uiLang, 'blog')} style={{ fontSize: 14.5, fontWeight: 700, color: NAVY, textDecoration: 'none' }}>{t.backToBlog}</Link>
          </div>

          {/* Related posts — internal linking */}
          {related.length > 0 && (
            <section style={{ marginTop: 48 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: NAVY, letterSpacing: '-0.4px', marginBottom: 18 }}>{t.related}</h2>
              <div style={{ display: 'grid', gap: 14 }}>
                {related.map((r) => (
                  <Link key={r.slug} to={`${langPath(uiLang, 'blog')}/${r.slug}`}
                    style={{ display: 'block', padding: '18px 20px', borderRadius: 12, border: '1px solid #E2E8F0', textDecoration: 'none', background: '#F8FAFC' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#9a7d2e' }}>{r.category}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, margin: '6px 0 4px', lineHeight: 1.35 }}>{r.title}</h3>
                    <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6, margin: 0 }}>{r.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>

        {/* CTA */}
        <section style={{ background: 'linear-gradient(155deg, #050C1A 0%, #0B1C37 100%)', padding: '64px max(5%, 24px)', textAlign: 'center' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.6px', marginBottom: 14 }}>{t.ctaH2}</h2>
            <p style={{ fontSize: 16, color: '#8899AA', lineHeight: 1.7, marginBottom: 28 }}>{t.ctaP}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to={langPath(uiLang, 'contact')} style={{ padding: '13px 30px', borderRadius: 10, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #C9A84C, #E8C56B)', color: NAVY, textDecoration: 'none' }}>{t.ctaBtn}</Link>
              <Link to={langPath(uiLang, 'features')} style={{ padding: '13px 30px', borderRadius: 10, fontSize: 15, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none' }}>{t.features}</Link>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: '#040D1C', padding: '40px max(5%, 24px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <OptimizedImage src="/emblem.png" alt="Safiron" width={36} height={36} loading="lazy" style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Safiron Global Solutions</span>
            </div>
            <span style={{ fontSize: 12.5, color: '#475569' }}>© {new Date().getFullYear()} Safiron. {t.rights}</span>
          </div>
        </footer>
      </div>
    </>
  )
}
