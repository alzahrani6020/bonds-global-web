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
  test('company workspace UI has eleven read-only scoped program actions and no SCC token exposure',()=>{
    const fs=require('fs');
    const path=require('path');
    const html=fs.readFileSync(path.join(__dirname,'../../my-bonds/company-programs/index.html'),'utf8');
    const ui=fs.readFileSync(path.join(__dirname,'../../my-bonds/company-programs/app.js'),'utf8');
    const ops=require('../../lib/company-programs/makkin-read-operations').MAKKIN_READ_OPERATIONS;
    expect(html).toContain('id="workspace"');
    expect(html).toContain('id="programs"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('/my-bonds/company-programs/app.js');
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(ui).toContain('window.BondsAuth.authenticatedFetch');
    expect(ui).toContain('program-read');
    expect(ui).toContain("card.append(h,badge,note,button)");
    expect(ui).toContain("button.disabled=!program.entitled");
    expect(ui).toContain("result').textContent");
    expect(ui).not.toContain('BONDS_MAKKIN_SIGNING_PRIVATE_KEY');
    expect(ui).not.toContain('scc380-api.onrender.com');
    expect(ui).not.toContain('program-write');
    expect(ui).not.toMatch(/innerHTML\s*=/);
    expect(()=>new Function(ui)).not.toThrow();
    for(const program of PROGRAMS){
      const lines=ui.split('\n').filter(line=>line.trim().startsWith(program.key+':'));
      expect(lines).toHaveLength(1);
      const operationKey=lines[0].split("'")[1];
      expect(ops[operationKey]?.program).toBe(program.key);
    }
  });
  test('company programs API permits only vetted mapping, audited reads and staged writes',()=>{
    const fs=require('fs');
    const api=fs.readFileSync(require('path').join(__dirname,'../../lib/api/company-programs.js'),'utf8');
    expect(api).toContain("if(!['GET','POST'].includes(req.method))");
    expect(api).toContain("['probe-mapping','session-check','program-read','program-write'].includes(req.query?.action)");
    expect(api).toContain('VERIFIED_EMAIL_REQUIRED');
    expect(api).toContain('PROGRAM_ENTITLEMENT_REQUIRED');
    expect(api).toContain('operationalReady:false');
    expect(api).toContain('verifyBearer(req)');
    expect(api).toContain(".eq('owner_user_id',user.id)");
    expect(api).toContain(".eq('member_user_id',user.id)");
    expect(api).toContain(".eq('active',true)");
    expect(api).toContain("runtimeIntegration:'not_verified'");
    expect(api).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });
});
