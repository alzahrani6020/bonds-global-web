'use strict';

const { normalizeRel, protectedSurfaceForFile }=require('./system-map');

const IMPACT_RULES=Object.freeze([
  {
    id:'service-token-runtime',
    match:p=>/^services\/bonds_token_runtime\//.test(p)||/^lib\/security\/service-token-/.test(p),
    tests:[
      'tests/integration/governed-token-runtime.test.js',
      'tests/integration/governed-token-runtime-acceptance.js',
      'tests/security/service-token-authorization.test.js',
      'tests/security/service-token-broker.test.js',
      'tests/security/service-token-channel.test.js',
      'tests/security/service-token-policy-validation.test.js'
    ],
    gates:['token-runtime-windows-acceptance','service-manifest-token-policy']
  },
  {
    id:'service-capability-registry',
    match:p=>/^services\/manifests\//.test(p)||/^lib\/capabilities\//.test(p),
    tests:[
      'tests/security/service-manifest-registration.test.js',
      'tests/capabilities/capability-governance.test.js',
      'tests/capabilities/governed-executor-shadow-authorization.test.js'
    ],
    gates:['services:check','audit:tools']
  },
  {
    id:'assistant-runtime',
    match:p=>/^lib\/assistant\//.test(p)||/^v3\/api\/(assistant|ai)\.js$/.test(p),
    tests:[
      'tests/assistant/assistant-protocol.test.js',
      'tests/assistant/assistant-production-readiness.test.js',
      'tests/assistant/assistant-global-service-chat.test.js'
    ],
    gates:['unit-integration']
  },
  {
    id:'evolution-learning',
    match:p=>/^lib\/(dual-core|learning|evolution)\//.test(p),
    tests:[
      'tests/dual-core/assistant-outcome-bridge.test.js',
      'tests/dual-core/evolution-proposal-aggregator.test.js',
      'tests/learning/phase2-learning-foundation.test.js'
    ],
    gates:['unit-integration']
  },
  {
    id:'database-schema',
    match:p=>/^supabase\/migrations\//.test(p),
    tests:[
      'tests/security/supabase-migration-uniqueness.test.js'
    ],
    gates:['audit:migrations','migration-forward-only','rls-verification']
  },
  {
    id:'admin-surface',
    match:p=>/^admin\//.test(p)||/^v3\/api\/admin\.js$/.test(p),
    tests:[
      'tests/admin/admin-architecture-contracts.test.js',
      'tests/security/admin-auth-unification.test.js'
    ],
    gates:['audit:admin-contracts','test:admin:ui']
  },
  {
    id:'financial-engines',
    match:p=>/^lib\/financial\//.test(p)||/^v3\/engine\/.*financial/i.test(p)||/^calculators\//.test(p),
    tests:[
      'tests/api/calculator-regressions.test.js',
      'tests/finance/financial-engine-registry.test.js',
      'tests/investment-center-financial-regression.test.js'
    ],
    gates:['financial-regression']
  },
  {
    id:'deployment-release',
    match:p=>/^\.github\/workflows\//.test(p)||/^scripts\/post-deploy-smoke\.js$/.test(p)||/^vercel\.json$/.test(p),
    tests:[
      'tests/post-release-pipeline-contracts.test.js',
      'tests/deployment/vercel-function-budget.test.js'
    ],
    gates:['ci-contract','staged-release','production-verification']
  }
]);

function uniqueSorted(values){
  return [...new Set(values)].sort();
}

function analyzeImpact({changedFiles=[]}={}){
  const files=uniqueSorted((Array.isArray(changedFiles)?changedFiles:[]).map(normalizeRel).filter(Boolean));
  const surfaces=[];
  const tests=[];
  const gates=[];
  const protectedSurfaces=[];

  for(const file of files){
    protectedSurfaces.push(...protectedSurfaceForFile(file));
    for(const rule of IMPACT_RULES){
      if(!rule.match(file))continue;
      surfaces.push(rule.id);
      tests.push(...rule.tests);
      gates.push(...rule.gates);
    }
  }

  const protectedIds=uniqueSorted(protectedSurfaces);
  return {
    version:1,
    changed_files:files,
    impacted_surfaces:uniqueSorted(surfaces),
    protected_surfaces:protectedIds,
    required_tests:uniqueSorted(tests),
    required_gates:uniqueSorted(gates),
    risk:protectedIds.length?'protected':'standard',
    requires_full_regression:protectedIds.length>0,
    policy:{
      deterministic_rules:true,
      ai_inference:false,
      execution_authorized:false,
      protected_surface_bypass:false
    }
  };
}

module.exports={
  IMPACT_RULES,
  analyzeImpact
};
