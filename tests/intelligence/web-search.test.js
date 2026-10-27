const {
  parseDuckDuckGoHtml,
  parseBraveHtml,
  decodeBingRedirectUrl,
  parseBingHtml,
  parseBingRss
} = require('../../lib/intelligence/web-search');

describe('BONDS governed web search', () => {
  test('parses bounded public search results and unwraps redirect targets', () => {
    const html = `
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fprofile">Example Profile</a>
        <div class="result__snippet">Verified public profile snippet.</div>
      </div>
      <div class="result">
        <a href="https://example.org/report" class="result__a">Example Report</a>
        <div class="result__snippet">Public report.</div>
      </div>
    `;
    const results = parseDuckDuckGoHtml(html, 5);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({
      title: 'Example Profile',
      url: 'https://example.com/profile',
      snippet: 'Verified public profile snippet.'
    }));
    expect(results[1].url).toBe('https://example.org/report');
  });

  test('parses Brave public search result links while excluding Brave internal links', () => {
    const html = `
      <main>
        <a href="https://search.brave.com/settings">Settings</a>
        <a href="https://www.spa.gov.sa/1319666">عام / السيرة الذاتية لصاحب السمو الملكي الأمير محمد بن سلمان</a>
        <p>سيرة ذاتية رسمية.</p>
        <a href="https://www.britannica.com/biography/Mohammed-bin-Salman">Mohammed bin Salman | Biography</a>
        <p>Biography result.</p>
      </main>
    `;
    const results = parseBraveHtml(html, 5);
    expect(results).toEqual([
      expect.objectContaining({
        title: 'عام / السيرة الذاتية لصاحب السمو الملكي الأمير محمد بن سلمان',
        url: 'https://www.spa.gov.sa/1319666'
      }),
      expect.objectContaining({
        title: 'Mohammed bin Salman | Biography',
        url: 'https://www.britannica.com/biography/Mohammed-bin-Salman'
      })
    ]);
  });

  test('decodes Bing ck/a base64url redirects to the external destination', () => {
    const target = 'https://en.wikipedia.org/wiki/Amr_Moussa';
    const encoded = Buffer.from(target, 'utf8').toString('base64url');
    const redirect = 'https://www.bing.com/ck/a?u=a1' + encoded + '&ntb=1';
    expect(decodeBingRedirectUrl(redirect)).toBe(target);
  });

  test('parses Bing public search result links while excluding Bing navigation', () => {
    const wikiTarget = 'https://en.wikipedia.org/wiki/Amr_Moussa';
    const wikiRedirect = 'https://www.bing.com/ck/a?u=a1' + Buffer.from(wikiTarget, 'utf8').toString('base64url') + '&ntb=1';
    const html = `
      <main>
        <a href="https://www.bing.com/search?q=settings">Search</a>
        <li class="b_algo">
          <h2><a href="https://www.spa.gov.sa/1319666">محمد بن سلمان - وكالة الأنباء السعودية</a></h2>
          <div class="b_caption"><p>نتيجة عامة موثوقة.</p></div>
        </li>
        <li class="b_algo">
          <h2><a href="${wikiRedirect}">Amr Moussa - Wikipedia</a></h2>
          <div class="b_caption"><p>Biography result.</p></div>
        </li>
      </main>
    `;
    const results = parseBingHtml(html, 5);
    expect(results).toEqual([
      expect.objectContaining({
        title: 'محمد بن سلمان - وكالة الأنباء السعودية',
        url: 'https://www.spa.gov.sa/1319666'
      }),
      expect.objectContaining({
        title: 'Amr Moussa - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Amr_Moussa'
      })
    ]);
  });

  test('accepts DuckDuckGo lite result-link markup and redirect URLs', () => {
    const html = `
      <table>
        <tr>
          <td>
            <a href="/l/?uddg=https%3A%2F%2Fbonds-global.com%2Fdr-talal-alzahrani" class="result-link">
              الدكتور طلال حسن الزهراني | بوندز
            </a>
          </td>
        </tr>
      </table>
    `;
    expect(parseDuckDuckGoHtml(html, 5)).toEqual([
      expect.objectContaining({
        title: 'الدكتور طلال حسن الزهراني | بوندز',
        url: 'https://bonds-global.com/dr-talal-alzahrani'
      })
    ]);
  });

  test('rejects Bing/Microsoft-owned RSS items before exposing search results', () => {
    const rss = `
      <rss><channel>
        <item>
          <title>Microsoft - Official Home Page</title>
          <link>https://www.microsoft.com/en-us/</link>
          <description>Microsoft products and services.</description>
        </item>
        <item>
          <title>External biography</title>
          <link>https://example.org/profile</link>
          <description>Public profile.</description>
        </item>
      </channel></rss>
    `;

    expect(parseBingRss(rss, 5)).toEqual([
      expect.objectContaining({
        title:'External biography',
        url:'https://example.org/profile'
      })
    ]);
  });

  test('parses Bing RSS search results as a stable no-key fallback', () => {
    const rss = `
      <rss>
        <channel>
          <item>
            <title><![CDATA[Amr Moussa - Example]]></title>
            <link>https://example.org/amr-moussa</link>
            <description><![CDATA[Public biography result.]]></description>
          </item>
        </channel>
      </rss>
    `;

    expect(parseBingRss(rss, 5)).toEqual([
      expect.objectContaining({
        title: 'Amr Moussa - Example',
        url: 'https://example.org/amr-moussa',
        snippet: 'Public biography result.'
      })
    ]);
  });

});
