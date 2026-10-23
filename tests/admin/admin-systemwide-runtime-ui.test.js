/** @jest-environment node */
const fs=require('fs');
const path=require('path');

const read=file=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Admin system-wide runtime and UI contracts',()=>{
  const auth=read('bonds-auth-2026.js');
  const common=read('admin/admin-common.js');
  const platform=read('admin/platform-center.html');
  const css=read('admin/admin-shared-ux.css');

  test('authenticatedFetch always exposes response-like json/text/blob methods',()=>{
    expect(auth).toContain('function responseLikeError');
    expect(auth).toContain('function wrapFetchResponse');
    expect(auth).toContain('async json()');
    expect(auth).toContain('async text()');
    expect(auth).toContain('async blob()');
    expect(auth).not.toContain("return { __authError: 'FORBIDDEN', ok: false");
  });

  test('shared admin request helper tolerates normalized response contract',()=>{
    expect(common).toContain('async function requestJson');
    expect(common).toContain("typeof response?.json === 'function'");
    expect(common).toContain('humanizeAdminKey');
  });

  test('platform center uses shared JSON request helper and readable labels',()=>{
    expect(platform).toContain('BondsAdminCommon.requestJson');
    expect(platform).toContain('BondsAdminCommon.humanizeAdminKey');
    expect(platform).toContain('إدارة علاقات العملاء');
    expect(platform).not.toContain('response.json().catch');
    expect(platform).not.toContain('</a>\\n        <a');
  });

  test('shared admin CSS prevents narrow metrics from breaking words vertically',()=>{
    expect(css).toContain('overflow-wrap: break-word');
    expect(css).toContain('word-break: normal');
    expect(css).toContain('html[dir="rtl"] .metric strong');
  });
});
