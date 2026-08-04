#!/usr/bin/env node
/**
 * Bonds Global — Full Stripe Setup Script
 * Usage: STRIPE_SECRET_KEY=sk_... node scripts/setup-stripe.js
 *
 * Creates:
 *   1. Saudi VAT 15% Tax Rate
 *   2. Bonds Pro product + price (SAR 71/mo)
 *   3. Bonds Enterprise product + price (SAR 184/mo)
 *   4. Webhook endpoint (production)
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_URL || 'https://bonds-global.com/api/webhook';

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error(" Error: STRIPE_SECRET_KEY is required");
    process.exit(1);
  }

  console.log(" Running full Stripe setup...\n");
  const outputs = {};

  // ── 1. Tax Rate (Saudi VAT 15%) ───────────────────────────────
  try {
    const existingTaxRates = await stripe.taxRates.list({ limit: 100 });
    const saVat = existingTaxRates.data.find(
      tr => tr.display_name === 'VAT' && tr.percentage === 15 && tr.jurisdiction === 'SA'
    );
    if (saVat) {
      console.log("⏭  Tax Rate already exists:", saVat.id);
      outputs.taxRateId = saVat.id;
    } else {
      const taxRate = await stripe.taxRates.create({
        display_name: 'VAT',
        description: 'Saudi Arabia VAT 15%',
        jurisdiction: 'SA',
        percentage: 15,
        inclusive: false,
      });
      console.log(` Tax Rate created: ${taxRate.id}`);
      outputs.taxRateId = taxRate.id;
    }
  } catch (err) {
    console.error(" Tax Rate error:", err.message);
  }

  // ── 2. Products & Prices ──────────────────────────────────────
  try {
    const existingProducts = await stripe.products.list({ limit: 100 });
    const existingNames = existingProducts.data.map(p => p.name);

    // Pro
    let proPrice;
    if (existingNames.includes('Bonds Pro')) {
      const pro = existingProducts.data.find(p => p.name === 'Bonds Pro');
      const prices = await stripe.prices.list({ product: pro.id, limit: 1 });
      proPrice = prices.data[0];
      console.log("⏭  Product \"Bonds Pro\" already exists — Price:", proPrice.id);
    } else {
      const pro = await stripe.products.create({
        name: 'Bonds Pro',
        description: 'Unlimited scenarios, PDF export, Health Score history, 22 countries',
      });
      proPrice = await stripe.prices.create({
        product: pro.id,
        unit_amount: 7100,
        currency: 'sar',
        recurring: { interval: 'month' },
      });
      console.log(` Bonds Pro created — Price: ${proPrice.id}`);
    }
    outputs.pricePro = proPrice.id;

    // Enterprise
    let entPrice;
    if (existingNames.includes('Bonds Enterprise')) {
      const ent = existingProducts.data.find(p => p.name === 'Bonds Enterprise');
      const prices = await stripe.prices.list({ product: ent.id, limit: 1 });
      entPrice = prices.data[0];
      console.log("⏭  Product \"Bonds Enterprise\" already exists — Price:", entPrice.id);
    } else {
      const ent = await stripe.products.create({
        name: 'Bonds Enterprise',
        description: 'Everything in Pro + webhooks, priority support',
      });
      entPrice = await stripe.prices.create({
        product: ent.id,
        unit_amount: 18400,
        currency: 'sar',
        recurring: { interval: 'month' },
      });
      console.log(` Bonds Enterprise created — Price: ${entPrice.id}`);
    }
    outputs.priceEnterprise = entPrice.id;
  } catch (err) {
    console.error(" Product/Price error:", err.message);
  }

  // ── 3. Webhook Endpoint ───────────────────────────────────────
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const existing = endpoints.data.find(wh => wh.url === WEBHOOK_URL);
    if (existing) {
      console.log("⏭  Webhook already exists:", existing.id);
      outputs.webhookSecret = existing.secret;
    } else {
      const wh = await stripe.webhookEndpoints.create({
        url: WEBHOOK_URL,
        enabled_events: [
          'checkout.session.completed',
          'invoice.payment_succeeded',
          'invoice.payment_failed',
          'customer.subscription.updated',
          'customer.subscription.deleted',
        ],
      });
      console.log(` Webhook created: ${wh.id}`);
      console.log(`   Secret: ${wh.secret}`);
      outputs.webhookSecret = wh.secret;
    }
  } catch (err) {
    console.error(" Webhook error:", err.message);
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n");
  console.log(" Add these to Vercel Environment Variables:");
  console.log("");
  if (outputs.taxRateId)     console.log(`STRIPE_TAX_RATE_ID=${outputs.taxRateId}`);
  if (outputs.pricePro)      console.log(`STRIPE_PRICE_PRO=${outputs.pricePro}`);
  if (outputs.priceEnterprise) console.log(`STRIPE_PRICE_ENTERPRISE=${outputs.priceEnterprise}`);
  if (outputs.webhookSecret) console.log(`STRIPE_WEBHOOK_SECRET=${outputs.webhookSecret}`);
  console.log("\n");
}

main();
