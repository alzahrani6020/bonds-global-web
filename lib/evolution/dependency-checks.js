'use strict';

const { analyzeImpact }=require('./impact-analyzer');
const { assertCandidateFresh }=require('./candidate-manager');
const { validateApprovedTarget, approvalCovers, assertTargetUnchanged }=require('./approval-target');

const DEPENDENCY_CHECK_VERSION=1;

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function uniqueSorted(values){
  return [...new Set((Array.isArray(values)?values:[]).map(v=>clean(v,300)).filter(Boolean))].sort();
}

function normalizeInventory(inventory={}){
  if(!inventory||typeof inventory!=='object'||Array.isArray(inventory)){
    throw new Error('DEPENDENCY_INVENTORY_INVALID');
  }
  return {
    files:new Set(uniqueSorted(inventory.files)),
    tests:new Set(uniqueSorted(inventory.tests)),
    gates:new Set(uniqueSorted(inventory.gates)),
    capabilities:new Set(uniqueSorted(inventory.capabilities)),
    services:new Set(uniqueSorted(inventory.services))
  };
}

function candidateProposal(candidate){
  if(!candidate||typeof candidate!=='object')throw new Error('DEPENDENCY_CANDIDATE_REQUIRED');
  return {
    proposal_id:candidate.target?.proposal_id,
    fingerprint:candidate.target?.fingerprint,
    problem_class:candidate.target?.problem_class,
    target_component:candidate.target?.target_component,
    recommended_path:candidate.target?.recommended_path,
    risk_level:candidate.target?.risk_level||null
  };
}

function evaluateDependencies({
  approvedTarget,
  candidate,
  currentMainSha,
  changedFiles=[],
  inventory={},
  requiredCapabilities=[],
  requiredServices=[]
}={}){
  validateApprovedTarget(approvedTarget);
  const normalizedInventory=normalizeInventory(inventory);
  const files=uniqueSorted(changedFiles);
  const impact=analyzeImpact({changedFiles:files});
  const checks=[];

  const freshness=assertCandidateFresh(candidate,currentMainSha);
  checks.push({
    id:'candidate_freshness',
    passed:freshness.fresh===true,
    code:freshness.fresh?'OK':freshness.code
  });

  const target=assertTargetUnchanged(approvedTarget,candidateProposal(candidate));
  checks.push({
    id:'approved_target_unchanged',
    passed:target.unchanged===true,
    code:target.unchanged?'OK':target.code
  });

  const scope=approvalCovers({
    approvedTarget,
    targetComponent:candidate.target?.target_component,
    changedFiles:files
  });
  checks.push({
    id:'approval_scope',
    passed:scope.covered===true,
    code:scope.covered?'OK':scope.code
  });

  const missingFiles=files.filter(file=>!normalizedInventory.files.has(file));
  checks.push({
    id:'changed_files_exist',
    passed:missingFiles.length===0,
    code:missingFiles.length?'DEPENDENCY_CHANGED_FILE_MISSING':'OK',
    missing:missingFiles
  });

  const missingTests=impact.required_tests.filter(test=>!normalizedInventory.tests.has(test));
  checks.push({
    id:'required_tests_available',
    passed:missingTests.length===0,
    code:missingTests.length?'DEPENDENCY_REQUIRED_TEST_MISSING':'OK',
    missing:missingTests
  });

  const missingGates=impact.required_gates.filter(gate=>!normalizedInventory.gates.has(gate));
  checks.push({
    id:'required_gates_available',
    passed:missingGates.length===0,
    code:missingGates.length?'DEPENDENCY_REQUIRED_GATE_MISSING':'OK',
    missing:missingGates
  });

  const reqCaps=uniqueSorted(requiredCapabilities);
  const missingCapabilities=reqCaps.filter(id=>!normalizedInventory.capabilities.has(id));
  checks.push({
    id:'required_capabilities_available',
    passed:missingCapabilities.length===0,
    code:missingCapabilities.length?'DEPENDENCY_CAPABILITY_MISSING':'OK',
    missing:missingCapabilities
  });

  const reqServices=uniqueSorted(requiredServices);
  const missingServices=reqServices.filter(id=>!normalizedInventory.services.has(id));
  checks.push({
    id:'required_services_available',
    passed:missingServices.length===0,
    code:missingServices.length?'DEPENDENCY_SERVICE_MISSING':'OK',
    missing:missingServices
  });

  const failed=checks.filter(check=>check.passed!==true);

  return {
    version:DEPENDENCY_CHECK_VERSION,
    status:failed.length?'blocked':'ready',
    candidate_id:candidate.candidate_id||null,
    approved_target_id:approvedTarget.approval_id,
    impact,
    checks,
    blockers:failed.map(check=>({
      id:check.id,
      code:check.code,
      missing:check.missing||[]
    })),
    policy:{
      deterministic:true,
      ai_inference:false,
      fail_closed:true,
      protected_surface_bypass:false,
      execution_authorized:false,
      validation_bypass:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

function assertDependenciesReady(args={}){
  const result=evaluateDependencies(args);
  if(result.status!=='ready'){
    const err=new Error('DEPENDENCY_CHECK_BLOCKED');
    err.result=result;
    throw err;
  }
  return result;
}

module.exports={
  DEPENDENCY_CHECK_VERSION,
  normalizeInventory,
  candidateProposal,
  evaluateDependencies,
  assertDependenciesReady
};
