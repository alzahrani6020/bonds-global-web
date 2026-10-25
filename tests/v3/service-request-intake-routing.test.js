/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('service request intake routing', () => {
  let ui;
  let api;

  beforeAll(() => {
    ui = fs.readFileSync(path.join(process.cwd(), 'components/service-request.js'), 'utf8');
    api = fs.readFileSync(path.join(process.cwd(), 'v3/api/services.js'), 'utf8');
  });

  test('service detail exposes intake support independently from execution capabilities', () => {
    expect(api).toContain("intakeRequirements.supported === true");
    expect(api).toContain("execution_mode: resolved.profile.execution_mode || 'request_only'");
    expect(api).toContain("requirement_fields: intakeRequirements.requirement_fields || []");
  });

  test('request page renders intake when the service supports intake even without capabilities', () => {
    expect(ui).toContain("if(detail?.intake?.supported===true)return true");
    expect(ui).toContain("detail?.intake?.execution_mode==='request_only'");
  });

  test('request-only intake creates a service request tied to the approved dataset', () => {
    expect(ui).toContain("metadata:{financial_dataset_id:intakeDatasetId,intake_mode:intakeMode}");
    expect(ui).toContain("const d=await json('/api/v3/services/requests'");
    expect(ui).toContain("if(isRequestOnlyIntakeService())");
  });

  test('automated intake still uses the governed execution endpoint', () => {
    expect(ui).toContain("fetch('/api/v3/services/execute'");
    expect(ui).toContain("dataset_id:intakeDatasetId");
  });

  test('central request profiles cover request-only service families', () => {
    expect(api).toContain("accounting_records: 'accounting'");
    expect(api).toContain("financial_statements_reporting: 'reporting'");
    expect(api).toContain("audit_opinion: 'audit'");
    expect(api).toContain("planning_cashflow: 'planning'");
    expect(api).toContain("core_financial_analysis: 'analysis'");
    expect(api).toContain("risk_resilience: 'risk'");
    expect(api).toContain("zakat_services: 'tax'");
    expect(api).toContain("vat_services: 'tax'");
    expect(api).toContain("tax_audit_disputes: 'tax'");
    expect(api).toContain("business_market: 'consulting'");
  });

  test('service detail returns a request profile only when no specific request content exists', () => {
    expect(api).toContain("const requestProfile = (!form && procedures.length===0 && requirements.length===0 && (delRes.data||[]).length===0)");
    expect(api).toContain("request_profile:requestProfile");
  });

  test('request UI renders the central request profile instead of the generic empty form', () => {
    expect(ui).toContain("function renderRequestProfile()");
    expect(ui).toContain("if(!form?.fields?.length)renderRequestProfile()");
    expect(ui).toContain("profile.requirements_ar");
    expect(ui).toContain("profile.procedures_ar");
    expect(ui).toContain("profile.deliverables_ar");
  });

});
