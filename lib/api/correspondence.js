const crypto = require('crypto');
const getSupabase = require('./supabase');
const { sendEmail } = require('./email');

const ADMIN_ROLES = new Set(['super_admin', 'admin']);
const READ_ROLES = new Set(['super_admin', 'admin']);
const EDITABLE_STATUSES = new Set(['draft', 'returned']);
const TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  returned: ['submitted', 'cancelled'],
  submitted: ['under_review', 'returned', 'rejected', 'cancelled'],
  under_review: ['approved', 'returned', 'rejected'],
  approved: ['issued', 'returned', 'rejected'],
  issued: ['sent', 'archived'],
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

function canRead(doc, user, role, memberships = []) {
  if (!doc) return false;
  if (doc.owner_user_id === user.id || READ_ROLES.has(role)) return true;
  if (!doc.company_id || doc.confidentiality === 'restricted') return false;
  return memberships.some(m => m.company_id === doc.company_id);
}

function canManage(role) {
  return ADMIN_ROLES.has(role);
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

async function createDocument(sb, user, body, memberships = []) {
  const requestedCompanyId = cleanText(body.company_id, 64);
  const allowedCompanyIds = new Set(memberships.map(m => m.company_id));
  if (requestedCompanyId && !allowedCompanyIds.has(requestedCompanyId)) {
    const err = new Error('User is not a member of the requested company');
    err.status = 403;
    throw err;
  }
  const companyId = requestedCompanyId || (memberships.length === 1 ? memberships[0].company_id : null);

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
    workspace_context: body.workspace_context && typeof body.workspace_context === 'object' ? body.workspace_context : {}
  };
  if (row.recipient_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.recipient_email)) {
    const err = new Error('Invalid recipient email');
    err.status = 400;
    throw err;
  }
  if (jsonSize(row.workspace_context) > 12_000) {
    const err = new Error('workspace_context is too large');
    err.status = 413;
    throw err;
  }
  const { data, error } = await sb.from('correspondence_documents').insert(row).select('*').single();
  if (error) throw error;
  await addEvent(sb, data.id, user.id, 'created', null, 'draft', null, { language: data.language, direction: data.direction });
  return data;
}

async function saveVersion(sb, doc, user, body) {
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
  const nextVersion = Number(doc.current_version || 0) + 1;

  const { error: versionError } = await sb.from('correspondence_versions').insert({
    document_id: doc.id,
    version: nextVersion,
    pages_html: pages,
    text_content: text,
    checksum_sha256: checksum,
    created_by: user.id
  });
  if (versionError) throw versionError;

  const updates = {
    current_version: nextVersion,
    document_hash: checksum,
    signed_by: null,
    signed_at: null,
    signature_image_data: null,
    signature_hash: null,
    stamped_by: null,
    stamped_at: null,
    stamp_hash: null,
    issued_hash: null
  };
  for (const key of ['title','subject','recipient_organization','recipient_name','recipient_title','sender_department']) {
    if (body[key] !== undefined) updates[key] = cleanText(body[key], key === 'subject' ? 500 : 250);
  }
  if (['incoming','outgoing','internal'].includes(body.direction)) updates.direction = body.direction;
  if (['low','normal','high','urgent'].includes(body.priority)) updates.priority = body.priority;
  if (['public','internal','confidential','restricted'].includes(body.confidentiality)) updates.confidentiality = body.confidentiality;
  if (body.recipient_email !== undefined) {
    const email = cleanText(body.recipient_email, 320);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error('Invalid recipient email');
      err.status = 400;
      throw err;
    }
    updates.recipient_email = email;
  }
  if (body.workspace_context && typeof body.workspace_context === 'object') {
    if (jsonSize(body.workspace_context) > 12_000) {
      const err = new Error('workspace_context is too large');
      err.status = 413;
      throw err;
    }
    updates.workspace_context = body.workspace_context;
  }

  const { data, error } = await sb.from('correspondence_documents').update(updates).eq('id', doc.id).select('*').single();
  if (error) throw error;
  await addEvent(sb, doc.id, user.id, 'version_saved', doc.status, doc.status, nextVersion, { checksum_sha256: checksum });
  return { document: data, version: nextVersion, checksum_sha256: checksum };
}

async function transitionDocument(sb, doc, user, role, target, body) {
  const allowed = TRANSITIONS[doc.status] || [];
  if (!allowed.includes(target)) {
    const err = new Error(`Invalid workflow transition: ${doc.status} -> ${target}`);
    err.status = 409;
    throw err;
  }

  const ownerTransition = doc.owner_user_id === user.id && ['submitted', 'cancelled'].includes(target) && ['draft', 'returned'].includes(doc.status);
  if (!ownerTransition && !canManage(role)) {
    const err = new Error('This workflow transition requires correspondence management permission');
    err.status = 403;
    throw err;
  }
  if (target === 'submitted' && Number(doc.current_version || 0) < 1) {
    const err = new Error('Save at least one document version before submission');
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
    if (!doc.signed_by || !doc.signature_hash) {
      const err = new Error('Approved document must be signed before issuance');
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
    note: cleanText(body.note, 1000),
    reference_number: data.reference_number || null
  });
  return data;
}

