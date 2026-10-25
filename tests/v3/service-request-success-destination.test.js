/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('service request success destination', () => {
  let ui;
  let css;

  beforeAll(() => {
    ui = fs.readFileSync(path.join(process.cwd(), 'components/service-request.js'), 'utf8');
    css = fs.readFileSync(path.join(process.cwd(), 'components/service-request.css'), 'utf8');
  });

  test('hidden service request controls stay hidden', () => {
    expect(css).toContain('.service-request-page [hidden]{display:none!important}');
  });

  test('successful request creation does not redirect or link to my-bonds', () => {
    expect(ui).not.toContain("$('#srSuccessLink').href=lang==='ar'?'/my-bonds/':'/en/my-bonds/'");
    expect(ui).toContain("$('#srSuccessLink').hidden=true");
  });

  test('request page keeps the created request reference visible in place', () => {
    expect(ui).toContain("showStatus(T.sent+' — '+d.request.request_reference,true)");
  });
});
