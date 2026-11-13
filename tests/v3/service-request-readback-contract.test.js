/** @jest-environment node */
'use strict';
const fs = require('fs');
const path = require('path');
const read = name => fs.readFileSync(path.join(process.cwd(), name), 'utf8');

describe('service request persistence and readback contracts', () => {
  const api = read('v3/api/services.js');
  const client = read('components/service-request.js');

  test('GET resolves exact request reference after authenticated owner filtering', () => {
    const start = api.indexOf('async function handleServiceRequests(');
    const end = api.indexOf('function defaultRequestProfileForService(', start);
    const handler = api.slice(start, end);
    expect(handler).toContain("if (!user) return sendJson(res, 401");
    expect(handler).toContain(".eq('user_id', user.id)");
    expect(handler).toContain("query.eq('request_reference', reference).limit(1)");
    expect(handler).toContain(".eq('service_request_id', requests[0].id)");
    expect(handler).toContain("...(reference ? { values: savedValues } : {})");
    expect(handler).toContain("if (valuesError) return sendJson(res, 500");
  });

  test('client does not report success until server-side readback matches sent inputs', () => {
    expect(client).toContain('async function confirmServiceRequestReadback(reference,expected,headers)');
    expect(client).toContain("result.requests[0].request_reference!==reference");
    expect(client).toContain('Object.prototype.hasOwnProperty.call(saved,key)');
    expect(client).toContain('JSON.stringify(saved[key])===JSON.stringify(expected[key])');
    expect(client).toContain('if(verified){\n  clearWorkspaceDraft();\n  showStatus(T.sent+');
    expect(client).toContain('await finalizeServiceRequestCreation(d,requestBody.values,headers');
    expect(client).toContain('await finalizeServiceRequestCreation(d,values,headers)');
  });

  test('service discovery preserves vetted workflow context during workspace routing', () => {
    const discovery = read('components/service-discovery.js');
    for (const key of ['project_id','deal_id','opportunity_id','company_id','client_id','funding_case_id','request_id','return_to']) {
      expect(discovery).toContain("'"+key+"'");
    }
    expect(discovery).toContain("const incoming = new URLSearchParams(window.location.search)");
    expect(discovery).toContain("params.set(key, value)");
    expect(discovery).toContain("routeWithParams(directRoute,params)");
  });

  test('both language and workspace routes use the same cache-busted client', () => {
    for (const route of ['service-request.html','en/service-request.html','my-bonds/workspace/index.html','en/my-bonds/workspace/index.html']) {
      expect(read(route)).toContain('/components/service-request.js?v=19');
    }
    expect(read('sw.js')).toContain("'/components/service-request.js?v=19'");
  });
});
