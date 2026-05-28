#!/usr/bin/env node
/**
 * Bonds Global — Stripe Products & Prices Setup Script
 * Usage: npm run setup:stripe
 *
 * Requires env var: STRIPE_SECRET_KEY
 * Creates: Bonds Pro ($19/mo) and Bonds Enterprise ($49/mo)
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Error: STRIPE_SECRET_KEY is required');
    console.error('   Get it from: Stripe Dashboard → Developers → API keys');
    process.exit(1);
  }

  console.log('🏦 Creating Stripe products and prices...\n');

  try {
    // Check if products already exist
    const existingProducts = await stripe.products.list({ limit: 100 });
    const existingNames = existingProducts.data.map(p => p.name);

    // Pro Plan
    let proProduct, proPrice;
    if (existingNames.includes('Bonds Pro')) {
      proProduct = existingProducts.data.find(p => p.name === 'Bonds Pro');
      console.log('⏭️  Product "Bonds Pro" already exists');
      const prices = await stripe.prices.list({ product: proProduct.id, limit: 1 });
      proPrice = prices.data[0];
    } else {
      proProduct = await stripe.products.create({
        name: 'Bonds Pro',
        description: 'Unlimited scenarios, PDF export, Health Score history, 22 countries',
      });
      proPrice = await stripe.prices.create({
        product: proProduct.id,
        unit_amount: 1900, // $19.00 in cents
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      console.log(`✅ Created "Bonds Pro" — Price ID: ${proPrice.id}`);
    }

    // Enterprise Plan
    let entProduct, entPrice;
    if (existingNames.includes('Bonds Enterprise')) {
      entProduct = existingProducts.data.find(p => p.name === 'Bonds Enterprise');
      console.log('⏭️  Product "Bonds Enterprise" already exists');
      const prices = await stripe.prices.list({ product: entProduct.id, limit: 1 });
      entPrice = prices.data[0];
    } else {
      entProduct = await stripe.products.create({
        name: 'Bonds Enterprise',
        description: 'Everything in Pro + Otter/Deliverect webhooks, Email Parser, priority support, multiple accounts',
      });
      entPrice = await stripe.prices.create({
        product: entProduct.id,
        unit_amount: 4900, // $49.00 in cents
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      console.log(`✅ Created "Bonds Enterprise" — Price ID: ${entPrice.id}`);
    }

    console.log('\n📋 Copy these values to your Vercel Environment Variables:');
    console.log('   STRIPE_PRICE_PRO=' + proPrice.id);
    console.log('   STRIPE_PRICE_ENTERPRISE=' + entPrice.id);
    console.log('\n📋 Next steps:');
    console.log('   1. Go to Stripe Dashboard → Developers → Webhooks');
    console.log('   2. Add endpoint: https://your-site.vercel.app/api/webhook');
    console.log('   3. Select events: checkout.session.completed, invoice.payment_succeeded,');
    console.log('      invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted');

  } catch (err) {
    console.error('\n❌ Stripe error:', err.message);
    process.exit(1);
  }
}

main();
