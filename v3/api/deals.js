'use strict';

const {
  normalizeDealCreate,
  normalizeDealPatch,
  normalizeParty,
  normalizeTask,
  normalizeDueDiligenceItem,
  normalizeDocument
} = require('../../lib/deals/deal-domain');
const {
  ACTIONS,
  can,
  normalizeMemberInvite,
  normalizeMemberPatch,
  normalizeNda,
  normalizeLink,
  isMemberUsable,
  claimInvitations,
  findMembership,
  recordEvent
} = require('../../lib/deals/deal-access');

const LEGACY_DEAL_COLUMNS = 'id,user_id,deal_number,title,deal_type,stage,status,currency,target_value,summary,metadata,created_at,updated_at';
const DEAL_COLUMNS = LEGACY_DEAL_COLUMNS + ',project_id,lifecycle_instance_id,funding_case_id';
const LIST_COLUMNS = 'id,deal_number,title,deal_type,stage,status,currency,target_value,summary,created_at,updated_at';
const MEMBER_DEAL_COLUMNS = 'id,deal_number,title,deal_type,stage,status,currency,target_value,summary,created_at,updated_at';
const COUNTERPARTY_DOCUMENT_LEVELS = ['standard', 'confidential'];

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 262144) {
        reject(new Error('REQUEST_BODY_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (_err) { reject(new Error('INVALID_JSON_BODY')); }
    });
    req.on('error', reject);
  });
}

function dealNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return 'DEAL-' + stamp + '-' + suffix;
}

function isMissingColumn(error) {
  return Boolean(error && (error.code === '42703' || /column .* does not exist/i.test(String(error.message || ''))));
}

async function ownedDeal(supabase, userId, dealId) {
  let { data, error } = await supabase
    .from('bonds_deals')
    .select(DEAL_COLUMNS)
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();
  if (isMissingColumn(error)) {
    ({ data, error } = await supabase
      .from('bonds_deals')
      .select(LEGACY_DEAL_COLUMNS)
      .eq('id', dealId)
      .eq('user_id', userId)
      .maybeSingle());
  }
  if (error) throw error;
  return data || null;
}

