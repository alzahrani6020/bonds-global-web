/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');

describe('service workspace UI contract',()=>{
  const ar=fs.readFileSync(path.join(process.cwd(),'my-bonds/workspace/index.html'),'utf8');
  const en=fs.readFileSync(path.join(process.cwd(),'en/my-bonds/workspace/index.html'),'utf8');
  const discovery=fs.readFileSync(path.join(process.cwd(),'components/service-discovery.js'),'utf8');
  const api=fs.readFileSync(path.join(process.cwd(),'v3/api/services.js'),'utf8');

  test('Arabic and English workspaces reuse governed service execution UI',()=>{
    expect(ar).toContain('/components/service-request.js?v=4');
    expect(en).toContain('/components/service-request.js?v=4');
    expect(ar).toContain('id="srRequestForm"');
    expect(en).toContain('id="srRequestForm"');
  });

  test('catalog exposes execution profile and resolved workspace',()=>{
    expect(api).toContain("execution_profile: executionProfile");
    expect(api).toContain("workspace: resolveServiceWorkspace(row, executionProfile)");
    expect(api).toContain("workspace,");
  });

  test('service selection launches immediately and executable services use workspace route',()=>{
    expect(discovery).toContain("function selectService(serviceCode, launch=true)");
    expect(discovery).toContain("if (launch) setTimeout(start, 0)");
    expect(discovery).toContain("service.workspace?.mode === 'execute'");
    expect(discovery).toContain("track('service_workspace_route'");
  });

  test('request-only services preserve service-request fallback',()=>{
    expect(discovery).toContain("'/en/service-request.html':'/service-request.html'");
  });
});
