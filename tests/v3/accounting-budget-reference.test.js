/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');

describe('accounting budget reference endpoint contract',()=>{
  const api=fs.readFileSync(path.join(process.cwd(),'v3/api/services.js'),'utf8');
  const ui=fs.readFileSync(path.join(process.cwd(),'components/service-request.js'),'utf8');

  test('reference endpoint is authenticated and scoped through user accounting entities',()=>{
    expect(api).toContain('async function handleAccountingBudgetReference');
    expect(api).toContain("if (!user) return sendJson(res, 401");
    expect(api).toContain('service.listForUser(user.id)');
    expect(api).toContain("ACCOUNTING_ENTITY_ACCESS_DENIED");
    expect(api).toContain("'/services/accounting/budget-reference'");
  });

  test('reference endpoint exposes canonical periods accounts dimensions and policies',()=>{
    expect(api).toContain("from('accounting_periods')");
    expect(api).toContain("from('accounting_accounts')");
    expect(api).toContain("from('accounting_dimensions')");
    expect(api).toContain("from('accounting_account_dimension_policies')");
    expect(api).toContain("eq('is_postable', true)");
  });

  test('workspace calls governed budget capabilities instead of direct database writes',()=>{
    for(const action of [
      'accounting_budget_plan_create',
      'accounting_budget_draft_save',
      'accounting_budget_version_transition',
      'accounting_budget_analysis'
    ]) expect(ui).toContain(action);
    expect(ui).toContain("'/api/v3/capabilities/execute'");
    expect(ui).toContain("'/api/v3/services/accounting/budget-reference?accounting_entity_id='");
  });

  test('governed budget lines use canonical ids and enforce required dimensions',()=>{
    expect(ui).toContain('period_id,account_id,amount:Number(amountRaw),dimensions');
    expect(ui).toContain('dimension_policies');
    expect(ui).toContain('Required dimension missing');
  });
});
