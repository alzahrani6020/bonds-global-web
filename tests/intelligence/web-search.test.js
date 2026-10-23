const { parseDuckDuckGoHtml } = require('../../lib/intelligence/web-search');

describe('BONDS governed web search', () => {
  test('parses bounded public search results and unwraps redirect targets', () => {
    const html = `
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fprofile">Example Profile</a>
        <div class="result__snippet">Verified public profile snippet.</div>
      </div>
      <div class="result">
        <a class="result__a" href="https://example.org/report">Example Report</a>
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
});
