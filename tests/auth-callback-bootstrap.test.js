'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'calculators/auth/index.html'), 'utf8');
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function runBootstrap(search, hash, alreadyVisited = false) {
  const values = new Map(alreadyVisited ? [['auth_v2', '1']] : []);
  const replace = jest.fn();
  const location = { pathname: '/calculators/auth/', search, hash, replace };
  vm.runInNewContext(bootstrap, {
    location,
    sessionStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    Date: { now: () => 123456 }
  });
  return { replace, values };
}

describe('first-visit authentication callback cache refresh', () => {
  test.each([
    ['?redirect=%2Fmy-bonds%2Fcrm%3Fprogram%3Dhr', '#access_token=synthetic-access&refresh_token=synthetic-refresh&type=magiclink'],
    ['', '#error=access_denied&error_description=synthetic-error']
  ])('preserves the callback fragment with query %s', (search, hash) => {
    const { replace } = runBootstrap(search, hash);
    const target = new URL(replace.mock.calls[0][0], 'https://preview.example');
    expect(target.hash).toBe(hash);
    expect(target.pathname).toBe('/calculators/auth/');
    expect(target.searchParams.get('_')).toBe('123456');
    expect(target.searchParams.get('redirect')).toBe(new URLSearchParams(search).get('redirect'));
    expect(target.searchParams.has('access_token')).toBe(false);
    expect(target.searchParams.has('refresh_token')).toBe(false);
  });

  test('refreshes an ordinary first visit only once', () => {
    const { replace, values } = runBootstrap('', '');
    expect(replace).toHaveBeenCalledWith('/calculators/auth/?_=123456');
    expect(values.get('auth_v2')).toBe('1');
  });

  test('does not reload an already initialized callback', () => {
    const { replace } = runBootstrap('', '#access_token=synthetic-access', true);
    expect(replace).not.toHaveBeenCalled();
  });
});
