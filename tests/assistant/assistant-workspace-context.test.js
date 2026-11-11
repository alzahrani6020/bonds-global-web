const fs = require('fs');
const path = require('path');

describe('verified assistant workspace context', () => {
  const request = fs.readFileSync(path.join(process.cwd(),'components/service-request.js'),'utf8');
  const widget = fs.readFileSync(path.join(process.cwd(),'v3/components/ai-chat-widget.js'),'utf8');
  const aiApi = fs.readFileSync(path.join(process.cwd(),'v3/api/ai.js'),'utf8');
  const arWorkspace = fs.readFileSync(path.join(process.cwd(),'my-bonds/workspace/index.html'),'utf8');
  const enWorkspace = fs.readFileSync(path.join(process.cwd(),'en/my-bonds/workspace/index.html'),'utf8');
  const sw = fs.readFileSync(path.join(process.cwd(),'sw.js'),'utf8');

  test('service-request publishes workspace identity only after service detail verification', () => {
    expect(request).toContain('let detailVerified=false;');
    expect(request).toContain('detailVerified=true;');
    expect(request).toContain('detailVerified=false;');
    expect(request).toContain('function syncWorkspaceAssistantContext()');
    expect(request).toContain("if(!isServiceWorkspace||detailVerified!==true||detail?.workspace?.mode!=='execute')return;");
    expect(request).toContain("const verifiedCode=String(detail?.service?.code||'').trim();");
    expect(request).toContain('if(!verifiedCode||verifiedCode!==serviceCode)return;');
    expect(request).toContain("source:'service_workspace'");
    expect(request).toContain("workspaceType:String(detail?.workspace?.type||'').slice(0,100)||null");
    expect(request).toContain("workspaceMode:'execute'");
    expect(request).toContain('function syncStudiesAssistantContext(){syncWorkspaceAssistantContext()}');
  });

  test('widget treats URL service as a hint and verifies it through the service API before stored context wins', () => {
    expect(widget).toContain('function workspaceServiceHint()');
    expect(widget).toContain("new URLSearchParams(window.location.search).get('service')");
    expect(widget).toContain('async function resolveVerifiedWorkspaceService()');
    expect(widget).toContain('SERVICE_DETAIL_API + encodeURIComponent(hint)');
    expect(widget).toContain("if (verifiedCode !== hint || data?.workspace?.mode !== 'execute') return false;");
    expect(widget).toContain("if (workspaceServiceHint() && await resolveVerifiedWorkspaceService()) return;");
    expect(widget).toContain('const safeBridge = workspaceHint && bridge.serviceCode && bridge.serviceCode !== workspaceHint');
  });

  test('workspace context remains service-scoped across client and durable server state', () => {
    expect(widget).toContain('function readWorkspaceContext()');
    expect(widget).toContain('...readAccountingWorkspaceContext()');
    expect(widget).toContain('...readStudiesWorkspaceContext()');
    expect(widget).toContain('return service ? `${base}|service:${service}` : base;');
    expect(aiApi).toContain("return `page:${pagePath || '/'}|service:${serviceCode || 'none'}`;");
  });

  test('governed plan forwards service_code only for site navigation and never a model URL', () => {
    expect(widget).toContain("action.type === 'site_navigate' && action.input?.service_code");
    expect(widget).toContain("{ service_code:String(action.input.service_code).slice(0,100) }");
    expect(widget).not.toContain('route: action.input');
    expect(widget).not.toContain('url: action.input');
  });

  test('workspace pages and service worker use the same shared runtime revisions', () => {
    for (const source of [arWorkspace,enWorkspace]) {
      expect(source).toContain('/site-layout.js?v=3.8.12');
      expect(source).toContain('/components/service-request.js?v=17');
    }
    expect(sw).toContain("const CACHE_VERSION = 'v3.0.264';");
    expect(sw).toContain("'/site-layout.js?v=3.8.12'");
    expect(sw).toContain("'/components/service-request.js?v=17'");
  });
});
