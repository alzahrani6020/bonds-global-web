const { normalizePlatforms, getAccountStatus, fetchLatestPosts } = require('../../lib/social');

describe('social/providers', () => {
  test('normalizePlatforms filters unknown platforms', () => {
    expect(normalizePlatforms(['instagram', 'unknown', 'x'])).toEqual(['instagram', 'x']);
    expect(normalizePlatforms('youtube,x')).toEqual(['youtube', 'x']);
    expect(normalizePlatforms('all')).toEqual(['instagram', 'youtube', 'x']);
  });

  test('getAccountStatus returns three platforms', async () => {
    const status = await getAccountStatus();
    expect(status).toHaveLength(3);
    expect(status.map(s => s.platform).sort()).toEqual(['instagram', 'x', 'youtube']);
  });

  test('fetchLatestPosts returns empty when credentials missing', async () => {
    const result = await fetchLatestPosts(['instagram', 'youtube', 'x'], 6);
    expect(result.success).toBe(true);
    expect(result.posts).toEqual([]);
  });
});
