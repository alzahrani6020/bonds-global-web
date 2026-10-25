'use strict';
const fs=require('fs');const path=require('path');const SOURCE=fs.readFileSync(path.join(__dirname,'../../admin/finance.html'),'utf8');
describe('finance accounting entity workspace UI',()=>{
test('uses governed entity API and never writes accounting tables directly',()=>{expect(SOURCE).toContain('/api/v3/services/accounting/entities');expect(SOURCE).toContain('window.BondsAuth.authenticatedFetch');expect(SOURCE).not.toMatch(/from\(['"]accounting_entities['"]\)/);expect(SOURCE).not.toMatch(/from\(['"]accounting_entity_members['"]\)/)});
test('requires an accounting entity context for workspace reads',()=>{expect(SOURCE).toContain('id="entitySelect"');expect(SOURCE).toContain('accounting_entity_id:entityId');expect(SOURCE).toContain('async function loadWorkspace()')});
test('refund submission is locked and carries stable request identity',()=>{expect(SOURCE).toContain('refundInFlight');expect(SOURCE).toContain('refundRequestKey');expect(SOURCE).toContain('refundSubmit.disabled=true');expect(SOURCE).toContain('refundSubmit.disabled=false')});
});