/**
 * Create Stripe webhook endpoint and update Vercel env.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const stripe = require('stripe');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
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
  const args = ['vercel', 'env', 'add', name, 'production', '--force', '--yes', '--sensitive'];
  await runCommand('npx', args, value + '\n');
}

async function updateEnvLocal(name, value) {
  const envPath = path.join(__dirname, '..', '.env.local');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const lines = content.split('\n');
  let found = false;
  const newLines = lines.map(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const [k] = t.split('=');
    if (k && k.trim() === name) {
      found = true;
      return `${name}=${value}`;
    }
    return line;
  });
  if (!found) newLines.push(`${name}=${value}`);
  fs.writeFileSync(envPath, newLines.join('\n') + '\n');
}

async function main() {
  const env = loadEnvLocal();
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY missing');

  const stripeClient = stripe(env.STRIPE_SECRET_KEY);
  const url = 'https://bonds-v3.vercel.app/api/billing/webhook';

  console.log('Creating Stripe webhook endpoint...');
  const endpoint = await stripeClient.webhookEndpoints.create({
    url,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted'
    ],
    description: 'Bonds V3 Subscriptions'
  });

  const secret = endpoint.secret;
  console.log('Webhook created:', endpoint.id);

  await updateEnvLocal('STRIPE_WEBHOOK_SECRET', secret);
  await setVercelEnv('STRIPE_WEBHOOK_SECRET', secret);

  console.log('Redeploying Vercel...');
  await runCommand('npx', ['vercel', '--prod', '--yes']);

  console.log("\n Stripe webhook setup complete");
}

main().catch(err => {
  console.error("\n Failed:", err.message);
  process.exit(1);
});
