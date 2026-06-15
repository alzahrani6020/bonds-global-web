/**
 * Apply Bonds V3 migration via Supabase API using exec_sql RPC.
 * Use this when direct Postgres connection (SUPABASE_DB_URL) is unavailable.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
  return env;
}

function splitSqlStatements(sql) {
  // Remove block comments /* ... */
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove line comments -- ...
  sql = sql.replace(/--[^\n]*/g, '');

  const statements = [];
  let current = '';
  let inFunction = false;
  let functionDepth = 0;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    current += char;

    if (char === '$') {
      // Check for $$ delimiter
      if (sql.slice(i, i + 2) === '$$') {
        inFunction = !inFunction;
        i++;
        current += '$';
        continue;
      }
    }

    if (char === ';' && !inFunction) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    }
  }

  const last = current.trim();
  if (last) statements.push(last);

  return statements.filter(s => s.length > 0);
}

async function main() {
  const env = loadEnvLocal();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  const filename = process.argv[2] || '20260615000000_v3_data_acquisition_platform.sql';
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('Connecting to Supabase via API...');

  // Test connection
  const { error: testError } = await supabase.from('cities').select('id').limit(1);
  if (testError) throw new Error('Failed to connect: ' + testError.message);

  const statements = splitSqlStatements(sql);
  console.log(`Applying ${statements.length} statements from ${filename}...`);

  let applied = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        // Ignore "already exists" errors
        if (error.message && (error.message.includes('already exists') || error.message.includes('duplicate key'))) {
          console.log(`  [${i + 1}/${statements.length}] skipped (already exists)`);
        } else {
          console.error(`  [${i + 1}/${statements.length}] FAILED: ${error.message}`);
          console.error(`  Statement: ${stmt.slice(0, 200)}...`);
          failed++;
        }
      } else {
        applied++;
        if (applied % 10 === 0) console.log(`  [${i + 1}/${statements.length}] applied ${applied} statements...`);
      }
    } catch (err) {
      console.error(`  [${i + 1}/${statements.length}] ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${applied} applied, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
