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
const {
  normalizePipelineCreate,
  normalizePipelinePatch,
  normalizeOfferCreate,
  normalizeOfferPatch
} = require('../../lib/deals/deal-pipeline');
const {
  normalizeClosingItemCreate,
  normalizeClosingItemPatch,
  normalizeClosingRecordCreate,
  normalizeClosingRecordPatch
} = require('../../lib/deals/deal-closing');
const {
  DATA_ROOM_BUCKET,
  normalizeUploadSpec,
  normalizeDocumentPatch,
  normalizeGrant,
  normalizeDocumentRequest,
  normalizeDocumentRequestPatch,
  normalizeDueDiligencePatch,
  buildStoragePath,
  memberCanSeeDocument,
  memberCanUploadRequest
} = require('../../lib/deals/deal-data-room');

const LEGACY_DEAL_COLUMNS = 'id,user_id,deal_number,title,deal_type,stage,status,currency,target_value,summary,metadata,created_at,updated_at';
const DEAL_COLUMNS = LEGACY_DEAL_COLUMNS + ',project_id,lifecycle_instance_id,funding_case_id';
const LIST_COLUMNS = 'id,deal_number,title,deal_type,stage,status,currency,target_value,summary,created_at,updated_at';
const MEMBER_DEAL_COLUMNS = 'id,deal_number,title,deal_type,stage,status,currency,target_value,summary,created_at,updated_at';

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

function isMissingRelation(error) {
  return Boolean(error && (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist/i.test(String(error.message || '')) ||
    /could not find the table/i.test(String(error.message || ''))
  ));
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

  const [parties, tasks, dueDiligence, documents, documentRequests, pipeline, offers, closingItems, closingRecords] = await Promise.all([
    supabase.from('bonds_deal_parties').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_tasks').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_due_diligence_items').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_document_requests').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_pipeline_entries').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_offers').select('*').eq('deal_id', dealId).order('received_at', { ascending:false }),
    supabase.from('bonds_deal_closing_items').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_closing_records').select('*').eq('deal_id', dealId).order('effective_at', { ascending:false })
  ]);
  const failed = [parties, tasks, dueDiligence, documents].find(row => row.error);
  if (failed) return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });
  if (documentRequests.error && !isMissingRelation(documentRequests.error)) {
    return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });
  }
  if (pipeline.error && !isMissingRelation(pipeline.error)) return sendJson(res, 503, { error:'DEAL_PIPELINE_READ_FAILED' });
  if (offers.error && !isMissingRelation(offers.error)) return sendJson(res, 503, { error:'DEAL_OFFERS_READ_FAILED' });
  if (closingItems.error && !isMissingRelation(closingItems.error)) return sendJson(res, 503, { error:'DEAL_CLOSING_READ_FAILED' });
  if (closingRecords.error && !isMissingRelation(closingRecords.error)) return sendJson(res, 503, { error:'DEAL_CLOSING_READ_FAILED' });

  const members = await supabase.from('bonds_deal_members').select('*').eq('deal_id', dealId).order('created_at', { ascending:true });

  return sendJson(res, 200, {
    deal,
    access:accessSummary(resolved.access),
    members:members.error ? [] : (members.data || []),
    workspace:{
      parties:parties.data || [],
      tasks:tasks.data || [],
      due_diligence:dueDiligence.data || [],
      documents:documents.data || [],
      document_requests:documentRequests.error ? [] : (documentRequests.data || []),
      pipeline:pipeline.error ? [] : (pipeline.data || []),
      offers:offers.error ? [] : (offers.data || []),
      closing_items:closingItems.error ? [] : (closingItems.data || []),
      closing_records:closingRecords.error ? [] : (closingRecords.data || [])
    }
  });
}

