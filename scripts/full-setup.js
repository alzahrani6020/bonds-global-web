#!/usr/bin/env node
/**
 * Bonds Global — Full SaaS Setup Automation
 * ==========================================
 * This script automates the complete setup after you create accounts:
 * 1. Adds all environment variables to Vercel
 * 2. Executes Supabase SQL schema
 * 3. Creates Stripe products & prices
 * 4. Prints webhook endpoint to register
 *
 * Usage:
 *   node scripts/full-setup.js
 *
 * Prerequisites:
 *   - Vercel CLI authenticated (vercel whoami)
 *   - Supabase project created at https://supabase.com
 *   - Stripe account created at https://stripe.com
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const VERCEL_PROJECT = 'bonds-global-web';
const APP_URL = 'https://bonds-global.vercel.app';

function vercelEnvAdd(key, value, target = 'production') {
  try {
    execSync(`echo "${value}" | vercel env add ${key} ${target} --yes 2>&1`, {
      stdio: 'pipe',
      cwd: path.resolve(__dirname, '..')
    });
    console.log(`  ✅ ${key}`);
  } catch (e) {
    const stderr = e.stderr?.toString() || e.stdout?.toString() || '';
    if (stderr.includes('already exists')) {
      console.log(`  ⚠️  ${key} already exists`);
    } else {
      console.log(`  ❌ ${key} — ${stderr}`);
    }
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Bonds Global — Full SaaS Setup Automation              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ─── Step 0: Verify Vercel auth ───
  try {
    execSync('vercel whoami', { stdio: 'pipe' });
  } catch {
    console.error('❌ Vercel CLI not authenticated. Run: vercel login');
    process.exit(1);
  }

  // ─── Step 1: Collect credentials ───
  console.log('📋 Enter your credentials (paste values and press Enter):\n');

  const supabaseUrl = (await ask('Supabase Project URL   (https://xxx.supabase.co): ')).trim();
  const supabaseAnon = (await ask('Supabase Anon Key      (eyJ...): ')).trim();
  const supabaseService = (await ask('Supabase Service Role  (eyJ...): ')).trim();
  const stripeSecret = (await ask('Stripe Secret Key      (sk_test_... or sk_live_...): ')).trim();
  const stripePublishable = (await ask('Stripe Publishable Key (pk_test_... or pk_live_...): ')).trim();

  if (!supabaseUrl || !supabaseAnon || !supabaseService || !stripeSecret || !stripePublishable) {
    console.error('\n❌ All credentials are required. Exiting.');
    process.exit(1);
  }

  // ─── Step 2: Add env vars to Vercel ───
  console.log('\n📡 Adding environment variables to Vercel...');
  vercelEnvAdd('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl);
  vercelEnvAdd('NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseAnon);
  vercelEnvAdd('SUPABASE_SERVICE_ROLE_KEY', supabaseService);
  vercelEnvAdd('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', stripePublishable);
  vercelEnvAdd('STRIPE_SECRET_KEY', stripeSecret);
  vercelEnvAdd('NEXT_PUBLIC_APP_URL', APP_URL);

  // ─── Step 3: Setup Supabase schema ───
  console.log('\n🗄️  Executing Supabase SQL schema...');
  const schemaPath = path.resolve(__dirname, '..', 'templates', 'supabase-schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.log('  ❌ Schema file not found: templates/supabase-schema.sql');
  } else {
    try {
      // Extract project ref from URL
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (!projectRef) {
        console.log('  ❌ Could not extract project ref from URL');
      } else {
        // Use supabase CLI to link and push, or use direct PostgreSQL connection
        // Try using pg connection string if available
        const dbPassword = await ask('Supabase Database Password (for direct connection): ');
        if (dbPassword) {
          const dbUrl = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
          const { Client } = require('pg');
          const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
          await client.connect();
          const sql = fs.readFileSync(schemaPath, 'utf8');
          await client.query(sql);
          await client.end();
          console.log('  ✅ Schema executed successfully');
        } else {
          console.log('  ⚠️  Skipped schema execution. Run manually in Supabase SQL Editor.');
        }
      }
    } catch (e) {
      console.log(`  ❌ Schema execution failed: ${e.message}`);
      console.log('     Run manually: Open Supabase Dashboard → SQL Editor → paste templates/supabase-schema.sql');
    }
  }

  // ─── Step 4: Setup Stripe products ───
  console.log('\n💳 Creating Stripe products & prices...');
  try {
    const stripe = require('stripe')(stripeSecret);

    // Pro Plan
    const proProduct = await stripe.products.create({
      name: 'Bonds Global Pro',
      description: 'Unlimited scenarios, cloud save, PDF export, health score history'
    });
    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 1900, // $19.00
      currency: 'usd',
      recurring: { interval: 'month' }
    });
    console.log(`  ✅ Pro Plan     — Price ID: ${proPrice.id}`);

    // Enterprise Plan
    const entProduct = await stripe.products.create({
      name: 'Bonds Global Enterprise',
      description: 'Everything in Pro + team features, priority support, API access'
    });
    const entPrice = await stripe.prices.create({
      product: entProduct.id,
      unit_amount: 4900, // $49.00
      currency: 'usd',
      recurring: { interval: 'month' }
    });
    console.log(`  ✅ Enterprise   — Price ID: ${entPrice.id}`);

    // Add price IDs to Vercel
    vercelEnvAdd('STRIPE_PRICE_PRO', proPrice.id);
    vercelEnvAdd('STRIPE_PRICE_ENTERPRISE', entPrice.id);

    // ─── Step 5: Register webhook ───
    console.log('\n🔗 Stripe Webhook Setup:');
    const webhookUrl = `${APP_URL}/api/webhook`;
    console.log(`   Endpoint URL: ${webhookUrl}`);
    console.log(`   Events to select:`);
    console.log(`     • checkout.session.completed`);
    console.log(`     • invoice.payment_succeeded`);
    console.log(`     • invoice.payment_failed`);
    console.log(`     • customer.subscription.updated`);
    console.log(`     • customer.subscription.deleted`);
    console.log(`\n   👉 Go to https://dashboard.stripe.com/webhooks → Add endpoint → paste above URL`);
    console.log(`   👉 After creating, copy the Signing secret (whsec_...) and run:`);
    console.log(`      echo "whsec_..." | vercel env add STRIPE_WEBHOOK_SECRET production`);

  } catch (e) {
    console.log(`  ❌ Stripe setup failed: ${e.message}`);
  }

  // ─── Step 6: Redeploy ───
  console.log('\n🚀 Triggering production redeploy...');
  try {
    execSync('vercel --prod --yes', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
  } catch {
    console.log('  ⚠️  Redeploy may have failed. Run manually: vercel --prod');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Setup complete! Check your Vercel Dashboard for status.');
  console.log('═══════════════════════════════════════════════════════════\n');

  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
