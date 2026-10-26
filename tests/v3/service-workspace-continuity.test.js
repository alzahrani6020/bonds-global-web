/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');

describe('service workspace continuity contract',()=>{
  const ui=fs.readFileSync(path.join(process.cwd(),'components/service-request.js'),'utf8');

  test('workspace persists draft inputs and restores them',()=>{
    expect(ui).toContain("const workspaceDraftKey='bonds_service_workspace_draft_v1:'+serviceCode");
    expect(ui).toContain('function saveWorkspaceDraft()');
    expect(ui).toContain('function restoreWorkspaceDraft()');
    expect(ui).toContain('localStorage.setItem(workspaceDraftKey');
  });

  test('workspace protects unsaved changes',()=>{
    expect(ui).toContain("window.addEventListener('beforeunload'");
    expect(ui).toContain('workspaceDirty');
  });

  test('request-only service cannot remain in execution workspace',()=>{
    expect(ui).toContain("if(isServiceWorkspace&&detail?.workspace?.mode!=='execute')");
    expect(ui).toContain("location.replace((lang==='ar'?'/service-request.html':'/en/service-request.html')+location.search)");
  });

  test('successful execution clears persisted draft',()=>{
    expect(ui).toContain('clearWorkspaceDraft();');
  });
});
