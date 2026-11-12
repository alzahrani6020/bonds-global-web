const crypto = require('crypto');
const getSupabase = require('./supabase');
const { sendEmail } = require('./email');

const ADMIN_ROLES = new Set(['super_admin', 'admin']);
const READ_ROLES = new Set(['super_admin', 'admin']);
const CORRESPONDENCE_PERMISSIONS = new Set(['review','approve','sign','stamp','issue','finalize_pdf','send','archive','read_all']);
const EDITABLE_STATUSES = new Set(['draft', 'returned']);
const TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  returned: ['submitted', 'cancelled'],
  submitted: ['under_review', 'returned', 'rejected', 'cancelled'],
  under_review: ['approved', 'returned', 'rejected'],
  approved: ['issued', 'returned', 'rejected'],
  issued: ['archived'],
  sent: ['archived'],
  archived: [],
  rejected: [],
  cancelled: []
};

function jsonSize(value) {
  return Buffer.byteLength(JSON.stringify(value || null), 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function cleanText(value, max = 500) {
  if (value === undefined || value === null) return null;
  return String(value).replace(/\0/g, '').trim().slice(0, max) || null;
}

function sanitizeHtml(input) {
  let html = String(input || '');
  if (Buffer.byteLength(html, 'utf8') > 750_000) {
    const err = new Error('Document HTML exceeds 750 KB limit');
    err.status = 413;
    throw err;
  }
  html = html
    .replace(/<\s*(script|iframe|object|embed|form|meta|base|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|form|meta|base|link)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, '')
    .replace(/\sstyle\s*=\s*(["'])[^"']*expression\s*\([^"']*\)[^"']*\1/gi, '');
  return html;
}

function sanitizePages(pages) {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 50) {
    const err = new Error('pages_html must contain 1 to 50 pages');
    err.status = 400;
    throw err;
  }
  return pages.map(sanitizeHtml);
}

const WORKSPACE_CONTEXT_KEYS = new Set(['service','workspace','company_id','project_id','client_id','funding_case_id','request_id','source','path','return_to','imported_from']);
const WORKSPACE_UUID_KEYS = new Set(['company_id','project_id','client_id','funding_case_id','request_id']);

function cleanWorkspaceContext(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!WORKSPACE_CONTEXT_KEYS.has(key)) continue;
    const value = cleanText(raw, (key === 'path' || key === 'return_to') ? 500 : 160);
    if (!value) continue;
    if (key === 'return_to' && (!value.startsWith('/') || value.startsWith('//'))) {
      const err = new Error('Invalid workspace return path');
      err.status = 400;
      throw err;
    }
    if (WORKSPACE_UUID_KEYS.has(key) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      const err = new Error('Invalid workspace context identifier: ' + key);
      err.status = 400;
      throw err;
    }
    out[key] = value;
  }
  out.source = out.source || 'letterhead';
  return out;
}

async function assertContextExists(sb, table, id) {
  const { data, error } = await sb.from(table).select('id').eq('id', id).maybeSingle();
  if (error) throw error;
  return !!data?.id;
}

async function validateWorkspaceContext(sb, input, user, role = 'user', permissions = new Set(), memberships = []) {
  const ctx = cleanWorkspaceContext(input);
  const privileged = ADMIN_ROLES.has(role) || permissions.has('read_all');
  const membershipCompanyIds = new Set(memberships.map(m => m.company_id).filter(Boolean));
  let derivedCompanyId = null;

  function deny(key) {
    const err = new Error('Workspace context is not accessible to the current user: ' + key);
    err.status = 403;
    throw err;
  }

  if (ctx.company_id) {
    if (!privileged && !membershipCompanyIds.has(ctx.company_id)) deny('company_id');
    derivedCompanyId = ctx.company_id;
  }

  if (ctx.request_id) {
    const { data, error } = await sb.from('service_requests')
      .select('id,user_id,client_id,funding_case_id')
      .eq('id', ctx.request_id).maybeSingle();
    if (error) throw error;
    if (!data?.id) {
      const err = new Error('Workspace context reference not found: request_id');
      err.status = 400;
      throw err;
    }
    if (!privileged && data.user_id !== user.id) deny('request_id');
  }

  if (ctx.funding_case_id) {
    const { data, error } = await sb.from('funding_cases')
      .select('id,user_id,assigned_to,client_id,project_id')
      .eq('id', ctx.funding_case_id).maybeSingle();
    if (error) throw error;
    if (!data?.id) {
      const err = new Error('Workspace context reference not found: funding_case_id');
      err.status = 400;
      throw err;
    }
    if (!privileged && data.user_id !== user.id && data.assigned_to !== user.id) deny('funding_case_id');
  }

  if (ctx.client_id) {
    const { data, error } = await sb.from('advisory_clients')
      .select('id,created_by,assigned_to,auth_user_id,account_owner')
      .eq('id', ctx.client_id).maybeSingle();
    if (error) throw error;
    if (!data?.id) {
      const err = new Error('Workspace context reference not found: client_id');
      err.status = 400;
      throw err;
    }
    if (!privileged && ![data.created_by,data.assigned_to,data.auth_user_id,data.account_owner].includes(user.id)) deny('client_id');
  }

  if (ctx.service) {
    const { data, error } = await sb.from('service_catalog').select('code').eq('code', ctx.service).maybeSingle();
    if (error) throw error;
    if (!data?.code) {
      const err = new Error('Workspace context service not found');
      err.status = 400;
      throw err;
    }
  }

  if (ctx.project_id) {
    let found = false;
    let authorized = privileged;
    const projectChecks = [
      ['user_projects', 'id,user_id,company_id'],
      ['bonds_projects', 'id,user_id'],
      ['projects', 'id,user_id'],
      ['advisory_projects', 'id,created_by,assigned_to,client_id'],
      ['city_projects', 'id,created_by']
    ];
    for (const [table, select] of projectChecks) {
      const { data, error } = await sb.from(table).select(select).eq('id', ctx.project_id).maybeSingle();
      if (error) throw error;
      if (!data?.id) continue;
      found = true;
      if (table === 'user_projects') {
        authorized = authorized || data.user_id === user.id || (!!data.company_id && membershipCompanyIds.has(data.company_id));
        derivedCompanyId = derivedCompanyId || data.company_id || null;
      } else if (table === 'advisory_projects') {
        authorized = authorized || data.created_by === user.id || data.assigned_to === user.id;
        if (!authorized && data.client_id) {
          const { data: client } = await sb.from('advisory_clients')
            .select('created_by,assigned_to,auth_user_id,account_owner')
            .eq('id', data.client_id).maybeSingle();
          authorized = !!client && [client.created_by,client.assigned_to,client.auth_user_id,client.account_owner].includes(user.id);
        }
      } else {
        authorized = authorized || data.user_id === user.id || data.created_by === user.id;
      }
      break;
    }
    if (!found) {
      const err = new Error('Workspace context reference not found: project_id');
      err.status = 400;
      throw err;
    }
    if (!authorized) deny('project_id');
  }

  if (jsonSize(ctx) > 12_000) {
    const err = new Error('workspace_context is too large');
    err.status = 413;
    throw err;
  }
  return { context: ctx, companyId: derivedCompanyId };
}

function requestedWorkspaceFilters(req, url) {
  const filters = {};
  for (const key of ['service','workspace','project_id','client_id','funding_case_id','request_id']) {
    const value = cleanText(req.query?.[key] || url.searchParams.get(key), 160);
    if (value) filters[key] = value;
  }
  return filters;
}

function workspaceContextMatches(context, filters) {
  if (!filters || !Object.keys(filters).length) return true;
  const ctx = context && typeof context === 'object' ? context : {};
  return Object.entries(filters).every(([key, value]) => String(ctx[key] || '') === String(value));
}

function escapeHtmlText(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function importDeviceFile(body = {}) {
  const filename = cleanText(body.filename, 255) || 'document';
  const mimeType = cleanText(body.mime_type, 120) || '';
  const dataBase64 = String(body.data_base64 || '').trim();

  if (!dataBase64 || !/^[A-Za-z0-9+/=]+$/.test(dataBase64)) {
    const err = new Error('Valid base64 file data is required');
    err.status = 400;
    throw err;
  }

  const buffer = Buffer.from(dataBase64, 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
    const err = new Error('Imported file must be between 1 byte and 2 MB');
    err.status = 413;
    throw err;
  }

  const lower = filename.toLowerCase();
  let html = '';

  if (lower.endsWith('.txt') || mimeType === 'text/plain') {
    html = escapeHtmlText(buffer.toString('utf8')).replace(/\r?\n/g, '<br>');
  } else if (lower.endsWith('.html') || lower.endsWith('.htm') || mimeType === 'text/html') {
    html = buffer.toString('utf8');
  } else if (lower.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value || '';
  } else if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    require('pdf-parse/worker');
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      html = escapeHtmlText(result.text || '').replace(/\r?\n/g, '<br>');
    } finally {
      await parser.destroy().catch(() => {});
    }
  } else {
    const err = new Error('Unsupported import type. Use TXT, HTML, HTM, DOCX, or PDF');
    err.status = 415;
    throw err;
  }

  const sanitized = sanitizeHtml(html);
  if (!sanitized.trim()) {
    const err = new Error('Imported document contains no usable content');
    err.status = 422;
    throw err;
  }

  return {
    filename,
    html: sanitized,
    text: sanitized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20_000)
  };
}