// Owner first (unchanged behaviour), then an active, unexpired membership.
async function resolveAccess(supabase, user, dealId) {
  const owned = await ownedDeal(supabase, user.id, dealId);
  if (owned) return { deal:owned, access:{ mode:'owner' } };
  const member = await findMembership(supabase, dealId, user.id);
  if (!member) return null;
  const { data, error } = await supabase
    .from('bonds_deals')
    .select(MEMBER_DEAL_COLUMNS + ',user_id')
    .eq('id', dealId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { deal:data, access:{ mode:'member', member } };
}

function accessSummary(access) {
  if (access.mode === 'owner') return { mode:'owner', can:Object.values(ACTIONS) };
  const m = access.member;
  return {
    mode:'member',
    side:m.side,
    member_role:m.member_role,
    nda_status:m.nda_status,
    access_expires_at:m.access_expires_at,
    can:Object.values(ACTIONS).filter(action => can(access, action))
  };
}

function memberView(deal) {
  const out = {};
  for (const key of MEMBER_DEAL_COLUMNS.split(',')) out[key] = deal[key];
  return out;
}

async function listDeals(res, supabase, user) {
  await claimInvitations(supabase, user);
  const listOwned = columns => supabase
    .from('bonds_deals')
    .select(columns)
    .eq('user_id', user.id)
    .order('updated_at', { ascending:false })
    .limit(100);
  let { data, error } = await listOwned(LIST_COLUMNS + ',project_id');
  if (isMissingColumn(error)) ({ data, error } = await listOwned(LIST_COLUMNS));
  if (error) return sendJson(res, 503, { error:'DEAL_LIST_FAILED' });

  let sharedDeals = [];
  const { data: memberships } = await supabase
    .from('bonds_deal_members')
    .select('deal_id,side,member_role,nda_status,status,user_id,access_expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active');
  const usable = (memberships || []).filter(m => isMemberUsable(m));
  if (usable.length) {
    const { data: shared } = await supabase
      .from('bonds_deals')
      .select(MEMBER_DEAL_COLUMNS)
      .in('id', usable.map(m => m.deal_id))
      .order('updated_at', { ascending:false })
      .limit(100);
    const byDeal = new Map(usable.map(m => [m.deal_id, m]));
    sharedDeals = (shared || []).map(deal => ({
      ...memberView(deal),
      membership:{
        side:byDeal.get(deal.id).side,
        member_role:byDeal.get(deal.id).member_role,
        nda_status:byDeal.get(deal.id).nda_status
      }
    }));
  }
  return sendJson(res, 200, { deals:data || [], shared_deals:sharedDeals });
}

async function applyLink(supabase, deal, link) {
  const patch = {};
  if (link.project_id !== undefined) {
    patch.project_id = link.project_id;
    patch.lifecycle_instance_id = null;
    if (link.project_id) {
      const { data: project, error } = await supabase
        .from('bonds_projects')
        .select('id')
        .eq('id', link.project_id)
        .eq('user_id', deal.user_id)
        .maybeSingle();
      if (error) throw error;
      if (!project) throw new Error('PROJECT_NOT_FOUND');
      const { data: instance } = await supabase
        .from('enterprise_lifecycle_instances')
        .select('id')
        .eq('entity_type', 'project')
        .eq('entity_id', link.project_id)
        .eq('status', 'active')
        .order('created_at', { ascending:false })
        .limit(1)
        .maybeSingle();
      patch.lifecycle_instance_id = instance ? instance.id : null;
    }
  }
  if (link.funding_case_id !== undefined) {
    patch.funding_case_id = link.funding_case_id;
    if (link.funding_case_id) {
      const { data: fundingCase, error } = await supabase
        .from('funding_cases')
        .select('id')
        .eq('id', link.funding_case_id)
        .eq('user_id', deal.user_id)
        .maybeSingle();
      if (error) throw error;
      if (!fundingCase) throw new Error('FUNDING_CASE_NOT_FOUND');
    }
  }
  const { data, error } = await supabase
    .from('bonds_deals')
    .update(patch)
    .eq('id', deal.id)
    .eq('user_id', deal.user_id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createDeal(req, res, supabase, user) {
  let body;
  try { body = await parseBody(req); }
  catch (err) { return sendJson(res, err.message === 'REQUEST_BODY_TOO_LARGE' ? 413 : 400, { error:err.message }); }

  let normalized;
  try { normalized = normalizeDealCreate(body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const payload = {
    ...normalized,
    deal_number:dealNumber(),
    user_id:user.id
  };
  const { data, error } = await supabase
    .from('bonds_deals')
    .insert(payload)
    .select()
    .single();
  if (error) return sendJson(res, 503, { error:'DEAL_CREATE_FAILED' });
  await recordEvent(supabase, { deal_id:data.id, event_type:'deal_created', entity_type:'deal', entity_id:data.id, actor_id:user.id, metadata:{ deal_type:data.deal_type } });

  if (body.project_id || body.funding_case_id) {
    try {
      const linked = await applyLink(supabase, data, normalizeLink({ project_id:body.project_id, funding_case_id:body.funding_case_id }));
      await recordEvent(supabase, { deal_id:data.id, event_type:'deal_linked', entity_type:'deal', entity_id:data.id, actor_id:user.id, metadata:{ project_id:linked.project_id || null, funding_case_id:linked.funding_case_id || null } });
      return sendJson(res, 201, { deal:linked });
    } catch (err) {
      return sendJson(res, 201, { deal:data, link_warning:err.message || 'DEAL_LINK_FAILED' });
    }
  }
  return sendJson(res, 201, { deal:data });
}

async function getDeal(res, supabase, user, dealId) {
  let resolved;
  try { resolved = await resolveAccess(supabase, user, dealId); }
  catch (_err) { return sendJson(res, 503, { error:'DEAL_READ_FAILED' }); }
  if (!resolved) return sendJson(res, 404, { error:'DEAL_NOT_FOUND' });
  if (resolved.access.mode !== 'owner') return getMemberDeal(res, supabase, resolved, dealId);
  const deal = resolved.deal;

  const [parties, tasks, dueDiligence, documents] = await Promise.all([
    supabase.from('bonds_deal_parties').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_tasks').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_due_diligence_items').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending:false })
  ]);
  const failed = [parties, tasks, dueDiligence, documents].find(row => row.error);
  if (failed) return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });

  const members = await supabase.from('bonds_deal_members').select('*').eq('deal_id', dealId).order('created_at', { ascending:true });

  return sendJson(res, 200, {
    deal,
    access:accessSummary(resolved.access),
    members:members.error ? [] : (members.data || []),
    workspace:{
      parties:parties.data || [],
      tasks:tasks.data || [],
      due_diligence:dueDiligence.data || [],
      documents:documents.data || []
    }
  });
}

