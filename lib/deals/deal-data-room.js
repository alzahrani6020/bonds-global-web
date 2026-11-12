'use strict';

const crypto = require('crypto');

const DATA_ROOM_BUCKET = 'deal-data-room';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const DOCUMENT_VISIBILITIES = Object.freeze(['team','counterparty','selected']);
const DOCUMENT_GRANT_LEVELS = Object.freeze(['view','download']);
const DOCUMENT_REQUEST_STATUSES = Object.freeze(['open','submitted','fulfilled','waived']);
const DD_STATUSES = Object.freeze(['not_started','in_progress','blocked','complete','not_applicable']);
const RISK_RATINGS = Object.freeze(['low','medium','high','critical']);
const ALLOWED_CONTENT_TYPES = Object.freeze([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

function cleanText(value, max = 500) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : '';
}

function pick(value, allowed, field, fallback = undefined) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!allowed.includes(normalized)) throw new Error(field.toUpperCase() + '_INVALID');
  return normalized;
}

function isoDate(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(field.toUpperCase() + '_INVALID');
  return new Date(time).toISOString();
}

function safeUuid(value, field, nullable = true) {
  if (value === undefined) return undefined;
  if ((value === null || value === '') && nullable) return null;
  const text = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(field.toUpperCase() + '_INVALID');
  }
  return text;
}

function safeFilename(value) {
  const input = String(value || '').normalize('NFKC').trim();
  if (!input) throw new Error('UPLOAD_FILE_NAME_REQUIRED');
  const withoutPath = input.replace(/[\\/]+/g, '-').replace(/[\u0000-\u001f\u007f]/g, '');
  const safe = withoutPath.replace(/\s+/g, ' ').slice(0, 180).trim();
  if (!safe || safe === '.' || safe === '..') throw new Error('UPLOAD_FILE_NAME_INVALID');
  return safe;
}

function normalizeUploadSpec(body = {}) {
  const file_name = safeFilename(body.file_name);
  const content_type = cleanText(body.content_type, 160).toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(content_type)) throw new Error('UPLOAD_CONTENT_TYPE_NOT_ALLOWED');
  const size_bytes = Number(body.size_bytes);
  if (!Number.isInteger(size_bytes) || size_bytes <= 0 || size_bytes > MAX_FILE_BYTES) {
    throw new Error('UPLOAD_SIZE_INVALID');
  }
  const checksum = cleanText(body.checksum_sha256, 64).toLowerCase();
  if (checksum && !/^[0-9a-f]{64}$/.test(checksum)) throw new Error('UPLOAD_CHECKSUM_INVALID');
  return { file_name, content_type, size_bytes, checksum_sha256:checksum || null };
}

function normalizeDocumentPatch(body = {}) {
  const patch = {};
  if (body.visibility !== undefined) patch.visibility = pick(body.visibility, DOCUMENT_VISIBILITIES, 'document_visibility');
  if (body.confidentiality !== undefined) patch.confidentiality = pick(body.confidentiality, ['standard','confidential','restricted'], 'document_confidentiality');
  if (body.status !== undefined) patch.status = pick(body.status, ['requested','received','reviewed','approved','rejected'], 'document_status');
  if (body.name !== undefined) {
    const name = cleanText(body.name, 300);
    if (!name) throw new Error('DEAL_DOCUMENT_NAME_REQUIRED');
    patch.name = name;
  }
  if (body.category !== undefined) patch.category = cleanText(body.category, 120) || 'general';
  if (body.notes !== undefined) patch.notes = cleanText(body.notes, 2000) || null;
  if (!Object.keys(patch).length) throw new Error('DOCUMENT_PATCH_EMPTY');
  return patch;
}

function normalizeGrant(body = {}) {
  const member_id = safeUuid(body.member_id, 'member_id', false);
  return {
    member_id,
    access_level:pick(body.access_level, DOCUMENT_GRANT_LEVELS, 'access_level', 'download'),
    status:pick(body.status, ['active','revoked'], 'grant_status', 'active')
  };
}

