# Google Search Console Setup

**Date:** 2026-05-30  
**Property:** https://safironpay.com

## Verification Method

HTML tag verification in `frontend/index.html`:

```html
<meta name="google-site-verification" content="[verification-code]" />
```

## Status

- [ ] Property created at https://search.google.com/search-console
- [ ] HTML verification tag added to index.html
- [ ] Property verified by Google (1-24 hours)
- [ ] Sitemaps submitted

## Sitemaps Submitted

- `/sitemap.xml` — Main sitemap
- `/sitemap-en.xml` — English sitemap (future)
- `/sitemap-tr.xml` — Turkish sitemap (future)
- `/sitemap-ar.xml` — Arabic sitemap (future)

## Key GSC Actions

### Crawl Issues
Monitor monthly for:
- 404 errors (broken links)
- 5xx server errors
- Redirect errors
- Blocked resources

### Search Performance
Track monthly:
- Impressions (how often Safiron appears in search)
- Clicks (CTR)
- Average position
- Countries (MENA focus)

### Index Coverage
Ensure:
- Public pages are indexed
- Protected pages (/dashboard, /admin) are not indexed
- No "Excluded" pages that should be indexed

## Next Steps

1. Create GSC property at https://search.google.com/search-console
2. Add verification meta tag
3. Wait for verification (Google will confirm via email)
4. Submit sitemaps
5. Set up monthly monitoring in Analytics
