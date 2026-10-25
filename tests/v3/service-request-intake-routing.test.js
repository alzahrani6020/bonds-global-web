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
});