async function resolveUser(req) {
  const auth = String(req.headers?.authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data?.user || null;
}

async function resolveRole(sb, userId) {
  const { data } = await sb.from('admin_roles').select('role').eq('user_id', userId).maybeSingle();
  return data?.role || 'user';
}

async function resolveMemberships(sb, userId) {
  const { data, error } = await sb.from('company_members').select('company_id,role').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

async function resolveCorrespondencePermissions(sb, userId, role) {
  if (ADMIN_ROLES.has(role)) return new Set(CORRESPONDENCE_PERMISSIONS);
  const { data, error } = await sb.from('correspondence_user_permissions')
    .select('permission')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map(row => row.permission).filter(permission => CORRESPONDENCE_PERMISSIONS.has(permission)));
}

function hasPermission(role, permissions, permission) {
  return ADMIN_ROLES.has(role) || permissions?.has(permission);
}

function canRead(doc, user, role, memberships = [], permissions = new Set()) {
  if (!doc) return false;
  if (doc.owner_user_id === user.id || READ_ROLES.has(role) || permissions.has('read_all')) return true;
  if (!doc.company_id || ['confidential','restricted'].includes(doc.confidentiality)) return false;
  return memberships.some(m => m.company_id === doc.company_id);
}

function canManage(role, permissions, permission) {
  return hasPermission(role, permissions, permission);
}

function dueIso(hours) {
  return new Date(Date.now() + Number(hours || 0) * 60 * 60 * 1000).toISOString();
}

async function completeOpenTasks(sb, documentId, userId, taskTypes, status = 'completed') {
  const types = Array.isArray(taskTypes) ? taskTypes : [taskTypes];
  const { error } = await sb.from('correspondence_tasks')
    .update({
      status,
      completed_at: new Date().toISOString(),
      completed_by: userId || null,
      updated_at: new Date().toISOString()
    })
    .eq('document_id', documentId)
    .eq('status', 'open')
    .in('task_type', types);
  if (error) throw error;
}

async function createOpenTask(sb, documentId, taskType, options = {}) {
  const row = {
    document_id: documentId,
    task_type: taskType,
    assigned_user_id: options.assigned_user_id || null,
    assigned_role: options.assigned_role || null,
    status: 'open',
    due_at: options.due_at || null,
    completed_at: null,
    completed_by: null,
    metadata: options.metadata || {},
    updated_at: new Date().toISOString()
  };
  const { error } = await sb.from('correspondence_tasks').upsert(row, {
    onConflict: 'document_id,task_type'
  });
  if (error) throw error;
}

async function addEvent(sb, documentId, userId, action, fromStatus, toStatus, version, metadata = {}) {
  const { error } = await sb.from('correspondence_events').insert({
    document_id: documentId,
    actor_user_id: userId || null,
    action,
    from_status: fromStatus || null,
    to_status: toStatus || null,
    version: version || null,
    metadata
  });
  if (error) throw error;
}

async function loadDoc(sb, id) {
  const { data, error } = await sb.from('correspondence_documents').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function loadLatestVersion(sb, id) {
  const { data, error } = await sb.from('correspondence_versions')
    .select('*').eq('document_id', id).order('version', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function createDocument(sb, user, body, memberships = [], role = 'user', permissions = new Set()) {
  const requestedCompanyId = cleanText(body.company_id, 64);
  const allowedCompanyIds = new Set(memberships.map(m => m.company_id).filter(Boolean));
  const workspace = await validateWorkspaceContext(sb, body.workspace_context, user, role, permissions, memberships);
  const privileged = ADMIN_ROLES.has(role) || permissions.has('read_all');

  if (requestedCompanyId && !privileged && !allowedCompanyIds.has(requestedCompanyId)) {
    const err = new Error('User is not a member of the requested company');
    err.status = 403;
    throw err;
  }

  const companyId = requestedCompanyId
    || workspace.companyId
    || (memberships.length === 1 ? memberships[0].company_id : null);

  if (companyId && !privileged && !allowedCompanyIds.has(companyId)) {
    const err = new Error('Resolved correspondence company is not accessible to the current user');
    err.status = 403;
    throw err;
  }

  const row = {
    owner_user_id: user.id,
    company_id: companyId,
    created_by: user.id,
    language: body.language === 'en' ? 'en' : 'ar',
    direction: ['incoming', 'outgoing', 'internal'].includes(body.direction) ? body.direction : 'outgoing',
    document_type: cleanText(body.document_type, 80) || 'letter',
    title: cleanText(body.title, 200) || (body.language === 'en' ? 'Untitled letter' : 'خطاب بدون عنوان'),
    subject: cleanText(body.subject, 500),
    recipient_organization: cleanText(body.recipient_organization, 250),
    recipient_name: cleanText(body.recipient_name, 250),
    recipient_title: cleanText(body.recipient_title, 250),
    recipient_email: cleanText(body.recipient_email, 320),
    sender_department: cleanText(body.sender_department, 250),
    priority: ['low', 'normal', 'high', 'urgent'].includes(body.priority) ? body.priority : 'normal',
    confidentiality: ['public', 'internal', 'confidential', 'restricted'].includes(body.confidentiality) ? body.confidentiality : 'internal',
    workspace_context: workspace.context
  };
  if (row.recipient_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.recipient_email)) {
    const err = new Error('Invalid recipient email');
    err.status = 400;
    throw err;
  }
  const { data, error } = await sb.from('correspondence_documents').insert(row).select('*').single();
  if (error) throw error;
  await addEvent(sb, data.id, user.id, 'created', null, 'draft', null, { language: data.language, direction: data.direction });
  return data;
}

async function saveVersion(sb, doc, user, body, memberships = [], role = 'user', permissions = new Set()) {
  if (doc.owner_user_id !== user.id) {
    const err = new Error('Only the document owner can edit the draft');
    err.status = 403;
    throw err;
  }
  if (!EDITABLE_STATUSES.has(doc.status)) {
    const err = new Error('Issued or workflow-controlled documents are immutable');
    err.status = 409;
    throw err;
  }

  const pages = sanitizePages(body.pages_html);
  const text = cleanText(body.text_content, 100_000) || '';
  const canonical = JSON.stringify({ pages, text });
  const checksum = sha256(canonical);
  const workspace = await validateWorkspaceContext(
    sb,
    body.workspace_context && typeof body.workspace_context === 'object' ? body.workspace_context : doc.workspace_context,
    user,
    role,
    permissions,
    memberships
  );

  const title = body.title !== undefined ? cleanText(body.title, 200) : doc.title;
  const subject = body.subject !== undefined ? cleanText(body.subject, 500) : doc.subject;
  const recipientOrganization = body.recipient_organization !== undefined ? cleanText(body.recipient_organization, 250) : doc.recipient_organization;
  const recipientName = body.recipient_name !== undefined ? cleanText(body.recipient_name, 250) : doc.recipient_name;
  const recipientTitle = body.recipient_title !== undefined ? cleanText(body.recipient_title, 250) : doc.recipient_title;
  const senderDepartment = body.sender_department !== undefined ? cleanText(body.sender_department, 250) : doc.sender_department;
  const direction = ['incoming','outgoing','internal'].includes(body.direction) ? body.direction : doc.direction;
  const priority = ['low','normal','high','urgent'].includes(body.priority) ? body.priority : doc.priority;
  const confidentiality = ['public','internal','confidential','restricted'].includes(body.confidentiality) ? body.confidentiality : doc.confidentiality;

  let recipientEmail = doc.recipient_email;
  if (body.recipient_email !== undefined) {
    recipientEmail = cleanText(body.recipient_email, 320);
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      const err = new Error('Invalid recipient email');
      err.status = 400;
      throw err;
    }
  }

  const companyId = workspace.companyId || doc.company_id || (memberships.length === 1 ? memberships[0].company_id : null);
  const allowedCompanyIds = new Set(memberships.map(m => m.company_id).filter(Boolean));
  const privileged = ADMIN_ROLES.has(role) || permissions.has('read_all');
  if (companyId && !privileged && !allowedCompanyIds.has(companyId)) {
    const err = new Error('Resolved correspondence company is not accessible to the current user');
    err.status = 403;
    throw err;
  }

  const { data, error } = await sb.rpc('save_correspondence_version_atomic', {
    p_document_id: doc.id,
    p_actor_user_id: user.id,
    p_pages_html: pages,
    p_text_content: text,
    p_checksum_sha256: checksum,
    p_title: title,
    p_subject: subject,
    p_direction: direction,
    p_priority: priority,
    p_confidentiality: confidentiality,
    p_recipient_organization: recipientOrganization,
    p_recipient_name: recipientName,
    p_recipient_title: recipientTitle,
    p_recipient_email: recipientEmail,
    p_sender_department: senderDepartment,
    p_company_id: companyId,
    p_workspace_context: workspace.context
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.document || !row?.version) throw new Error('Atomic correspondence save returned no document');
  return {
    document: row.document,
    version: Number(row.version),
    checksum_sha256: row.checksum_sha256 || checksum
  };
}

async function transitionDocument(sb, doc, user, role, permissions, target, body) {
  const allowed = TRANSITIONS[doc.status] || [];
  if (!allowed.includes(target)) {
    const err = new Error(`Invalid workflow transition: ${doc.status} -> ${target}`);
    err.status = 409;
    throw err;
  }

  const reason = cleanText(body.note, 1000);
  if (['returned', 'rejected', 'cancelled'].includes(target) && !reason) {
    const err = new Error('A reason is required for return, rejection or cancellation');
    err.status = 400;
    throw err;
  }
  if (['under_review', 'approved'].includes(target) && doc.created_by === user.id && role !== 'super_admin') {
    const err = new Error('Segregation of duties prevents the document creator from reviewing or approving the same document');
    err.status = 409;
    throw err;
  }

  const ownerTransition = doc.owner_user_id === user.id && ['submitted', 'cancelled'].includes(target) && ['draft', 'returned'].includes(doc.status);
  const permissionByTarget = {
    under_review: 'review',
    approved: 'approve',
    returned: doc.status === 'under_review' || doc.status === 'approved' ? 'approve' : 'review',
    rejected: doc.status === 'under_review' || doc.status === 'approved' ? 'approve' : 'review',
    cancelled: 'review',
    issued: 'issue',
    archived: 'archive'
  };
  const requiredPermission = permissionByTarget[target];
  if (!ownerTransition && (!requiredPermission || !canManage(role, permissions, requiredPermission))) {
    const err = new Error('This workflow transition requires correspondence management permission');
    err.status = 403;
    throw err;
  }
  if (target === 'submitted' && Number(doc.current_version || 0) < 1) {
    const err = new Error('Save at least one document version before submission');
    err.status = 409;
    throw err;
  }
  if (target === 'archived' && doc.status === 'issued' && doc.direction !== 'internal') {
    const err = new Error('Outgoing or incoming issued correspondence must be sent before archival');
    err.status = 409;
    throw err;
  }

  const now = new Date().toISOString();
  const updates = { status: target };
  if (target === 'submitted') updates.submitted_at = now;
  if (target === 'under_review') { updates.reviewed_by = user.id; updates.reviewed_at = now; }
  if (target === 'approved') { updates.approved_by = user.id; updates.approved_at = now; }
  if (target === 'archived') updates.archived_at = now;
  if (target === 'returned') {
    updates.signed_by = null;
    updates.signed_at = null;
    updates.signature_image_data = null;
    updates.signature_hash = null;
    updates.stamped_by = null;
    updates.stamped_at = null;
    updates.stamp_hash = null;
    updates.issued_hash = null;
  }

  if (target === 'issued') {
    if (doc.status !== 'approved') {
      const err = new Error('Only approved documents can be issued');
      err.status = 409;
      throw err;
    }
    const latest = await loadLatestVersion(sb, doc.id);
    if (!latest || latest.version !== doc.current_version || latest.checksum_sha256 !== doc.document_hash) {
      const err = new Error('Document version integrity check failed');
      err.status = 409;
      throw err;
    }
    if (doc.requires_signature !== false && (!doc.signed_by || !doc.signature_hash)) {
      const err = new Error('Approved document must be signed before issuance');
      err.status = 409;
      throw err;
    }
    if (doc.requires_stamp && !doc.stamp_hash) {
      const err = new Error('This document type requires an administrative stamp before issuance');
      err.status = 409;
      throw err;
    }
    const { data: reference, error: refError } = await sb.rpc('next_correspondence_reference');
    if (refError) throw refError;
    const issuedHash = sha256([
      doc.document_hash || '',
      doc.signature_hash || '',
      doc.stamp_hash || '',
      reference
    ].join('|'));
    updates.reference_number = reference;
    updates.verification_token = crypto.randomUUID();
    updates.issued_hash = issuedHash;
    updates.issued_by = user.id;
    updates.issued_at = now;
  }

  const { data, error } = await sb.from('correspondence_documents').update(updates).eq('id', doc.id).eq('status', doc.status).select('*').single();
  if (error) throw error;
  await addEvent(sb, doc.id, user.id, target, doc.status, target, doc.current_version, {
    note: reason,
    reference_number: data.reference_number || null
  });

  if (['returned', 'rejected', 'cancelled'].includes(target)) {
    await completeOpenTasks(sb, doc.id, user.id, ['review','approve','sign','stamp','finalize_pdf','send','archive'], 'cancelled');
  } else if (target === 'submitted') {
    await createOpenTask(sb, doc.id, 'review', { assigned_role: 'admin', due_at: dueIso(24) });
  } else if (target === 'under_review') {
    await completeOpenTasks(sb, doc.id, user.id, 'review');
    await createOpenTask(sb, doc.id, 'approve', { assigned_role: 'admin', due_at: dueIso(24) });
  } else if (target === 'approved') {
    await completeOpenTasks(sb, doc.id, user.id, 'approve');
    if (data.requires_signature !== false) await createOpenTask(sb, doc.id, 'sign', { assigned_role: 'admin', due_at: dueIso(24) });
    if (data.requires_stamp) await createOpenTask(sb, doc.id, 'stamp', { assigned_role: 'admin', due_at: dueIso(24) });
  } else if (target === 'issued') {
    await completeOpenTasks(sb, doc.id, user.id, ['sign','stamp']);
    await createOpenTask(sb, doc.id, 'finalize_pdf', { assigned_role: 'admin', due_at: dueIso(4) });
  } else if (target === 'archived') {
    await completeOpenTasks(sb, doc.id, user.id, 'archive');
  }
  return data;
}

async function markGovernanceAction(sb, doc, user, role, permissions, action, body = {}) {
  if (!canManage(role, permissions, action === 'sign' ? 'sign' : 'stamp')) {
    const err = new Error('This correspondence action requires admin permission');
    err.status = 403;
    throw err;
  }
  if (doc.status !== 'approved') {
    const err = new Error('Signature and stamp require an approved document before issuance');
    err.status = 409;
    throw err;
  }
  const now = new Date().toISOString();
  let updates;
  let artifactHash = null;

  if (action === 'sign') {
    const artifact = String(body.signature_data_url || '');
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(artifact)) {
      const err = new Error('A PNG signature artifact is required');
      err.status = 400;
      throw err;
    }
    if (Buffer.byteLength(artifact, 'utf8') > 300_000) {
      const err = new Error('Signature artifact exceeds 300 KB');
      err.status = 413;
      throw err;
    }
    artifactHash = sha256(artifact);
    updates = {
      signed_by: user.id,
      signed_at: now,
      signature_image_data: artifact,
      signature_hash: artifactHash
    };
  } else {
    artifactHash = sha256([doc.document_hash || '', user.id, now, 'BONDS_ADMIN_STAMP'].join('|'));
    updates = {
      stamped_by: user.id,
      stamped_at: now,
      stamp_hash: artifactHash
    };
  }

  const { data, error } = await sb.from('correspondence_documents')
    .update(updates).eq('id', doc.id).eq('status', 'approved').select('*').single();
  if (error) throw error;
  await addEvent(
    sb,
    doc.id,
    user.id,
    action === 'sign' ? 'signed' : 'stamped',
    doc.status,
    doc.status,
    doc.current_version,
    { checksum_sha256: doc.document_hash || null, artifact_hash: artifactHash }
  );
  await completeOpenTasks(sb, doc.id, user.id, action === 'sign' ? 'sign' : 'stamp');
  return data;
}

async function createArtifactUpload(sb, doc, user, role, permissions) {
  if (!canManage(role, permissions, 'finalize_pdf')) {
    const err = new Error('Final PDF upload requires admin permission');
    err.status = 403;
    throw err;
  }
  if (doc.status !== 'issued') {
    const err = new Error('Final PDF can only be created for an issued document');
    err.status = 409;
    throw err;
  }
  const safeRef = String(doc.reference_number || doc.id).replace(/[^A-Za-z0-9._-]/g, '_');
  const scope = doc.company_id || ('user-' + doc.owner_user_id);
  const path = [scope, doc.id, safeRef + '.pdf'].join('/');
  const { data, error } = await sb.storage.from('correspondence-artifacts').createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  return { path, token: data.token, signed_url: data.signedUrl };
}

async function finalizeArtifact(sb, doc, user, role, permissions, body) {
  if (!canManage(role, permissions, 'finalize_pdf')) {
    const err = new Error('Final PDF finalization requires admin permission');
    err.status = 403;
    throw err;
  }
  if (doc.status !== 'issued') {
    const err = new Error('Final PDF can only be finalized for an issued document');
    err.status = 409;
    throw err;
  }
  const path = cleanText(body.path, 1000);
  if (!path || !path.includes('/' + doc.id + '/')) {
    const err = new Error('Invalid final PDF artifact path');
    err.status = 400;
    throw err;
  }

  const { data: blob, error: downloadError } = await sb.storage.from('correspondence-artifacts').download(path);
  if (downloadError) throw downloadError;
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
    const err = new Error('Final PDF artifact size is invalid');
    err.status = 413;
    throw err;
  }
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    const err = new Error('Final artifact is not a PDF');
    err.status = 400;
    throw err;
  }

  const latest = await loadLatestVersion(sb, doc.id);
  if (!latest || latest.version !== doc.current_version || latest.checksum_sha256 !== doc.document_hash || !doc.issued_hash) {
    const err = new Error('Final PDF cannot be bound because the issued document version is inconsistent');
    err.status = 409;
    throw err;
  }

  const expectedMarker = ['BONDS-DOC', doc.id, doc.current_version, doc.document_hash, doc.issued_hash].join(':');
  if (!buffer.includes(Buffer.from(expectedMarker, 'utf8'))) {
    const err = new Error('Final PDF does not contain the issued-document integrity marker');
    err.status = 409;
    throw err;
  }

  const artifactHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const now = new Date().toISOString();
  const { data, error } = await sb.from('correspondence_documents').update({
    artifact_path: path,
    artifact_hash: artifactHash,
    artifact_size_bytes: buffer.length,
    artifact_created_at: now,
    artifact_document_hash: doc.document_hash,
    artifact_issued_hash: doc.issued_hash,
    artifact_version: doc.current_version
  }).eq('id', doc.id).eq('status', 'issued').select('*').single();
  if (error) throw error;

  await addEvent(sb, doc.id, user.id, 'final_pdf_created', 'issued', 'issued', doc.current_version, {
    artifact_hash: artifactHash,
    size_bytes: buffer.length
  });
  await completeOpenTasks(sb, doc.id, user.id, 'finalize_pdf');
  await createOpenTask(sb, doc.id, 'send', { assigned_role: 'admin', due_at: dueIso(4) });
  return data;
}

