'use strict';

const {
  normalizeDealCreate,
  normalizeDealPatch,
  normalizeParty,
  normalizeTask,
  normalizeDueDiligenceItem,
  normalizeDocument
} = require('../../lib/deals/deal-domain');

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

async function ownedDeal(supabase, userId, dealId) {
  const { data, error } = await supabase
    .from('bonds_deals')
    .select('id,user_id,deal_number,title,deal_type,stage,status,currency,target_value,summary,metadata,created_at,updated_at')
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function listDeals(res, supabase, user) {
  const { data, error } = await supabase
    .from('bonds_deals')
    .select('id,deal_number,title,deal_type,stage,status,currency,target_value,summary,created_at,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending:false })
    .limit(100);
  if (error) return sendJson(res, 503, { error:'DEAL_LIST_FAILED' });
  return sendJson(res, 200, { deals:data || [] });
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
  return sendJson(res, 201, { deal:data });
}

async function getDeal(res, supabase, user, dealId) {
  let deal;
  try { deal = await ownedDeal(supabase, user.id, dealId); }
  catch (_err) { return sendJson(res, 503, { error:'DEAL_READ_FAILED' }); }
  if (!deal) return sendJson(res, 404, { error:'DEAL_NOT_FOUND' });

  const [parties, tasks, dueDiligence, documents] = await Promise.all([
    supabase.from('bonds_deal_parties').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_tasks').select('*').eq('deal_id', dealId).order('created_at', { ascending:false }),
    supabase.from('bonds_deal_due_diligence_items').select('*').eq('deal_id', dealId).order('created_at', { ascending:true }),
    supabase.from('bonds_deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending:false })
  ]);
  const failed = [parties, tasks, dueDiligence, documents].find(row => row.error);
  if (failed) return sendJson(res, 503, { error:'DEAL_WORKSPACE_READ_FAILED' });

  return sendJson(res, 200, {
    deal,
    workspace:{
      parties:parties.data || [],
      tasks:tasks.data || [],
      due_diligence:dueDiligence.data || [],
      documents:documents.data || []
    }
  });
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
  return sendJson(res, 200, { deal:data });
}

async function createChild(req, res, supabase, user, dealId, kind) {
  let deal;
  try { deal = await ownedDeal(supabase, user.id, dealId); }
  catch (_err) { return sendJson(res, 503, { error:'DEAL_READ_FAILED' }); }
  if (!deal) return sendJson(res, 404, { error:'DEAL_NOT_FOUND' });

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
  return sendJson(res, 201, { [spec.key]:data });
}

async function dealsRouter(req, res, path, supabase, user) {
  if (!user) return sendJson(res, 401, { error:'Unauthorized' });
  const parts = path.split('/').filter(Boolean);
  const dealId = parts[1] || null;
  const child = parts[2] || null;

  if (!dealId && req.method === 'GET') return listDeals(res, supabase, user);
  if (!dealId && req.method === 'POST') return createDeal(req, res, supabase, user);
  if (dealId && !child && req.method === 'GET') return getDeal(res, supabase, user, dealId);
  if (dealId && !child && req.method === 'PATCH') return patchDeal(req, res, supabase, user, dealId);
  if (dealId && child && req.method === 'POST') return createChild(req, res, supabase, user, dealId, child);

  return sendJson(res, 404, { error:'DEAL_ENDPOINT_NOT_FOUND' });
}

module.exports = { dealsRouter };
