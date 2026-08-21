// ============================================
// Funding Case Management — Phase 4 admin logic
// Shared helper used by /api/admin.js funding-case actions.
// ============================================

const { sendEmail } = require('./email');

const FUNDING_CASE_STATUSES = [
  'new', 'initial_review', 'documents_required', 'under_assessment',
  'funding_options', 'submitted_to_provider', 'provider_review',
  'approved', 'declined', 'on_hold', 'closed'
];

const FUNDING_STATUS_LABELS = {
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

const DOCUMENT_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (bucket limit)

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFilename(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 100);
}

function stripDataUri(data) {
  if (typeof data !== 'string') return '';
  const match = data.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : data;
}

function base64ByteLength(str) {
  const base64 = stripDataUri(str);
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

async function getFundingCases(sb, params) {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(100, Math.max(5, parseInt(params.limit || '20', 10)));
  const offset = (page - 1) * limit;

  let query = sb
    .from('funding_cases')
    .select('id, case_reference, status, source, name, company, email, phone, country, financing_type, amount, purpose_category, sector, readiness_score, assigned_to, provider_name, submitted_at, approved_at, closed_at, next_action_at, sla_deadline_at, client_id, project_id, created_at, updated_at', { count: 'exact' });

  if (params.status) query = query.eq('status', params.status);
  if (params.source) query = query.eq('source', params.source);
  if (params.financingType) query = query.eq('financing_type', params.financingType);
  if (params.assignedTo) query = query.eq('assigned_to', params.assignedTo);
  if (params.search) {
    const term = `%${String(params.search).replace(/[%_]/g, '\\$&')}%`;
    query = query.or(`case_reference.ilike.${term},company.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  query = query.order('created_at', { ascending: false });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    cases: data || [],
    pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
    statusLabels: FUNDING_STATUS_LABELS
  };
}

async function getFundingCaseDetail(sb, id) {
  const { data: caseData, error } = await sb
    .from('funding_cases')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  const [{ data: events }, { data: documents }, { data: transitions }] = await Promise.all([
    sb.from('funding_case_events').select('*').eq('case_id', id).order('created_at', { ascending: false }),
    sb.from('funding_case_documents').select('*').eq('case_id', id).order('created_at', { ascending: false }),
    sb.from('funding_case_allowed_transitions').select('to_status, requires_note, requires_document').eq('from_status', caseData.status)
  ]);

  // Generate short-lived signed URLs for private documents
  const docsWithUrls = await Promise.all((documents || []).map(async d => {
    try {
      const { data: urlData } = await sb.storage
        .from(d.storage_bucket || 'funding-documents')
        .createSignedUrl(d.storage_path, 3600);
      return { ...d, signedUrl: urlData?.signedUrl || null };
    } catch (e) {
      return { ...d, signedUrl: null };
    }
  }));

  return {
    case: caseData,
    events: events || [],
    documents: docsWithUrls,
    allowedTransitions: (transitions || []).map(t => t.to_status),
    statusLabels: FUNDING_STATUS_LABELS
  };
}

async function validateTransition(sb, fromStatus, toStatus) {
  const { count, error } = await sb
    .from('funding_case_allowed_transitions')
    .select('*', { count: 'exact', head: true })
    .eq('from_status', fromStatus)
    .eq('to_status', toStatus);
  if (error) throw new Error(error.message);
  return (count || 0) > 0;
}

async function updateFundingCase(sb, id, updates, actor) {
  const allowed = ['status', 'assigned_to', 'internal_notes', 'next_action_at', 'sla_deadline_at', 'provider_name', 'provider_reference', 'approved_at', 'closed_at'];
  const set = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) set[key] = updates[key] === '' ? null : updates[key];
  }
  if (Object.keys(set).length === 0) throw new Error('No valid fields to update');

  const { data: before } = await sb.from('funding_cases').select('*').eq('id', id).single();
  if (!before) throw new Error('Funding case not found');

  // Workflow enforcement
  if (updates.status && updates.status !== before.status) {
    const allowedTransition = await validateTransition(sb, before.status, updates.status);
    if (!allowedTransition) {
      throw new Error(`Transition from ${before.status} to ${updates.status} is not allowed`);
    }
  }

  // Auto-set lifecycle timestamps
  const now = new Date().toISOString();
  if (updates.status === 'approved' && !set.approved_at) set.approved_at = now;
  if (updates.status === 'declined' && !set.declined_at) set.declined_at = now;
  if (updates.status === 'closed' && !set.closed_at) set.closed_at = now;

  set.updated_at = now;

  const { data, error } = await sb.from('funding_cases').update(set).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);

  if (updates.status && before.status !== updates.status) {
    const { data: event } = await sb.from('funding_case_events').insert({
      case_id: id,
      event_type: 'status_changed',
      from_status: before.status,
      to_status: updates.status,
      actor_id: actor.id,
      actor_email: actor.email,
      metadata: {}
    }).select('id').single();

    // Notify client about status change (best-effort)
    if (isValidEmail(data.email)) {
      try {
        await sendFundingCaseNotification(sb, data, 'funding_status_changed');
        if (event?.id) {
          await sb.from('funding_case_events')
            .update({ notification_sent: true, template_key: 'funding_status_changed' })
            .eq('id', event.id);
        }
      } catch (e) {
        console.warn('Funding status notification failed:', e.message);
      }
    }
  }

  if (updates.assigned_to !== undefined && updates.assigned_to !== before.assigned_to) {
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

async function addFundingCaseNote(sb, caseId, note, actor) {
  const clean = String(note || '').trim().slice(0, 2000);
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

async function requestDocument(sb, caseId, payload, actor) {
  const documentType = String(payload.documentType || 'required').trim();
  const note = String(payload.note || '').trim().slice(0, 1000);

  const validTypes = ['commercial_register', 'financial_statements', 'bank_statement', 'id_copy', 'project_plan', 'other'];
  if (!validTypes.includes(documentType)) throw new Error('Invalid document type');

  const { data: caseRow } = await sb.from('funding_cases').select('*').eq('id', caseId).single();
  if (!caseRow) throw new Error('Funding case not found');

  const documentLabelMap = {
    commercial_register: 'السجل التجاري',
    financial_statements: 'القوائم المالية',
    bank_statement: 'كشف الحساب البنكي',
    id_copy: 'صورة الهوية',
    project_plan: 'خطة المشروع',
    other: 'مستند آخر'
  };

  const event = await sb.from('funding_case_events').insert({
    case_id: caseId,
    event_type: 'document_requested',
    note,
    actor_id: actor.id,
    actor_email: actor.email,
    metadata: { document_type: documentType }
  }).select('*').single();

  if (event.error) throw new Error(event.error.message);

  // Notify client
  if (isValidEmail(caseRow.email)) {
    try {
      await sendFundingCaseNotification(sb, caseRow, 'funding_document_requested', {
        documents: documentLabelMap[documentType]
      });
      await sb.from('funding_case_events')
        .update({ notification_sent: true, template_key: 'funding_document_requested' })
        .eq('id', event.data.id);
    } catch (e) {
      // Notification failure should not fail the request
      console.warn('Funding document request notification failed:', e.message);
    }
  }

  return { success: true, event: event.data };
}

async function uploadDocument(sb, caseId, payload, actor) {
  if (!payload || !payload.name || !payload.data) throw new Error('Missing file name or data');

  const contentType = payload.type || 'application/octet-stream';
  if (!DOCUMENT_ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${payload.type}`);
  }

  const size = base64ByteLength(payload.data);
  if (size > MAX_FILE_BYTES) throw new Error('File exceeds 10 MB limit');
  if (size === 0) throw new Error('Empty file');

  const filename = safeFilename(payload.name);
  const path = `${caseId}/${Date.now()}_${filename}`;
  const buffer = Buffer.from(stripDataUri(payload.data), 'base64');

  const { data: uploadData, error: uploadError } = await sb.storage
    .from('funding-documents')
    .upload(path, buffer, { contentType, upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data: doc, error: docError } = await sb.from('funding_case_documents').insert({
    case_id: caseId,
    file_name: filename,
    storage_bucket: 'funding-documents',
    storage_path: path,
    file_size: size,
    mime_type: contentType,
    document_type: 'received',
    uploaded_by: actor.id
  }).select('*').single();

  if (docError) throw new Error(docError.message);

  await sb.from('funding_case_events').insert({
    case_id: caseId,
    event_type: 'document_received',
    actor_id: actor.id,
    actor_email: actor.email,
    metadata: { document_id: doc.id, file_name: filename }
  });

  return { success: true, document: doc };
}

async function clientUploadDocument(sb, caseId, payload, actor) {
  if (!payload || !payload.name || !payload.data) throw new Error('Missing file name or data');

  const contentType = payload.type || 'application/octet-stream';
  if (!DOCUMENT_ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${payload.type}`);
  }

  const size = base64ByteLength(payload.data);
  if (size > MAX_FILE_BYTES) throw new Error('File exceeds 10 MB limit');
  if (size === 0) throw new Error('Empty file');

  const filename = safeFilename(payload.name);
  const path = `client-uploads/${caseId}/${Date.now()}_${filename}`;
  const buffer = Buffer.from(stripDataUri(payload.data), 'base64');

  const { error: uploadError } = await sb.storage
    .from('funding-documents')
    .upload(path, buffer, { contentType, upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data: doc, error: docError } = await sb.from('funding_case_documents').insert({
    case_id: caseId,
    file_name: filename,
    storage_bucket: 'funding-documents',
    storage_path: path,
    file_size: size,
    mime_type: contentType,
    document_type: 'received',
    uploaded_by: actor.id
  }).select('*').single();

  if (docError) throw new Error(docError.message);

  await sb.from('funding_case_events').insert({
    case_id: caseId,
    event_type: 'document_received',
    actor_id: actor.id,
    actor_email: actor.email,
    metadata: { document_id: doc.id, file_name: filename, source: 'client_portal' }
  });

  return { success: true, document: doc };
}

async function linkAdvisoryClient(sb, caseId, payload, actor) {
  const { clientId, createNew, projectName, projectDescription } = payload || {};

  const { data: caseRow } = await sb.from('funding_cases').select('*').eq('id', caseId).single();
  if (!caseRow) throw new Error('Funding case not found');

  let linkedClientId = clientId;

  if (createNew || !linkedClientId) {
    const { data: newClientId, error: rpcError } = await sb.rpc('capture_lead', {
      p_name: caseRow.name,
      p_email: caseRow.email,
      p_phone: caseRow.phone || null,
      p_company_name: caseRow.company,
      p_sector: caseRow.sector || null,
      p_country: caseRow.country || null,
      p_source: 'funding_case',
      p_source_url: `https://bonds-global.com/admin/funding-cases/?id=${caseId}`
    });

    if (rpcError) throw new Error(rpcError.message);
    linkedClientId = newClientId;
  } else if (!isValidUuid(linkedClientId)) {
    throw new Error('Invalid client id');
  }

  let linkedProjectId = null;
  if (createNew || projectName) {
    const { data: projectId, error: projectError } = await sb.rpc('create_advisory_project_from_funding_case', {
      p_client_id: linkedClientId,
      p_case_id: caseId,
      p_name: projectName || null,
      p_description: projectDescription || null,
      p_created_by: actor.id
    });
    if (projectError) throw new Error(projectError.message);
    linkedProjectId = projectId;
  }

  const update = { client_id: linkedClientId, updated_at: new Date().toISOString() };
  if (linkedProjectId) update.project_id = linkedProjectId;

  const { data: updated, error: updateError } = await sb.from('funding_cases')
    .update(update)
    .eq('id', caseId)
    .select('*')
    .single();
  if (updateError) throw new Error(updateError.message);

  await sb.from('funding_case_events').insert({
    case_id: caseId,
    event_type: 'contact',
    actor_id: actor.id,
    actor_email: actor.email,
    metadata: { client_id: linkedClientId, project_id: linkedProjectId, action: 'linked_advisory' }
  });

  return { success: true, case: updated, clientId: linkedClientId, projectId: linkedProjectId };
}

