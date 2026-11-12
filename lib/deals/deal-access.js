'use strict';

const MEMBER_SIDES = ['advisor', 'counterparty', 'external_expert'];
const MEMBER_ROLES = ['deal_manager', 'analyst', 'viewer', 'legal', 'auditor', 'investor_rep'];
const MEMBER_STATUSES = ['invited', 'active', 'revoked'];
const NDA_STATUSES = ['not_required', 'pending', 'signed', 'declined'];
const COUNTERPARTY_ROLES = ['viewer', 'investor_rep', 'legal'];

const ACTIONS = Object.freeze({
  VIEW_WORKSPACE: 'view_workspace',
  EDIT_WORKSPACE: 'edit_workspace',
  MANAGE_MEMBERS: 'manage_members',
  VIEW_EVENTS: 'view_events',
  EDIT_DEAL: 'edit_deal',
  LINK_RECORDS: 'link_records'
});

const ROLE_ACTIONS = {
  deal_manager: [ACTIONS.VIEW_WORKSPACE, ACTIONS.EDIT_WORKSPACE, ACTIONS.MANAGE_MEMBERS, ACTIONS.VIEW_EVENTS],
  analyst: [ACTIONS.VIEW_WORKSPACE, ACTIONS.EDIT_WORKSPACE, ACTIONS.VIEW_EVENTS],
  legal: [ACTIONS.VIEW_WORKSPACE, ACTIONS.VIEW_EVENTS],
  auditor: [ACTIONS.VIEW_WORKSPACE, ACTIONS.VIEW_EVENTS],
  viewer: [ACTIONS.VIEW_WORKSPACE],
  investor_rep: [ACTIONS.VIEW_WORKSPACE]
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value, max) {
  if (value === undefined || value === null) return null;
  const out = String(value).trim();
  if (!out) return null;
  return out.slice(0, max);
}

function pick(value, allowed, field) {
  if (value === undefined || value === null || value === '') return undefined;
  const out = String(value).trim();
  if (!allowed.includes(out)) throw new Error(field.toUpperCase() + '_INVALID');
  return out;
}

function isoDate(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) throw new Error(field.toUpperCase() + '_INVALID');
  return new Date(ts).toISOString();
}

function assertRoleFitsSide(side, role) {
  if (side === 'counterparty' && !COUNTERPARTY_ROLES.includes(role)) throw new Error('MEMBER_ROLE_NOT_ALLOWED_FOR_COUNTERPARTY');
  if (role === 'deal_manager' && side !== 'advisor') throw new Error('DEAL_MANAGER_MUST_BE_ADVISOR');
}

function normalizeMemberInvite(body = {}) {
  const email = text(body.email, 254);
  if (!email || !EMAIL_RE.test(email)) throw new Error('MEMBER_EMAIL_INVALID');
  const side = pick(body.side, MEMBER_SIDES, 'member_side') || 'advisor';
  const role = pick(body.member_role, MEMBER_ROLES, 'member_role') || 'viewer';
  assertRoleFitsSide(side, role);
  const ndaDefault = side === 'advisor' ? 'not_required' : 'pending';
  return {
    email: email.toLowerCase(),
    display_name: text(body.display_name, 160),
    organization: text(body.organization, 160),
    side,
    member_role: role,
    nda_status: pick(body.nda_status, NDA_STATUSES, 'nda_status') || ndaDefault,
    access_expires_at: isoDate(body.access_expires_at, 'access_expires_at') || null
  };
}

function normalizeMemberPatch(body = {}, current = {}) {
  const patch = {};
  const role = pick(body.member_role, MEMBER_ROLES, 'member_role');
  if (role) {
    assertRoleFitsSide(current.side, role);
    patch.member_role = role;
  }
  if (body.status !== undefined) {
    const status = pick(body.status, MEMBER_STATUSES, 'member_status');
    if (status === 'invited') throw new Error('MEMBER_STATUS_INVALID');
    if (status === 'active' && !current.user_id) throw new Error('MEMBER_NOT_YET_JOINED');
    if (status) patch.status = status;
  }
  const expires = isoDate(body.access_expires_at, 'access_expires_at');
  if (expires !== undefined) patch.access_expires_at = expires;
  if (body.display_name !== undefined) patch.display_name = text(body.display_name, 160);
  if (body.organization !== undefined) patch.organization = text(body.organization, 160);
  if (!Object.keys(patch).length) throw new Error('MEMBER_PATCH_EMPTY');
  return patch;
}

function normalizeNda(body = {}) {
  const status = pick(body.nda_status, NDA_STATUSES, 'nda_status');
  if (!status) throw new Error('NDA_STATUS_REQUIRED');
  const out = { nda_status: status, nda_reference: text(body.nda_reference, 160) };
  if (status === 'signed') out.nda_signed_at = isoDate(body.nda_signed_at, 'nda_signed_at') || new Date().toISOString();
  else out.nda_signed_at = null;
  return out;
}

function normalizeLink(body = {}) {
  const out = {};
  for (const key of ['project_id', 'funding_case_id']) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === '') { out[key] = null; continue; }
    if (!UUID_RE.test(String(body[key]))) throw new Error(key.toUpperCase() + '_INVALID');
    out[key] = String(body[key]);
  }
  if (!Object.keys(out).length) throw new Error('DEAL_LINK_EMPTY');
  return out;
}

