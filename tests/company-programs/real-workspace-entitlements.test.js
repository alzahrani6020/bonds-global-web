/** @jest-environment node */
'use strict';
const {PROGRAMS,isActiveEntitlement}=require('../../lib/company-programs/catalog');
describe('Company programs - no phantom capabilities',()=>{
  test('all 11 are distinct and complete',()=>{
    expect(PROGRAMS.map(x=>x.key)).toEqual([
      'crm','hr','real_estate','fleet','sales','purchasing','inventory',
      'finance','accounting','projects','governance'
    ]);
    expect(new Set(PROGRAMS.map(x=>x.key)).size).toBe(11);
  });
  test('only active, time-bounded subscriptions qualify',()=>{
    const date=new Date('2026-11-15T15:00:00Z');
    const base={program_key:'hr',status:'active',valid_from:'2026-11-01T00:00:00Z',valid_until:'2026-12-01T00:00:00Z'};
    expect(isActiveEntitlement(base,date)).toBe(true);
    expect(isActiveEntitlement({...base,status:'pending'},date)).toBe(false);
    expect(isActiveEntitlement({...base,status:'cancelled'},date)).toBe(false);
    expect(isActiveEntitlement({...base,valid_until:'2026-11-15T15:00:00Z'},date)).toBe(false);
    expect(isActiveEntitlement({...base,program_key:'unknown'},date)).toBe(false);
  });
  test('read-only endpoint requires an authenticated existing workspace',()=>{
    const fs=require('fs');
    const api=fs.readFileSync(require('path').join(__dirname,'../../lib/api/company-programs.js'),'utf8');
    expect(api).toContain("if(req.method!=='GET')");
    expect(api).toContain('verifyBearer(req)');
    expect(api).toContain(".eq('owner_user_id',user.id)");
    expect(api).toContain(".eq('member_user_id',user.id)");
    expect(api).toContain(".eq('active',true)");
    expect(api).toContain("runtimeIntegration:'not_verified'");
    expect(api).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });
});