async function listAssignees(sb) {
  const { data: adminUsers, error: adminErr } = await sb
    .from('admin_roles')
    .select('user_id, role, profiles(email, restaurant_name)')
    .in('role', ['super_admin', 'admin', 'support']);

  const { data: advisoryUsers, error: advErr } = await sb
    .from('advisory_roles')
    .select('user_id, role, profiles(email, restaurant_name)')
    .in('role', ['manager', 'advisor', 'viewer']);

  if (adminErr) throw new Error(adminErr.message);
  if (advErr) throw new Error(advErr.message);

  const map = new Map();
  const add = (u, source) => {
    const id = u.user_id;
    const profile = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
    const label = profile?.restaurant_name || profile?.email || id;
    if (!map.has(id)) {
      map.set(id, {
        id,
        email: profile?.email || '',
        name: profile?.restaurant_name || profile?.email || id,
        label: `${label} (${source}: ${u.role})`,
        role: u.role,
        source
      });
    }
  };

  (adminUsers || []).forEach(u => add(u, 'admin'));
  (advisoryUsers || []).forEach(u => add(u, 'advisory'));

  return { success: true, assignees: Array.from(map.values()) };
}

async function getFundingCaseKpis(sb) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const [
    { count: total },
    { count: newThisWeek },
    { count: overdue },
    { data: statusRows },
    { data: amountRow }
  ] = await Promise.all([
    sb.from('funding_cases').select('*', { count: 'exact', head: true }),
    sb.from('funding_cases').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo),
    sb.from('funding_cases').select('*', { count: 'exact', head: true }).lt('next_action_at', now).not('next_action_at', 'is', null),
    sb.from('funding_cases').select('status'),
    sb.from('funding_cases').select('amount')
  ]);

  const byStatus = {};
  for (const s of FUNDING_CASE_STATUSES) byStatus[s] = 0;
  for (const row of statusRows || []) {
    if (row.status in byStatus) byStatus[row.status]++;
  }

  const amounts = (amountRow || []).map(r => Number(r.amount)).filter(a => Number.isFinite(a) && a > 0);
  const avgAmount = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;

  const approvedCount = byStatus.approved || 0;
  const closedCount = byStatus.closed || 0;
  const totalDecided = approvedCount + closedCount + (byStatus.declined || 0);
  const conversionRate = totalDecided > 0 ? (approvedCount / totalDecided * 100).toFixed(1) : '0.0';

  return {
    success: true,
    kpis: {
      total: total || 0,
      newThisWeek: newThisWeek || 0,
      overdue: overdue || 0,
      avgAmount: Math.round(avgAmount),
      conversionRate,
      byStatus
    }
  };
}

