'use strict';

const path=require('path');
const {
  buildSystemMap,
  protectedSurfaceForFile
}=require('../../lib/evolution/system-map');
const { analyzeImpact }=require('../../lib/evolution/impact-analyzer');

describe('Phase 3 deterministic System Map and Impact Analyzer',()=>{
  test('builds a deterministic repository map from canonical registries',()=>{
    const map=buildSystemMap({
      root:path.join(__dirname,'../..'),
      baselineSha:'abc123'
    });
    expect(map.baseline_sha).toBe('abc123');
    expect(map.deterministic).toBe(true);
    expect(map.counts.files).toBeGreaterThan(100);
    expect(map.counts.api_routes).toBeGreaterThan(0);
    expect(map.counts.tests).toBeGreaterThan(0);
    expect(map.counts.registered_services).toBeGreaterThan(0);
    expect(map.counts.registered_capabilities).toBeGreaterThan(0);
    expect(map.policy.ai_inference).toBe(false);
    expect(map.generated_at).toBeNull();
  });

  test('identifies protected token runtime and migration surfaces',()=>{
    expect(protectedSurfaceForFile('services/bonds_token_runtime/bonds_security/server.py'))
      .toContain('service-token-runtime');
    expect(protectedSurfaceForFile('supabase/migrations/20261023024500_evolution_proposal_aggregation.sql'))
      .toContain('authorization-and-rls');
  });

  test('selects deterministic tests and gates for protected changes',()=>{
    const impact=analyzeImpact({
      changedFiles:[
        'services/bonds_token_runtime/bonds_security/server.py',
        'supabase/migrations/20261023024500_evolution_proposal_aggregation.sql'
      ]
    });
    expect(impact.risk).toBe('protected');
    expect(impact.requires_full_regression).toBe(true);
    expect(impact.impacted_surfaces).toEqual(expect.arrayContaining([
      'service-token-runtime','database-schema'
    ]));
    expect(impact.required_gates).toEqual(expect.arrayContaining([
      'token-runtime-windows-acceptance','audit:migrations','rls-verification'
    ]));
    expect(impact.policy.protected_surface_bypass).toBe(false);
  });

  test('normalizes and deduplicates changed paths',()=>{
    const impact=analyzeImpact({
      changedFiles:['v3\\api\\assistant.js','v3/api/assistant.js']
    });
    expect(impact.changed_files).toEqual(['v3/api/assistant.js']);
    expect(impact.impacted_surfaces).toContain('assistant-runtime');
  });
});
