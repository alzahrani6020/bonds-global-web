'use strict';

// Tenant-scoped, read-only institutional directory backed by existing CRM tables.
// No writes, no contacts from other workspaces, and no platform-wide export.
const getSupabase = require('./supabase');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_COMPANY_COLUMNS = 'id,name,legal_name,city,country,sector,status';
const PUBLIC_CONTACT_COLUMNS = 'id,company_id,name,role,status';
const CONTACT_DETAIL_COLUMNS = 'id,company_id,name,email,phone,role,status';
const COMPANY_DETAIL_COLUMNS = 'id,name,legal_name,cr_number,tax_number,email,phone,city,country,sector,status';

function reply(res, status, body) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function parseRequest(req) {
  const url = new URL(req.url, 'https://bonds-global.com');
  const read = key => req.query?.[key] ?? url.searchParams.get(key);
  const workspaceId = String(read('workspace_id') || '');
  const type = String(read('type') || 'organizations');
  const q = String(read('q') || '').trim();
  const rawLimit = String(read('limit') ?? '25');
  if (!UUID.test(workspaceId)) return { error: 'INVALID_WORKSPACE_ID' };
  if (!['organizations','contacts'].includes(type)) return { error: 'INVALID_DIRECTORY_TYPE' };
  if (q.length > 80 || /[^\p{L}\p{N}\s._-]/u.test(q)) return { error: 'INVALID_SEARCH' };
  if (!/^[1-9]\d?$/.test(rawLimit) || Number(rawLimit) > 50) return { error: 'INVALID_LIMIT' };
  return { workspaceId: workspaceId.toLowerCase(), type, q, limit: Number(rawLimit) };
}

function createHandler(makeClient = getSupabase) {
  return async function institutionalDirectory(req, res) {
    if (req.method !== 'GET') return reply(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    // Service-role security is provided by server configuration, never by a
    // key supplied in the request. Fail closed if the protected backend is absent.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return reply(res, 503, { error: 'DIRECTORY_BACKEND_UNAVAILABLE' });
    const { error, ...params } = parseRequest(req);
    if (error) return reply(res, 400, { error });
    const header = String(req.headers?.authorization || '');
    if (!/^Bearer [^\s]+$/.test(header)) return reply(res, 401, { error: 'AUTH_REQUIRED' });
    try {
      const sb = makeClient();
      const { data: auth, error: authError } = await sb.auth.getUser(header.slice(7));
      const user = auth?.user;
      if (authError || !user || user.is_anonymous) return reply(res, 401, { error: 'AUTH_REQUIRED' });

      const { data: workspace, error: wsError } = await sb.from('crm_app_workspaces')
        .select('id,owner_user_id').eq('id',params.workspaceId).maybeSingle();
      if (wsError) throw wsError;
      // Deliberately use 404 for inaccessible workspace to prevent enumeration.
      if (!workspace) return reply(res, 404, { error: 'WORKSPACE_NOT_FOUND' });
      if (workspace.owner_user_id !== user.id) {
        const { data: member, error: memberError } = await sb.from('crm_app_members')
          .select('id').eq('workspace_id',params.workspaceId)
          .eq('member_user_id',user.id).eq('active',true).limit(1);
        if (memberError) throw memberError;
        if (!member?.length) return reply(res, 404, { error: 'WORKSPACE_NOT_FOUND' });
      }
      const table = params.type === 'contacts' ? 'crm_app_contacts' : 'crm_app_companies';
      // Members can read contact names and roles; full PII is restricted to
      // owner/editor/admin memberships (applied below).
      let canViewContactDetails = workspace.owner_user_id === user.id;
      if (!canViewContactDetails && params.type === 'contacts') {
        const { data: member, error: roleError } = await sb.from('crm_app_members')
          .select('role').eq('workspace_id',params.workspaceId)
          .eq('member_user_id',user.id).eq('active',true).limit(1);
        if (roleError) throw roleError;
        canViewContactDetails = ['admin','editor'].includes(member?.[0]?.role);
      }
      const columns = params.type === 'contacts'
        ? (canViewContactDetails ? CONTACT_DETAIL_COLUMNS : PUBLIC_CONTACT_COLUMNS)
        : (workspace.owner_user_id === user.id ? COMPANY_DETAIL_COLUMNS : PUBLIC_COMPANY_COLUMNS);
      let query = sb.from(table).select(columns).eq('workspace_id',params.workspaceId)
        .order('name', { ascending: true }).limit(params.limit);
      if (params.q) query = query.ilike('name', '%' + params.q + '%');
      const { data, error: directoryError } = await query;
      if (directoryError) throw directoryError;
      return reply(res, 200, { workspace_id: params.workspaceId, type: params.type, items: data || [], count: (data || []).length });
    } catch (_err) {
      // Never expose provider query errors, token contents, or raw PII.
      return reply(res, 503, { error: 'DIRECTORY_UNAVAILABLE' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.parseRequest = parseRequest;