async function getMemberDeal(res, supabase, resolved, dealId) {
  const { access } = resolved;
  const deal = memberView(resolved.deal);
  const summary = accessSummary(access);
  const empty = { parties:[], tasks:[], due_diligence:[], documents:[] };

  if (!can(access, ACTIONS.VIEW_WORKSPACE)) {
    return sendJson(res, 200, { deal, access:summary, members:[access.member], workspace:empty });
  }

  if (access.member.side === 'counterparty') {
    const documents = await supabase.from('bonds_deal_documents')
      .select('id,name,category,status,confidentiality,version,created_at,updated_at')
      .eq('deal_id', dealId)
      .in('confidentiality', COUNTERPARTY_DOCUMENT_LEVELS)
      .order('created_at', { ascending:false });
    if (documents.error) return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });
    return sendJson(res, 200, { deal, access:summary, members:[access.member], workspace:{ ...empty, documents:documents.data || [] } });
  }

  const [parties, tasks, dueDiligence, documents, members] = await Promise.all([
    supabase.from('bonds_deal_parties').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_tasks').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_due_diligence_items').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_members').select('*').eq('deal_id', dealId).order('created_at', { ascending:true })
  ]);
  const failed = [parties, tasks, dueDiligence, documents, members].find(row => row.error);
  if (failed) return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });
  return sendJson(res, 200, {
    deal,
    access:summary,
    members:members.data || [],
    workspace:{
      parties:parties.data || [],
      tasks:tasks.data || [],
      due_diligence:dueDiligence.data || [],
      documents:documents.data || []
    }
  });
}

async function readBody(req, res) {
  try { return { body:await parseBody(req) }; }
  catch (err) {
    sendJson(res, err.message === 'REQUEST_BODY_TOO_LARGE' ? 413 : 400, { error:err.message });
    return null;
  }
}

async function authorize(res, supabase, user, dealId, action) {
  let resolved;
  try { resolved = await resolveAccess(supabase, user, dealId); }
  catch (_err) { sendJson(res, 503, { error:'DEAL_READ_FAILED' }); return null; }
  if (!resolved) { sendJson(res, 404, { error:'DEAL_NOT_FOUND' }); return null; }
  if (!can(resolved.access, action)) { sendJson(res, 403, { error:'DEAL_ACTION_FORBIDDEN' }); return null; }
  return resolved;
}

async function listMembers(res, supabase, user, dealId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.VIEW_WORKSPACE);
  if (!resolved) return undefined;
  if (resolved.access.mode === 'member' && resolved.access.member.side === 'counterparty') {
    return sendJson(res, 200, { members:[resolved.access.member] });
  }
  const { data, error } = await supabase.from('bonds_deal_members').select('*').eq('deal_id', dealId).order('created_at', { ascending:true });
  if (error) return sendJson(res, 503, { error:'DEAL_MEMBERS_READ_FAILED' });
  return sendJson(res, 200, { members:data || [] });
}

