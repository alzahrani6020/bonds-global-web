/**
 * Run page tracking migration directly via PostgreSQL
 * Uses SUPABASE_DB_URL from .env.local
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/SUPABASE_DB_URL=(.+)/);
if (!dbUrlMatch) {
  console.error('❌ SUPABASE_DB_URL not found in .env.local');
  process.exit(1);
}
const connectionString = dbUrlMatch[1].trim();

const sql = `
-- Page Views & Session Tracking v2
-- Safe: does NOT drop existing tables (avoids data loss)

CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  page text,
  section text,
  url text,
  referrer text,
  lang text,
  screen text,
  source text DEFAULT 'web',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.page_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  page text,
  section text,
  duration_seconds int,
  url text,
  referrer text,
  lang text,
  screen text,
  source text DEFAULT 'web',
  started_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous page view inserts" ON public.page_views;
CREATE POLICY "Allow anonymous page view inserts"
  ON public.page_views FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous session inserts" ON public.page_sessions;
CREATE POLICY "Allow anonymous session inserts"
  ON public.page_sessions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON public.page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON public.page_views(page);
CREATE INDEX IF NOT EXISTS idx_page_views_section ON public.page_views(section);
CREATE INDEX IF NOT EXISTS idx_page_sessions_started ON public.page_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_page_sessions_page ON public.page_sessions(page);
`;

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('🔌 Connected to Supabase PostgreSQL');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');
    console.log('   - page_views table created');
    console.log('   - page_sessions table created');
    console.log('   - RLS policies enabled');
    console.log('   - Indexes created');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
