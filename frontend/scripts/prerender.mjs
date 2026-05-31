/**
 * Build-time prerender.
 *
 * Runs after `vite build`. Serves the built `dist/` with SPA fallback, drives a
 * headless Chrome through every public route, waits for React + react-helmet to
 * settle, then writes the fully-rendered HTML to `dist/<route>/index.html`.
 *
 * This gives non-JS crawlers and social scrapers per-page content + meta tags
 * (title, description, canonical, hreflang, OG, JSON-LD) while nginx `try_files`
 * serves the matching static file for each URL.
 *
 * Chrome resolution order: $PUPPETEER_EXECUTABLE_PATH, common Alpine paths, then
 * a local macOS install. If no Chrome is found the script logs a warning and
 * exits 0 so a plain `npm run build` (or a machine without Chrome) never breaks.
 */
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

import { langPath } from '../src/utils/lang.js'
import { POSTS } from '../src/data/blogPosts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const PORT = 5055

// ── Build the list of routes to prerender ───────────────────────────────────
const LANGS = ['en', 'tr', 'ar']
const PAGES = ['', 'features', 'pricing', 'about', 'contact', 'blog']

const routes = new Set()
for (const lang of LANGS) {
  for (const page of PAGES) routes.add(langPath(lang, page))
  for (const post of POSTS) routes.add(`${langPath(lang, 'blog')}/${post.slug}`)
}
const ROUTES = [...routes]

// ── Chrome executable resolution ─────────────────────────────────────────────
function resolveChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean)
  return candidates.find((p) => existsSync(p))
}

// ── Minimal static server with SPA fallback ──────────────────────────────────
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml',
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
      let filePath = join(DIST, urlPath)
      let isFile = false
      try { isFile = (await stat(filePath)).isFile() } catch { /* not a file */ }
      if (!isFile) filePath = join(DIST, 'index.html') // SPA fallback
      const body = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(500); res.end('error')
    }
  })
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)))
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const executablePath = resolveChrome()
  if (!executablePath) {
    console.warn('[prerender] No Chrome executable found — skipping prerender (SPA build is intact).')
    process.exit(0)
  }
  console.log(`[prerender] Using Chrome: ${executablePath}`)
  console.log(`[prerender] ${ROUTES.length} routes`)

  const server = await startServer()
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  let ok = 0
  try {
    for (const route of ROUTES) {
      const page = await browser.newPage()
      try {
        await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle0', timeout: 30000 })
        // Give react-helmet-async a tick to flush head mutations
        await page.evaluate(() => new Promise((r) => setTimeout(r, 150)))

        // The static index.html template ships hardcoded <title>/description/og/
        // canonical tags. react-helmet-async re-adds its own per-page versions
        // (marked data-rh="true") instead of replacing the static ones, so the
        // rendered head ends up with duplicate canonical/og/description tags.
        // Drop each static duplicate whenever a data-rh tag of the same key exists.
        await page.evaluate(() => {
          const keyOf = (el) => {
            if (el.tagName === 'LINK') return `link:${el.getAttribute('rel') || ''}:${el.getAttribute('hreflang') || ''}`
            if (el.tagName === 'META') return `meta:${el.getAttribute('name') || el.getAttribute('property') || el.getAttribute('http-equiv') || ''}`
            return null
          }
          const groups = new Map()
          for (const el of document.head.children) {
            const k = keyOf(el)
            if (!k) continue
            if (!groups.has(k)) groups.set(k, [])
            groups.get(k).push(el)
          }
          for (const els of groups.values()) {
            if (els.length < 2 || !els.some((e) => e.hasAttribute('data-rh'))) continue
            els.filter((e) => !e.hasAttribute('data-rh')).forEach((e) => e.remove())
          }
        })

        const html = '<!DOCTYPE html>\n' + (await page.evaluate(() => document.documentElement.outerHTML))

        // /          → dist/index.html
        // /tr        → dist/tr/index.html
        // /blog/slug → dist/blog/slug/index.html
        const rel = route === '/' ? 'index.html' : `${route.replace(/^\//, '')}/index.html`
        const outPath = join(DIST, rel)
        await mkdir(dirname(outPath), { recursive: true })
        await writeFile(outPath, html)
        ok++
      } catch (err) {
        console.error(`[prerender] FAILED ${route}: ${err.message}`)
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
    server.close()
  }

  console.log(`[prerender] Done: ${ok}/${ROUTES.length} routes written.`)
  if (ok < ROUTES.length) process.exit(1)
}

main().catch((err) => { console.error('[prerender]', err); process.exit(1) })
