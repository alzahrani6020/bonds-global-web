jest.mock('../../lib/intelligence/web-acquisition', () => ({
  fetchUrl: jest.fn(async (_url, options) => ({
    ok: false,
    executed: false,
    text: '',
    evidence: {
      content_type: null,
      failure_class: 'POLICY_BLOCK',
      options
    }
  })),
  crawl: jest.fn(async input => ({
    pages: [],
    failures: [],
    blocked: [],
    coverage: { input }
  }))
}));

jest.mock('../../lib/intelligence/content-extraction', () => ({
  extractContent: jest.fn(async () => ({ text: '' }))
}));

jest.mock('../../lib/ai/inference-router', () => ({
  getInferenceRouter: jest.fn(() => ({
    health: jest.fn(),
    generate: jest.fn()
  }))
}));

const { fetchUrl, crawl } = require('../../lib/intelligence/web-acquisition');
const { executeCapability } = require('../../lib/capabilities/governed-executor');

const authorizedContext = {
  actor: { id: 'user-1' },
  userId: 'user-1',
  governance: {
    permissions: ['research.web.read'],
    entitlements: ['research.web']
  }
};

describe('governed network capabilities', () => {
  beforeEach(() => jest.clearAllMocks());

  test('web_fetch cannot opt into private-network access', async () => {
    await executeCapability('web_fetch', {
      url: 'http://127.0.0.1/',
      options: { allowPrivateNetworks: true }
    }, authorizedContext);

    expect(fetchUrl).toHaveBeenCalledWith(
      'http://127.0.0.1/',
      expect.objectContaining({ allowPrivateNetworks: false })
    );
  });

  test.each(['web_crawl', 'web_explore'])('%s cannot opt into private-network access', async action => {
    await executeCapability(action, {
      seedUrls: ['http://127.0.0.1/'],
      allowPrivateNetworks: true,
      allow_private_networks: true
    }, authorizedContext);

    expect(crawl).toHaveBeenCalledWith(expect.objectContaining({
      allowPrivateNetworks: false,
      allow_private_networks: false
    }));
  });
});
