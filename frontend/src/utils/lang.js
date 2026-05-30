/**
 * Language routing helpers for SEO-friendly multi-language URLs.
 *
 * URL scheme (decided): English lives at the bare root (x-default),
 * Turkish under /tr, Arabic under /ar.
 *   /            → en   (e.g. /features, /pricing)
 *   /tr, /tr/... → tr
 *   /ar, /ar/... → ar
 */

export const LANGS = ['en', 'tr', 'ar']

/** Coerce an arbitrary value to a supported language, defaulting to English. */
export function normalizeLang(lang) {
  return LANGS.includes(lang) ? lang : 'en'
}

/**
 * Build the route path for a language + page.
 * @param {string} lang - 'en' | 'tr' | 'ar'
 * @param {string} base - page slug without leading slash ('' for landing)
 * @returns {string} e.g. langPath('tr', 'features') → '/tr/features'
 *                        langPath('en', 'features') → '/features'
 *                        langPath('ar', '')         → '/ar'
 *                        langPath('en', '')         → '/'
 */
export function langPath(lang, base = '') {
  const prefix = lang === 'en' ? '' : `/${lang}`
  if (base) return `${prefix}/${base}`
  return prefix || '/'
}
