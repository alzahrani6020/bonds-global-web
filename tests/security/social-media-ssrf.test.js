jest.mock('../../lib/social/config', () => ({
  youtube: {
    apiKey: '',
    channelId: '',
    clientId: '',
    clientSecret: '',
    accessToken: 'configured',
    refreshToken: ''
  }
}));

jest.mock('../../lib/social/oauth', () => ({
  getYouTubeAccessToken: jest.fn(async () => 'oauth-token')
}));

jest.mock('../../lib/intelligence/web-acquisition', () => ({
  fetchUrl: jest.fn(async () => ({
    ok: false,
    executed: false,
    body: Buffer.alloc(0),
    evidence: {
      failure_class: 'POLICY_BLOCK',
      blocked_reason: 'PRIVATE_OR_RESERVED_DESTINATION'
    }
  }))
}));

const { fetchUrl } = require('../../lib/intelligence/web-acquisition');
const youtube = require('../../lib/social/youtube');

describe('social media remote download boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('YouTube publishing blocks private media URLs before provider upload', async () => {
    const result = await youtube.publishPost({
      text: 'test',
      mediaUrl: 'http://127.0.0.1/internal.mp4',
      mediaType: 'video'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('PRIVATE_OR_RESERVED_DESTINATION');
    expect(fetchUrl).toHaveBeenCalledWith(
      'http://127.0.0.1/internal.mp4',
      expect.objectContaining({
        allowPrivateNetworks: false,
        maxBytes: 16 * 1024 * 1024,
        maxRedirects: 5
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
