/** @jest-environment node */

jest.mock('../../lib/intelligence/searx-search', () => ({
  searchSearx: jest.fn()
}));

jest.mock('../../lib/intelligence/web-acquisition', () => ({
  fetchUrl: jest.fn()
}));

const { searchSearx } = require('../../lib/intelligence/searx-search');
const { fetchUrl } = require('../../lib/intelligence/web-acquisition');
const { searchWeb } = require('../../lib/intelligence/web-search');

describe('BONDS web search SearX priority and fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BONDS_WEB_SEARCH_URL;
  });

  test('returns SearX results before legacy HTML search upstreams', async () => {
    searchSearx.mockResolvedValue({
      ok:true,
      executed:true,
      result:{
        query:'رئيس شركة أرامكو',
        results:[
          {
            title:'Saudi Aramco leadership',
            url:'https://www.aramco.com/en/who-we-are/our-leadership',
            snippet:'Official leadership information.',
            source:'searxng'
          }
        ],
        result_count:1
      },
      evidence:{
        upstream:'https://search.example.com',
        engine:'searxng',
        fetch:{ status_code:200 }
      }
    });

    const result = await searchWeb('رئيس شركة أرامكو', { limit:5 });

    expect(result.ok).toBe(true);
    expect(result.result.results[0].source).toBe('searxng');
    expect(result.evidence.search_engine).toBe('searxng');
    expect(fetchUrl).not.toHaveBeenCalled();
  });

  test('continues to the next upstream when a non-empty batch has zero required-term relevance', async () => {
    searchSearx.mockResolvedValue({
      ok:false,
      executed:true,
      error:{ code:'SEARX_UPSTREAM_FAILED', status_code:503 },
      evidence:{ upstream:'https://search.example.com', fetch:{ status_code:503, failure_class:'HTTP_503' } },
      result:{ query:'طلال حسن الزهراني الدكتور', results:[], result_count:0 }
    });

    fetchUrl
      .mockResolvedValueOnce({
        ok:true,
        text:`
          <rss><channel>
            <item>
              <title><![CDATA[Central Time Zone]]></title>
              <link>https://example.net/time-zone</link>
              <description><![CDATA[Time zone information.]]></description>
            </item>
          </channel></rss>
        `,
        evidence:{ status_code:200, content_type:'application/rss+xml' }
      })
      .mockResolvedValueOnce({
        ok:true,
        text:`
          <a class="result__a" href="https://example.org/talal">الدكتور طلال حسن الزهراني</a>
          <div class="result__snippet">طلال حسن الزهراني مستشار مالي.</div>
        `,
        evidence:{ status_code:200, content_type:'text/html' }
      });

    const result = await searchWeb('طلال حسن الزهراني الدكتور', {
      limit:5,
      requiredTerms:['طلال','حسن','الزهراني']
    });

    expect(result.ok).toBe(true);
    expect(result.result.results).toEqual([
      expect.objectContaining({
        title:'الدكتور طلال حسن الزهراني',
        url:'https://example.org/talal'
      })
    ]);
    expect(fetchUrl).toHaveBeenCalledTimes(2);
    expect(result.evidence.attempts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider:'bing',
        code:'SEARCH_RESULTS_REJECTED',
        raw_result_count:1,
        result_count:0
      })
    ]));
  });

  test('falls back to legacy upstreams when SearX fails', async () => {
    searchSearx.mockResolvedValue({
      ok:false,
      executed:true,
      error:{ code:'SEARX_UPSTREAM_FAILED', status_code:503 },
      evidence:{ upstream:'https://search.example.com', fetch:{ status_code:503, failure_class:'HTTP_503' } },
      result:{ query:'test', results:[], result_count:0 }
    });

    fetchUrl.mockResolvedValue({
      ok:true,
      text:`
        <rss>
          <channel>
            <item>
              <title><![CDATA[Fallback Result]]></title>
              <link>https://example.org/result</link>
              <description><![CDATA[Fallback result snippet.]]></description>
            </item>
          </channel>
        </rss>
      `,
      evidence:{
        status_code:200,
        content_type:'application/rss+xml',
        final_url:'https://www.bing.com/search?format=rss&q=test'
      }
    });

    const result = await searchWeb('test', { limit:5 });

    expect(result.ok).toBe(true);
    expect(result.result.results[0]).toEqual(expect.objectContaining({
      title:'Fallback Result',
      url:'https://example.org/result'
    }));
    expect(fetchUrl).toHaveBeenCalled();
    expect(result.evidence.attempts[0]).toEqual(expect.objectContaining({
      code:'SEARX_UPSTREAM_FAILED'
    }));
  });
});
