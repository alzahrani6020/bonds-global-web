import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

let cachedWebhookSecret = null;
let cachedWebhookSecretAt = 0;
const WEBHOOK_SECRET_TTL_MS = 5 * 60 * 1000;

function json(status, body) {
  return Response.json(body, { status });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function getWebhookSecret(resend, requestUrl) {
  if (process.env.RESEND_WEBHOOK_SECRET) return process.env.RESEND_WEBHOOK_SECRET;

  const now = Date.now();
  if (cachedWebhookSecret && now - cachedWebhookSecretAt < WEBHOOK_SECRET_TTL_MS) {
    return cachedWebhookSecret;
  }

  const { data, error } = await resend.webhooks.list();
  if (error) throw new Error('Unable to load Resend webhook configuration');

  const entries = Array.isArray(data) ? data : (data?.data || []);
  const request = new URL(requestUrl);
  const webhook = entries.find((item) => {
    try {
      const endpoint = new URL(item.endpoint);
      return endpoint.hostname === request.hostname
        && endpoint.pathname.replace(/\/$/, '') === '/api/email-webhook';
    } catch {
      return false;
    }
  });

  if (!webhook?.signing_secret) {
    throw new Error('Resend webhook signing secret is unavailable');
  }

  cachedWebhookSecret = webhook.signing_secret;
  cachedWebhookSecretAt = now;
  return cachedWebhookSecret;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return json(503, { error: 'Email provider is not configured' });

    const rawPayload = await request.text();
    const resend = new Resend(apiKey);

    let event;
    try {
      const webhookSecret = await getWebhookSecret(resend, request.url);
      event = resend.webhooks.verify({
        payload: rawPayload,
        headers: {
          id: request.headers.get('svix-id'),
          timestamp: request.headers.get('svix-timestamp'),
          signature: request.headers.get('svix-signature')
        },
        webhookSecret
      });
    } catch (err) {
      console.warn('[email-webhook] rejected:', err.message);
      return json(401, { error: 'Invalid webhook signature' });
    }

    const type = event?.type || '';
    const recipient = Array.isArray(event?.data?.to)
      ? event.data.to[0]
      : (event?.data?.to || event?.data?.email || null);

    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return json(200, { success: true, ignored: true });
    }

    const email = String(recipient).toLowerCase().trim();
    const now = new Date().toISOString();
    const supabase = getSupabase();

    if (type === 'email.bounced' || type === 'email.delivery_failed') {
      const { error } = await supabase.from('calculator_leads')
        .update({ bounced_at: now })
        .eq('email', email);
      if (error) throw error;
    } else if (type === 'email.complained') {
      const { error } = await supabase.from('calculator_leads')
        .update({ complained_at: now })
        .eq('email', email);
      if (error) throw error;
    } else {
      return json(200, { success: true, ignored: true, type });
    }

    return json(200, { success: true });
  }
};
