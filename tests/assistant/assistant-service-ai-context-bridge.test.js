const fs = require('fs');
const path = require('path');

describe('service to AI context bridge', () => {
  const discovery = fs.readFileSync(path.join(process.cwd(), 'components/service-discovery.js'), 'utf8');
  const widget = fs.readFileSync(path.join(process.cwd(), 'v3/components/ai-chat-widget.js'), 'utf8');
  const aiApi = fs.readFileSync(path.join(process.cwd(), 'v3/api/ai.js'), 'utf8');

  test('service discovery persists assistant context', () => {
    expect(discovery).toContain("sessionStorage.setItem('bonds_service_assistant_context_v1'");
    expect(discovery).toContain('serviceCode:intent.service_code');
    expect(discovery).toContain("source:'service_discovery'");
    expect(discovery).toContain('activityCode:intent.activity_code');
    expect(discovery).toContain('sectorCode:intent.sector_code');
  });

  test('chat widget consumes service context and isolates memory by service', () => {
    expect(widget).toContain("const SERVICE_ASSISTANT_CONTEXT_KEY = 'bonds_service_assistant_context_v1';");
    expect(widget).toContain('function readServiceAssistantContext()');
    expect(widget).toContain('serviceCode: typeof parsed.serviceCode');
    expect(widget).toContain('|service:${service}');
    expect(widget).toContain('return service ?');
  });

  test('AI API verifies service against published active service catalog', () => {
    expect(aiApi).toContain(".from('service_catalog')");
    expect(aiApi).toContain(".eq('code', requestedServiceCode)");
    expect(aiApi).toContain(".eq('status', 'published')");
    expect(aiApi).toContain(".eq('is_active', true)");
    expect(aiApi).toContain('enriched.serviceCode = service.code');
  });

  test('verified service context reaches AI prompt and response', () => {
    expect(aiApi).toContain('serviceCode: context?.serviceCode || undefined');
    expect(aiApi).toContain('serviceName: context?.serviceName || undefined');
    expect(aiApi).toContain('serviceDeliveryType: context?.serviceDeliveryType || undefined');
    expect(aiApi).toContain('serviceCode: enrichedContext.serviceCode || null');
    expect(aiApi).toContain('serviceName: enrichedContext.serviceName || null');
  });

  test('legacy boundary remains compatible when service is absent', () => {
    expect(widget).toContain('return service ?');
    expect(aiApi).toContain('const expectedAssistantBoundary = serviceBoundary ?');
  });
});
