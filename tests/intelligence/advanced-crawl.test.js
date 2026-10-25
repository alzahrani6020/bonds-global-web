/** @jest-environment node */

const {
  canonicalizeUrl,
  extractPaginationLinks,
  extractSitemapUrls,
  extractRobotsSitemaps,
  normalizeCheckpoint
} = require('../../lib/intelligence/web-acquisition');

describe('advanced governed crawl primitives', () => {
  test('canonicalizes URLs by resolving relatives and removing fragments', () => {
    expect(canonicalizeUrl('/news?page=2#section', 'https://example.com/start'))
      .toBe('https://example.com/news?page=2');
    expect(canonicalizeUrl('file:///etc/passwd')).toBeNull();
  });

  test('extracts sitemap URLs and resolves relative locations', () => {
    const xml = `
      <urlset>
        <url><loc>https://example.com/a</loc></url>
        <url><loc><![CDATA[/b?x=1&amp;y=2]]></loc></url>
      </urlset>
    `;
    expect(extractSitemapUrls(xml, 'https://example.com/sitemap.xml')).toEqual([
      'https://example.com/a',
      'https://example.com/b?x=1&y=2'
    ]);
  });

  test('extracts sitemap declarations from robots.txt without duplicates', () => {
    const robots = `
      User-agent: *
      Disallow: /private
      Sitemap: https://example.com/sitemap.xml
      Sitemap: https://example.com/sitemap.xml
      Sitemap: /news-sitemap.xml
    `;
    expect(extractRobotsSitemaps(robots, 'https://example.com')).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/news-sitemap.xml'
    ]);
  });

  test('discovers explicit rel=next and visible next-page links', () => {
    const html = `
      <link rel="next" href="/page/2">
      <a href="/page/3">التالي</a>
      <a href="/about">About</a>
    `;
    expect(extractPaginationLinks(html, 'https://example.com/page/1')).toEqual(
      expect.arrayContaining([
        'https://example.com/page/2',
        'https://example.com/page/3'
      ])
    );
  });

  test('normalizes resume checkpoints and removes URL fragments', () => {
    expect(normalizeCheckpoint({
      visited:['https://example.com/a#x'],
      pending:[
        {url:'https://example.com/b#y',depth:2,priority:7,source:'pagination'},
        'https://example.com/c#z'
      ]
    })).toEqual({
      visited:['https://example.com/a'],
      pending:[
        {url:'https://example.com/b',depth:2,priority:7,source:'pagination'},
        {url:'https://example.com/c',depth:0,priority:0,source:'checkpoint'}
      ]
    });
  });
});