async function markGovernanceAction(sb, doc, user, role, action, body = {}) {
  if (!canManage(role)) {
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
  return data;
}

async function createArtifactUpload(sb, doc, user, role) {
  if (!canManage(role)) {
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

async function finalizeArtifact(sb, doc, user, role, body) {
  if (!canManage(role)) {
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

  const artifactHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const now = new Date().toISOString();
  const { data, error } = await sb.from('correspondence_documents').update({
    artifact_path: path,
    artifact_hash: artifactHash,
    artifact_size_bytes: buffer.length,
    artifact_created_at: now
  }).eq('id', doc.id).eq('status', 'issued').select('*').single();
  if (error) throw error;

  await addEvent(sb, doc.id, user.id, 'final_pdf_created', 'issued', 'issued', doc.current_version, {
    artifact_hash: artifactHash,
    size_bytes: buffer.length
  });
  return data;
}

async function loadVerifiedArtifact(sb, doc) {
  if (!doc.artifact_path || !doc.artifact_hash) {
    const err = new Error('Final PDF artifact is required before sending');
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
  return await response.text();
}

async function sendDocument(sb, doc, user, role, body) {
  if (!canManage(role)) {
    const err = new Error('Sending correspondence requires admin permission');
    err.status = 403;
    throw err;
  }
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
  const allowed = Array.from(new Set(configuredRecipients));
  if (!allowed.length) {
    const err = new Error('Correspondence recipient is not configured');
    err.status = 503;
    throw err;
  }
  const requested = cleanText(body.to, 320)?.toLowerCase();
  const recipient = requested || allowed[0];
  if (!allowed.includes(recipient)) {
    const err = new Error('Recipient is not authorized for correspondence');
    err.status = 403;
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
    attachments: [{
      filename: (doc.reference_number || 'bonds-correspondence') + '.pdf',
      contentType: 'application/pdf',
      content: finalPdf.toString('base64')
    }]
  });
  if (!result?.success || result?.demo) {
    const err = new Error(result?.demo ? 'Email provider is not configured for real delivery' : (result?.error || 'Email delivery failed'));
    err.status = 502;
    throw err;
  }

  const now = new Date().toISOString();
  const { data, error } = await sb.from('correspondence_documents').update({ status: 'sent', sent_at: now }).eq('id', doc.id).eq('status', 'issued').select('*').single();
  if (error) throw error;
  await addEvent(sb, doc.id, user.id, 'sent', 'issued', 'sent', doc.current_version, {
    recipient,
    provider_message_id: result.messageId || null
  });
  return data;
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
      .select('reference_number,title,subject,status,document_hash,issued_hash,artifact_hash,artifact_size_bytes,signature_hash,stamp_hash,signed_at,stamped_at,issued_at,sent_at,verification_token')
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
      final_pdf_verified: !!data.artifact_hash,
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

  if (req.method === 'GET' && action === 'list') {
    let query = sb.from('correspondence_documents').select('*').order('updated_at', { ascending: false }).limit(100);
    if (!READ_ROLES.has(role)) {
      const companyIds = memberships.map(m => m.company_id).filter(Boolean);
      const filters = [`owner_user_id.eq.${user.id}`];
      if (companyIds.length) filters.push(`company_id.in.(${companyIds.join(',')})`);
      query = query.or(filters.join(','));
    }
    const status = String(req.query?.status || url.searchParams.get('status') || '');
    const direction = String(req.query?.direction || url.searchParams.get('direction') || '');
    if (status) query = query.eq('status', status);
    if (direction) query = query.eq('direction', direction);
    const { data, error } = await query;
    if (error) throw error;
    const visible = READ_ROLES.has(role)
      ? (data || [])
      : (data || []).filter(row => row.owner_user_id === user.id || row.confidentiality !== 'restricted');
    return res.status(200).json({ documents: visible, role });
  }

  if (req.method === 'GET' && action === 'get') {
    const doc = await loadDoc(sb, id);
    if (!canRead(doc, user, role, memberships)) return res.status(doc ? 403 : 404).json({ error: doc ? 'Forbidden' : 'Not found' });
    const latest = await loadLatestVersion(sb, id);
    const { data: events } = await sb.from('correspondence_events').select('*').eq('document_id', id).order('created_at', { ascending: false }).limit(100);
    return res.status(200).json({ document: doc, latest_version: latest, events: events || [], role });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (action === 'create') {
    const doc = await createDocument(sb, user, req.body || {}, memberships);
    return res.status(201).json({ document: doc, role });
  }

  const doc = await loadDoc(sb, id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (!canRead(doc, user, role, memberships)) return res.status(403).json({ error: 'Forbidden' });

  if (action === 'save-version') {
    const result = await saveVersion(sb, doc, user, req.body || {});
    return res.status(200).json(result);
  }
  if (action === 'transition') {
    const target = String(req.body?.target || '').trim();
    const result = await transitionDocument(sb, doc, user, role, target, req.body || {});
    return res.status(200).json({ document: result });
  }
  if (action === 'mark-signature') {
    const result = await markGovernanceAction(sb, doc, user, role, 'sign', req.body || {});
    return res.status(200).json({ document: result });
  }
  if (action === 'mark-stamp') {
    const result = await markGovernanceAction(sb, doc, user, role, 'stamp', req.body || {});
    return res.status(200).json({ document: result });
  }
  if (action === 'artifact-upload-url') {
    const result = await createArtifactUpload(sb, doc, user, role);
    return res.status(200).json(result);
  }
  if (action === 'artifact-finalize') {
    const result = await finalizeArtifact(sb, doc, user, role, req.body || {});
    return res.status(200).json({ document: result });
  }
  if (action === 'send') {
    const result = await sendDocument(sb, doc, user, role, req.body || {});
    return res.status(200).json({ document: result });
  }

  return res.status(400).json({ error: 'Unknown correspondence action' });
}

module.exports = {
  handler,
  sanitizeHtml,
  sanitizePages,
  TRANSITIONS,
  ADMIN_ROLES,
  READ_ROLES
};