function normalizeDocumentRequest(body = {}) {
  const title = cleanText(body.title, 300);
  if (!title) throw new Error('DOCUMENT_REQUEST_TITLE_REQUIRED');
  return {
    title,
    description:cleanText(body.description, 3000) || null,
    category:cleanText(body.category, 120) || 'general',
    requested_from_member_id:safeUuid(body.requested_from_member_id, 'requested_from_member_id'),
    due_at:isoDate(body.due_at, 'due_at') || null,
    metadata:body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}
  };
}

function normalizeDocumentRequestPatch(body = {}) {
  const patch = {};
  if (body.status !== undefined) patch.status = pick(body.status, DOCUMENT_REQUEST_STATUSES, 'request_status');
  if (body.title !== undefined) {
    const title = cleanText(body.title, 300);
    if (!title) throw new Error('DOCUMENT_REQUEST_TITLE_REQUIRED');
    patch.title = title;
  }
  if (body.description !== undefined) patch.description = cleanText(body.description, 3000) || null;
  if (body.category !== undefined) patch.category = cleanText(body.category, 120) || 'general';
  if (body.requested_from_member_id !== undefined) patch.requested_from_member_id = safeUuid(body.requested_from_member_id, 'requested_from_member_id');
  if (body.due_at !== undefined) patch.due_at = isoDate(body.due_at, 'due_at');
  if (!Object.keys(patch).length) throw new Error('DOCUMENT_REQUEST_PATCH_EMPTY');
  return patch;
}

function normalizeDueDiligencePatch(body = {}) {
  const patch = {};
  if (body.status !== undefined) patch.status = pick(body.status, DD_STATUSES, 'dd_status');
  if (body.risk_rating !== undefined) {
    patch.risk_rating = body.risk_rating === null || body.risk_rating === ''
      ? null
      : pick(body.risk_rating, RISK_RATINGS, 'risk_rating');
  }
  if (body.finding !== undefined) patch.finding = cleanText(body.finding, 4000) || null;
  if (body.owner_note !== undefined) patch.owner_note = cleanText(body.owner_note, 2000) || null;
  if (body.assigned_member_id !== undefined) patch.assigned_member_id = safeUuid(body.assigned_member_id, 'assigned_member_id');
  if (body.due_at !== undefined) patch.due_at = isoDate(body.due_at, 'due_at');
  if (body.evidence_document_id !== undefined) patch.evidence_document_id = safeUuid(body.evidence_document_id, 'evidence_document_id');
  if (body.remediation !== undefined) patch.remediation = cleanText(body.remediation, 4000) || null;
  if (body.resolution_note !== undefined) patch.resolution_note = cleanText(body.resolution_note, 4000) || null;
  if (!Object.keys(patch).length) throw new Error('DD_PATCH_EMPTY');
  return patch;
}

function buildStoragePath(dealId, documentId, version, fileName) {
  const nonce = crypto.randomUUID();
  return [dealId, documentId, 'v' + version, nonce + '-' + safeFilename(fileName)].join('/');
}

function memberCanSeeDocument(document, member, grants = []) {
  if (!document || !member || member.side !== 'counterparty' || member.nda_status !== 'signed') return false;
  if (document.confidentiality === 'restricted') return false;
  const visibility = document.visibility || 'team';
  if (visibility === 'counterparty') return true;
  if (visibility !== 'selected') return false;
  return grants.some(g => g.member_id === member.id && g.status === 'active');
}

function memberCanUploadRequest(request, member) {
  if (!request || !member || member.side !== 'counterparty' || member.nda_status !== 'signed') return false;
  return request.requested_from_member_id === member.id && ['open','submitted'].includes(request.status);
}

module.exports = {
  DATA_ROOM_BUCKET,
  MAX_FILE_BYTES,
  DOCUMENT_VISIBILITIES,
  DOCUMENT_REQUEST_STATUSES,
  ALLOWED_CONTENT_TYPES,
  normalizeUploadSpec,
  normalizeDocumentPatch,
  normalizeGrant,
  normalizeDocumentRequest,
  normalizeDocumentRequestPatch,
  normalizeDueDiligencePatch,
  buildStoragePath,
  memberCanSeeDocument,
  memberCanUploadRequest
};
