/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('customer service request tracking', () => {
  let api;
  let ar;
  let en;

  beforeAll(() => {
    api = fs.readFileSync(path.join(process.cwd(), 'v3/api/services.js'), 'utf8');
    ar = fs.readFileSync(path.join(process.cwd(), 'my-bonds/index.html'), 'utf8');
    en = fs.readFileSync(path.join(process.cwd(), 'en/my-bonds/index.html'), 'utf8');
  });

  test('service requests endpoint supports user-scoped GET only after authentication', () => {
    expect(api).toContain("async function handleServiceRequests(req, res, supabase, user)");
    expect(api).toContain("if (!user) return sendJson(res, 401, { error: 'Unauthorized' })");
    expect(api).toContain(".eq('user_id', user.id)");
    expect(api).toContain("if (req.method === 'GET')");
  });

  test('customer response excludes CRM and internal workflow linkage fields', () => {
    const start = api.indexOf("const safeRequests = (requests || []).map(row => ({");
    const end = api.indexOf("return sendJson(res, 200", start);
    const safeBlock = api.slice(start, end);
    expect(safeBlock).toContain('request_reference');
    expect(safeBlock).toContain('status');
    expect(safeBlock).toContain('service: serviceMap.get');
    expect(safeBlock).not.toContain('crm_opportunity_id');
    expect(safeBlock).not.toContain('funding_case_id');
    expect(safeBlock).not.toContain('workflow_entity_id');
    expect(safeBlock).not.toContain('user_id');
  });

  test('Arabic My Bonds loads and renders service requests', () => {
    expect(ar).toContain('id="serviceRequestsSection"');
    expect(ar).toContain("apiFetch('/api/v3/services/requests'");
    expect(ar).toContain('طلبات الخدمات');
    expect(ar).toContain('رقم المرجع:');
  });

  test('English My Bonds loads and renders service requests', () => {
    expect(en).toContain('id="serviceRequestsSection"');
    expect(en).toContain("apiFetch('/api/v3/services/requests'");
    expect(en).toContain('Service Requests');
    expect(en).toContain('Reference:');
  });
});
