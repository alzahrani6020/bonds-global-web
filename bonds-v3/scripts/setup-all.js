/**
 * Bonds V3 — One-command setup
 *
 * Reads keys from .env.local and:
 * 1. Sets Vercel environment variables
 * 2. Applies seeds to Supabase
 * 3. Redeploys Vercel
 * 4. Tests the API
 *
 * Usage:
 *   cd bonds-v3
 *   # Fill .env.local first
 *   node scripts/setup-all.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found. Create it first with your Supabase keys.');
  }

  const env = {};
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      env[key.trim()] = rest.join('=').trim();
    }
  }
  return env;
}

function runCommand(cmd, args, input = null) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const child = isWin
      ? spawn(cmd, args, { stdio: ['pipe', 'inherit', 'inherit'], shell: true })
      : spawn(cmd, args, { stdio: ['pipe', 'inherit', 'inherit'] });

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

async function setVercelEnv(name, value) {
  console.log(`Setting Vercel env: ${name}`);
  const args = ['vercel', 'env', 'add', name, 'production', '--force', '--yes'];
  if (name === 'SUPABASE_SERVICE_ROLE_KEY' || name === 'ADMIN_TOKEN') args.push('--sensitive');
  await runCommand('npx', args, value + '\n');
}

async function applySeeds(env) {
  console.log('Applying seeds to Supabase...');
  const { Client } = require('pg');
  const seedFile = path.join(__dirname, '..', 'supabase', 'seed', 'all-seeds.sql');
  const sql = fs.readFileSync(seedFile, 'utf8');

  const client = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('Seeds applied successfully');
}

async function main() {
  const env = loadEnvLocal();

  const required = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_DB_URL', 'ADMIN_TOKEN',
  'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_TAX_RATE_ID',
  'STRIPE_PRICE_PRO', 'STRIPE_PRICE_ENTERPRISE', 'STRIPE_WEBHOOK_SECRET'
];
  for (const key of required) {
    if (!env[key]) throw new Error(`Missing ${key} in .env.local`);
  }

  console.log('Starting Bonds V3 setup...\n');

  await setVercelEnv('SUPABASE_URL', env.SUPABASE_URL);
  await setVercelEnv('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL);
  await setVercelEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await setVercelEnv('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY);
  await setVercelEnv('ADMIN_TOKEN', env.ADMIN_TOKEN);

  await setVercelEnv('STRIPE_SECRET_KEY', env.STRIPE_SECRET_KEY);
  await setVercelEnv('STRIPE_PUBLISHABLE_KEY', env.STRIPE_PUBLISHABLE_KEY);
  await setVercelEnv('STRIPE_TAX_RATE_ID', env.STRIPE_TAX_RATE_ID);
  await setVercelEnv('STRIPE_PRICE_PRO', env.STRIPE_PRICE_PRO);
  await setVercelEnv('STRIPE_PRICE_ENTERPRISE', env.STRIPE_PRICE_ENTERPRISE);
  await setVercelEnv('STRIPE_WEBHOOK_SECRET', env.STRIPE_WEBHOOK_SECRET);

  await applySeeds(env);

  console.log('\nRedeploying Vercel...');
  await runCommand('npx', ['vercel', '--prod', '--yes']);

  console.log('\nTesting API...');
  await runCommand('node', [path.join(__dirname, 'test-api.js')]);

  console.log('\n✅ Setup complete!');
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
