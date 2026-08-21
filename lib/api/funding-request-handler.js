// ============================================
// Funding extraction request handler
// Shared logic used by /api/funding?action=funding-request
// Phase 3: persists a Funding Case + reference number.
// ============================================

const { sendEmail } = require('./email');
const getSupabase = require('./supabase');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'info@bonds-global.com')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const MAX_FILES = 3;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 MB total payload
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

const FUNDING_SOURCE_WHITELIST = new Set([
  'funding-hub',
  'readiness',
  'calculator',
  'funding-sources',
  'financial-advisory',
  'economic-intelligence',
  'sector-real-estate',
  'sector-industrial',
  'sector-hospitality',
  'sector-healthcare',
  'direct'
]);

const CALCULATOR_SOURCES = new Set([
  'loan', 'roi', 'break-even', 'cash-flow', 'feasibility', 'valuation',
  'water-factory', 'medical-viability', 'factory-cost'
]);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

function isValidPhone(phone) {
  return /^[\d\s+\-()]{7,25}$/.test(String(phone).trim());
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function normalizeFundingSource(raw) {
  if (!raw) return 'direct';
  const key = String(raw).toLowerCase().trim();
  if (CALCULATOR_SOURCES.has(key)) return 'calculator';
  if (FUNDING_SOURCE_WHITELIST.has(key)) return key;
  return 'direct';
}

function safeFilename(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 100);
}

function validateFiles(files) {
  if (!files) return [];
  if (!Array.isArray(files)) throw new Error('files must be an array');
  if (files.length > MAX_FILES) throw new Error(`Maximum ${MAX_FILES} files allowed`);

  let total = 0;
  const attachments = [];

  for (const file of files) {
    if (!file || !file.name || !file.data) continue;

    const contentType = file.type || 'application/octet-stream';
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new Error(`File type not allowed: ${file.name}`);
    }

    const size = base64ByteLength(file.data);
    if (size > MAX_FILE_BYTES) {
      throw new Error(`File too large: ${file.name}`);
    }
    total += size;

    attachments.push({
      filename: safeFilename(file.name),
      contentType,
      content: stripDataUri(file.data)
    });
  }

  if (total > MAX_TOTAL_BYTES) {
    throw new Error('Total attachment size exceeds limit');
  }

  return attachments;
}

function buildAdminEmail(body, attachments, lang, caseReference) {
  const isEn = lang === 'en';
  const company = body.company || body.organizationName || '-';
  const subject = isEn
    ? `New funding request — ${escapeHtml(company)} — ${caseReference}`
    : `طلب تمويل جديد — ${escapeHtml(company)} — ${caseReference}`;

  const dir = isEn ? 'ltr' : 'rtl';

  const fields = [
    { label: isEn ? 'Case reference' : 'رقم الطلب', value: caseReference },
    { label: isEn ? 'Name' : 'الاسم', value: body.name },
    { label: isEn ? 'Company / Project' : 'الشركة / المشروع', value: company },
    { label: isEn ? 'Email' : 'البريد الإلكتروني', value: body.email },
    { label: isEn ? 'Phone' : 'رقم الجوال', value: body.phone },
    { label: isEn ? 'Country' : 'الدولة', value: body.country },
    { label: isEn ? 'Financing type' : 'نوع التمويل', value: body.financingType },
    { label: isEn ? 'Amount requested' : 'مبلغ التمويل المطلوب', value: body.amount },
    { label: isEn ? 'Purpose category' : 'فئة الغرض', value: body.purposeCategory },
    { label: isEn ? 'Purpose details' : 'تفاصيل الغرض', value: body.purpose }
  ];

  const rows = fields
    .map(f => `<tr><td style="padding:10px;border:1px solid #ddd;font-weight:700;background:#f8f9fa;white-space:nowrap;">${f.label}</td><td style="padding:10px;border:1px solid #ddd;">${escapeHtml(f.value || '-')}</td></tr>`)
    .join('');

  const html = `
    <div dir="${dir}" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
      <div style="background:#0a0f1a;color:#d4a853;padding:1.25rem;text-align:center;">
        <h2 style="margin:0;font-size:1.25rem;">${isEn ? 'New funding request' : 'طلب تمويل جديد'}</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:0;">${rows}</table>
      <div style="padding:1rem 1.25rem;border-top:1px solid #eee;">
        <h3 style="margin:0 0 0.5rem;color:#0a0f1a;">${isEn ? 'Cover letter' : 'الخطاب الموجه'}</h3>
        <p style="margin:0;line-height:1.7;white-space:pre-wrap;">${escapeHtml(body.letter || '-')}</p>
      </div>
      <div style="padding:1rem 1.25rem;border-top:1px solid #eee;background:#f8f9fa;font-size:0.85rem;color:#555;">
        ${isEn ? 'Attachments' : 'المرفقات'}: ${attachments.length}
      </div>
    </div>
  `;

  const text = fields.map(f => `${f.label}: ${f.value || '-'}`).join('\n') +
    `\n\n${isEn ? 'Cover letter' : 'الخطاب الموجه'}:\n${body.letter || '-'}` +
    `\n\n${isEn ? 'Attachments' : 'المرفقات'}: ${attachments.length}`;

  return { subject, html, text };
}