async function inviteMember(req, res, supabase, user, dealId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.MANAGE_MEMBERS);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;

  let invite;
  try { invite = normalizeMemberInvite(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }
  if (user.email && String(user.email).toLowerCase() === invite.email && resolved.access.mode === 'owner') {
    return sendJson(res, 422, { error:'MEMBER_IS_OWNER' });
  }

  const { data: existing } = await supabase.from('bonds_deal_members')
    .select('id')
    .eq('deal_id', dealId)
    .eq('email', invite.email)
    .neq('status', 'revoked')
    .maybeSingle();
  if (existing) return sendJson(res, 409, { error:'MEMBER_ALREADY_INVITED' });

  const { data, error } = await supabase.from('bonds_deal_members')
    .insert({ deal_id:dealId, ...invite, status:'invited', invited_by:user.id })
    .select()
    .single();
  if (error) return sendJson(res, error.code === '23505' ? 409 : 503, { error:error.code === '23505' ? 'MEMBER_ALREADY_INVITED' : 'DEAL_MEMBER_CREATE_FAILED' });
  await recordEvent(supabase, { deal_id:dealId, event_type:'member_invited', entity_type:'deal_member', entity_id:data.id, actor_id:user.id, metadata:{ side:data.side, member_role:data.member_role } });
  return sendJson(res, 201, { member:data });
}

async function loadMember(res, supabase, dealId, memberId) {
  const { data, error } = await supabase.from('bonds_deal_members').select('*').eq('id', memberId).eq('deal_id', dealId).maybeSingle();
  if (error) { sendJson(res, 503, { error:'DEAL_MEMBERS_READ_FAILED' }); return null; }
  if (!data) { sendJson(res, 404, { error:'DEAL_MEMBER_NOT_FOUND' }); return null; }
  return data;
}

async function patchMember(req, res, supabase, user, dealId, memberId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.MANAGE_MEMBERS);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  const current = await loadMember(res, supabase, dealId, memberId);
  if (!current) return undefined;
  if (resolved.access.mode === 'member' && current.user_id === user.id) {
    return sendJson(res, 403, { error:'DEAL_MEMBER_SELF_CHANGE_FORBIDDEN' });
  }
  if (current.status === 'revoked') return sendJson(res, 409, { error:'DEAL_MEMBER_REVOKED' });

  let patch;
  try { patch = normalizeMemberPatch(parsed.body, current); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const { data, error } = await supabase.from('bonds_deal_members').update(patch).eq('id', memberId).eq('deal_id', dealId).select().maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_MEMBER_UPDATE_FAILED' });
  await recordEvent(supabase, { deal_id:dealId, event_type:patch.status === 'revoked' ? 'member_revoked' : 'member_updated', entity_type:'deal_member', entity_id:memberId, actor_id:user.id, metadata:{ fields:Object.keys(patch) } });
  return sendJson(res, 200, { member:data });
}

async function recordMemberNda(req, res, supabase, user, dealId, memberId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.MANAGE_MEMBERS);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  const current = await loadMember(res, supabase, dealId, memberId);
  if (!current) return undefined;
  if (current.status === 'revoked') return sendJson(res, 409, { error:'DEAL_MEMBER_REVOKED' });

  let nda;
  try { nda = normalizeNda(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const { data, error } = await supabase.from('bonds_deal_members').update(nda).eq('id', memberId).eq('deal_id', dealId).select().maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_MEMBER_UPDATE_FAILED' });
  await recordEvent(supabase, { deal_id:dealId, event_type:'nda_' + nda.nda_status, entity_type:'deal_member', entity_id:memberId, actor_id:user.id, metadata:{ nda_reference:nda.nda_reference } });
  return sendJson(res, 200, { member:data });
}

async function listEvents(res, supabase, user, dealId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.VIEW_EVENTS);
  if (!resolved) return undefined;
  const { data, error } = await supabase.from('bonds_deal_events').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }).limit(200);
  if (error) return sendJson(res, 503, { error:'DEAL_EVENTS_READ_FAILED' });
  return sendJson(res, 200, { events:data || [] });
}