function isMemberUsable(member, now = Date.now()) {
  if (!member || member.status !== 'active' || !member.user_id) return false;
  if (member.access_expires_at && Date.parse(member.access_expires_at) <= now) return false;
  return true;
}

/**
 * access: { mode: 'owner'|'member', member?: object }
 */
function can(access, action) {
  if (!access) return false;
  if (access.mode === 'owner') return true;
  const member = access.member;
  if (!isMemberUsable(member)) return false;
  if (action === ACTIONS.EDIT_DEAL || action === ACTIONS.LINK_RECORDS) return false;
  if (member.side === 'counterparty') {
    return action === ACTIONS.VIEW_WORKSPACE && member.nda_status === 'signed';
  }
  return (ROLE_ACTIONS[member.member_role] || []).includes(action);
}

function emailConfirmed(user) {
  return Boolean(user && user.email && (user.email_confirmed_at || user.confirmed_at));
}

async function claimInvitations(supabase, user) {
  if (!emailConfirmed(user)) return [];
  const email = String(user.email).toLowerCase();
  const { data, error } = await supabase
    .from('bonds_deal_members')
    .update({ user_id: user.id, status: 'active', joined_at: new Date().toISOString() })
    .eq('email', email)
    .eq('status', 'invited')
    .is('user_id', null)
    .select('id,deal_id,side,member_role');
  if (error || !Array.isArray(data)) return [];
  await Promise.all(data.map(m => recordEvent(supabase, {
    deal_id: m.deal_id,
    event_type: 'member_joined',
    entity_type: 'deal_member',
    entity_id: m.id,
    actor_id: user.id,
    metadata: { side: m.side, member_role: m.member_role }
  })));
  return data;
}

async function findMembership(supabase, dealId, userId) {
  const { data, error } = await supabase
    .from('bonds_deal_members')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .neq('status', 'revoked')
    .maybeSingle();
  if (error) throw error;
  return isMemberUsable(data) ? data : null;
}

async function recordEvent(supabase, event) {
  try {
    await supabase.from('bonds_deal_events').insert({ metadata: {}, ...event });
  } catch (_err) {
    // audit logging must never break the primary write
  }
}

const DD_DONE = ['complete', 'not_applicable'];
const VDR_READY = ['received', 'reviewed', 'approved'];
const DD_COMPLETE_THRESHOLD = 0.95;

/**
 * Maps a bonds_deals workspace onto the context paths read by
 * project-investment-lifecycle guards.
 */
function buildDealLifecycleContext({ deal, members = [], dueDiligence = [], documents = [] }, now = Date.now()) {
  const usable = members.filter(m => isMemberUsable(m, now));
  const counterparties = usable.filter(m => m.side === 'counterparty');
  const ndaSigned = counterparties.filter(m => m.nda_status === 'signed').length;

  const ddTotal = dueDiligence.length;
  const ddDone = dueDiligence.filter(i => DD_DONE.includes(i.status)).length;
  const ddBlocked = dueDiligence.filter(i => i.status === 'blocked').length;
  const ddCritical = dueDiligence.filter(i => i.risk_rating === 'critical' && i.status !== 'not_applicable').length;
  const ddCompletion = ddTotal ? ddDone / ddTotal : 0;
  const ddPassed = ddTotal > 0 && ddCompletion >= DD_COMPLETE_THRESHOLD && ddBlocked === 0 && ddCritical === 0;

  const vdrDocs = documents
    .filter(d => VDR_READY.includes(d.status))
    .map(d => ({ id: d.id, name: d.name, category: d.category, status: d.status }));

  const summary = {
    id: deal.id,
    deal_number: deal.deal_number,
    title: deal.title,
    stage: deal.stage,
    status: deal.status,
    members: {
      active: usable.length,
      counterparties: counterparties.length,
      nda_signed: ndaSigned
    },
    due_diligence: {
      total: ddTotal,
      done: ddDone,
      blocked: ddBlocked,
      critical: ddCritical,
      completion: Math.round(ddCompletion * 100)
    },
    vdr_documents: vdrDocs.length
  };

  const fragment = {
    deal: summary,
    documents: {
      deal_room: { status: deal.status === 'active' && counterparties.length > 0 ? 'active' : 'inactive' }
    }
  };
  if (counterparties.length) {
    fragment.documents.nda = { status: ndaSigned > 0 ? 'signed' : 'pending' };
  }
  if (vdrDocs.length) fragment.vdr = { documents: vdrDocs };
  if (ddPassed) fragment.dueDiligence = { checklist: { total: ddTotal, done: ddDone, completion: summary.due_diligence.completion } };
  return fragment;
}

module.exports = {
  MEMBER_SIDES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  NDA_STATUSES,
  ACTIONS,
  normalizeMemberInvite,
  normalizeMemberPatch,
  normalizeNda,
  normalizeLink,
  isMemberUsable,
  can,
  claimInvitations,
  findMembership,
  recordEvent,
  buildDealLifecycleContext
};
