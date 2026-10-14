'use strict';

const COMMERCIAL_CALCULATOR = 'commercial_funnel';
const COMMERCIAL_EVENTS = new Set([
  'pricing_checkout_intent','book_clicked','whatsapp_clicked',
  'stripe_checkout_created','moyasar_invoice_created','bank_transfer_requested','bank_transfer_activated',
  'contact_lead_created','subscription_started','subscription_payment_succeeded','subscription_activated',
  'oneoff_checkout_created','oneoff_fulfilled','pro_checkout_created'
]);
const PUBLIC_COMMERCIAL_EVENTS = new Set(['pricing_checkout_intent','book_clicked','whatsapp_clicked']);

function sanitizeProperties(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  for (const [key, value] of Object.entries(source).slice(0, 20)) {
    const safeKey = String(key).slice(0, 64);
    if (value == null || typeof value === 'number' || typeof value === 'boolean') out[safeKey] = value;
    else if (typeof value === 'string') out[safeKey] = value.slice(0, 256);
  }
  return out;
}
async function logCommercialEvent(supabase, event, options = {}) {
  if (!supabase || !COMMERCIAL_EVENTS.has(event)) return false;
  try {
    const { error } = await supabase.from('calculator_events').insert([{
      event, calculator: COMMERCIAL_CALCULATOR,
      country: options.country ? String(options.country).slice(0, 8) : null,
      lang: options.lang ? String(options.lang).slice(0, 8) : null,
      session_id: options.sessionId ? String(options.sessionId).slice(0, 64) : null,
      user_id: options.userId || null,
      action: options.action ? String(options.action).slice(0, 32) : null,
      properties: sanitizeProperties(options.properties),
      url: options.url ? String(options.url).slice(0, 512) : null,
      ip_hash: null
    }]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('[commercial-analytics] event insert failed:', event, error.message || error);
    return false;
  }
}
module.exports = { COMMERCIAL_CALCULATOR, COMMERCIAL_EVENTS, PUBLIC_COMMERCIAL_EVENTS, sanitizeProperties, logCommercialEvent };
