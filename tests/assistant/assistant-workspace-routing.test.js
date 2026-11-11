/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const {
  WORKSPACE_TYPES,
  normalizeServiceCode,
  serviceWorkspaceRoute,
  routeForWorkspace,
  resolveServiceWorkspace
} = require('../../lib/services/service-workspace-resolver');
const {
  resolveNavigation,
  planRegisteredAction
} = require('../../lib/assistant/protocol');
const {
  parseWorkspaceOpen,
  resolveDeterministicTool,
  navigationActionFromExecution
} = require('../../lib/assistant/deterministic-tools');

describe('assistant governed workspace routing', () => {
  test('builds service-scoped workspace routes from validated service codes', () => {
    expect(normalizeServiceCode('financial_statements')).toBe('financial_statements');
    expect(normalizeServiceCode('../financial_statements')).toBe('');
    expect(serviceWorkspaceRoute('financial_statements','ar'))
      .toBe('/my-bonds/workspace/?service=financial_statements');
    expect(serviceWorkspaceRoute('financial_statements','en'))
      .toBe('/en/my-bonds/workspace/?service=financial_statements');
    expect(routeForWorkspace(WORKSPACE_TYPES.ACCOUNTING,'ar','financial_statements'))
      .toBe('/my-bonds/workspace/?service=financial_statements');
  });

  test('resolved execute workspaces carry their service code in both locales', () => {
    const workspace = resolveServiceWorkspace({
      code:'financial_statements',
      group_code:'financial_statements_reporting',
      category_code:'financial_advisory'
    }, {
      execution_mode:'capability_plan',
      execution_status:'ready',
      primary_action:'financial_analysis_run'
    });
    expect(workspace.mode).toBe('execute');
    expect(workspace.route_ar).toBe('/my-bonds/workspace/?service=financial_statements');
    expect(workspace.route_en).toBe('/en/my-bonds/workspace/?service=financial_statements');
  });

  test('generic workspace navigation opens the hub, never an unbound service workspace', () => {
    expect(parseWorkspaceOpen('افتح مساحة العمل')).toEqual({target:'my_bonds'});
    expect(parseWorkspaceOpen('open service workspace')).toEqual({target:'my_bonds'});
    expect(resolveNavigation('my_bonds','ar').route).toBe('/my-bonds/');
    expect(resolveNavigation('service_workspace','ar')).toBeNull();
  });

  test('service-specific workspace navigation is registered and URL-free in the action', () => {
    expect(parseWorkspaceOpen('افتح مساحة القوائم المالية')).toEqual({
      target:'service_workspace',
      service_code:'financial_statements'
    });
    expect(resolveDeterministicTool('افتح مساحة دراسة الجدوى')).toEqual({
      action:'site_navigate',
      input:{target:'service_workspace',service_code:'feasibility_studies'}
    });
    expect(resolveNavigation('service_workspace','ar',{serviceCode:'financial_statements'})).toMatchObject({
      key:'service_workspace',
      route:'/my-bonds/workspace/?service=financial_statements',
      service_code:'financial_statements'
    });
    expect(resolveNavigation('service_workspace','ar',{serviceCode:'../../admin'})).toBeNull();

    const plan = planRegisteredAction({
      type:'site_navigate',
      target:'service_workspace',
      service_code:'financial_statements',
      language:'ar'
    });
    expect(plan.status).toBe('ready');
    expect(plan.actions[0]).toMatchObject({
      type:'site_navigate',
      target:'service_workspace',
      input:{service_code:'financial_statements'}
    });
    expect(plan.actions[0].input.url).toBeUndefined();
    expect(plan.context.navigation.route)
      .toBe('/my-bonds/workspace/?service=financial_statements');
  });

  test('navigation action preserves service identity without changing legacy actions', () => {
    expect(navigationActionFromExecution({
      ok:true,
      result:{
        target:'service_workspace',
        route:'/my-bonds/workspace/?service=financial_statements',
        service_code:'financial_statements'
      }
    })).toEqual({
      type:'site_navigate',
      capability:'site_navigate',
      target:'service_workspace',
      input:{service_code:'financial_statements'},
      risk:'low'
    });

    expect(navigationActionFromExecution({
      ok:true,
      result:{navigation:{target:'calculator_loan',route:'/calculators/loan'}}
    })).toEqual({
      type:'site_navigate',
      capability:'site_navigate',
      target:'calculator_loan',
      risk:'low'
    });
  });

  test('runtime and assistant plan validate workspace navigation without arbitrary route fields', () => {
    const runtime = fs.readFileSync(path.join(process.cwd(),'lib/capabilities/runtime-adapters.js'),'utf8');
    const assistant = fs.readFileSync(path.join(process.cwd(),'v3/api/assistant.js'),'utf8');
    expect(runtime).toContain('{ serviceCode: input.service_code }');
    expect(runtime).toContain('service_code: navigation.service_code || null');
    expect(runtime).not.toContain('route: input.route');
    expect(runtime).not.toContain('url: input.url');

    expect(assistant).toContain("body.type === 'site_navigate' && body.target === 'service_workspace'");
    expect(assistant).toContain(".from('service_catalog')");
    expect(assistant).toContain(".eq('status', 'published')");
    expect(assistant).toContain(".eq('is_active', true)");
    expect(assistant).toContain(".from('service_execution_profiles')");
    expect(assistant).toContain("workspace?.mode !== 'execute'");
    expect(assistant).toContain("context:{ code:'SERVICE_WORKSPACE_NOT_AVAILABLE' }");
  });
});
