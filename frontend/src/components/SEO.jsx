import { Helmet } from 'react-helmet-async'

/**
 * Reusable SEO Component
 * Wraps react-helmet-async to manage HTML head metadata
 * Supports multi-language with hreflang alternates
 *
 * @param {Object} props
 * @param {string} props.title - Page title (required)
 * @param {string} props.description - Meta description
 * @param {string} props.keywords - Meta keywords (comma-separated)
 * @param {string} props.ogTitle - Open Graph title
 * @param {string} props.ogDescription - Open Graph description
 * @param {string} props.ogImage - Open Graph image URL
 * @param {string} props.canonicalUrl - Canonical URL for the page
 * @param {string} props.ogUrl - Open Graph URL
 * @param {string} props.lang - Language code (default: 'en')
 * @param {string} props.author - Author meta tag (optional)
 * @returns {JSX.Element}
 */
export default function SEO({
  title,
  description = '',
  keywords = '',
  ogTitle = '',
  ogDescription = '',
  ogImage = '',
  canonicalUrl = '',
  ogUrl = '',
  lang = 'en',
  author = 'Safiron Global Solutions',
}) {
  // Generate language alternates with hreflang
  // Supported languages: en, tr, ar
  const generateHreflangs = (baseUrl) => {
    if (!baseUrl) return []

    const languages = ['en', 'tr', 'ar']
    return languages.map((langCode) => {
      let url = baseUrl
      // Replace language prefix in URL
      // Pattern: /lang/ at the beginning of path (after domain)
      const pathMatch = baseUrl.match(/^(https?:\/\/[^/]+)(.*)$/)
      if (pathMatch) {
        const domain = pathMatch[1]
        let path = pathMatch[2]

        // Remove existing language prefix if present
        path = path.replace(/^\/(en|tr|ar)(\/|$)/, '/')

        // Add language prefix for non-English
        if (langCode !== 'en') {
          path = `/${langCode}${path}`
        }

        url = `${domain}${path}`
      }

      return {
        rel: 'alternate',
        hrefLang: langCode,
        href: url,
      }
    })
  }

  const hreflangs = generateHreflangs(canonicalUrl)

  return (
    <Helmet>
      {/* HTML lang attribute */}
      <html lang={lang} />

      {/* Primary Meta Tags */}
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {author && <meta name="author" content={author} />}
      <meta name="robots" content="index, follow" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta charSet="utf-8" />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      {ogTitle && <meta property="og:title" content={ogTitle} />}
      {ogDescription && (
        <meta property="og:description" content={ogDescription} />
      )}
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogUrl && <meta property="og:url" content={ogUrl} />}
      <meta property="og:locale" content={getLangLocale(lang)} />

      {/* Alternate language locales for Open Graph */}
      {['en', 'tr', 'ar'].map((altLang) => {
        if (altLang !== lang) {
          return (
            <meta
              key={`og-locale-alt-${altLang}`}
              property="og:locale:alternate"
              content={getLangLocale(altLang)}
            />
          )
        }
        return null
      })}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      {ogTitle && <meta name="twitter:title" content={ogTitle} />}
      {ogDescription && (
        <meta name="twitter:description" content={ogDescription} />
      )}
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* hreflang Alternates for Multi-language Support */}
      {hreflangs.map((alternate) => (
        <link
          key={`hreflang-${alternate.hrefLang}`}
          rel={alternate.rel}
          hrefLang={alternate.hrefLang}
          href={alternate.href}
        />
      ))}

      {/* x-default hreflang for pages without specific language */}
      {canonicalUrl && (
        <link
          rel="alternate"
          hrefLang="x-default"
          href={getDefaultUrl(canonicalUrl)}
        />
      )}
    </Helmet>
  )
}

/**
 * Map language code to Open Graph locale
 * @param {string} lang - Language code
 * @returns {string} Open Graph locale format
 */
function getLangLocale(lang) {
  const localeMap = {
    en: 'en_US',
    tr: 'tr_TR',
    ar: 'ar_AE',
  }
  return localeMap[lang] || 'en_US'
}

/**
 * Get the default (English) version of a URL
 * @param {string} url - The current URL
 * @returns {string} URL in English version
 */
function getDefaultUrl(url) {
  // Remove language prefix if present, default to English version
  return url.replace(/\/(en|tr|ar)(\/|$)/, '/')
}
