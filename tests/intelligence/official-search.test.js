/** @jest-environment node */

jest.mock('../../lib/intelligence/web-acquisition', () => ({
  fetchUrl: jest.fn()
}));

const { fetchUrl } = require('../../lib/intelligence/web-acquisition');
const {
  configuredOfficialSearchProviders,
  officialSearchConfigured,
  parseBraveApi,
  parseBingApi,
  parseGoogleCse,
  searchOfficialWeb
} = require('../../lib/intelligence/official-search');

describe('official search APIs', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    jest.clearAllMocks();
  });

  test('reports which official providers are configured without exposing keys', () => {
    delete process.env.BONDS_BRAVE_SEARCH_API_KEY;
    delete process.env.BONDS_BING_SEARCH_API_KEY;
    delete process.env.GOOGLE_CSE_KEY;
    delete process.env.GOOGLE_CSE_CX;
    expect(officialSearchConfigured()).toBe(false);
    expect(configuredOfficialSearchProviders()).toEqual({
      brave: false,
      bing: false,
      google_cse: false
    });

    process.env.BONDS_BRAVE_SEARCH_API_KEY = 'secret-brave';
    process.env.GOOGLE_CSE_KEY = 'secret-google';
    process.env.GOOGLE_CSE_CX = 'cx-1';
    const configured = configuredOfficialSearchProviders();
    expect(configured).toEqual({ brave: true, bing: false, google_cse: true });
    expect(JSON.stringify(configured)).not.toMatch(/secret/);
  });

  test('parses Brave, Bing, and Google CSE payloads', () => {
    expect(parseBraveApi({
      web: { results: [{ title: 'A', url: 'https://a.example', description: 'da' }] }
    }, 5)).toEqual([
      { title: 'A', url: 'https://a.example', snippet: 'da', source: 'brave-api' }
    ]);
    expect(parseBingApi({
      webPages: { value: [{ name: 'B', url: 'https://b.example', snippet: 'db' }] }
    }, 5)).toEqual([
      { title: 'B', url: 'https://b.example', snippet: 'db', source: 'bing-api' }
    ]);
    expect(parseGoogleCse({
      items: [{ title: 'C', link: 'https://c.example', snippet: 'dc' }]
    }, 5)).toEqual([
      { title: 'C', url: 'https://c.example', snippet: 'dc', source: 'google-cse' }
    ]);
  });

  test('does not call the network when no official key is configured', async () => {
    delete process.env.BONDS_BRAVE_SEARCH_API_KEY;
    delete process.env.BONDS_BING_SEARCH_API_KEY;
    delete process.env.GOOGLE_CSE_KEY;
    delete process.env.GOOGLE_CSE_CX;
    const result = await searchOfficialWeb('أرامكو');
    expect(result.ok).toBe(false);
    expect(result.attempts).toEqual([]);
    expect(fetchUrl).not.toHaveBeenCalled();
  });

  test('falls through Brave to Bing when Brave is empty', async () => {
    process.env.BONDS_BRAVE_SEARCH_API_KEY = 'brave';
    process.env.BONDS_BING_SEARCH_API_KEY = 'bing';
    fetchUrl
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify({ web: { results: [] } }),
        evidence: { status_code: 200 }
      })
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify({
          webPages: { value: [{ name: 'Bing hit', url: 'https://bing.example', snippet: 'ok' }] }
        }),
        evidence: { status_code: 200 }
      });

    const result = await searchOfficialWeb('query');
    expect(result.ok).toBe(true);
    expect(result.engine).toBe('bing-api');
    expect(result.results[0].title).toBe('Bing hit');
    expect(result.attempts.map(item => item.provider)).toEqual(['brave-api', 'bing-api']);
  });
});
