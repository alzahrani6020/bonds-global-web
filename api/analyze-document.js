const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const { data: fileBlob, error: dlErr } = await sb.storage
    .from('client-documents')
    .download(doc.storage_path);
  if (dlErr || !fileBlob) return res.status(500).json({ error: dlErr?.message || 'Download failed' });

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const mime = doc.mime_type || 'application/octet-stream';

  let extracted = { mime, text: '', rows: null, summary: '', method: 'local' };

  try {
    if (mime.includes('csv') || mime.includes('sheet') || mime.includes('excel')) {
      const xlsx = require('xlsx');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      extracted.rows = rows;
      extracted.text = rows.map(r => r.join('\t')).join('\n');
      extracted.summary = `تم استخراج ${rows.length} صفوف من ${doc.filename}`;
    } else if (mime.includes('pdf')) {
      const pdfParse = require('pdf-parse');
      const pdf = await pdfParse(buffer);
      extracted.text = pdf.text || '';
      extracted.summary = `تم استخراج ${extracted.text.length} حرف من ${doc.filename}`;
    } else if (mime.includes('word') || mime.includes('officedocument.wordprocessingml')) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      extracted.text = result.value || '';
      extracted.summary = `تم استخراج ${extracted.text.length} حرف من ${doc.filename}`;
    } else if (mime.startsWith('image/')) {
      extracted.text = '[يتطلب OCR: يمكن ربط مفتاح OpenAI Vision أو Google Vision لاستخراج النص من الصور]';
      extracted.summary = 'الصور تحتاج خدمة OCR خارجية';
      extracted.method = 'ocr-required';
    } else {
      extracted.text = '[نوع الملف غير مدعوم للاستخراج التلقائي]';
      extracted.summary = 'نوع الملف غير مدعوم';
    }
  } catch (e) {
    extracted.text = '';
    extracted.summary = `فشل الاستخراج: ${e.message}`;
    extracted.error = e.message;
  }

  const status = extracted.error ? 'error' : 'analyzed';
  const { error: updErr } = await sb.from('client_documents').update({
    status,
    extracted_data: extracted
  }).eq('id', documentId);
  if (updErr) return res.status(500).json({ error: updErr.message });

  return res.status(200).json({ success: true, extracted });
};
