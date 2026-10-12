const fs=require('fs');const path=require('path');const ROOT=path.join(__dirname,'../..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
describe('Admin architecture contract audit wiring',()=>{
 test('contract audit checks critical admin safety and performance invariants',()=>{
  const s=read('scripts/admin-contract-audit.js');
  expect(s).toContain('sensitive actions retain granular permission gates');
  expect(s).toContain('correlation ID contract present');
  expect(s).toContain('workflow cron retains explicit authorization checks');
  expect(s).toContain('static query limits bounded');
  expect(s).toContain('user merge remains dry-run/approval gated');
 });
 test('CI executes the admin contract audit',()=>{
  const pkg=JSON.parse(read('package.json'));const ci=read('.github/workflows/ci.yml');
  expect(pkg.scripts['audit:admin-contracts']).toBe('node scripts/admin-contract-audit.js');
  expect(ci).toContain('Run Admin Architecture Contract Audit');
  expect(ci).toContain('npm run audit:admin-contracts');
 });
});