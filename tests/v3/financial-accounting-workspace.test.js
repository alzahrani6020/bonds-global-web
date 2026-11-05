/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');

describe('financial accounting workspace contract',()=>{
  const ui=fs.readFileSync(path.join(process.cwd(),'components/service-request.js'),'utf8');
  const css=fs.readFileSync(path.join(process.cwd(),'components/service-workspace.css'),'utf8');

  test('canonical finance services render inside the unified workspace',()=>{
    for(const code of [
      'financial_statements',
      'income_statement',
      'statement_financial_position',
      'cash_flow_statement',
      'changes_in_equity',
      'planning_budgeting_forecasting'
    ]){
      expect(ui).toContain("'"+code+"'");
    }
    expect(ui).toContain('function renderFinancialWorkspaceShell()');
    expect(ui).toContain('financial-workspace-mode');
    expect(ui).toContain('financialWorkspaceHref');
    expect(ui).toContain('function renderFinancialExecution');
    expect(ui).toContain('function renderFinancialRows');
    expect(ui).toContain('function renderFinancialOperationalInputs');
    expect(ui).toContain('function hydrateAccountingEntities');
    expect(ui).toContain("'/api/v3/services/accounting/entities'");
    expect(ui).toContain('function collectPlanningBudgetValues');
  });

  test('accounting reports use typed operational inputs instead of numeric fallbacks',()=>{
    expect(ui).toContain('name="accounting_entity_id"');
    expect(ui).toContain('name="dimension_type"');
    expect(ui).toContain('type="date" name="from"');
    expect(ui).toContain('type="date" name="to"');
    expect(ui).toContain("if(isFinancialWorkspaceService())return false;");
  });

  test('financial workspace preserves the existing unified execution route',()=>{
    expect(ui).toContain("'/my-bonds/workspace/'");
    expect(ui).toContain("'/en/my-bonds/workspace/'");
    expect(ui).toContain('renderFinancialWorkspaceShell();');
  });

  test('workspace exposes finance navigation without inventing financial values',()=>{
    expect(ui).toContain('financial-workspace-tabs');
    expect(ui).toContain('planning_budgeting_forecasting');
    expect(ui).not.toContain('20,000,000');
    expect(ui).not.toContain('3,280,000');
  });

  test('financial workspace remains responsive',()=>{
    expect(css).toContain('.financial-workspace-tabs');
    expect(css).toContain('@media(max-width:700px)');
    expect(css).toContain('@media(max-width:430px)');
    expect(css).toContain('.financial-result-table');
    expect(css).toContain('.financial-result-kpis');
    expect(css).toContain('.financial-budget-row');
    expect(css).toContain('.financial-budget-builder');
  });
});
