const { parseDuckDuckGoHtml } = require('../../lib/intelligence/web-search');

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
});
