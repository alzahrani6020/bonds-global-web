/** @jest-environment node */

const mockValidate=jest.fn();
const mockGetService=jest.fn();
const mockAdapter=jest.fn();
const mockGetAdapter=jest.fn(()=>mockAdapter);
const mockEvaluateGovernance=jest.fn();
const mockAudit=jest.fn();
const mockMetric=jest.fn();

jest.mock('../../lib/capabilities/bonds-capability-registry',()=>({
  validateCapabilityInput:(...args)=>mockValidate(...args),
  getService:(...args)=>mockGetService(...args)
}));
jest.mock('../../lib/capabilities/runtime-adapters',()=>({
  getRuntimeAdapter:(...args)=>mockGetAdapter(...args)
}));
jest.mock('../../lib/capabilities/governance-gateway',()=>({
  evaluateGovernance:(...args)=>mockEvaluateGovernance(...args),
  emitAudit:(...args)=>mockAudit(...args),
  emitMetric:(...args)=>mockMetric(...args)
}));

const {executeCapability}=require('../../lib/capabilities/governed-executor');

const cap={
  action:'orchestrator_run',
  active:true,
  serviceCode:'svc',
  runtime:{adapter:'mock'},
  required:[],
  requiredAny:[]
};
const svc={
  serviceCode:'svc',
  enabled:true,
  security:{requestedSensitivePrivileges:[],serviceTokenRequired:false},
  governance:{permissions:[],entitlements:[],featureFlags:[]},
  limits:{},
  observability:{audit:false,metrics:false}
};
const ctx={
  actor:{id:'u1'},
  userId:'u1',
  governance:{permissions:[],entitlements:[]}
};

describe('Governed executor shadow authorization integration',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockValidate.mockReturnValue({valid:true,code:null,missing:[],spec:cap});
    mockGetService.mockReturnValue(svc);
    mockAdapter.mockResolvedValue({ok:true,executed:true});
  });

  test('allowed production decision executes and reports matching shadow outcome',async()=>{
    mockEvaluateGovernance.mockResolvedValue({allowed:true,code:null});
    const out=await executeCapability('orchestrator_run',{request:{}},ctx);
    expect(mockAdapter).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(true);
    expect(out.shadow_authorization).toEqual(expect.objectContaining({
      outcome:'would_allow',
      drift:false,
      enforcement:'production_governance_only',
      production_decision_affected:false
    }));
  });

  test('production denial remains denied even when shadow would allow',async()=>{
    mockEvaluateGovernance.mockResolvedValue({allowed:false,code:'RATE_LIMITED'});
    const out=await executeCapability('orchestrator_run',{request:{}},ctx);
    expect(out.ok).toBe(false);
    expect(out.executed).toBe(false);
    expect(out.error.code).toBe('RATE_LIMITED');
    expect(mockAdapter).not.toHaveBeenCalled();
    expect(out.shadow_authorization).toEqual(expect.objectContaining({
      outcome:'would_allow',
      drift:true,
      actual:{allowed:false,code:'RATE_LIMITED'},
      production_decision_affected:false,
      authorization_granted:false,
      execution_authorized:false
    }));
  });

  test('production denial and shadow denial agree without execution',async()=>{
    mockGetService.mockReturnValue({
      ...svc,
      governance:{permissions:['required.permission'],entitlements:[],featureFlags:[]}
    });
    mockEvaluateGovernance.mockResolvedValue({allowed:false,code:'PERMISSION_DENIED'});
    const out=await executeCapability('orchestrator_run',{request:{}},ctx);
    expect(mockAdapter).not.toHaveBeenCalled();
    expect(out.shadow_authorization).toEqual(expect.objectContaining({
      outcome:'would_deny',
      code:'PERMISSION_DENIED',
      drift:false
    }));
  });
});
