const { createClient } = require('@supabase/supabase-js');
const { parseDocument, DocumentParserError } = require('./document-parser');
const { detectParserKind } = require('./document-parser-core');
const { publishAssistantOutcomeBestEffort } = require('../dual-core/assistant-outcome-bridge');
const { EVENT_TYPES: DUAL_CORE_EVENT_TYPES } = require('../dual-core/event-taxonomy');

const PUBLIC_PARSE_ERROR = 'تعذر معالجة الملف بأمان';

module.exports = async function analyzeDocument(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' });
  const userId = userData.user.id;

  const { documentId } = req.body || {};
  if (!documentId) return res.status(400).json({ error: 'documentId is required' });

  const { data: doc, error: docErr } = await sb
    .from('client_documents')
    .select('*, advisory_clients!inner(auth_user_id)')
    .eq('id', documentId)
    .maybeSingle();
  if (docErr || !doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.advisory_clients.auth_user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (doc.security_status !== 'clean' || doc.security_verdict !== 'clean') {
    return res.status(423).json({ error: 'Document security approval required' });
  }
  if (doc.storage_bucket !== 'client-documents') {
    return res.status(423).json({ error: 'Document is not in approved storage' });
  }

  const { data: fileBlob, error: dlErr } = await sb.storage
    .from(doc.storage_bucket)
    .download(doc.storage_path);
  if (dlErr || !fileBlob) {
    if (dlErr) console.error('[analyze-document] storage download failed', dlErr);
    return res.status(500).json({ error: 'Download failed' });
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const mime = doc.mime_type || 'application/octet-stream';

  let extracted = { mime, text: '', rows: null, summary: '', method: 'local' };

  try {
    if (detectParserKind(mime)) {
      const parsed = await parseDocument({
        buffer,
        mime,
        filename: doc.filename
      });
      extracted = { ...extracted, ...parsed };
    } else if (mime.startsWith('image/')) {
      extracted.text = '[يتطلب OCR: يمكن ربط مفتاح OpenAI Vision أو Google Vision لاستخراج النص من الصور]';
      extracted.summary = 'الصور تحتاج خدمة OCR خارجية';
      extracted.method = 'ocr-required';
    } else {
      extracted.text = '[نوع الملف غير مدعوم للاستخراج التلقائي]';
      extracted.summary = 'نوع الملف غير مدعوم';
    }
  } catch (error) {
    const code = error instanceof DocumentParserError
      ? error.code
      : 'PARSER_FAILED';

    if (!(error instanceof DocumentParserError)) {
      console.error('[analyze-document] unexpected parser failure', error);
    }

    extracted.text = '';
    extracted.rows = null;
    extracted.summary = PUBLIC_PARSE_ERROR;
    extracted.error = PUBLIC_PARSE_ERROR;
    extracted.error_code = code;

    await publishAssistantOutcomeBestEffort({
      supabase:sb,
      type:DUAL_CORE_EVENT_TYPES.DOCUMENT_EXTRACTION_FAILED,
      userId,
      projectId:doc.project_id || null,
      metadata:{
        resource_id:String(documentId),
        error_code:code,
        source:'analyze-document'
      }
    });
  }

  const status = extracted.error ? 'error' : 'analyzed';
  const { error: updErr } = await sb.from('client_documents').update({
    status,
    extracted_data: extracted
  }).eq('id', documentId);
  if (updErr) {
    console.error('[analyze-document] metadata update failed', updErr);
    return res.status(500).json({ error: 'Document update failed' });
  }

  return res.status(200).json({ success: true, extracted });
};
