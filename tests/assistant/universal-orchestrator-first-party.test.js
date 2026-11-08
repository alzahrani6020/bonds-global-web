/** @jest-environment node */

const { trustedFirstPartyDiscoveryUrls } = require('../../lib/assistant/universal-orchestrator');

describe('trusted first-party discovery origin ordering', () => {
  const previous = {
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('prefers stable public production origin before protected staged runtime origin', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'bonds-global-web.vercel.app';
    process.env.VERCEL_URL = 'bonds-global-staged-dr-talal.vercel.app';

    expect(trustedFirstPartyDiscoveryUrls()).toEqual([
      'https://bonds-global-web.vercel.app/about',
      'https://bonds-global-web.vercel.app/en/about',
      'https://bonds-global-staged-dr-talal.vercel.app/about',
      'https://bonds-global-staged-dr-talal.vercel.app/en/about'
    ]);
  });
});