async function findExistingCase(sb, idempotencyKey) {
  if (!idempotencyKey) return null;
  const { data, error } = await sb
    .from('funding_cases')
    .select('case_reference')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

async function createFundingCase(sb, body, idempotencyKey) {
  const amountNum = Number(String(body.amount).replace(/,/g, ''));
  const parsedAmount = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 1e12
    ? amountNum
    : null;

  const parsedScore = /^\d+$/.test(String(body.readinessScore || ''))
    ? parseInt(body.readinessScore, 10)
    : null;

  const parsedDuration = /^\d+$/.test(String(body.duration || body.loanTerm || ''))
    ? parseInt(body.duration || body.loanTerm, 10)
    : null;

  const parsedEstimatedPayment = Number(String(body.estimatedPayment || '').replace(/,/g, ''));

  const insert = {
    idempotency_key: idempotencyKey || undefined,
    source: normalizeFundingSource(body.source),
    status: 'new',
    name: String(body.name || '').slice(0, 200),
    company: String(body.company || body.organizationName || '').slice(0, 200),
    email: String(body.email || '').toLowerCase().slice(0, 200),
    phone: String(body.phone || '').slice(0, 50),
    country: String(body.country || '').slice(0, 100),
    financing_type: String(body.financingType || '').slice(0, 100) || null,
    amount: parsedAmount,
    purpose_category: String(body.purposeCategory || '').slice(0, 100) || null,
    purpose: String(body.purpose || '').slice(0, 2000) || null,
    letter: String(body.letter || '').slice(0, 4000) || null,
    sector: String(body.sector || '').slice(0, 100) || null,
    readiness_score: parsedScore,
    estimated_payment: Number.isFinite(parsedEstimatedPayment) && parsedEstimatedPayment > 0
      ? parsedEstimatedPayment
      : null,
    duration: parsedDuration
  };

  const { data, error } = await sb
    .from('funding_cases')
    .insert(insert)
    .select('id, case_reference')
    .single();

  if (error) {
    // If idempotency key collision happened between check and insert, fetch existing.
    if (idempotencyKey && error.message && error.message.includes('duplicate key')) {
      const existing = await findExistingCase(sb, idempotencyKey);
      if (existing) return { existing: true, ...existing };
    }
    throw new Error(`Failed to create funding case: ${error.message}`);
  }

  return { id: data.id, case_reference: data.case_reference, existing: false };
}

async function uploadCaseFiles(sb, caseId, attachments) {
  const results = [];
  for (const file of attachments) {
    try {
      const buffer = Buffer.from(file.content, 'base64');
      const storagePath = `cases/${caseId}/${Date.now()}-${safeFilename(file.filename)}`;
      const { error: uploadError } = await sb.storage
        .from('funding-documents')
        .upload(storagePath, buffer, {
          contentType: file.contentType,
          upsert: false
        });

      if (uploadError) {
        // eslint-disable-next-line no-console
        if (process.env.NODE_ENV !== 'test') console.error('[funding-request] Storage upload failed:', uploadError.message);
        continue;
      }

      const { data: doc, error: docError } = await sb
        .from('funding_case_documents')
        .insert({
          case_id: caseId,
          file_name: file.filename,
          storage_bucket: 'funding-documents',
          storage_path: storagePath,
          file_size: buffer.length,
          mime_type: file.contentType,
          document_type: 'uploaded'
        })
        .select('id')
        .single();

      if (!docError && doc) results.push(doc.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'test') console.error('[funding-request] File processing error:', err.message);
    }
  }
  return results;
}

async function logCaseEvent(sb, caseId, eventType, actorEmail, metadata = {}) {
  try {
    await sb.from('funding_case_events').insert({
      case_id: caseId,
      event_type: eventType,
      actor_email: actorEmail || 'system',
      metadata
    });
  } catch (err) {
    // Non-fatal: do not fail the request if audit logging fails.
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.error('[funding-request] Event log error:', err.message);
    }
  }
}

