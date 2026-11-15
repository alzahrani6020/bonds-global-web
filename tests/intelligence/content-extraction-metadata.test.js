'use strict';

const { extractContent, extractDocumentMetadata } = require('../../lib/intelligence/content-extraction');

describe('extractDocumentMetadata', () => {
  test('reads JSON-LD NewsArticle dates, author, and publisher', () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"NewsArticle",
       "headline":"GDP rises","datePublished":"2026-11-10T09:00:00Z",
       "author":{"@type":"Person","name":"Sara Ahmed"},
       "publisher":{"@type":"Organization","name":"Bonds Daily"}}
      </script>
    </head><body><p>content</p></body></html>`;
    const metadata = extractDocumentMetadata(html);
    expect(metadata.publishedAt).toBe('2026-11-10T09:00:00Z');
    expect(metadata.author).toBe('Sara Ahmed');
    expect(metadata.siteName).toBe('Bonds Daily');
  });

  test('walks @graph containers for datePublished', () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebSite","name":"Example"},
        {"@type":"Article","datePublished":"2026-05-01","author":[{"name":"Ali"}]}
      ]}
      </script>
    </head><body>x</body></html>`;
    const metadata = extractDocumentMetadata(html);
    expect(metadata.publishedAt).toBe('2026-05-01');
    expect(metadata.author).toBe('Ali');
  });

  test('falls back to OpenGraph and meta tags', () => {
    const html = `<html><head>
      <meta property="article:published_time" content="2026-08-15T12:00:00Z">
      <meta property="og:site_name" content="Market Wire">
      <meta name="author" content="Noura">
    </head><body>x</body></html>`;
    const metadata = extractDocumentMetadata(html);
    expect(metadata.publishedAt).toBe('2026-08-15T12:00:00Z');
    expect(metadata.siteName).toBe('Market Wire');
    expect(metadata.author).toBe('Noura');
  });

  test('returns null when nothing is found and never throws on malformed JSON-LD', () => {
    expect(extractDocumentMetadata('<html><body>plain</body></html>')).toBeNull();
    const html = `<html><head><script type="application/ld+json">{broken json</script></head><body>x</body></html>`;
    expect(extractDocumentMetadata(html)).toBeNull();
  });

  test('flows through extractContent for HTML pages', async () => {
    const html = `<html><head><title>T</title>
      <meta property="article:published_time" content="2026-01-01T00:00:00Z">
    </head><body><p>text</p></body></html>`;
    const extracted = await extractContent(html, 'text/html');
    expect(extracted.format).toBe('html');
    expect(extracted.metadata.publishedAt).toBe('2026-01-01T00:00:00Z');
    expect(extracted.text).toContain('text');
  });
});
