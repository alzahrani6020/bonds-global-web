/** @jest-environment node */

jest.mock('../../lib/intelligence/web-acquisition', () => ({
  fetchUrl: jest.fn()
}));

const { fetchUrl } = require('../../lib/intelligence/web-acquisition');
const {
  DEFAULT_BONDS_SEARX_UPSTREAM,
  parseSearxJson,
  searchSearx
} = require('../../lib/intelligence/searx-search');

describe('BONDS SearXNG search capability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BONDS_SEARX_UPSTREAM;
    delete process.env.BONDS_SEARX_ENGINES;
    delete process.env.BONDS_SEARX_OFF;
  });

  test('parses bounded normalized SearX JSON results', () => {
    const parsed = parseSearxJson(JSON.stringify({
      results:[
        {
          title:'Saudi Aramco leadership',
          url:'https://www.aramco.com/en/who-we-are/our-leadership',
          content:'Official leadership information.',
          engine:'google',
          engines:['google','bing'],
          score:4.2,
          category:'general'
        },
        {
          title:'Duplicate',
          url:'https://www.aramco.com/en/who-we-are/our-leadership',
          content:'Duplicate URL.'
        }
      ]
    }), 5);

    expect(parsed.ok).toBe(true);
    expect(parsed.code).toBe('SEARX_RESULTS_FOUND');
    expect(parsed.results).toEqual([
      expect.objectContaining({
        title:'Saudi Aramco leadership',
        url:'https://www.aramco.com/en/who-we-are/our-leadership',
        snippet:'Official leadership information.',
        source:'searxng',
        engine:'google',
        engines:['google','bing']
      })
    ]);
  });

  test('queries SearX JSON endpoint with independent BONDS settings', async () => {
    process.env.BONDS_SEARX_UPSTREAM = 'https://search.example.com';
    process.env.BONDS_SEARX_ENGINES = 'google,bing';

    fetchUrl.mockResolvedValue({
      ok:true,
      text:JSON.stringify({
        results:[
          {
            title:'Aramco leadership',
            url:'https://www.aramco.com/en/who-we-are/our-leadership',
            content:'Leadership page'
          }
        ]
      }),
      evidence:{
        status_code:200,
        final_url:'https://search.example.com/search',
        content_type:'application/json'
      }
    });

    const result = await searchSearx('رئيس شركة أرامكو', {
      language:'ar',
      limit:5
    });

    expect(result.ok).toBe(true);
    expect(result.result.result_count).toBe(1);

    const requested = new URL(fetchUrl.mock.calls[0][0]);
    expect(requested.origin).toBe('https://search.example.com');
    expect(requested.pathname).toBe('/search');
    expect(requested.searchParams.get('q')).toBe('رئيس شركة أرامكو');
    expect(requested.searchParams.get('format')).toBe('json');
    expect(requested.searchParams.get('language')).toBe('ar');
    expect(requested.searchParams.get('engines')).toBe('google,bing');

    expect(fetchUrl.mock.calls[0][1].userAgent).toBe('BONDS-SearX-Search/1.0');
  });

  test('fails closed when SearX is disabled', async () => {
    process.env.BONDS_SEARX_OFF = '1';
    const result = await searchSearx('test');
    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.error.code).toBe('SEARX_DISABLED');
    expect(fetchUrl).not.toHaveBeenCalled();
  });

  test('ships with a public default that can be replaced by BONDS_SEARX_UPSTREAM', () => {
    expect(DEFAULT_BONDS_SEARX_UPSTREAM).toBe('https://searx.tiekoetter.com');
  });
});
