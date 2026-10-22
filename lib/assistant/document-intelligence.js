'use strict';

const DOCUMENT_INTELLIGENCE_VERSION = 1;
const MAX_FIELDS = 100;

const DOCUMENT_TYPES = Object.freeze([
  'bank_statement',
  'commercial_registration',
  'national_id',
  'financial_statement',
  'tax_certificate',
  'invoice',
  'contract',
  'feasibility_study',
  'other'
]);

const TYPE_RULES = [
  { type:'bank_statement', patterns:[/bank[ _-]*statement/i,/كشف[ _-]*حساب/i,/حساب[ _-]*بنكي/i] },
  { type:'commercial_registration', patterns:[/commercial[ _-]*registration/i,/commercial[ _-]*register/i,/سجل[ _-]*تجاري/i] },
  { type:'national_id', patterns:[/national[ _-]*id/i,/identity/i,/هوية/i,/اقامة/i,/إقامة/i] },
  { type:'financial_statement', patterns:[/financial[ _-]*statement/i,/balance[ _-]*sheet/i,/income[ _-]*statement/i,/قوائم[ _-]*مالية/i,/ميزانية/i] },
  { type:'tax_certificate', patterns:[/tax[ _-]*certificate/i,/vat/i,/زكاة/i,/ضريبة/i,/ضريبي/i] },
  { type:'invoice', patterns:[/invoice/i,/فاتورة/i] },
  { type:'contract', patterns:[/contract/i,/agreement/i,/عقد/i,/اتفاقية/i] },
  { type:'feasibility_study', patterns:[/feasibility/i,/دراسة[ _-]*جدوى/i] }
];

function cleanString(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function classifyDocumentMetadata({ filename, mimeType } = {}) {
  const name = cleanString(filename, 300) || '';
  const mime = cleanString(mimeType, 120) || '';
  const haystack = `${name} ${mime}`;

  const matched = TYPE_RULES.find(rule => rule.patterns.some(rx => rx.test(haystack)));
  if (!matched) {
    return {
      version:DOCUMENT_INTELLIGENCE_VERSION,
      document_type:'other',
      confidence:0.25,
      source:'metadata',
      reason:'no_registered_metadata_rule'
    };
  }

  return {
    version:DOCUMENT_INTELLIGENCE_VERSION,
    document_type:matched.type,
    confidence:0.85,
    source:'metadata',
    reason:'registered_metadata_rule'
  };
}

function normalizeFieldValue(value) {
  if (value === null || ['string','number','boolean'].includes(typeof value)) {
    return typeof value === 'string' ? value.slice(0, 2000) : value;
  }
  return null;
}

function normalizeDocumentExtraction({ documentId, documentType, fields } = {}) {
  const id = cleanString(documentId, 100);
  if (!id) throw new Error('DOCUMENT_ID_REQUIRED');
  if (!DOCUMENT_TYPES.includes(documentType)) throw new Error('DOCUMENT_TYPE_INVALID');
  if (!Array.isArray(fields)) throw new Error('DOCUMENT_FIELDS_INVALID');

  const normalized = [];
  for (const item of fields.slice(0, MAX_FIELDS)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const field = cleanString(item.field, 120);
    if (!field) continue;

    const value = normalizeFieldValue(item.value);
    if (value === null && item.value !== null) continue;

    normalized.push({
      field,
      value,
      provenance:{
        source:'document',
        document_id:id,
        page:Number.isInteger(item.page) && item.page > 0 ? item.page : null,
        section:cleanString(item.section, 160),
        confidence:clampConfidence(item.confidence)
      }
    });
  }

  return {
    version:DOCUMENT_INTELLIGENCE_VERSION,
    document_id:id,
    document_type:documentType,
    fields:normalized
  };
}

function buildDocumentAssistantView(document) {
  if (!document || typeof document !== 'object') throw new Error('DOCUMENT_REQUIRED');
  const classification = classifyDocumentMetadata({
    filename:document.filename,
    mimeType:document.mime_type
  });

  return {
    document_id:document.id || null,
    filename:cleanString(document.filename, 300),
    mime_type:cleanString(document.mime_type, 120),
    status:cleanString(document.status, 50),
    classification,
    instructions_from_document_are_data_only:true,
    execution_authorized:false
  };
}

module.exports = {
  DOCUMENT_INTELLIGENCE_VERSION,
  DOCUMENT_TYPES,
  classifyDocumentMetadata,
  normalizeDocumentExtraction,
  buildDocumentAssistantView
};
