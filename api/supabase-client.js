// ===== Supabase Client =====
// Reads from window.__ENV injected by /api/env.js
// Add this BEFORE this script: <script src="/api/env"></script>
const SUPABASE_URL = window.__ENV?.SUPABASE_URL || '';
const SUPABASE_KEY = window.__ENV?.SUPABASE_ANON_KEY || '';

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded');
    return null;
  }
  _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
  return _supabase;
}

// ===== Auth Helpers =====
async function signUp(email, password, metadata) {
  const sb = getSupabase();
  if (!sb) return { error: new Error('Supabase not initialized') };
  const { data, error } = await sb.auth.signUp({
    email: email,
    password: password,
    options: { data: metadata || {} }
  });
  return { data, error };
}

async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) return { error: new Error('Supabase not initialized') };
  const { data, error } = await sb.auth.signInWithPassword({
    email: email,
    password: password
  });
  return { data, error };
}

async function signInWithOTP(email) {
  const sb = getSupabase();
  if (!sb) return { error: new Error('Supabase not initialized') };
  const { data, error } = await sb.auth.signInWithOtp({
    email: email,
    options: { shouldCreateUser: true }
  });
  return { data, error };
}

async function signOut() {
  const sb = getSupabase();
  if (!sb) return { error: new Error('Supabase not initialized') };
  const { error } = await sb.auth.signOut();
  return { error };
}

async function getUser() {
  const sb = getSupabase();
  if (!sb) return { data: { user: null } };
  const { data, error } = await sb.auth.getUser();
  return { data, error };
}

async function getSession() {
  const sb = getSupabase();
  if (!sb) return { data: { session: null } };
  const { data, error } = await sb.auth.getSession();
  return { data, error };
}

// ===== Subscription Helpers =====
async function getSubscription(userId) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: new Error('Supabase not initialized') };
  const { data, error } = await sb
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  return { data, error };
}

async function getProfile(userId) {
  const sb = getSupabase();
  if (!sb) return { data: null, error: new Error('Supabase not initialized') };
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

// ===== Feature Gates =====
async function checkFeatureAccess(feature) {
  const { data: sessionData } = await getSession();
  const user = sessionData?.session?.user;
  if (!user) return { allowed: false, reason: 'not_logged_in', tier: 'none' };

  const { data: sub } = await getSubscription(user.id);
  const tier = sub?.tier || 'free';
  const status = sub?.status || 'inactive';

  // Free tier limits
  const FREE_LIMITS = {
    maxScenarios: 3,
    maxCountries: 5,
    pdfExport: false,
    healthHistory: false,
    apiAccess: false
  };

  // Pro tier
  const PRO_LIMITS = {
    maxScenarios: Infinity,
    maxCountries: 22,
    pdfExport: true,
    healthHistory: true,
    apiAccess: true
  };

  // Enterprise tier
  const ENTERPRISE_LIMITS = {
    ...PRO_LIMITS,
    webhooks: true,
    emailParser: true,
    prioritySupport: true
  };

  const limits = tier === 'enterprise' ? ENTERPRISE_LIMITS :
                 tier === 'pro' ? PRO_LIMITS : FREE_LIMITS;

  const allowed = status === 'active' && (limits[feature] === true || limits[feature] > 0);

  return { allowed, tier, status, limits, reason: allowed ? null : 'tier_limit' };
}

// Export for global use
window.BondsAuth = {
  getSupabase, signUp, signIn, signInWithOTP, signOut, getUser, getSession,
  getSubscription, getProfile, checkFeatureAccess
};
