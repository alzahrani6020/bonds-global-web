/** @jest-environment node */
'use strict';
const fs = require('fs');
const path = require('path');
const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('workspace direct entry without a service identifier', () => {
  const ui = read('components/service-request.js');
  test('renders a localized actionable chooser instead of a technical error', () => {
    const start = ui.indexOf('async function init(){');
    const end = ui.indexOf("$('#srLoading').textContent=T.loading;", start);
    const guard = ui.slice(start, end);
    expect(guard).toContain('if(!serviceCode){');
    expect(guard).toContain("loading.textContent=''");
    expect(guard).toContain("اختر الخدمة لفتح مساحة العمل");
    expect(guard).toContain('Choose a service to open its workspace');
    expect(guard).toContain("document.querySelector('#bondsServiceTrigger')");
    expect(guard).toContain('selector.click()');
    expect(guard).toContain("status.textContent=''");
    expect(guard).not.toContain("showStatus(T.failed+': service'");
  });
  test('the normal valid service loading path remains intact', () => {
    expect(ui).toContain("detail=await json('/api/v3/services/'+encodeURIComponent(serviceCode)");
    expect(ui).toContain("if(isServiceWorkspace&&detail?.workspace?.mode!=='execute')");
  });
  test('both workspace languages load the new script and worker tracks it', () => {
    for(const file of ['my-bonds/workspace/index.html','en/my-bonds/workspace/index.html','service-request.html','en/service-request.html']){
      expect(read(file)).toContain('/components/service-request.js?v=21');
    }
    expect(read('sw.js')).toContain("const CACHE_VERSION = 'v3.0.295';");
    expect(read('sw.js')).toContain("'/components/service-request.js?v=21'");
  });
});
