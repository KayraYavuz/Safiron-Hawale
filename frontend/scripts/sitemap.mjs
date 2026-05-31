/**
 * Build-time sitemap generator.
 *
 * Generates `dist/sitemap.xml` from the same source of truth the prerender and
 * the app router use — `langPath()` + the `POSTS` list — so the sitemap can
 * never drift from the routes that actually exist. Adding a blog post or a page
 * here updates the sitemap automatically on the next build.
 *
 * Each URL carries hreflang alternates for every language (en / tr / ar) plus
 * x-default → English, matching the per-page <link rel="alternate"> tags that
 * react-helmet emits. Blog posts use their own `date` as <lastmod>; the static
 * marketing pages use a single explicit SITE_LASTMOD so their lastmod doesn't
 * churn on every build (which would make the signal untrustworthy to crawlers).
 *
 * Runs as part of `npm run build` (before prerender). Has no Chrome dependency,
 * so it always produces a sitemap even on machines where prerender is skipped.
 */
import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { LANGS, langPath } from '../src/utils/lang.js'
import { POSTS } from '../src/data/blogPosts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')

const ORIGIN = 'https://safironpay.com'

// Last-modified date for the static marketing pages. Bump intentionally when
// their content meaningfully changes — not automatically, so crawlers keep
// trusting the signal. Blog posts override this with their own publish date.
const SITE_LASTMOD = '2026-05-31'

// Per-page crawl hints. `base` is the slug passed to langPath('', base).
const PAGES = [
  { base: '', priority: '1.0', changefreq: 'weekly' },
  { base: 'features', priority: '0.8', changefreq: 'monthly' },
  { base: 'pricing', priority: '0.8', changefreq: 'monthly' },
  { base: 'about', priority: '0.7', changefreq: 'monthly' },
  { base: 'contact', priority: '0.7', changefreq: 'monthly' },
  { base: 'blog', priority: '0.9', changefreq: 'weekly' },
]
const POST_HINTS = { priority: '0.7', changefreq: 'monthly' }

const abs = (path) => `${ORIGIN}${path === '/' ? '' : path}`

/** hreflang alternates block shared by every URL of a given logical page. */
function alternates(base) {
  const links = LANGS.map(
    (lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${abs(langPath(lang, base))}" />`,
  )
  links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(langPath('en', base))}" />`)
  return links.join('\n')
}

function urlEntry(lang, base, { priority, changefreq, lastmod }) {
  return [
    '  <url>',
    `    <loc>${abs(langPath(lang, base))}</loc>`,
    alternates(base),
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n')
}

function build() {
  const entries = []

  // Static pages × languages
  for (const page of PAGES) {
    for (const lang of LANGS) {
      entries.push(urlEntry(lang, page.base, { ...page, lastmod: SITE_LASTMOD }))
    }
  }

  // Blog posts × languages (lastmod = post's own date)
  for (const post of POSTS) {
    const base = `blog/${post.slug}`
    for (const lang of LANGS) {
      entries.push(urlEntry(lang, base, { ...POST_HINTS, lastmod: post.date }))
    }
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    entries.join('\n') +
    '\n</urlset>\n'
  )
}

async function main() {
  const xml = build()
  const outPath = join(DIST, 'sitemap.xml')
  await writeFile(outPath, xml)
  const count = (xml.match(/<url>/g) || []).length
  console.log(`[sitemap] Wrote ${count} URLs → ${outPath}`)
}

main().catch((err) => {
  console.error('[sitemap]', err)
  process.exit(1)
})
