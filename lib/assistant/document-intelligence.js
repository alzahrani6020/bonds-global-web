'use strict';

const MAX_TEXT_CHARS = 200000;
const MAX_RESULTS = 50;

const DOCUMENT_TYPES = Object.freeze([
  'bank_statement',
  'commercial_registration',
  'financial_statement',
  'invoice',
  'tax_certificate',
  'contract',
  'feasibility_study',
  'identity_document',
  'unknown'
]);

const CLASSIFIERS = Object.freeze([
  {
    type:'bank_statement',
    patterns:[
      /bank statement|account statement|statement of account/i,
      /كشف\s*حساب|كشف\s*بنكي|حركة\s*الحساب/i,
      /iban|آيبان/i
    ]
  },
  {
    type:'commercial_registration',
    patterns:[
      /commercial registration|commercial register|\bcr\b/i,
      /السجل\s*التجاري|رقم\s*السجل/i
    ]
  },
  {
    type:'financial_statement',
    patterns:[
      /financial statements?|balance sheet|income statement|cash flow statement/i,
      /القوائم\s*المالية|الميزانية|قائمة\s*الدخل|التدفقات\s*النقدية/i
    ]
  },
  {
    type:'invoice',
    patterns:[
      /tax invoice|invoice\s*(number|no\.?|#)?/i,
      /فاتورة\s*ضريبية|فاتورة|رقم\s*الفاتورة/i
    ]
  },
  {
    type:'tax_certificate',
    patterns:[
      /vat certificate|tax certificate|value added tax/i,
      /شهادة\s*ضريبية|الرقم\s*الضريبي|ضريبة\s*القيمة\s*المضافة/i
    ]
  },
  {
    type:'contract',
    patterns:[
      /agreement|contract|party of the first part|party of the second part/i,
      /عقد|اتفاقية|الطرف\s*الأول|الطرف\s*الثاني/i
    ]
  },
  {
    type:'feasibility_study',
    patterns:[
      /feasibility study|business plan|project feasibility/i,
      /دراسة\s*جدوى|خطة\s*عمل|الجدوى\s*الاقتصادية/i
    ]
  },
  {
    type:'identity_document',
    patterns:[
      /national id|identity card|passport/i,
      /الهوية\s*الوطنية|بطاقة\s*الهوية|جواز\s*السفر/i
    ]
  }
]);

const INSTRUCTION_LIKE_PATTERNS = Object.freeze([
  /ignore (all |the )?(previous|prior) instructions/i,
  /system prompt/i,
  /developer message/i,
  /execute (this|the following) (command|code)/i,
  /تجاهل\s+(كل\s+)?التعليمات/i,
  /تعليمات\s+النظام/i,
  /نفذ\s+(هذا|الكود|الأمر)/i,
  /أوامر\s+التنفيذ/i
]);

function cleanString(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function normalizedDocumentText(document) {
  const extracted = document && document.extracted_data && typeof document.extracted_data === 'object'
    ? document.extracted_data
    : {};
  const text = typeof extracted.text === 'string'
    ? extracted.text
    : Array.isArray(extracted.rows)
      ? extracted.rows.map(row => Array.isArray(row) ? row.join('\t') : String(row || '')).join('\n')
      : '';
  return cleanString(text, MAX_TEXT_CHARS);
}

function classificationInput(document) {
  return [
    cleanString(document && document.filename, 255),
    normalizedDocumentText(document)
  ].filter(Boolean).join('\n');
}

function classifyDocument(document) {
  const input = classificationInput(document);
  if (!input) {
    return { type:'unknown', confidence:0, evidence:[] };
  }

  let best = { type:'unknown', score:0, evidence:[] };
  for (const classifier of CLASSIFIERS) {
    const evidence = classifier.patterns
      .filter(pattern => pattern.test(input))
      .map(pattern => pattern.source)
      .slice(0, 5);
    const score = evidence.length;
    if (score > best.score) {
      best = { type:classifier.type, score, evidence };
    }
  }

  if (!best.score) return { type:'unknown', confidence:0.2, evidence:[] };
  return {
    type:best.type,
    confidence:Math.min(0.98, 0.65 + (best.score * 0.1)),
    evidence:best.evidence
  };
}

function firstMatch(text, patterns) {
  for (const item of patterns) {
    const match = item.regex.exec(text);
    if (match && match[item.group || 1]) {
      return {
        value:cleanString(match[item.group || 1], item.maxLength || 120),
        confidence:item.confidence || 0.9,
        evidence:cleanString(match[0], 240)
      };
    }
  }
  return null;
}

function makeField(name, match, documentId) {
  if (!match || !match.value) return null;
  return {
    name,
    value:match.value,
    confidence:match.confidence,
    status:'suggested',
    provenance:{
      source:'client_documents.extracted_data',
      document_id:String(documentId || ''),
      method:'deterministic_regex',
      evidence:match.evidence
    }
  };
}

function extractDocumentFields(document) {
  const text = normalizedDocumentText(document);
  if (!text) return [];

  const fields = [
    makeField('iban', firstMatch(text, [
      { regex:/\b(SA\d{22})\b/i, confidence:0.99, maxLength:24 }
    ]), document.id),
    makeField('commercial_registration_number', firstMatch(text, [
      { regex:/(?:commercial registration(?: number)?|commercial register(?: number)?|\bCR\b)\s*[:#-]?\s*(\d{10,15})/i, confidence:0.97, maxLength:20 },
      { regex:/(?:رقم\s*)?السجل\s*التجاري\s*[:#-]?\s*(\d{10,15})/i, confidence:0.97, maxLength:20 }
    ]), document.id),
    makeField('vat_number', firstMatch(text, [
      { regex:/(?:VAT(?: number| no\.?)?|tax number|tax registration number)\s*[:#-]?\s*(\d{15})/i, confidence:0.98, maxLength:15 },
      { regex:/(?:الرقم\s*الضريبي|رقم\s*التسجيل\s*الضريبي)\s*[:#-]?\s*(\d{15})/i, confidence:0.98, maxLength:15 }
    ]), document.id),
    makeField('invoice_number', firstMatch(text, [
      { regex:/(?:invoice(?: number| no\.?| #)?)[\s:#-]*([A-Z0-9][A-Z0-9\/_-]{2,39})/i, confidence:0.93, maxLength:40 },
      { regex:/(?:رقم\s*الفاتورة|فاتورة\s*رقم)\s*[:#-]?\s*([A-Z0-9\u0660-\u0669][A-Z0-9\u0660-\u0669\/_-]{2,39})/i, confidence:0.93, maxLength:40 }
    ]), document.id),
    makeField('document_date', firstMatch(text, [
      { regex:/(?:document date|invoice date|date)\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i, confidence:0.88, maxLength:20 },
      { regex:/(?:تاريخ\s*المستند|تاريخ\s*الفاتورة|التاريخ)\s*[:#-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i, confidence:0.88, maxLength:20 }
    ]), document.id)
  ].filter(Boolean);

  return fields.slice(0, 25);
}

function detectInstructionLikeText(document) {
  const text = normalizedDocumentText(document);
  if (!text) return [];
  return INSTRUCTION_LIKE_PATTERNS
    .filter(pattern => pattern.test(text))
    .map(pattern => pattern.source)
    .slice(0, 10);
}

function analyzeDocumentForAssistant(document) {
  if (!document || typeof document !== 'object') throw new Error('DOCUMENT_REQUIRED');
  const classification = classifyDocument(document);
  const fields = extractDocumentFields(document);
  const instructionSignals = detectInstructionLikeText(document);

  return {
    document_id:String(document.id || ''),
    filename:cleanString(document.filename, 255) || null,
    mime_type:cleanString(document.mime_type, 120) || null,
    source_status:cleanString(document.status, 50) || null,
    classification,
    fields,
    trust:{
      content_is_data_not_instruction:true,
      instruction_like_text_detected:instructionSignals.length > 0,
      instruction_signals:instructionSignals
    },
    policy:{
      values_are_suggestions:true,
      requires_confirmation_before_business_write:true,
      executable_content_allowed:false
    }
  };
}

async function findOwnedDocuments({ supabase, userId, projectId = null, limit = 20 }) {
  if (!supabase || typeof supabase.from !== 'function') throw new Error('DOCUMENT_STORE_UNAVAILABLE');
  if (!userId) throw new Error('DOCUMENT_USER_REQUIRED');

  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, MAX_RESULTS));
  let query = supabase
    .from('client_documents')
    .select('id,client_id,project_id,filename,mime_type,size_bytes,status,extracted_data,created_at,updated_at,advisory_clients!inner(auth_user_id)')
    .eq('advisory_clients.auth_user_id', userId)
    .order('updated_at', { ascending:false })
    .limit(boundedLimit);

  if (projectId) query = query.eq('project_id', String(projectId));

  const { data, error } = await query;
  if (error) throw new Error('DOCUMENT_LOOKUP_FAILED');

  return (Array.isArray(data) ? data : []).map(document => ({
    id:document.id,
    project_id:document.project_id,
    filename:document.filename,
    mime_type:document.mime_type,
    size_bytes:document.size_bytes,
    status:document.status,
    created_at:document.created_at,
    updated_at:document.updated_at,
    assistant_analysis:analyzeDocumentForAssistant(document)
  }));
}

async function loadOwnedDocument({ supabase, userId, documentId }) {
  if (!supabase || typeof supabase.from !== 'function') throw new Error('DOCUMENT_STORE_UNAVAILABLE');
  if (!userId) throw new Error('DOCUMENT_USER_REQUIRED');
  const id = cleanString(documentId, 100);
  if (!id) throw new Error('DOCUMENT_ID_REQUIRED');

  const { data, error } = await supabase
    .from('client_documents')
    .select('id,client_id,project_id,filename,mime_type,size_bytes,status,extracted_data,created_at,updated_at,advisory_clients!inner(auth_user_id)')
    .eq('id', id)
    .eq('advisory_clients.auth_user_id', userId)
    .maybeSingle();

  if (error) throw new Error('DOCUMENT_LOOKUP_FAILED');
  if (!data) return null;
  return {
    id:data.id,
    project_id:data.project_id,
    filename:data.filename,
    mime_type:data.mime_type,
    size_bytes:data.size_bytes,
    status:data.status,
    created_at:data.created_at,
    updated_at:data.updated_at,
    assistant_analysis:analyzeDocumentForAssistant(data)
  };
}

module.exports = {
  DOCUMENT_TYPES,
  MAX_RESULTS,
  classifyDocument,
  extractDocumentFields,
  detectInstructionLikeText,
  analyzeDocumentForAssistant,
  findOwnedDocuments,
  loadOwnedDocument
};
