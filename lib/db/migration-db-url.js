'use strict';

function extractSupabaseRef(env = process.env) {
  const fromUrl = String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '');
  const match = fromUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

function resolveMigrationDbUrl(dbUrl = process.env.SUPABASE_DB_URL, env = process.env) {
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL is not configured in environment variables');
  }

  try {
    const url = new URL(dbUrl);
    const directMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    const ref = (directMatch && directMatch[1]) || extractSupabaseRef(env);
    const user = decodeURIComponent(url.username || '');

    if (directMatch) {
      url.hostname = env.SUPABASE_POOLER_HOST || 'aws-1-eu-central-1.pooler.supabase.com';
      url.port = '5432';
      if (ref) url.username = `postgres.${ref}`;
      return url.toString();
    }

    if (user === 'postgres') {
      if (!ref) {
        throw new Error('Cannot rewrite migration DB user: missing SUPABASE_URL project ref');
      }
      url.username = `postgres.${ref}`;
      return url.toString();
    }

    return dbUrl;
  } catch (err) {
    throw new Error(`Failed to parse SUPABASE_DB_URL: ${err.message}`);
  }
}

function describeMigrationDbUrl(connectionString) {
  const url = new URL(connectionString);
  const user = decodeURIComponent(url.username || '');
  return {
    hostKind: /pooler\.supabase\.com$/i.test(url.hostname)
      ? 'pooler'
      : (/^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname) ? 'direct' : 'other'),
    userKind: user.startsWith('postgres.') ? 'postgres.ref' : (user === 'postgres' ? 'postgres' : 'other')
  };
}

module.exports = {
  extractSupabaseRef,
  resolveMigrationDbUrl,
  describeMigrationDbUrl
};