async function linkDeal(req, res, supabase, user, dealId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.LINK_RECORDS);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;

  let link;
  try { link = normalizeLink(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  try {
    const deal = await applyLink(supabase, resolved.deal, link);
    await recordEvent(supabase, { deal_id:dealId, event_type:'deal_linked', entity_type:'deal', entity_id:dealId, actor_id:user.id, metadata:{ project_id:deal.project_id || null, funding_case_id:deal.funding_case_id || null } });
    return sendJson(res, 200, { deal });
  } catch (err) {
    if (err.message === 'PROJECT_NOT_FOUND' || err.message === 'FUNDING_CASE_NOT_FOUND') return sendJson(res, 422, { error:err.message });
    return sendJson(res, 503, { error:'DEAL_LINK_FAILED' });
  }
}

async function patchDeal(req, res, supabase, user, dealId) {
  let body;
  try { body = await parseBody(req); }
  catch (err) { return sendJson(res, err.message === 'REQUEST_BODY_TOO_LARGE' ? 413 : 400, { error:err.message }); }

  let patch;
  try { patch = normalizeDealPatch(body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const { data, error } = await supabase
    .from('bonds_deals')
    .update(patch)
    .eq('id', dealId)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_UPDATE_FAILED' });
  if (!data) return sendJson(res, 404, { error:'DEAL_NOT_FOUND' });
  await recordEvent(supabase, { deal_id:dealId, event_type:'deal_updated', entity_type:'deal', entity_id:dealId, actor_id:user.id, metadata:{ fields:Object.keys(patch) } });
  return sendJson(res, 200, { deal:data });
}

async function createChild(req, res, supabase, user, dealId, kind) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;

  let body;
  try { body = await parseBody(req); }
  catch (err) { return sendJson(res, err.message === 'REQUEST_BODY_TOO_LARGE' ? 413 : 400, { error:err.message }); }

  const map = {
    parties:{ table:'bonds_deal_parties', normalize:normalizeParty, key:'party' },
    tasks:{ table:'bonds_deal_tasks', normalize:normalizeTask, key:'task' },
    'due-diligence':{ table:'bonds_deal_due_diligence_items', normalize:normalizeDueDiligenceItem, key:'due_diligence_item' },
    documents:{ table:'bonds_deal_documents', normalize:normalizeDocument, key:'document' }
  };
  const spec = map[kind];
  if (!spec) return sendJson(res, 404, { error:'DEAL_CHILD_ENDPOINT_NOT_FOUND' });

  let normalized;
  try { normalized = spec.normalize(body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const { data, error } = await supabase
    .from(spec.table)
    .insert({ deal_id:dealId, ...normalized })
    .select()
    .single();
  if (error) return sendJson(res, 503, { error:'DEAL_CHILD_CREATE_FAILED' });
  await recordEvent(supabase, { deal_id:dealId, event_type:spec.key + '_created', entity_type:spec.key, entity_id:data.id, actor_id:user.id, metadata:{} });
  return sendJson(res, 201, { [spec.key]:data });
}

async function dealsRouter(req, res, path, supabase, user) {
  if (!user) return sendJson(res, 401, { error:'Unauthorized' });
  const parts = path.split('/').filter(Boolean);
  const dealId = parts[1] || null;
  const child = parts[2] || null;
  const childId = parts[3] || null;
  const childAction = parts[4] || null;

  if (dealId && child === 'members') {
    if (!childId && req.method === 'GET') return listMembers(res, supabase, user, dealId);
    if (!childId && req.method === 'POST') return inviteMember(req, res, supabase, user, dealId);
    if (childId && !childAction && req.method === 'PATCH') return patchMember(req, res, supabase, user, dealId, childId);
    if (childId && childAction === 'nda' && req.method === 'POST') return recordMemberNda(req, res, supabase, user, dealId, childId);
    return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
  }
  if (dealId && child === 'events' && !childId && req.method === 'GET') return listEvents(res, supabase, user, dealId);
  if (dealId && child === 'link' && !childId && req.method === 'POST') return linkDeal(req, res, supabase, user, dealId);
  if (dealId && child && childId) return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });

  if (!dealId && req.method === 'GET') return listDeals(res, supabase, user);
  if (!dealId && req.method === 'POST') return createDeal(req, res, supabase, user);
  if (dealId && !child && req.method === 'GET') return getDeal(res, supabase, user, dealId);
  if (dealId && !child && req.method === 'PATCH') return patchDeal(req, res, supabase, user, dealId);
  if (dealId && child && req.method === 'POST') return createChild(req, res, supabase, user, dealId, child);

  return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
}

module.exports = { dealsRouter };
