/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('service discovery direct routing', () => {
  let script;

  beforeAll(() => {
    script = fs.readFileSync(
      path.join(process.cwd(), 'components/service-discovery.js'),
      'utf8'
    );
  });

  test('uses canonical service routes from catalog instead of hard-coded service mappings', () => {
    expect(script).toContain("service.default_route_en");
    expect(script).toContain("service.default_route_ar");
    expect(script).toContain("state.services.find(row => row.code === serviceCode)");
  });

  test('only accepts same-origin internal routes', () => {
    expect(script).toContain("trimmed.startsWith('/')");
    expect(script).toContain("trimmed.startsWith('//')");
    expect(script).toContain("url.origin !== window.location.origin");
  });

  test('preserves generic service request as fallback when no canonical route exists', () => {
    expect(script).toContain("'/en/service-request.html':'/service-request.html'");
    expect(script).toContain("if (directRoute)");
  });

  test('persists selected service intent before direct routing', () => {
    const storeIndex = script.indexOf("sessionStorage.setItem('bonds_service_intent'");
    const routeIndex = script.indexOf("const directRoute = selectedServiceRoute(serviceCode)");
    expect(storeIndex).toBeGreaterThan(-1);
    expect(routeIndex).toBeGreaterThan(storeIndex);
  });
});
