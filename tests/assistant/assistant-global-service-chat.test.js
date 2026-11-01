const fs = require('fs');
const path = require('path');

describe('BONDS global service assistant', () => {
  const layout = fs.readFileSync(path.join(process.cwd(), 'site-layout.js'), 'utf8');
  const widget = fs.readFileSync(path.join(process.cwd(), 'v3/components/ai-chat-widget.js'), 'utf8');
  const aiApi = fs.readFileSync(path.join(process.cwd(), 'v3/api/ai.js'), 'utf8');

  test('mounts the assistant globally from the shared site layout', () => {
    expect(layout).toContain('function ensureGlobalAssistantRuntime()');
    expect(layout).toMatch(/script\.src = '\/v3\/components\/ai-chat-widget\.js\?v=global-assistant-[0-9a-f]{10}';/);
    expect(layout).toContain("window.BondsAIChat.mount({");
    expect(layout).toContain("global: true");
    expect(layout).toContain("pagePath: window.location.pathname + window.location.hash");
    expect(layout).toContain("ensureGlobalAssistantRuntime();");
  });

  test('keeps WhatsApp as fallback but removes duplicate launcher after AI mount', () => {
    expect(layout).toContain("const whatsapp = document.getElementById('bonds-chat-launcher');");
    expect(layout).toContain('if (whatsapp) whatsapp.remove();');
  });

  test('chat is page-aware and loads verified service profile', () => {
    expect(widget).toContain("const SERVICE_DETAIL_API = '/api/v3/services/';");
    expect(widget).toContain("pagePath: options.pagePath || (window.location.pathname + window.location.hash)");
    expect(widget).toContain("const SERVICE_CATALOG_API = '/api/v3/services/catalog';");
    expect(widget).toContain('async function resolveServiceContextFromPage()');
    expect(widget).toContain('async function loadVerifiedServiceProfile()');
    expect(widget).toContain('updateContext(compactServiceProfile(data));');
    expect(widget).toContain("context.pagePath = (window.location.pathname + window.location.hash)");
  });

  test('service-aware greeting and suggestions are generated from verified service context', () => {
    expect(widget).toContain("} else if (context.serviceCode) {");
    expect(widget).toContain('ما متطلبات خدمة ${service}؟');
    expect(widget).toContain('ما البيانات أو المستندات الناقصة؟');
    expect(widget).toContain('ما القدرات والأدوات المتاحة لهذه الخدمة؟');
    expect(widget).toContain('طلب مراجعة بشرية');
    expect(widget).toContain("data-assistant-human-escalation=\"true\"");
    expect(widget).not.toContain('href="https://wa.me/966567566616');
  });

  test('server discards client capability arrays and reloads them from service tables', () => {
    expect(aiApi).toContain('delete enriched.serviceCapabilities;');
    expect(aiApi).toContain(".from('service_capability_map')");
    expect(aiApi).toContain(".from('service_requirements')");
    expect(aiApi).toContain(".from('service_deliverables')");
    expect(aiApi).toContain(".from('service_dependencies')");
    expect(aiApi).toContain('enriched.serviceCapabilities =');
  });

  test('server provides deterministic service answers before requiring native AI', () => {
    expect(aiApi).toContain('function generateServiceDrivenReply(userMessage, context)');
    expect(aiApi).toContain("msg.includes('متطلبات')");
    expect(aiApi).toContain("msg.includes('مخرجات')");
    expect(aiApi).toContain("msg.includes('قدرات')");
    expect(aiApi).toContain("msg.includes('الخطوة التالية')");
  });

  test('verified service execution context is supplied to native AI evidence', () => {
    expect(aiApi).toContain('serviceCapabilities: context?.serviceCapabilities?.length');
    expect(aiApi).toContain('serviceRequirements: context?.serviceRequirements?.length');
    expect(aiApi).toContain('serviceDeliverables: context?.serviceDeliverables?.length');
    expect(aiApi).toContain('serviceDependencies: context?.serviceDependencies?.length');
  });
});