async function handleFundingExtractionRequest(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const lang = body.lang === 'en' ? 'en' : 'ar';

    // Honeypot check
    if (body.website || body.companyWebsite) {
      return res.status(200).json({ success: true, demo: true });
    }

    const { name, company, email, phone, country, financingType, amount, letter, files } = body;

    if (!name || !company || !email || !phone || !country || !financingType || amount === undefined || amount === '') {
      return res.status(400).json({
        success: false,
        error: lang === 'en'
          ? 'Please fill in all required fields.'
          : 'يرجى تعبئة جميع الحقول المطلوبة.'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: lang === 'en' ? 'Please enter a valid email.' : 'يرجى إدخال بريد إلكتروني صحيح.'
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: lang === 'en' ? 'Please enter a valid phone number.' : 'يرجى إدخال رقم جوال صحيح.'
      });
    }

    const amountNum = Number(String(amount).replace(/,/g, ''));
    if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > 1e12) {
      return res.status(400).json({
        success: false,
        error: lang === 'en' ? 'Please enter a valid funding amount.' : 'يرجى إدخال مبلغ تمويل صحيح.'
      });
    }

    let attachments = [];
    try {
      attachments = validateFiles(files);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const sb = getSupabase();

    // Idempotency: return existing case reference if the same key was used.
    const idempotencyKey = body.idempotencyKey || null;
    if (idempotencyKey) {
      const existing = await findExistingCase(sb, idempotencyKey);
      if (existing) {
        return res.status(200).json({
          success: true,
          caseReference: existing.case_reference,
          existing: true,
          message: lang === 'en'
            ? 'Your funding request has already been received.'
            : 'تم استلام طلب التمويل مسبقاً.'
        });
      }
    }

    const caseResult = await createFundingCase(sb, body, idempotencyKey);

    if (!caseResult.existing) {
      await uploadCaseFiles(sb, caseResult.id, attachments);
      await logCaseEvent(sb, caseResult.id, 'case_created', null, {
        source: normalizeFundingSource(body.source),
        has_attachments: attachments.length > 0,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
      });
    }

    const { subject, html, text } = buildAdminEmail(body, attachments, lang, caseResult.case_reference);
    const result = await sendEmail({
      to: ADMIN_EMAILS,
      subject,
      text,
      html,
      attachments
    });

    if (!result.success) {
      // Case was created even if email fails; log but still give the user a reference.
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.error('[funding-request] Email send failed:', result.error);
      }
      await logCaseEvent(sb, caseResult.id, 'contact', null, {
        channel: 'email',
        status: 'failed',
        error: result.error
      });
    }

    return res.status(200).json({
      success: true,
      caseReference: caseResult.case_reference,
      message: lang === 'en'
        ? 'Your funding request has been sent successfully. Our team will contact you soon.'
        : 'تم إرسال طلب التمويل بنجاح. سيقوم فريقنا بالتواصل معك قريباً.'
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.error('[funding-request] Error:', err);
    }
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
}

module.exports = { handleFundingExtractionRequest };
