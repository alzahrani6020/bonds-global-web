/**
 * Applies all V3 seed files to Supabase.
 *
 * Usage:
 *   cd bonds-v3
 *   node scripts/apply-seeds.js
 *
 * Requires:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const seedFile = path.join(__dirname, '..', 'supabase', 'seed', 'all-seeds.sql');
  const sql = fs.readFileSync(seedFile, 'utf8');

  console.log('Applying seeds to Supabase...');

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('❌ Failed to apply seeds:', error.message);
    console.log('Fallback: copy the SQL from supabase/seed/all-seeds.sql and run it in Supabase SQL Editor.');
    process.exit(1);
  }

  console.log('✅ Seeds applied successfully');
}

main();