async function loadVerifiedArtifact(sb, doc) {
  if (!doc.artifact_path || !doc.artifact_hash) {
    const err = new Error('Final PDF artifact is required before sending');
    err.status = 409;
    throw err;
  }
  if (doc.artifact_document_hash !== doc.document_hash || doc.artifact_issued_hash !== doc.issued_hash || Number(doc.artifact_version || 0) !== Number(doc.current_version || 0)) {
    const err = new Error('Final PDF is not bound to the current issued document version');
    err.status = 409;
    throw err;
  }
  const { data: blob, error } = await sb.storage.from('correspondence-artifacts').download(doc.artifact_path);
  if (error) throw error;
  const buffer = Buffer.from(await blob.arrayBuffer());
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (hash !== doc.artifact_hash) {
    const err = new Error('Final PDF artifact integrity check failed');
    err.status = 409;
    throw err;
  }
  return buffer;
}

async function createArtifactDownloadUrl(sb, doc, user, role, memberships, permissions) {
  if (!canRead(doc, user, role, memberships, permissions)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (!doc.artifact_path || !doc.artifact_hash) {
    const err = new Error('Official PDF artifact is not available');
    err.status = 409;
    throw err;
  }
  if (doc.artifact_document_hash !== doc.document_hash || doc.artifact_issued_hash !== doc.issued_hash || Number(doc.artifact_version || 0) !== Number(doc.current_version || 0)) {
    const err = new Error('Official PDF artifact is not bound to the current issued document version');
    err.status = 409;
    throw err;
  }
  const { data, error } = await sb.storage.from('correspondence-artifacts').createSignedUrl(doc.artifact_path, 60, {
    download: (doc.reference_number || 'bonds-correspondence') + '.pdf'
  });
  if (error) throw error;
  return { signed_url: data.signedUrl, expires_in: 60, artifact_hash: doc.artifact_hash };
}

async function renderVerificationQr(sb, token, language) {
  if (!/^[0-9a-f-]{36}$/i.test(token || '')) {
    const err = new Error('Invalid verification token');
    err.status = 400;
    throw err;
  }
  const { data, error } = await sb.from('correspondence_documents')
    .select('verification_token,status')
    .eq('verification_token', token).maybeSingle();
  if (error) throw error;
  if (!data || !['issued','sent','archived'].includes(data.status)) {
    const err = new Error('Verification document not found');
    err.status = 404;
    throw err;
  }
  const verifyPath = language === 'en' ? '/en/verify-document.html?token=' : '/verify-document.html?token=';
  const verifyUrl = 'https://bonds-global.com' + verifyPath + encodeURIComponent(token);
  const upstream = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=svg&data=' + encodeURIComponent(verifyUrl);
  const response = await fetch(upstream, { headers: { 'User-Agent': 'Bonds-Global-Correspondence/1.0' } });
  if (!response.ok) {
    const err = new Error('QR generation service unavailable');
    err.status = 503;
    throw err;
  }
  let svg = await response.text();
  if (!/<svg\b/i.test(svg)) {
    const err = new Error('QR generator returned invalid SVG');
    err.status = 502;
    throw err;
  }
  svg = svg
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return svg;
}

async function sendDocument(sb, doc, user, role, permissions, body) {
  if (!canManage(role, permissions, 'send')) {
    const err = new Error('Sending correspondence requires admin permission');
    err.status = 403;
    throw err;
  }
  if (doc.status === 'sent') return doc;
  if (doc.status !== 'issued') {
    const err = new Error('Only issued documents can be sent');
    err.status = 409;
    throw err;
  }

  const latest = await loadLatestVersion(sb, doc.id);
  if (!latest || latest.checksum_sha256 !== doc.document_hash || !doc.issued_hash) {
    const err = new Error('Issued document integrity check failed');
    err.status = 409;
    throw err;
  }
  const finalPdf = await loadVerifiedArtifact(sb, doc);

  const configuredRecipients = [
    process.env.MANAGER_EMAIL,
    ...(process.env.ADMIN_EMAILS || '').split(','),
    process.env.ADMIN_EMAIL
  ].map(v => String(v || '').trim().toLowerCase()).filter(v => v.includes('@'));
  const fallbackRecipients = Array.from(new Set(configuredRecipients));
  const documentRecipient = cleanText(doc.recipient_email, 320)?.toLowerCase() || '';
  const requested = cleanText(body.to, 320)?.toLowerCase() || '';
  const permittedRecipients = new Set([...fallbackRecipients, ...(documentRecipient ? [documentRecipient] : [])]);
  if (doc.direction !== 'internal' && !requested && !documentRecipient) {
    const err = new Error('Recipient email is required for non-internal correspondence');
    err.status = 409;
    throw err;
  }
  const recipient = requested || documentRecipient || fallbackRecipients[0] || '';
  if (!recipient) {
    const err = new Error('Correspondence recipient is not configured');
    err.status = 503;
    throw err;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    const err = new Error('Invalid correspondence recipient email');
    err.status = 400;
    throw err;
  }
  if (requested && !permittedRecipients.has(requested)) {
    const err = new Error('Recipient must match the governed document recipient or an authorized administrative address');
    err.status = 403;
    throw err;
  }

  const idempotencyKey = ('correspondence-send/' + doc.id + '/' + doc.issued_hash).slice(0, 256);
  const claimTime = new Date().toISOString();
  const { data: claimed, error: claimError } = await sb.from('correspondence_documents').update({
    send_idempotency_key: idempotencyKey,
    delivery_status: 'queued',
    delivery_updated_at: claimTime
  }).eq('id', doc.id).eq('status', 'issued').select('*').maybeSingle();
  if (claimError) throw claimError;

  const current = claimed || await loadDoc(sb, doc.id);
  if (current?.status === 'sent') return current;
  if (current?.send_idempotency_key && current.send_idempotency_key !== idempotencyKey) {
    const err = new Error('A different delivery attempt is already bound to this document');
    err.status = 409;
    throw err;
  }

  const pages = Array.isArray(latest.pages_html) ? latest.pages_html : [];
  const governanceHtml = [
    doc.signature_image_data ? `<div style="margin-top:24px"><img alt="signature" src="${doc.signature_image_data}" style="max-width:200px;height:auto"></div>` : '',
    doc.stamp_hash ? `<div style="margin-top:16px;color:#a51d2d;font-weight:700">BONDS — ${doc.language === 'en' ? 'Administrative Stamp' : 'ختم إداري'} — ${doc.reference_number || ''}</div>` : ''
  ].join('');
  const html = `<html><body dir="${doc.language === 'en' ? 'ltr' : 'rtl'}"><h3>${doc.reference_number || ''}</h3>${pages.map(p => `<section style="margin-bottom:32px">${p}</section>`).join('')}${governanceHtml}</body></html>`;

  const result = await sendEmail({
    to: recipient,
    subject: `${doc.reference_number || 'Bonds'} — ${doc.subject || doc.title}`.slice(0, 200),
    text: String(latest.text_content || '').slice(0, 20_000),
    html,
    idempotencyKey,
    attachments: [{
      filename: (doc.reference_number || 'bonds-correspondence') + '.pdf',
      contentType: 'application/pdf',
      content: finalPdf.toString('base64')
    }]
  });

  if (!result?.success || result?.demo) {
    await sb.from('correspondence_documents').update({
      delivery_status: 'failed',
      delivery_updated_at: new Date().toISOString()
    }).eq('id', doc.id).eq('status', 'issued');
    const err = new Error(result?.demo ? 'Email provider is not configured for real delivery' : (result?.error || 'Email delivery failed'));
    err.status = 502;
    throw err;
  }

  const now = new Date().toISOString();
  const { data, error } = await sb.from('correspondence_documents').update({
    status: 'sent',
    sent_at: now,
    delivery_status: 'accepted',
    provider_message_id: result.messageId || null,
    delivery_provider: result.provider || null,
    delivery_updated_at: now
  }).eq('id', doc.id).eq('status', 'issued').eq('send_idempotency_key', idempotencyKey).select('*').maybeSingle();
  if (error) throw error;

  const sentDoc = data || await loadDoc(sb, doc.id);
  if (sentDoc?.status !== 'sent') {
    const err = new Error('Email was accepted but correspondence state could not be finalized');
    err.status = 503;
    throw err;
  }

  await addEvent(sb, doc.id, user.id, 'sent', 'issued', 'sent', doc.current_version, {
    recipient,
    provider_message_id: result.messageId || null,
    idempotency_key: idempotencyKey
  });
  await completeOpenTasks(sb, doc.id, user.id, 'send');
  await createOpenTask(sb, doc.id, 'archive', { assigned_role: 'admin', due_at: dueIso(72) });
  return sentDoc;
}

async function handler(req, res) {
  const sb = getSupabase();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = String(req.query?.action || url.searchParams.get('action') || req.body?.action || 'list');
  const id = String(req.query?.id || url.searchParams.get('id') || req.body?.id || '').trim();

  if (action === 'verify') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const token = String(req.query?.token || url.searchParams.get('token') || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(token)) return res.status(400).json({ error: 'Invalid verification token' });
    const { data, error } = await sb.from('correspondence_documents')
      .select('reference_number,title,subject,status,document_hash,issued_hash,artifact_hash,artifact_size_bytes,artifact_document_hash,artifact_issued_hash,artifact_version,current_version,signature_hash,stamp_hash,signed_at,stamped_at,issued_at,sent_at,verification_token')
      .eq('verification_token', token).maybeSingle();
    if (error) throw error;
    if (!data || !['issued','sent','archived'].includes(data.status)) return res.status(404).json({ verified: false });
    return res.status(200).json({
      verified: true,
      reference_number: data.reference_number,
      title: data.title,
      subject: data.subject,
      status: data.status,
      checksum_sha256: data.document_hash,
      issued_hash: data.issued_hash,
      artifact_hash: data.artifact_hash,
      artifact_size_bytes: data.artifact_size_bytes,
      final_pdf_verified: !!data.artifact_hash && data.artifact_document_hash === data.document_hash && data.artifact_issued_hash === data.issued_hash && Number(data.artifact_version || 0) === Number(data.current_version || 0),
      signature_verified: !!data.signature_hash,
      stamp_verified: !!data.stamp_hash,
      signed_at: data.signed_at,
      stamped_at: data.stamped_at,
      issued_at: data.issued_at,
      sent_at: data.sent_at
    });
  }

  if (action === 'qr') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const token = String(req.query?.token || url.searchParams.get('token') || '').trim();
    const language = String(req.query?.lang || url.searchParams.get('lang') || 'ar').toLowerCase() === 'en' ? 'en' : 'ar';
    try {
      const svg = await renderVerificationQr(sb, token, language);
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).send(svg);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'QR generation failed' });
    }
  }

  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const role = await resolveRole(sb, user.id);
  const memberships = await resolveMemberships(sb, user.id);
  const permissions = await resolveCorrespondencePermissions(sb, user.id, role);

  if (req.method === 'GET' && action === 'list') {
    const page = Math.max(1, Math.min(100000, Number(req.query?.page || url.searchParams.get('page') || 1)));
    const pageSize = Math.max(1, Math.min(100, Number(req.query?.page_size || url.searchParams.get('page_size') || 25)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = sb.from('correspondence_documents').select('*', { count: 'exact' }).order('updated_at', { ascending: false });
    if (!READ_ROLES.has(role) && !permissions.has('read_all')) {
      const companyIds = memberships.map(m => m.company_id).filter(Boolean);
      const filters = [`owner_user_id.eq.${user.id}`];
      if (companyIds.length) {
        filters.push(`and(company_id.in.(${companyIds.join(',')}),confidentiality.in.(public,internal))`);
      }
      query = query.or(filters.join(','));
    }
    const status = String(req.query?.status || url.searchParams.get('status') || '');
    const direction = String(req.query?.direction || url.searchParams.get('direction') || '');
    const priority = String(req.query?.priority || url.searchParams.get('priority') || '');
    const confidentiality = String(req.query?.confidentiality || url.searchParams.get('confidentiality') || '');
    const companyId = String(req.query?.company_id || url.searchParams.get('company_id') || '');
    const reference = cleanText(req.query?.reference || url.searchParams.get('reference'), 120);
    const q = cleanText(req.query?.q || url.searchParams.get('q'), 200);
    const workspaceFilters = requestedWorkspaceFilters(req, url);
    if (status) query = query.eq('status', status);
    if (direction) query = query.eq('direction', direction);
    if (priority) query = query.eq('priority', priority);
    if (confidentiality) query = query.eq('confidentiality', confidentiality);
    if (companyId) query = query.eq('company_id', companyId);
    for (const [key, value] of Object.entries(workspaceFilters)) {
      query = query.contains('workspace_context', { [key]: value });
    }
    if (reference) query = query.ilike('reference_number', `%${reference.replace(/[%_]/g, '')}%`);
    if (q) {
      const term = q.replace(/[%_,().]/g, ' ').trim();
      if (term) query = query.or([
        `title.ilike.%${term}%`,
        `subject.ilike.%${term}%`,
        `recipient_organization.ilike.%${term}%`,
        `recipient_name.ilike.%${term}%`,
        `recipient_email.ilike.%${term}%`,
        `sender_department.ilike.%${term}%`,
        `reference_number.ilike.%${term}%`
      ].join(','));
    }
    query = query.range(from, to);
    const { data, error, count } = await query;
    if (error) throw error;
    const visible = data || [];
    return res.status(200).json({
      documents: visible,
      role,
      permissions: Array.from(permissions),
      pagination: { page, page_size: pageSize, total: Number(count || 0) }
    });
  }

  if (req.method === 'GET' && action === 'summary') {
    const companyIds = memberships.map(m => m.company_id).filter(Boolean);
    const workspaceFilters = requestedWorkspaceFilters(req, url);
    const { data, error } = await sb.rpc('get_correspondence_summary_v2', {
      p_user_id: user.id,
      p_company_ids: companyIds,
      p_read_all: READ_ROLES.has(role) || permissions.has('read_all'),
      p_workspace_context: workspaceFilters,
      p_filter_company_id: cleanText(req.query?.company_id || url.searchParams.get('company_id'), 64)
    });
    if (error) throw error;
    const summary = data || {};
    return res.status(200).json({
      total: Number(summary.total || 0),
      by_status: summary.by_status || {},
      urgent: Number(summary.urgent || 0),
      failed_delivery: Number(summary.failed_delivery || 0),
      role,
      permissions: Array.from(permissions)
    });
  }

  if (req.method === 'GET' && action === 'my-work') {
    const page = Math.max(1, Math.min(100000, Number(req.query?.page || url.searchParams.get('page') || 1)));
    const pageSize = Math.max(1, Math.min(100, Number(req.query?.page_size || url.searchParams.get('page_size') || 25)));
    const companyIds = memberships.map(m => m.company_id).filter(Boolean);
    const workspaceFilters = requestedWorkspaceFilters(req, url);
    const { data, error } = await sb.rpc('get_correspondence_my_work_v2', {
      p_user_id: user.id,
      p_role: role,
      p_permissions: Array.from(permissions),
      p_read_all: READ_ROLES.has(role) || permissions.has('read_all'),
      p_company_ids: companyIds,
      p_workspace_context: workspaceFilters,
      p_filter_company_id: cleanText(req.query?.company_id || url.searchParams.get('company_id'), 64),
      p_offset: (page - 1) * pageSize,
      p_limit: pageSize
    });
    if (error) throw error;
    const payload = data || {};
    const now = Date.now();
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    return res.status(200).json({
      tasks: tasks.map(task => ({ ...task, overdue: !!task.due_at && new Date(task.due_at).getTime() < now })),
      pagination: { page, page_size: pageSize, total: Number(payload.total || 0) },
      role,
      permissions: Array.from(permissions)
    });
  }

  if (req.method === 'GET' && action === 'get') {
    const doc = await loadDoc(sb, id);
    if (!canRead(doc, user, role, memberships, permissions)) return res.status(doc ? 403 : 404).json({ error: doc ? 'Forbidden' : 'Not found' });
    const latest = await loadLatestVersion(sb, id);
    const { data: events } = await sb.from('correspondence_events').select('*').eq('document_id', id).order('created_at', { ascending: false }).limit(100);
    return res.status(200).json({
      document: doc,
      latest_version: latest,
      events: events || [],
      role,
      permissions: Array.from(permissions),
      is_owner: doc.owner_user_id === user.id
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (action === 'import-device') {
    const result = await importDeviceFile(req.body || {});
    return res.status(200).json(result);
  }

  if (action === 'create') {
    const doc = await createDocument(sb, user, req.body || {}, memberships, role, permissions);
    return res.status(201).json({
      document: doc,
      role,
      permissions: Array.from(permissions),
      is_owner: doc.owner_user_id === user.id
    });
  }

  const doc = await loadDoc(sb, id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (!canRead(doc, user, role, memberships, permissions)) return res.status(403).json({ error: 'Forbidden' });

  if (action === 'artifact-download-url') {
    const result = await createArtifactDownloadUrl(sb, doc, user, role, memberships, permissions);
    return res.status(200).json(result);
  }
  if (action === 'save-version') {
    const result = await saveVersion(sb, doc, user, req.body || {}, memberships, role, permissions);
    return res.status(200).json(result);
  }
  if (action === 'transition') {
    const target = String(req.body?.target || '').trim();
    const result = await transitionDocument(sb, doc, user, role, permissions, target, req.body || {});
    return res.status(200).json({ document: result });
  }
  if (action === 'mark-signature') {
    const result = await markGovernanceAction(sb, doc, user, role, permissions, 'sign', req.body || {});
    return res.status(200).json({ document: result });
  }
  if (action === 'mark-stamp') {
    const result = await markGovernanceAction(sb, doc, user, role, permissions, 'stamp', req.body || {});
    return res.status(200).json({ document: result });
  }
  if (action === 'artifact-upload-url') {
    const result = await createArtifactUpload(sb, doc, user, role, permissions);
    return res.status(200).json(result);
  }
  if (action === 'artifact-finalize') {
    const result = await finalizeArtifact(sb, doc, user, role, permissions, req.body || {});
    return res.status(200).json({ document: result });
  }
  if (action === 'send') {
    const result = await sendDocument(sb, doc, user, role, permissions, req.body || {});
    return res.status(200).json({ document: result });
  }

  return res.status(400).json({ error: 'Unknown correspondence action' });
}

module.exports = {
  handler,
  sanitizeHtml,
  sanitizePages,
  importDeviceFile,
  cleanWorkspaceContext,
  validateWorkspaceContext,
  requestedWorkspaceFilters,
  workspaceContextMatches,
  TRANSITIONS,
  ADMIN_ROLES,
  READ_ROLES
};
