/**
 * Add the first user as recovery module admin.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
  const content = fs.readFileSync(file, 'utf-8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

async function main() {
  const env = loadEnv(path.join(__dirname, '..', '.env.local'));
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (listErr) throw listErr;
  if (!users || users.length === 0) {
    console.log('No users found in auth.users');
    return;
  }
  const user = users[0];
  console.log('First user:', user.email, user.id);

  const { data: existing } = await supabase
    .from('recovery_roles')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log('User already has a recovery role.');
    return;
  }

  const { data, error } = await supabase
    .from('recovery_roles')
    .insert({ user_id: user.id, role: 'admin' })
    .select()
    .single();
  if (error) throw error;
  console.log('Added recovery admin:', data);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
