/**
 * Moyasar API helper
 * https://moyasar.com/docs/api
 */

const MOYASAR_API_URL = 'https://api.moyasar.com/v1/invoices';

function getCredentials() {
  const secretKey = process.env.MOYASAR_SECRET_KEY;
  if (!secretKey) throw new Error('MOYASAR_SECRET_KEY not configured');
  return Buffer.from(secretKey + ':').toString('base64');
}

async function moyasarRequest(method, body) {
  const res = await fetch(MOYASAR_API_URL + (method === 'GET' && body ? `/${body}` : ''), {
    method,
    headers: {
      'Authorization': 'Basic ' + getCredentials(),
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Moyasar ${method} failed`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function createInvoice({ amount, currency, description, callbackUrl, metadata, successUrl, backUrl }) {
  return moyasarRequest('POST', {
    amount,
    currency,
    description,
    callback_url: callbackUrl,
    metadata,
    success_url: successUrl,
    back_url: backUrl,
  });
}

async function getInvoice(id) {
  if (!id) throw new Error('Invoice id required');
  return moyasarRequest('GET', id);
}

function getTierAmount(tier) {
  if (tier === 'enterprise') return 212000; // 212 SAR in halalas
  if (tier === 'pro') return 82000;         // 82 SAR in halalas
  throw new Error('Invalid tier');
}

function getTierLabel(tier) {
  if (tier === 'enterprise') return 'Bonds Enterprise';
  if (tier === 'pro') return 'Bonds Pro';
  return 'Bonds Subscription';
}

module.exports = {
  createInvoice,
  getInvoice,
  getTierAmount,
  getTierLabel,
};