async function getMemberDeal(res, supabase, resolved, dealId) {
  const { access } = resolved;
  const deal = memberView(resolved.deal);
  const summary = accessSummary(access);
  const empty = { parties:[], tasks:[], due_diligence:[], documents:[], document_requests:[], pipeline:[], offers:[], closing_items:[], closing_records:[] };

  if (!can(access, ACTIONS.VIEW_WORKSPACE)) {
    return sendJson(res, 200, { deal, access:summary, members:[access.member], workspace:empty });
  }

  if (access.member.side === 'counterparty') {
    const [documents, grants, requests] = await Promise.all([
      supabase.from('bonds_deal_documents')
        .select('id,name,category,status,confidentiality,visibility,version,created_at,updated_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending:false }),
      supabase.from('bonds_deal_document_grants')
        .select('document_id,member_id,status,access_level')
        .eq('deal_id', dealId)
        .eq('member_id', access.member.id)
        .eq('status', 'active'),
      supabase.from('bonds_deal_document_requests')
        .select('*')
        .eq('deal_id', dealId)
        .eq('requested_from_member_id', access.member.id)
        .order('created_at', { ascending:false })
    ]);
    if (isMissingColumn(documents.error) || isMissingRelation(grants.error) || isMissingRelation(requests.error)) {
      return sendJson(res, 200, { deal, access:summary, members:[access.member], workspace:empty });
    }
    if (documents.error || grants.error || requests.error) return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });
    const visibleDocuments = (documents.data || []).filter(document =>
      memberCanSeeDocument(
        document,
        access.member,
        (grants.data || []).filter(grant => grant.document_id === document.id)
      )
    );
    return sendJson(res, 200, {
      deal,
      access:summary,
      members:[access.member],
      workspace:{ ...empty, documents:visibleDocuments, document_requests:requests.data || [] }
    });
  }

  const [parties, tasks, dueDiligence, documents, members, documentRequests, pipeline, offers, closingItems, closingRecords] = await Promise.all([
    supabase.from('bonds_deal_parties').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_tasks').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_due_diligence_items').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_members').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_document_requests').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_pipeline_entries').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_offers').select('*').eq('deal_id', dealId).order('received_at', { ascending:false }),
    supabase.from('bonds_deal_closing_items').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_closing_records').select('*').eq('deal_id', dealId).order('effective_at', { ascending:false })
  ]);
  const failed = [parties, tasks, dueDiligence, documents, members].find(row => row.error);
  if (failed) return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });
  if (documentRequests.error && !isMissingRelation(documentRequests.error)) {
    return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });
  }
  return sendJson(res, 200, {
    deal,
    access:summary,
    members:members.data || [],
    workspace:{
      parties:parties.data || [],
      tasks:tasks.data || [],
      due_diligence:dueDiligence.data || [],
      documents:documents.data || [],
      document_requests:documentRequests.data || [],
      pipeline:pipeline.error ? [] : (pipeline.data || []),
      offers:offers.error ? [] : (offers.data || []),
      closing_items:closingItems.error ? [] : (closingItems.data || []),
      closing_records:closingRecords.error ? [] : (closingRecords.data || [])
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


async function recordDataRoomEvent(supabase, event) {
  try {
    await supabase.from('bonds_deal_document_access_log').insert({ metadata:{}, ...event });
  } catch (_err) {
    // Access logging must not break the primary operation.
  }
}

async function loadDealDocument(res, supabase, dealId, documentId) {
  const { data, error } = await supabase.from('bonds_deal_documents')
    .select('*').eq('id', documentId).eq('deal_id', dealId).maybeSingle();
  if (error) { sendJson(res, 503, { error:'DEAL_DOCUMENT_READ_FAILED' }); return null; }
  if (!data) { sendJson(res, 404, { error:'DEAL_DOCUMENT_NOT_FOUND' }); return null; }
  return data;
}

async function loadDocumentRequest(res, supabase, dealId, requestId) {
  const { data, error } = await supabase.from('bonds_deal_document_requests')
    .select('*').eq('id', requestId).eq('deal_id', dealId).maybeSingle();
  if (error) { sendJson(res, 503, { error:'DEAL_DOCUMENT_REQUEST_READ_FAILED' }); return null; }
  if (!data) { sendJson(res, 404, { error:'DEAL_DOCUMENT_REQUEST_NOT_FOUND' }); return null; }
  return data;
}

async function listDocumentRequests(res, supabase, user, dealId) {
  let resolved;
  try { resolved = await resolveAccess(supabase, user, dealId); }
  catch (_err) { return sendJson(res, 503, { error:'DEAL_READ_FAILED' }); }
  if (!resolved) return sendJson(res, 404, { error:'DEAL_NOT_FOUND' });

  let query = supabase.from('bonds_deal_document_requests').select('*').eq('deal_id', dealId).order('created_at', { ascending:false });
  if (resolved.access.mode === 'member' && resolved.access.member.side === 'counterparty') {
    if (!can(resolved.access, ACTIONS.VIEW_WORKSPACE)) return sendJson(res, 200, { requests:[] });
    query = query.eq('requested_from_member_id', resolved.access.member.id);
  } else if (!can(resolved.access, ACTIONS.VIEW_WORKSPACE)) {
    return sendJson(res, 403, { error:'DEAL_ACTION_FORBIDDEN' });
  }
  const { data, error } = await query;
  if (error) return sendJson(res, 503, { error:'DEAL_DOCUMENT_REQUESTS_READ_FAILED' });
  return sendJson(res, 200, { requests:data || [] });
}

async function createDocumentRequest(req, res, supabase, user, dealId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let normalized;
  try { normalized = normalizeDocumentRequest(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  if (normalized.requested_from_member_id) {
    const member = await loadMember(res, supabase, dealId, normalized.requested_from_member_id);
    if (!member) return undefined;
    if (member.side !== 'counterparty' || member.status === 'revoked') {
      return sendJson(res, 422, { error:'DOCUMENT_REQUEST_MEMBER_INVALID' });
    }
  }

  const { data, error } = await supabase.from('bonds_deal_document_requests')
    .insert({ deal_id:dealId, ...normalized, created_by:user.id })
    .select().single();
  if (error) return sendJson(res, 503, { error:'DEAL_DOCUMENT_REQUEST_CREATE_FAILED' });
  await recordDataRoomEvent(supabase, {
    deal_id:dealId, document_id:null, version_id:null, actor_id:user.id,
    action:'request_created', metadata:{ request_id:data.id, requested_from_member_id:data.requested_from_member_id }
  });
  await recordEvent(supabase, {
    deal_id:dealId, event_type:'document_request_created', entity_type:'deal_document_request',
    entity_id:data.id, actor_id:user.id, metadata:{}
  });
  return sendJson(res, 201, { request:data });
}

async function patchDocumentRequest(req, res, supabase, user, dealId, requestId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const current = await loadDocumentRequest(res, supabase, dealId, requestId);
  if (!current) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let patch;
  try { patch = normalizeDocumentRequestPatch(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  if (patch.requested_from_member_id) {
    const member = await loadMember(res, supabase, dealId, patch.requested_from_member_id);
    if (!member) return undefined;
    if (member.side !== 'counterparty' || member.status === 'revoked') {
      return sendJson(res, 422, { error:'DOCUMENT_REQUEST_MEMBER_INVALID' });
    }
  }
  if (patch.status === 'fulfilled') {
    if (!current.document_id) return sendJson(res, 409, { error:'DOCUMENT_REQUEST_FILE_REQUIRED' });
    patch.fulfilled_at = new Date().toISOString();
    patch.fulfilled_by = user.id;
  }

  const { data, error } = await supabase.from('bonds_deal_document_requests')
    .update(patch).eq('id', requestId).eq('deal_id', dealId).select().maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_DOCUMENT_REQUEST_UPDATE_FAILED' });
  return sendJson(res, 200, { request:data });
}

async function patchDueDiligence(req, res, supabase, user, dealId, itemId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let patch;
  try { patch = normalizeDueDiligencePatch(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  if (patch.assigned_member_id) {
    const member = await loadMember(res, supabase, dealId, patch.assigned_member_id);
    if (!member) return undefined;
  }
  if (patch.evidence_document_id) {
    const document = await loadDealDocument(res, supabase, dealId, patch.evidence_document_id);
    if (!document) return undefined;
  }

  const { data, error } = await supabase.from('bonds_deal_due_diligence_items')
    .update(patch).eq('id', itemId).eq('deal_id', dealId).select().maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_DD_UPDATE_FAILED' });
  if (!data) return sendJson(res, 404, { error:'DEAL_DD_NOT_FOUND' });
  await recordDataRoomEvent(supabase, {
    deal_id:dealId, document_id:patch.evidence_document_id || null, version_id:null,
    actor_id:user.id, action:'due_diligence_updated', metadata:{ item_id:itemId, fields:Object.keys(patch) }
  });
  await recordEvent(supabase, {
    deal_id:dealId, event_type:'due_diligence_item_updated', entity_type:'due_diligence_item',
    entity_id:itemId, actor_id:user.id, metadata:{ fields:Object.keys(patch) }
  });
  return sendJson(res, 200, { due_diligence_item:data });
}

async function patchDocument(req, res, supabase, user, dealId, documentId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const current = await loadDealDocument(res, supabase, dealId, documentId);
  if (!current) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let patch;
  try { patch = normalizeDocumentPatch(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  if (['received','reviewed','approved'].includes(patch.status)) {
    const { data:readyVersions, error:readyError } = await supabase.from('bonds_deal_document_versions')
      .select('id').eq('document_id', documentId).eq('deal_id', dealId).eq('upload_status', 'ready').limit(1);
    if (readyError) return sendJson(res, 503, { error:'DEAL_DOCUMENT_VERSION_READ_FAILED' });
    if (!Array.isArray(readyVersions) || readyVersions.length === 0) {
      return sendJson(res, 409, { error:'DEAL_DOCUMENT_FILE_NOT_READY' });
    }
  }

  const { data, error } = await supabase.from('bonds_deal_documents')
    .update(patch).eq('id', documentId).eq('deal_id', dealId).select().maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_DOCUMENT_UPDATE_FAILED' });
  return sendJson(res, 200, { document:data });
}

async function setDocumentGrant(req, res, supabase, user, dealId, documentId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.MANAGE_MEMBERS);
  if (!resolved) return undefined;
  const document = await loadDealDocument(res, supabase, dealId, documentId);
  if (!document) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let normalized;
  try { normalized = normalizeGrant(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }
  const member = await loadMember(res, supabase, dealId, normalized.member_id);
  if (!member) return undefined;
  if (member.side !== 'counterparty') return sendJson(res, 422, { error:'DOCUMENT_GRANT_MEMBER_INVALID' });

  const { data:existing, error:readError } = await supabase.from('bonds_deal_document_grants')
    .select('id').eq('document_id', documentId).eq('member_id', normalized.member_id).maybeSingle();
  if (readError) return sendJson(res, 503, { error:'DEAL_DOCUMENT_GRANT_READ_FAILED' });

  let result;
  if (existing) {
    result = await supabase.from('bonds_deal_document_grants').update({
      access_level:normalized.access_level, status:normalized.status, granted_by:user.id
    }).eq('id', existing.id).select().single();
  } else {
    result = await supabase.from('bonds_deal_document_grants').insert({
      deal_id:dealId, document_id:documentId, ...normalized, granted_by:user.id
    }).select().single();
  }
  if (result.error) return sendJson(res, 503, { error:'DEAL_DOCUMENT_GRANT_WRITE_FAILED' });
  await recordDataRoomEvent(supabase, {
    deal_id:dealId, document_id:documentId, version_id:null, actor_id:user.id,
    action:'grant_changed', metadata:{ member_id:normalized.member_id, status:normalized.status }
  });
  return sendJson(res, 200, { grant:result.data });
}

async function createPendingVersion(supabase, user, dealId, document, spec, requestId) {
  const { data:latest, error:versionError } = await supabase.from('bonds_deal_document_versions')
    .select('version').eq('document_id', document.id).order('version', { ascending:false }).limit(1);
  if (versionError) throw versionError;
  const version = Array.isArray(latest) && latest[0] ? Number(latest[0].version) + 1 : 1;
  const storagePath = buildStoragePath(dealId, document.id, version, spec.file_name);
  const { data:row, error:insertError } = await supabase.from('bonds_deal_document_versions').insert({
    deal_id:dealId,
    document_id:document.id,
    request_id:requestId || null,
    version,
    file_name:spec.file_name,
    storage_bucket:DATA_ROOM_BUCKET,
    storage_path:storagePath,
    content_type:spec.content_type,
    size_bytes:spec.size_bytes,
    checksum_sha256:spec.checksum_sha256,
    upload_status:'pending',
    uploaded_by:user.id
  }).select().single();
  if (insertError) throw insertError;

  const { data:signed, error:signError } = await supabase.storage.from(DATA_ROOM_BUCKET).createSignedUploadUrl(storagePath);
  if (signError || !signed) {
    await supabase.from('bonds_deal_document_versions').update({ upload_status:'failed' }).eq('id', row.id);
    throw signError || new Error('SIGNED_UPLOAD_URL_FAILED');
  }
  await recordDataRoomEvent(supabase, {
    deal_id:dealId, document_id:document.id, version_id:row.id, actor_id:user.id,
    action:'upload_url_created', metadata:{ request_id:requestId || null, version }
  });
  return { row, signed };
}

async function createDocumentUploadUrl(req, res, supabase, user, dealId, documentId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const document = await loadDealDocument(res, supabase, dealId, documentId);
  if (!document) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let spec;
  try { spec = normalizeUploadSpec(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }
  try {
    const { row, signed } = await createPendingVersion(supabase, user, dealId, document, spec, null);
    return sendJson(res, 201, {
      upload:{ bucket:DATA_ROOM_BUCKET, path:row.storage_path, token:signed.token, signed_url:signed.signedUrl },
      version:row
    });
  } catch (_err) {
    return sendJson(res, 503, { error:'DEAL_DOCUMENT_UPLOAD_URL_FAILED' });
  }
}

async function createRequestUploadUrl(req, res, supabase, user, dealId, requestId) {
  let resolved;
  try { resolved = await resolveAccess(supabase, user, dealId); }
  catch (_err) { return sendJson(res, 503, { error:'DEAL_READ_FAILED' }); }
  if (!resolved) return sendJson(res, 404, { error:'DEAL_NOT_FOUND' });
  const request = await loadDocumentRequest(res, supabase, dealId, requestId);
  if (!request) return undefined;

  const teamAllowed = can(resolved.access, ACTIONS.EDIT_WORKSPACE);
  const counterpartyAllowed = resolved.access.mode === 'member' &&
    memberCanUploadRequest(request, resolved.access.member);
  if (!teamAllowed && !counterpartyAllowed) return sendJson(res, 403, { error:'DEAL_ACTION_FORBIDDEN' });

  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let spec;
  try { spec = normalizeUploadSpec(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  let document = null;
  if (request.document_id) {
    document = await loadDealDocument(res, supabase, dealId, request.document_id);
    if (!document) return undefined;
  } else {
    const { data, error } = await supabase.from('bonds_deal_documents').insert({
      deal_id:dealId,
      name:request.title,
      category:request.category || 'general',
      status:'requested',
      confidentiality:'confidential',
      visibility:'team',
      version:1,
      metadata:{ request_id:request.id }
    }).select().single();
    if (error) return sendJson(res, 503, { error:'DEAL_DOCUMENT_CREATE_FAILED' });
    document = data;
    await supabase.from('bonds_deal_document_requests').update({ document_id:document.id }).eq('id', request.id);
  }

  try {
    const { row, signed } = await createPendingVersion(supabase, user, dealId, document, spec, request.id);
    return sendJson(res, 201, {
      upload:{ bucket:DATA_ROOM_BUCKET, path:row.storage_path, token:signed.token, signed_url:signed.signedUrl },
      version:row,
      document
    });
  } catch (_err) {
    return sendJson(res, 503, { error:'DEAL_DOCUMENT_UPLOAD_URL_FAILED' });
  }
}

async function confirmDocumentUpload(req, res, supabase, user, dealId, documentId) {
  let resolved;
  try { resolved = await resolveAccess(supabase, user, dealId); }
  catch (_err) { return sendJson(res, 503, { error:'DEAL_READ_FAILED' }); }
  if (!resolved) return sendJson(res, 404, { error:'DEAL_NOT_FOUND' });
  const document = await loadDealDocument(res, supabase, dealId, documentId);
  if (!document) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  const versionId = String(parsed.body.version_id || '').trim();
  if (!versionId) return sendJson(res, 422, { error:'VERSION_ID_REQUIRED' });

  const { data:version, error } = await supabase.from('bonds_deal_document_versions')
    .select('*').eq('id', versionId).eq('document_id', documentId).eq('deal_id', dealId).maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_DOCUMENT_VERSION_READ_FAILED' });
  if (!version) return sendJson(res, 404, { error:'DEAL_DOCUMENT_VERSION_NOT_FOUND' });

  const teamAllowed = can(resolved.access, ACTIONS.EDIT_WORKSPACE);
  const uploaderAllowed = resolved.access.mode === 'member' && version.uploaded_by === user.id;
  if (!teamAllowed && !uploaderAllowed) return sendJson(res, 403, { error:'DEAL_ACTION_FORBIDDEN' });
  if (version.upload_status === 'ready') return sendJson(res, 200, { version, document });

  const slash = version.storage_path.lastIndexOf('/');
  const folder = slash >= 0 ? version.storage_path.slice(0, slash) : '';
  const file = slash >= 0 ? version.storage_path.slice(slash + 1) : version.storage_path;
  const { data:list, error:listError } = await supabase.storage.from(DATA_ROOM_BUCKET).list(folder, { search:file, limit:10 });
  if (listError) return sendJson(res, 503, { error:'DEAL_DOCUMENT_STORAGE_VERIFY_FAILED' });
  const stored = (list || []).find(item => item.name === file);
  if (!stored) return sendJson(res, 409, { error:'DEAL_DOCUMENT_UPLOAD_NOT_FOUND' });

  const confirmedAt = new Date().toISOString();
  const { data:ready, error:updateError } = await supabase.from('bonds_deal_document_versions')
    .update({ upload_status:'ready', confirmed_at:confirmedAt }).eq('id', version.id).select().single();
  if (updateError) return sendJson(res, 503, { error:'DEAL_DOCUMENT_VERSION_UPDATE_FAILED' });

  const { data:updatedDocument, error:documentError } = await supabase.from('bonds_deal_documents').update({
    status:'received',
    version:ready.version,
    storage_bucket:ready.storage_bucket,
    storage_path:ready.storage_path
  }).eq('id', documentId).eq('deal_id', dealId).select().single();
  if (documentError) return sendJson(res, 503, { error:'DEAL_DOCUMENT_UPDATE_FAILED' });

  if (ready.request_id) {
    await supabase.from('bonds_deal_document_requests').update({ status:'submitted' }).eq('id', ready.request_id);
  }
  await recordDataRoomEvent(supabase, {
    deal_id:dealId, document_id:documentId, version_id:ready.id, actor_id:user.id,
    action:'upload_confirmed', metadata:{ request_id:ready.request_id || null, version:ready.version }
  });
  return sendJson(res, 200, { version:ready, document:updatedDocument });
}

async function createDocumentDownloadUrl(req, res, supabase, user, dealId, documentId) {
  let resolved;
  try { resolved = await resolveAccess(supabase, user, dealId); }
  catch (_err) { return sendJson(res, 503, { error:'DEAL_READ_FAILED' }); }
  if (!resolved) return sendJson(res, 404, { error:'DEAL_NOT_FOUND' });
  const document = await loadDealDocument(res, supabase, dealId, documentId);
  if (!document) return undefined;

  let allowed = can(resolved.access, ACTIONS.VIEW_WORKSPACE) && !(resolved.access.mode === 'member' && resolved.access.member.side === 'counterparty');
  if (resolved.access.mode === 'member' && resolved.access.member.side === 'counterparty') {
    const { data:grants, error:grantError } = await supabase.from('bonds_deal_document_grants')
      .select('member_id,status,access_level').eq('document_id', documentId).eq('deal_id', dealId);
    if (grantError) return sendJson(res, 503, { error:'DEAL_DOCUMENT_GRANT_READ_FAILED' });
    allowed = memberCanSeeDocument(document, resolved.access.member, grants || []);
  }
  if (!allowed) return sendJson(res, 403, { error:'DEAL_DOCUMENT_ACCESS_FORBIDDEN' });

  const { data:versions, error } = await supabase.from('bonds_deal_document_versions')
    .select('*').eq('document_id', documentId).eq('deal_id', dealId).eq('upload_status', 'ready')
    .order('version', { ascending:false }).limit(1);
  if (error) return sendJson(res, 503, { error:'DEAL_DOCUMENT_VERSION_READ_FAILED' });
  const version = Array.isArray(versions) ? versions[0] : null;
  if (!version) return sendJson(res, 409, { error:'DEAL_DOCUMENT_FILE_NOT_READY' });

  const { data:signed, error:signError } = await supabase.storage.from(DATA_ROOM_BUCKET)
    .createSignedUrl(version.storage_path, 60, { download:version.file_name });
  if (signError || !signed?.signedUrl) return sendJson(res, 503, { error:'DEAL_DOCUMENT_DOWNLOAD_URL_FAILED' });
  await recordDataRoomEvent(supabase, {
    deal_id:dealId, document_id:documentId, version_id:version.id, actor_id:user.id,
    action:'download_url_created', metadata:{ version:version.version }
  });
  return sendJson(res, 200, { signed_url:signed.signedUrl, expires_in:60, version:{ id:version.id, version:version.version, file_name:version.file_name } });
}


async function createPipelineEntry(req, res, supabase, user, dealId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let payload;
  try { payload = normalizePipelineCreate(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const { data:party, error:partyError } = await supabase.from('bonds_deal_parties')
    .select('id,party_role').eq('id', payload.party_id).eq('deal_id', dealId).maybeSingle();
  if (partyError) return sendJson(res, 503, { error:'DEAL_PARTY_READ_FAILED' });
  if (!party) return sendJson(res, 422, { error:'PIPELINE_PARTY_NOT_FOUND' });
  if (!['investor','lender','buyer'].includes(party.party_role)) return sendJson(res, 422, { error:'PIPELINE_PARTY_ROLE_INVALID' });
  if (party.party_role !== payload.kind) return sendJson(res, 422, { error:'PIPELINE_KIND_PARTY_MISMATCH' });

  if (payload.member_id) {
    const { data:member, error:memberError } = await supabase.from('bonds_deal_members')
      .select('id,side,status').eq('id', payload.member_id).eq('deal_id', dealId).maybeSingle();
    if (memberError) return sendJson(res, 503, { error:'DEAL_MEMBER_READ_FAILED' });
    if (!member || member.side !== 'counterparty' || member.status === 'revoked') return sendJson(res, 422, { error:'PIPELINE_MEMBER_INVALID' });
  }

  const { data:existing, error:existingError } = await supabase.from('bonds_deal_pipeline_entries')
    .select('id').eq('deal_id', dealId).eq('party_id', payload.party_id).maybeSingle();
  if (existingError && !isMissingRelation(existingError)) return sendJson(res, 503, { error:'DEAL_PIPELINE_READ_FAILED' });
  if (existing) return sendJson(res, 409, { error:'PIPELINE_PARTY_ALREADY_EXISTS' });

  const { data, error } = await supabase.from('bonds_deal_pipeline_entries')
    .insert({ deal_id:dealId, created_by:user.id, ...payload }).select().single();
  if (error) return sendJson(res, error.code === '23505' ? 409 : 503, { error:error.code === '23505' ? 'PIPELINE_PARTY_ALREADY_EXISTS' : 'DEAL_PIPELINE_CREATE_FAILED' });
  await recordEvent(supabase, { deal_id:dealId, event_type:'pipeline_entry_created', entity_type:'deal_pipeline', entity_id:data.id, actor_id:user.id, metadata:{ kind:data.kind, status:data.status } });
  return sendJson(res, 201, { pipeline_entry:data });
}

async function patchPipelineEntry(req, res, supabase, user, dealId, entryId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let patch;
  try { patch = normalizePipelinePatch(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const { data, error } = await supabase.from('bonds_deal_pipeline_entries')
    .update(patch).eq('id', entryId).eq('deal_id', dealId).select().maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_PIPELINE_UPDATE_FAILED' });
  if (!data) return sendJson(res, 404, { error:'DEAL_PIPELINE_NOT_FOUND' });
  await recordEvent(supabase, { deal_id:dealId, event_type:'pipeline_entry_updated', entity_type:'deal_pipeline', entity_id:entryId, actor_id:user.id, metadata:{ fields:Object.keys(patch), status:data.status } });
  return sendJson(res, 200, { pipeline_entry:data });
}

async function createOffer(req, res, supabase, user, dealId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let payload;
  try { payload = normalizeOfferCreate(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const { data:entry, error:entryError } = await supabase.from('bonds_deal_pipeline_entries')
    .select('id').eq('id', payload.pipeline_entry_id).eq('deal_id', dealId).maybeSingle();
  if (entryError) return sendJson(res, 503, { error:'DEAL_PIPELINE_READ_FAILED' });
  if (!entry) return sendJson(res, 422, { error:'OFFER_PIPELINE_NOT_FOUND' });

  if (payload.document_id) {
    const { data:document, error:documentError } = await supabase.from('bonds_deal_documents')
      .select('id').eq('id', payload.document_id).eq('deal_id', dealId).maybeSingle();
    if (documentError) return sendJson(res, 503, { error:'DEAL_DOCUMENT_READ_FAILED' });
    if (!document) return sendJson(res, 422, { error:'OFFER_DOCUMENT_NOT_FOUND' });
  }

  const { data, error } = await supabase.from('bonds_deal_offers')
    .insert({ deal_id:dealId, created_by:user.id, ...payload }).select().single();
  if (error) return sendJson(res, 503, { error:'DEAL_OFFER_CREATE_FAILED' });

  const nextStatus = payload.offer_type === 'ioi' ? 'ioi_received' : 'term_sheet_received';
  await supabase.from('bonds_deal_pipeline_entries').update({ status:nextStatus }).eq('id', payload.pipeline_entry_id).eq('deal_id', dealId);
  await recordEvent(supabase, { deal_id:dealId, event_type:'offer_received', entity_type:'deal_offer', entity_id:data.id, actor_id:user.id, metadata:{ offer_type:data.offer_type, pipeline_entry_id:data.pipeline_entry_id } });
  return sendJson(res, 201, { offer:data });
}

async function patchOffer(req, res, supabase, user, dealId, offerId) {
  const resolved = await authorize(res, supabase, user, dealId, ACTIONS.EDIT_WORKSPACE);
  if (!resolved) return undefined;
  const parsed = await readBody(req, res);
  if (!parsed) return undefined;
  let patch;
  try { patch = normalizeOfferPatch(parsed.body); }
  catch (err) { return sendJson(res, 422, { error:err.message }); }

  const { data, error } = await supabase.from('bonds_deal_offers')
    .update(patch).eq('id', offerId).eq('deal_id', dealId).select().maybeSingle();
  if (error) return sendJson(res, 503, { error:'DEAL_OFFER_UPDATE_FAILED' });
  if (!data) return sendJson(res, 404, { error:'DEAL_OFFER_NOT_FOUND' });
  await recordEvent(supabase, { deal_id:dealId, event_type:'offer_updated', entity_type:'deal_offer', entity_id:offerId, actor_id:user.id, metadata:{ fields:Object.keys(patch), status:data.status } });
  return sendJson(res, 200, { offer:data });
}


async function validateClosingRecord(res, supabase, dealId, record) {
  const finalStatus = (
    (record.record_type === 'term_sheet' && record.status === 'signed') ||
    (record.record_type === 'cap_table' && record.status === 'approved') ||
    (record.record_type === 'funding_confirmation' && record.status === 'confirmed')
  );
  if (finalStatus && !record.document_id) {
    sendJson(res, 422, { error:'CLOSING_EVIDENCE_DOCUMENT_REQUIRED' });
    return false;
  }
  if (record.document_id) {
    const { data:document, error } = await supabase.from('bonds_deal_documents')
      .select('id').eq('id', record.document_id).eq('deal_id', dealId).maybeSingle();
    if (error) { sendJson(res, 503, { error:'DEAL_DOCUMENT_READ_FAILED' }); return false; }
    if (!document) { sendJson(res, 422, { error:'CLOSING_DOCUMENT_NOT_FOUND' }); return false; }
    if (finalStatus) {
      const { data:versions, error:versionError } = await supabase.from('bonds_deal_document_versions')
        .select('id').eq('deal_id', dealId).eq('document_id', record.document_id)
        .eq('upload_status','ready').limit(1);
      if (versionError) { sendJson(res, 503, { error:'DEAL_DOCUMENT_VERSION_READ_FAILED' }); return false; }
      if (!versions?.length) { sendJson(res, 409, { error:'CLOSING_EVIDENCE_FILE_NOT_READY' }); return false; }
    }
  }
  if (record.record_type === 'term_sheet' && record.status === 'signed') {
    if (!record.offer_id) { sendJson(res, 422, { error:'CLOSING_TERM_SHEET_OFFER_REQUIRED' }); return false; }
    const { data:offer, error } = await supabase.from('bonds_deal_offers')
      .select('id,offer_type,status').eq('id', record.offer_id).eq('deal_id', dealId).maybeSingle();
    if (error) { sendJson(res, 503, { error:'DEAL_OFFER_READ_FAILED' }); return false; }
    if (!offer || !['term_sheet','revised_term_sheet'].includes(offer.offer_type)) {
      sendJson(res, 422, { error:'CLOSING_TERM_SHEET_OFFER_INVALID' }); return false;
    }
    if (offer.status !== 'accepted') { sendJson(res, 409, { error:'CLOSING_TERM_SHEET_OFFER_NOT_ACCEPTED' }); return false; }
  }
  if (record.record_type === 'cap_table' && record.status === 'approved') {
    const { data:records, error } = await supabase.from('bonds_deal_closing_records')
      .select('id').eq('deal_id', dealId).eq('record_type','term_sheet').eq('status','signed').limit(1);
    if (error) { sendJson(res, 503, { error:'DEAL_CLOSING_READ_FAILED' }); return false; }
    if (!records?.length) { sendJson(res, 409, { error:'CLOSING_TERM_SHEET_NOT_SIGNED' }); return false; }
  }
  if (record.record_type === 'funding_confirmation' && record.status === 'confirmed') {
    const [capTable, items] = await Promise.all([
      supabase.from('bonds_deal_closing_records').select('id').eq('deal_id', dealId).eq('record_type','cap_table').eq('status','approved').limit(1),
      supabase.from('bonds_deal_closing_items').select('id,title,status,required').eq('deal_id', dealId)
    ]);
    if (capTable.error || items.error) { sendJson(res, 503, { error:'DEAL_CLOSING_READ_FAILED' }); return false; }
    if (!capTable.data?.length) { sendJson(res, 409, { error:'CLOSING_CAP_TABLE_NOT_APPROVED' }); return false; }
    const openRequired=(items.data||[]).filter(item=>item.required!==false&&!['satisfied','waived'].includes(item.status));
    if (openRequired.length) {
      sendJson(res, 409, { error:'CLOSING_CONDITIONS_INCOMPLETE', open_required:openRequired.map(item=>({id:item.id,title:item.title,status:item.status})) });
      return false;
    }
  }
  return true;
}

async function createClosingItem(req,res,supabase,user,dealId){
  const resolved=await authorize(res,supabase,user,dealId,ACTIONS.EDIT_WORKSPACE);
  if(!resolved)return undefined;
  const parsed=await readBody(req,res);if(!parsed)return undefined;
  let payload;try{payload=normalizeClosingItemCreate(parsed.body)}catch(err){return sendJson(res,422,{error:err.message})}
  if(payload.evidence_document_id){
    const {data:document,error}=await supabase.from('bonds_deal_documents').select('id').eq('id',payload.evidence_document_id).eq('deal_id',dealId).maybeSingle();
    if(error)return sendJson(res,503,{error:'DEAL_DOCUMENT_READ_FAILED'});
    if(!document)return sendJson(res,422,{error:'CLOSING_DOCUMENT_NOT_FOUND'});
  }
  if(['satisfied','waived'].includes(payload.status)){payload.satisfied_by=user.id;payload.satisfied_at=new Date().toISOString()}
  const {data,error}=await supabase.from('bonds_deal_closing_items').insert({deal_id:dealId,created_by:user.id,...payload}).select().single();
  if(error)return sendJson(res,503,{error:'DEAL_CLOSING_ITEM_CREATE_FAILED'});
  await recordEvent(supabase,{deal_id:dealId,event_type:'closing_item_created',entity_type:'deal_closing_item',entity_id:data.id,actor_id:user.id,metadata:{status:data.status,required:data.required}});
  return sendJson(res,201,{closing_item:data});
}

async function patchClosingItem(req,res,supabase,user,dealId,itemId){
  const resolved=await authorize(res,supabase,user,dealId,ACTIONS.EDIT_WORKSPACE);
  if(!resolved)return undefined;
  const parsed=await readBody(req,res);if(!parsed)return undefined;
  const {data:current,error:readError}=await supabase.from('bonds_deal_closing_items').select('*').eq('id',itemId).eq('deal_id',dealId).maybeSingle();
  if(readError)return sendJson(res,503,{error:'DEAL_CLOSING_READ_FAILED'});
  if(!current)return sendJson(res,404,{error:'DEAL_CLOSING_ITEM_NOT_FOUND'});
  let patch;try{patch=normalizeClosingItemPatch(parsed.body)}catch(err){return sendJson(res,422,{error:err.message})}
  if(patch.evidence_document_id){
    const {data:document,error}=await supabase.from('bonds_deal_documents').select('id').eq('id',patch.evidence_document_id).eq('deal_id',dealId).maybeSingle();
    if(error)return sendJson(res,503,{error:'DEAL_DOCUMENT_READ_FAILED'});
    if(!document)return sendJson(res,422,{error:'CLOSING_DOCUMENT_NOT_FOUND'});
  }
  if(['satisfied','waived'].includes(patch.status)){patch.satisfied_by=user.id;patch.satisfied_at=new Date().toISOString()}
  else if(patch.status){patch.satisfied_by=null;patch.satisfied_at=null}
  const {data,error}=await supabase.from('bonds_deal_closing_items').update(patch).eq('id',itemId).eq('deal_id',dealId).select().maybeSingle();
  if(error)return sendJson(res,503,{error:'DEAL_CLOSING_ITEM_UPDATE_FAILED'});
  await recordEvent(supabase,{deal_id:dealId,event_type:'closing_item_updated',entity_type:'deal_closing_item',entity_id:itemId,actor_id:user.id,metadata:{fields:Object.keys(patch),status:data.status}});
  return sendJson(res,200,{closing_item:data});
}

async function createClosingRecord(req,res,supabase,user,dealId){
  const resolved=await authorize(res,supabase,user,dealId,ACTIONS.EDIT_WORKSPACE);
  if(!resolved)return undefined;
  const parsed=await readBody(req,res);if(!parsed)return undefined;
  let payload;try{payload=normalizeClosingRecordCreate(parsed.body)}catch(err){return sendJson(res,422,{error:err.message})}
  if(!(await validateClosingRecord(res,supabase,dealId,payload)))return undefined;
  const {data,error}=await supabase.from('bonds_deal_closing_records').insert({deal_id:dealId,created_by:user.id,...payload}).select().single();
  if(error)return sendJson(res,503,{error:'DEAL_CLOSING_RECORD_CREATE_FAILED'});
  await recordEvent(supabase,{deal_id:dealId,event_type:'closing_record_created',entity_type:'deal_closing_record',entity_id:data.id,actor_id:user.id,metadata:{record_type:data.record_type,status:data.status}});
  return sendJson(res,201,{closing_record:data});
}

async function patchClosingRecord(req,res,supabase,user,dealId,recordId){
  const resolved=await authorize(res,supabase,user,dealId,ACTIONS.EDIT_WORKSPACE);
  if(!resolved)return undefined;
  const parsed=await readBody(req,res);if(!parsed)return undefined;
  const {data:current,error:readError}=await supabase.from('bonds_deal_closing_records').select('*').eq('id',recordId).eq('deal_id',dealId).maybeSingle();
  if(readError)return sendJson(res,503,{error:'DEAL_CLOSING_READ_FAILED'});
  if(!current)return sendJson(res,404,{error:'DEAL_CLOSING_RECORD_NOT_FOUND'});
  let patch;try{patch=normalizeClosingRecordPatch(parsed.body,current)}catch(err){return sendJson(res,422,{error:err.message})}
  const next={...current,...patch};
  if(!(await validateClosingRecord(res,supabase,dealId,next)))return undefined;
  const {data,error}=await supabase.from('bonds_deal_closing_records').update(patch).eq('id',recordId).eq('deal_id',dealId).select().maybeSingle();
  if(error)return sendJson(res,503,{error:'DEAL_CLOSING_RECORD_UPDATE_FAILED'});
  await recordEvent(supabase,{deal_id:dealId,event_type:'closing_record_updated',entity_type:'deal_closing_record',entity_id:recordId,actor_id:user.id,metadata:{record_type:data.record_type,status:data.status,fields:Object.keys(patch)}});
  return sendJson(res,200,{closing_record:data});
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

  if (dealId && child === 'requests') {
    if (!childId && req.method === 'GET') return listDocumentRequests(res, supabase, user, dealId);
    if (!childId && req.method === 'POST') return createDocumentRequest(req, res, supabase, user, dealId);
    if (childId && !childAction && req.method === 'PATCH') return patchDocumentRequest(req, res, supabase, user, dealId, childId);
    if (childId && childAction === 'upload-url' && req.method === 'POST') return createRequestUploadUrl(req, res, supabase, user, dealId, childId);
    return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
  }

  if (dealId && child === 'documents' && childId) {
    if (!childAction && req.method === 'PATCH') return patchDocument(req, res, supabase, user, dealId, childId);
    if (childAction === 'grant' && req.method === 'POST') return setDocumentGrant(req, res, supabase, user, dealId, childId);
    if (childAction === 'upload-url' && req.method === 'POST') return createDocumentUploadUrl(req, res, supabase, user, dealId, childId);
    if (childAction === 'confirm-upload' && req.method === 'POST') return confirmDocumentUpload(req, res, supabase, user, dealId, childId);
    if (childAction === 'download-url' && req.method === 'POST') return createDocumentDownloadUrl(req, res, supabase, user, dealId, childId);
    return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
  }

  if (dealId && child === 'pipeline') {
    if (!childId && req.method === 'POST') return createPipelineEntry(req, res, supabase, user, dealId);
    if (childId && !childAction && req.method === 'PATCH') return patchPipelineEntry(req, res, supabase, user, dealId, childId);
    return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
  }

  if (dealId && child === 'offers') {
    if (!childId && req.method === 'POST') return createOffer(req, res, supabase, user, dealId);
    if (childId && !childAction && req.method === 'PATCH') return patchOffer(req, res, supabase, user, dealId, childId);
    return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
  }

  if (dealId && child === 'closing-items') {
    if (!childId && req.method === 'POST') return createClosingItem(req,res,supabase,user,dealId);
    if (childId && !childAction && req.method === 'PATCH') return patchClosingItem(req,res,supabase,user,dealId,childId);
    return sendJson(res,404,{error:'DEAL_ENDPOINT_NOT_FOUND'});
  }

  if (dealId && child === 'closing-records') {
    if (!childId && req.method === 'POST') return createClosingRecord(req,res,supabase,user,dealId);
    if (childId && !childAction && req.method === 'PATCH') return patchClosingRecord(req,res,supabase,user,dealId,childId);
    return sendJson(res,404,{error:'DEAL_ENDPOINT_NOT_FOUND'});
  }

  if (dealId && child === 'due-diligence' && childId) {
    if (!childAction && req.method === 'PATCH') return patchDueDiligence(req, res, supabase, user, dealId, childId);
    return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
  }

  if (dealId && child && childId) return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });

  if (!dealId && req.method === 'GET') return listDeals(res, supabase, user);
  if (!dealId && req.method === 'POST') return createDeal(req, res, supabase, user);
  if (dealId && !child && req.method === 'GET') return getDeal(res, supabase, user, dealId);
  if (dealId && !child && req.method === 'PATCH') return patchDeal(req, res, supabase, user, dealId);
  if (dealId && child && req.method === 'POST') return createChild(req, res, supabase, user, dealId, child);

  return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
}

module.exports = { dealsRouter };
