'use strict';

const getSupabase = require('../api/supabase');

const REQUIRED_CHECKS = Object.freeze([
  'audit_table',
  'audit_rls',
  'audit_events',
  'audit_append_service_only',
  'audit_no_direct_access',
  'audit_immutable',
  'idempotency_table',
  'idempotency_rls',
  'idempotency_service_only'
]);

// Deployment evidence only: no user authorization or AI/API policy changes.
// The RPC inspects schema and privileges without writing customer/audit rows.
async function probeAssistantReadiness({ supabase } = {}) {
  if (!supabase && (
    !String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim() ||
    !String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  )) {
    return { status: 'not_configured', code: 'ASSISTANT_DATABASE_UNCONFIGURED' };
  }

  try {
    const db = supabase || getSupabase();
    const result = await db.rpc('assistant_rollout_readiness');
    if (!result || result.error) {
      return { status: 'unavailable', code: 'ASSISTANT_READINESS_UNAVAILABLE' };
    }

    const data = result.data;
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        data.schema_version !== 1 || typeof data.ready !== 'boolean' ||
        !data.checks || typeof data.checks !== 'object' || Array.isArray(data.checks) ||
        REQUIRED_CHECKS.some(key => typeof data.checks[key] !== 'boolean')) {
      return { status: 'invalid_contract', code: 'ASSISTANT_READINESS_CONTRACT_INVALID' };
    }

    if (!data.ready || REQUIRED_CHECKS.some(key => data.checks[key] !== true)) {
      return { status: 'not_ready', code: 'ASSISTANT_DATABASE_NOT_READY' };
    }

    // Keep public readiness bounded: never echo RPC errors or arbitrary fields.
    return { status: 'ok', code: null, schema_version: 1 };
  } catch (_) {
    return { status: 'unavailable', code: 'ASSISTANT_READINESS_UNAVAILABLE' };
  }
}

module.exports = { probeAssistantReadiness };
