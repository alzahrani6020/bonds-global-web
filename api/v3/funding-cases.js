// ============================================
// Funding Cases Admin API
// /api/v3/funding-cases?action=list|detail|update|add-note
// ============================================

const getSupabase = require('../../lib/api/supabase');
const { checkRateLimit } = require('../../lib/api/rate-limit');
const { setAllowedOrigin } = require('../../lib/api/cors');

const OWNER_EMAILS = ['iiffund.dev@gmail.com'];
const CONFIGURED_OWNER = (process.env.ADMIN_EMAIL || (process.env.ADMIN_EMAILS || '').split(',')[0] || '').trim();
if (CONFIGURED_OWNER) OWNER_EMAILS.push(CONFIGURED_OWNER.toLowerCase());

const STATUS_LABELS = {
  ar: {
    new: 'جديد',
    initial_review: 'مراجعة أولية',
    documents_required: 'مستندات مطلوبة',
    under_assessment: 'قيد التقييم',
    funding_options: 'خيارات تمويل',
    submitted_to_provider: 'تم التقديم للجهة',
    provider_review: 'قيد مراجعة الجهة',
    approved: 'موافق عليه',
    declined: 'مرفوض',
    on_hold: 'معلّق',
    closed: 'مغلق'
  },
  en: {
    new: 'New',
    initial_review: 'Initial Review',
    documents_required: 'Documents Required',
    under_assessment: 'Under Assessment',
    funding_options: 'Funding Options',
    submitted_to_provider: 'Submitted to Provider',
    provider_review: 'Provider Review',
    approved: 'Approved',
    declined: 'Declined',
    on_hold: 'On Hold',
    closed: 'Closed'
  }
};

function isOwner(email) {
  return email && OWNER_EMAILS.includes(email.toLowerCase());
}

async function verifyAdmin(req) {
  const auth = req.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) throw Object.assign(new Error('Admin authentication required'), { status: 401 });

  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error('Invalid token'), { status: 401 });
  const user = data.user;

  if (isOwner(user.email)) return user;

  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role || !['super_admin', 'admin', 'support'].includes(role.role)) {
    throw Object.assign(new Error('Admin role required'), { status: 403 });
  }
  return user;
}

function sanitizeText(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

async function getCases(sb, params) {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(100, Math.max(5, parseInt(params.limit || '20', 10)));
  const offset = (page - 1) * limit;

  let query = sb
    .from('funding_cases')
    .select('id, case_reference, status, source, name, company, email, phone, country, financing_type, amount, purpose_category, sector, readiness_score, assigned_to, provider_name, submitted_at, approved_at, closed_at, next_action_at, created_at, updated_at', { count: 'exact' });

  if (params.status) query = query.eq('status', params.status);
  if (params.source) query = query.eq('source', params.source);
  if (params.financingType) query = query.eq('financing_type', params.financingType);
  if (params.assignedTo) query = query.eq('assigned_to', params.assignedTo);
  if (params.search) {
    const term = `%${params.search.replace(/[%_]/g, '\\$&')}%`;
    query = query.or(`case_reference.ilike.${term},company.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  query = query.order('created_at', { ascending: false });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    cases: data || [],
    pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) }
  };
}

async function getCaseDetail(sb, id) {
  const { data: caseData, error } = await sb
    .from('funding_cases')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  const [{ data: events }, { data: documents }] = await Promise.all([
    sb.from('funding_case_events').select('*').eq('case_id', id).order('created_at', { ascending: false }),
    sb.from('funding_case_documents').select('*').eq('case_id', id).order('created_at', { ascending: false })
  ]);

  return { case: caseData, events: events || [], documents: documents || [] };
}

async function updateCase(sb, id, updates, actor) {
  const allowed = ['status', 'assigned_to', 'internal_notes', 'next_action_at', 'provider_name', 'provider_reference', 'approved_at', 'closed_at'];
  const set = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) set[key] = updates[key] === '' ? null : updates[key];
  }
  if (Object.keys(set).length === 0) throw new Error('No valid fields to update');
  set.updated_at = new Date().toISOString();

  const { data: before } = await sb.from('funding_cases').select('status').eq('id', id).single();

  const { data, error } = await sb.from('funding_cases').update(set).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);

  if (updates.status && before && before.status !== updates.status) {
    await sb.from('funding_case_events').insert({
      case_id: id,
      event_type: 'status_changed',
      from_status: before.status,
      to_status: updates.status,
      actor_id: actor.id,
      actor_email: actor.email,
      metadata: {}
    });
  }

  if (updates.assigned_to !== undefined) {
    await sb.from('funding_case_events').insert({
      case_id: id,
      event_type: 'assigned',
      actor_id: actor.id,
      actor_email: actor.email,
      metadata: { assigned_to: updates.assigned_to }
    });
  }

  return data;
}

async function addNote(sb, caseId, note, actor) {
  const clean = sanitizeText(note, 2000);
  if (!clean) throw new Error('Note cannot be empty');

  const { data, error } = await sb.from('funding_case_events').insert({
    case_id: caseId,
    event_type: 'note_added',
    note: clean,
    actor_id: actor.id,
    actor_email: actor.email,
    metadata: {}
  }).select('*').single();

  if (error) throw new Error(error.message);
  return data;
}

async function handler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (await checkRateLimit('strict', req, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action') || '';
    const sb = getSupabase();

    const actor = await verifyAdmin(req);

    if (req.method === 'GET') {
      if (action === 'list') {
        const result = await getCases(sb, {
          status: url.searchParams.get('status') || '',
          source: url.searchParams.get('source') || '',
          financingType: url.searchParams.get('financingType') || '',
          assignedTo: url.searchParams.get('assignedTo') || '',
          search: url.searchParams.get('search') || '',
          page: url.searchParams.get('page') || '1',
          limit: url.searchParams.get('limit') || '20'
        });
        return res.status(200).json({ success: true, ...result, statusLabels: STATUS_LABELS });
      }
      if (action === 'detail') {
        const id = url.searchParams.get('id');
        if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
        const detail = await getCaseDetail(sb, id);
        return res.status(200).json({ success: true, ...detail, statusLabels: STATUS_LABELS });
      }
      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (action === 'update') {
        if (!body.id) return res.status(400).json({ success: false, error: 'Missing id' });
        const data = await updateCase(sb, body.id, body, actor);
        return res.status(200).json({ success: true, case: data });
      }
      if (action === 'add-note') {
        if (!body.caseId || !body.note) return res.status(400).json({ success: false, error: 'Missing caseId or note' });
        const data = await addNote(sb, body.caseId, body.note, actor);
        return res.status(200).json({ success: true, event: data });
      }
      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    const status = err.status || 500;
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.error('[funding-cases] Error:', err.message);
    }
    return res.status(status).json({ success: false, error: err.message || 'Server error' });
  }
}

module.exports = handler;
