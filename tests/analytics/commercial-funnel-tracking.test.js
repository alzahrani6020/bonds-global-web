const fs = require('fs');
const path = require('path');
function read(rel){ return fs.readFileSync(path.join(__dirname,'..','..',rel),'utf8'); }

describe('commercial funnel analytics', () => {
  test('uses dedicated commercial namespace', () => {
    expect(read('lib/analytics/commercial-events.js')).toContain("COMMERCIAL_CALCULATOR = 'commercial_funnel'");
    const platform=read('api/platform.js');
    expect(platform).toContain("row.calculator !== COMMERCIAL_CALCULATOR");
    expect(platform).toContain('commercialEvents');
  });
  test('browser events are allowlisted and bounded', () => {
    const platform=read('api/platform.js');
    expect(platform).toContain('PUBLIC_COMMERCIAL_EVENTS.has(event)');
    expect(platform).toContain('propertySize > 2048');
    const tracker=read('page-tracker-v2.js');
    expect(tracker).toContain('window.BondsCommercialAnalytics');
    expect(tracker).toContain("'book_clicked'");
    expect(tracker).toContain("'whatsapp_clicked'");
  });
  test('pricing tracks checkout intent in both languages', () => {
    expect(read('pricing.html')).toContain('pricing_checkout_intent');
    expect(read('en/pricing.html')).toContain('pricing_checkout_intent');
  });
  test('server milestones cover all commercial channels', () => {
    const payments=read('api/payments.js');
    ['stripe_checkout_created','subscription_started','subscription_payment_succeeded','subscription_activated','oneoff_checkout_created','oneoff_fulfilled','moyasar_invoice_created'].forEach(e=>expect(payments).toContain(e));
    expect(read('api/platform.js')).toContain('contact_lead_created');
    expect(read('api/platform.js')).toContain('pro_checkout_created');
    expect(read('api/funding.js')).toContain('bank_transfer_requested');
    expect(read('api/admin.js')).toContain('bank_transfer_activated');
  });
  test('Stripe retries do not reset processed webhooks', () => {
    const payments=read('api/payments.js');
    expect(payments).toContain('existingWebhook?.processed');
    expect(payments).toContain('duplicate: true');
  });
  test('dashboard renders commercial metrics', () => {
    const dashboard=read('admin/conversion-dashboard.html');
    ['cIntent','cCheckout','cStarted','cPaid','cContact','cBook','cBank','cOneoff'].forEach(id=>expect(dashboard).toContain('id="'+id+'"'));
    expect(dashboard).toContain('json.commercial');
  });
  test('tracker bypasses stale static caching in service worker and Vercel', () => {
    const sw = read('sw.js');
    const vercel = read('vercel.json');
    expect(sw).toContain("const CACHE_VERSION = 'v3.0.140'");
    expect(sw).toContain("url.pathname === '/page-tracker-v2.js'");
    expect(sw).toContain('networkFirst(request)');
    expect(vercel).toContain('"/page-tracker-v2.js"');
    expect(vercel).toContain('"no-cache, no-store, must-revalidate"');
  });
});
