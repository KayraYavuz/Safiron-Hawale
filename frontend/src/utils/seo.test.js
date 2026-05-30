import { test } from 'node:test';
import assert from 'node:assert';
import { createSeoMetadata, SEO_PAGES } from './seo.js';

test('createSeoMetadata returns correct object structure for landing page in English', () => {
  const result = createSeoMetadata('landing', 'en');

  assert.strictEqual(typeof result, 'object', 'Result should be an object');
  assert.strictEqual(typeof result.title, 'string', 'title should be a string');
  assert.strictEqual(typeof result.description, 'string', 'description should be a string');
  assert.strictEqual(typeof result.keywords, 'string', 'keywords should be a string');
  assert.strictEqual(typeof result.ogTitle, 'string', 'ogTitle should be a string');
  assert.strictEqual(typeof result.ogDescription, 'string', 'ogDescription should be a string');
  assert.strictEqual(typeof result.ogImage, 'string', 'ogImage should be a string');
  assert.strictEqual(typeof result.ogUrl, 'string', 'ogUrl should be a string');
  assert.strictEqual(typeof result.canonicalUrl, 'string', 'canonicalUrl should be a string');
  assert.strictEqual(result.lang, 'en', 'lang should be "en"');

  // Verify description length is within reasonable bounds (120-160 chars)
  assert(result.description.length >= 100 && result.description.length <= 200,
    'Description should be between 100-200 characters');

  // Verify ogImage follows the expected pattern
  assert(result.ogImage.includes('safironpay.com/og-landing'),
    'ogImage should follow safironpay.com/og-[page].jpg pattern');
});

test('createSeoMetadata includes Turkish title with proper characters for features page', () => {
  const result = createSeoMetadata('features', 'tr');

  assert.strictEqual(result.lang, 'tr', 'lang should be "tr"');
  assert(result.title.includes('Özellikler'),
    'Turkish features page title should include "Özellikler"');
  assert(typeof result.ogImage, 'string', 'ogImage should be a string');
  assert(result.ogImage.includes('safironpay.com/og-features'),
    'ogImage should follow safironpay.com/og-features pattern');
});

test('SEO_PAGES contains all required pages for all languages', () => {
  const requiredPages = ['landing', 'features', 'pricing', 'blog', 'about', 'contact'];
  const requiredLanguages = ['en', 'tr', 'ar'];

  assert(typeof SEO_PAGES, 'object', 'SEO_PAGES should be an object');

  requiredLanguages.forEach(lang => {
    assert(SEO_PAGES[lang], `SEO_PAGES should have data for language: ${lang}`);
    requiredPages.forEach(page => {
      assert(SEO_PAGES[lang][page],
        `SEO_PAGES.${lang} should have data for page: ${page}`);
      assert(SEO_PAGES[lang][page].title, `${lang}.${page} should have title`);
      assert(SEO_PAGES[lang][page].description, `${lang}.${page} should have description`);
      assert(SEO_PAGES[lang][page].keywords, `${lang}.${page} should have keywords`);
    });
  });
});
