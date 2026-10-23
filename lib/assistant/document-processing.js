'use strict';

const { parseDocument, DocumentParserError } = require('../api/document-parser');
const { detectParserKind } = require('../api/document-parser-core');
const { analyzeDocumentForAssistant } = require('./document-intelligence');

async function analyzeOwnedDocument({ supabase, userId, documentId }) {
  if (!supabase || typeof supabase.from !== 'function' || !supabase.storage) {
    throw new Error('DOCUMENT_STORE_UNAVAILABLE');
  }
  if (!userId) throw new Error('DOCUMENT_USER_REQUIRED');
  if (!documentId) throw new Error('DOCUMENT_ID_REQUIRED');

  const { data:doc, error:docError } = await supabase
    .from('client_documents')
    .select('id,client_id,project_id,filename,storage_path,storage_bucket,mime_type,size_bytes,status,security_status,security_verdict,sha256,extracted_data,created_at,updated_at,advisory_clients!inner(auth_user_id)')
    .eq('id', String(documentId))
    .eq('advisory_clients.auth_user_id', userId)
    .maybeSingle();

  if (docError) throw new Error('DOCUMENT_LOOKUP_FAILED');
  if (!doc) return null;
  if (doc.security_status !== 'clean' || doc.security_verdict !== 'clean') {
    throw new Error('DOCUMENT_SECURITY_NOT_APPROVED');
  }
  if (doc.storage_bucket !== 'client-documents') {
    throw new Error('DOCUMENT_SECURITY_STORAGE_NOT_APPROVED');
  }

  const { data:fileBlob, error:downloadError } = await supabase.storage
    .from(doc.storage_bucket)
    .download(doc.storage_path);

  if (downloadError || !fileBlob) throw new Error('DOCUMENT_DOWNLOAD_FAILED');

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const mime = String(doc.mime_type || 'application/octet-stream');
  let extracted = { mime, text:'', rows:null, summary:'', method:'local' };

  try {
    if (detectParserKind(mime)) {
      extracted = {
        ...extracted,
        ...(await parseDocument({ buffer, mime, filename:doc.filename }))
      };
    } else if (mime.startsWith('image/')) {
      extracted = {
        ...extracted,
        method:'vision-required',
        summary:'تم رفع الصورة وحفظها بنجاح. فهم المحتوى البصري يحتاج Vision Engine.',
        text:''
      };
    } else {
      extracted = {
        ...extracted,
        method:'unsupported',
        summary:'نوع الملف محفوظ لكنه غير مدعوم للتحليل الآلي الحالي.'
      };
    }
  } catch (error) {
    extracted = {
      ...extracted,
      text:'',
      rows:null,
      summary:'تعذر معالجة الملف بأمان',
      error:'تعذر معالجة الملف بأمان',
      error_code:error instanceof DocumentParserError ? error.code : 'PARSER_FAILED'
    };
  }

  const status = extracted.error ? 'error' : 'analyzed';
  const { error:updateError } = await supabase
    .from('client_documents')
    .update({ status, extracted_data:extracted })
    .eq('id', doc.id);

  if (updateError) throw new Error('DOCUMENT_UPDATE_FAILED');

  const normalized = {
    ...doc,
    status,
    extracted_data:extracted
  };
  const assistantAnalysis = analyzeDocumentForAssistant(normalized);

  return {
    document_id:doc.id,
    filename:doc.filename,
    mime_type:mime,
    size_bytes:doc.size_bytes,
    status,
    extracted:{
      method:extracted.method,
      summary:extracted.summary || null,
      text_excerpt:String(extracted.text || '').slice(0, 2000),
      rows_count:Array.isArray(extracted.rows) ? extracted.rows.length : null,
      error_code:extracted.error_code || null
    },
    assistant_analysis:assistantAnalysis
  };
}

module.exports = { analyzeOwnedDocument };
