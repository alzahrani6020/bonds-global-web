'use strict';

describe('Brave Search API integration', () => {
  const originalKey = process.env.BONDS_BRAVE_SEARCH_API_KEY;

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (originalKey === undefined) delete process.env.BONDS_BRAVE_SEARCH_API_KEY;
    else process.env.BONDS_BRAVE_SEARCH_API_KEY = originalKey;
  });

  test('uses the official Brave endpoint and subscription token header', async () => {
    const fetchUrl = jest.fn(async () => ({
      ok:true,
      executed:true,
      text:JSON.stringify({
        web:{
          results:[{
            title:'الدكتور طلال حسن الزهراني',
            url:'https://example.org/dr-talal',
            description:'تعريف موثق.'
          }]
        }
      }),
      evidence:{
        status_code:200,
        failure_class:null
      }
    }));

    jest.doMock('../../lib/intelligence/web-acquisition', () => ({ fetchUrl }));
    process.env.BONDS_BRAVE_SEARCH_API_KEY = 'test-brave-key';

    const { searchBraveApi } = require('../../lib/intelligence/web-search');
    const result = await searchBraveApi('طلال حسن الزهراني', {
      limit:5,
      language:'ar',
      safeSearch:'1',
      timeoutMs:12000
    });

    expect(result.ok).toBe(true);
    expect(result.result.results).toHaveLength(1);
    expect(fetchUrl).toHaveBeenCalledTimes(1);

    const [url, options] = fetchUrl.mock.calls[0];
    expect(url).toContain('https://api.search.brave.com/res/v1/web/search');
    expect(url).toContain('q=');
    expect(options.headers).toEqual(expect.objectContaining({
      accept:'application/json',
      'X-Subscription-Token':'test-brave-key'
    }));
  });
});