async function sendFundingCaseNotification(sb, caseRow, templateKey, extra = {}) {
  const { data: template, error } = await sb
    .from('notification_templates')
    .select('*')
    .eq('key', templateKey)
    .single();
  if (error || !template) return { sent: false, reason: 'Template not found' };

  const statusLabel = FUNDING_STATUS_LABELS.ar[caseRow.status] || caseRow.status;
  const portalLink = `https://bonds-global.com/client/funding-case.html?id=${caseRow.id}`;
  const html = template.body_ar
    .replace(/{{case_reference}}/g, escapeHtml(caseRow.case_reference))
    .replace(/{{name}}/g, escapeHtml(caseRow.name))
    .replace(/{{status_label}}/g, escapeHtml(statusLabel))
    .replace(/{{documents}}/g, escapeHtml(extra.documents || ''))
    .replace(/{{next_action_at}}/g, extra.nextActionAt ? escapeHtml(new Date(extra.nextActionAt).toLocaleString('ar-SA')) : '-')
    .replace(/{{portal_link}}/g, escapeHtml(portalLink));

  const subject = template.subject_ar.replace(/{{case_reference}}/g, caseRow.case_reference);

  return sendEmail({
    to: caseRow.email,
    subject,
    html,
    text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  });
}

async function sendFundingCaseReminders(sb, actor) {
  const now = new Date().toISOString();
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: cases, error } = await sb
    .from('funding_cases')
    .select('*')
    .not('next_action_at', 'is', null)
    .lte('next_action_at', now)
    .or(`reminder_sent_at.is.null,reminder_sent_at.lt.${windowStart}`)
    .not('status', 'in', '(approved,declined,closed)');

  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const c of cases || []) {
    try {
      if (isValidEmail(c.email)) {
        await sendFundingCaseNotification(sb, c, 'funding_reminder', { nextActionAt: c.next_action_at });
      }
      await sb.from('funding_cases')
        .update({ reminder_sent_at: now })
        .eq('id', c.id);
      sent++;
    } catch (e) {
      console.warn('Funding reminder failed for case', c.id, e.message);
      failed++;
    }
  }

  await sb.from('funding_case_events').insert({
    case_id: null,
    event_type: 'contact',
    actor_id: actor?.id || null,
    actor_email: actor?.email || 'cron',
    metadata: { action: 'send_reminders', sent, failed }
  });

  return { success: true, sent, failed };
}

module.exports = {
  FUNDING_CASE_STATUSES,
  FUNDING_STATUS_LABELS,
  getFundingCases,
  getFundingCaseDetail,
  updateFundingCase,
  addFundingCaseNote,
  requestDocument,
  uploadDocument,
  clientUploadDocument,
  linkAdvisoryClient,
  listAssignees,
  getFundingCaseKpis,
  sendFundingCaseReminders,
  sendFundingCaseNotification
};
