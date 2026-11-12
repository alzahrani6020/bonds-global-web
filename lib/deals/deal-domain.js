'use strict';

const DEAL_TYPES = Object.freeze([
  'funding',
  'investment',
  'ma_buy',
  'ma_sell',
  'joint_venture',
  'restructuring',
  'other'
]);

const DEAL_STAGES = Object.freeze([
  'draft',
  'preparation',
  'due_diligence',
  'marketing',
  'offers',
  'negotiation',
  'approvals',
  'closing',
  'closed',
  'on_hold'
]);

const DEAL_STATUSES = Object.freeze(['active', 'on_hold', 'closed', 'cancelled']);
const PARTY_ROLES = Object.freeze([
  'client',
  'buyer',
  'seller',
  'investor',
  'lender',
  'advisor',
  'legal',
  'auditor',
  'other'
]);
const TASK_STATUSES = Object.freeze(['open', 'in_progress', 'blocked', 'completed']);
const TASK_PRIORITIES = Object.freeze(['low', 'normal', 'high', 'critical']);
const DD_AREAS = Object.freeze([
  'financial',
  'commercial',
  'legal',
  'tax',
  'operational',
  'technical',
  'governance'
]);
const DD_STATUSES = Object.freeze(['not_started', 'in_progress', 'blocked', 'complete', 'not_applicable']);
const RISK_RATINGS = Object.freeze(['low', 'medium', 'high', 'critical']);
const DOCUMENT_STATUSES = Object.freeze(['requested', 'received', 'reviewed', 'approved', 'rejected']);
const CONFIDENTIALITY_LEVELS = Object.freeze(['standard', 'confidential', 'restricted']);

function cleanText(value, max = 500) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : '';
}

function enumValue(value, allowed, fallback = null) {
  const normalized = cleanText(value, 80).toLowerCase();
  if (!normalized) return fallback;
  if (!allowed.includes(normalized)) throw new Error('INVALID_ENUM_VALUE');
  return normalized;
}

function nonNegativeNumber(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('INVALID_NON_NEGATIVE_NUMBER');
  return numeric;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeDealCreate(body = {}) {
  const title = cleanText(body.title, 240);
  if (!title) throw new Error('DEAL_TITLE_REQUIRED');
  return {
    title,
    deal_type: enumValue(body.deal_type, DEAL_TYPES, 'other'),
    stage: enumValue(body.stage, DEAL_STAGES, 'draft'),
    status: enumValue(body.status, DEAL_STATUSES, 'active'),
    currency: (cleanText(body.currency, 3) || 'SAR').toUpperCase(),
    target_value: nonNegativeNumber(body.target_value, null),
    summary: cleanText(body.summary, 4000) || null,
    metadata: plainObject(body.metadata)
  };
}

function normalizeDealPatch(body = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = cleanText(body.title, 240);
    if (!title) throw new Error('DEAL_TITLE_REQUIRED');
    patch.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'deal_type')) patch.deal_type = enumValue(body.deal_type, DEAL_TYPES);
  if (Object.prototype.hasOwnProperty.call(body, 'stage')) patch.stage = enumValue(body.stage, DEAL_STAGES);
  if (Object.prototype.hasOwnProperty.call(body, 'status')) patch.status = enumValue(body.status, DEAL_STATUSES);
  if (Object.prototype.hasOwnProperty.call(body, 'currency')) patch.currency = (cleanText(body.currency, 3) || 'SAR').toUpperCase();
  if (Object.prototype.hasOwnProperty.call(body, 'target_value')) patch.target_value = nonNegativeNumber(body.target_value, null);
  if (Object.prototype.hasOwnProperty.call(body, 'summary')) patch.summary = cleanText(body.summary, 4000) || null;
  if (Object.prototype.hasOwnProperty.call(body, 'metadata')) patch.metadata = plainObject(body.metadata);
  if (!Object.keys(patch).length) throw new Error('DEAL_PATCH_EMPTY');
  return patch;
}

function normalizeParty(body = {}) {
  const name = cleanText(body.name, 240);
  if (!name) throw new Error('DEAL_PARTY_NAME_REQUIRED');
  return {
    name,
    party_role: enumValue(body.party_role, PARTY_ROLES, 'other'),
    organization: cleanText(body.organization, 240) || null,
    email: cleanText(body.email, 320) || null,
    phone: cleanText(body.phone, 80) || null,
    notes: cleanText(body.notes, 2000) || null,
    metadata: plainObject(body.metadata)
  };
}

function normalizeTask(body = {}) {
  const title = cleanText(body.title, 300);
  if (!title) throw new Error('DEAL_TASK_TITLE_REQUIRED');
  return {
    title,
    status: enumValue(body.status, TASK_STATUSES, 'open'),
    priority: enumValue(body.priority, TASK_PRIORITIES, 'normal'),
    due_at: cleanText(body.due_at, 80) || null,
    notes: cleanText(body.notes, 2000) || null,
    metadata: plainObject(body.metadata)
  };
}

function normalizeDueDiligenceItem(body = {}) {
  const title = cleanText(body.title, 300);
  if (!title) throw new Error('DEAL_DD_TITLE_REQUIRED');
  return {
    area: enumValue(body.area, DD_AREAS, 'financial'),
    title,
    status: enumValue(body.status, DD_STATUSES, 'not_started'),
    risk_rating: body.risk_rating == null || body.risk_rating === ''
      ? null
      : enumValue(body.risk_rating, RISK_RATINGS),
    finding: cleanText(body.finding, 4000) || null,
    owner_note: cleanText(body.owner_note, 2000) || null,
    metadata: plainObject(body.metadata)
  };
}

function normalizeDocument(body = {}) {
  const name = cleanText(body.name, 300);
  if (!name) throw new Error('DEAL_DOCUMENT_NAME_REQUIRED');
  return {
    name,
    category: cleanText(body.category, 120) || 'general',
    status: 'requested',
    confidentiality: enumValue(body.confidentiality, CONFIDENTIALITY_LEVELS, 'confidential'),
    storage_bucket: null,
    storage_path: null,
    version: 1,
    notes: cleanText(body.notes, 2000) || null,
    metadata: plainObject(body.metadata)
  };
}

module.exports = {
  DEAL_TYPES,
  DEAL_STAGES,
  DEAL_STATUSES,
  PARTY_ROLES,
  TASK_STATUSES,
  DD_AREAS,
  DD_STATUSES,
  normalizeDealCreate,
  normalizeDealPatch,
  normalizeParty,
  normalizeTask,
  normalizeDueDiligenceItem,
  normalizeDocument
};
