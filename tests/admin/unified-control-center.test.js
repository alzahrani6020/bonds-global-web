/** @jest-environment node */
const fs=require('fs');
const path=require('path');

describe('Phase 7 Unified Control Center',()=>{
  const html=fs.readFileSync(path.join(process.cwd(),'admin','control-center.html'),'utf8');

  test('exposes all ten approved control surfaces',()=>{
    for(const label of [
      'Assistant','Learning','Training','Evolution','Capabilities',
      'Models','Approvals','Releases','Health','Audit'
    ]) expect(html).toContain('>'+label+'<');
  });

  test('uses existing admin surfaces instead of parallel execution paths',()=>{
    expect(html).toContain('/admin/assistant-control-center.html');
    expect(html).toContain('/admin/platform-center.html');
    expect(html).toContain('/admin/human-approvals/');
    expect(html).toContain('/admin/audit-log.html');
    expect(html).not.toContain('/api/v3/admin/training/execute');
    expect(html).not.toContain('/api/v3/admin/model/promote');
    expect(html).not.toContain('/api/v3/admin/model/rollback');
  });

  test('shows live production health readiness release and model provider',()=>{
    expect(html).toContain("publicJson('/api/health')");
    expect(html).toContain("publicJson('/api/readiness')");
    expect(html).toContain("Production SHA:");
    expect(html).toContain("Provider:");
    expect(html).toContain("Production READY");
  });

  test('preserves existing admin operational control plane',()=>{
    expect(html).toContain('control-center-overview');
    expect(html).toContain('security-sessions-overview');
    expect(html).toContain('config-drift');
    expect(html).toContain('Security Controls');
    expect(html).toContain('Configuration Drift');
  });

  test('states governed no-auto execution boundary',()=>{
    expect(html).toContain('no auto-train / auto-promote / auto-rollback');
  });
});
