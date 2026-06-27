/**
 * BONDS Valuation Certificate & Approval Handler
 *
 * Routes:
 *   POST /api/v3/ai/valuate/:report_id/approve
 *   POST /api/v3/valuations/:asset_valuation_id/certificate
 *   GET  /api/v3/certificates/:certificate_number/verify
 *
 * All certificate writes go through service role to satisfy RLS.
 */

const crypto = require('crypto');
const { getUserFromToken } = require('../../v3/lib/auth');
const getSupabase = require('../api/supabase');

const AI_VERSION = '1.0.0';
const CERTIFICATE_CONFIDENCE_MIN = 85;
const CERTIFICATE_DATA_QUALITY_MIN = 80;

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function extractPathId(path, pattern) {
  const match = path.match(pattern);
  return match ? match[1] : null;
}

function getSealSecret() {
  return process.env.BDVC_SEAL_SECRET || process.env.JWT_SECRET || 'bonds-dev-seal-secret';
}

function computeSealHash(certificateNumber, assetValuationId, issuedAt) {
  const payload = `${certificateNumber}|${assetValuationId}|${issuedAt}`;
  return crypto.createHmac('sha256', getSealSecret()).update(payload).digest('hex');
}

function computeVerificationUrl(certificateNumber) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://bonds-global.com';
  return `${base}/valuation/verify-certificate.html?number=${encodeURIComponent(certificateNumber)}`;
}

async function getUserOr401(req, res) {
  const user = await getUserFromToken(req);
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return user;
}

async function verifyReportOwnership(supabase, reportId, userId) {
  const { data, error } = await supabase
    .from('valuation_ai_reports')
    .select('*, asset_valuations!inner(user_id)')
    .eq('id', reportId)
    .or(`user_id.eq.${userId},user_id.in.(SELECT user_id FROM public.user_roles WHERE role in ('admin','editor'))`)
    .single();

  if (error || !data) return { error: 'Report not found or access denied' };
  return { report: data };
}

async function verifyValuationOwnership(supabase, assetValuationId, userId) {
  const { data, error } = await supabase
    .from('asset_valuations')
    .select('*')
    .eq('id', assetValuationId)
    .or(`user_id.eq.${userId},user_id.in.(SELECT user_id FROM public.user_roles WHERE role in ('admin','editor'))`)
    .single();

  if (error || !data) return { error: 'Valuation not found or access denied' };
  return { valuation: data };
}

/**
 * POST /api/v3/ai/valuate/:report_id/approve
 * Body (optional): { notes }
 */
async function handleApproveReport(req, res, path) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const user = await getUserOr401(req, res);
  if (!user) return;

  const reportId = extractPathId(path, /^\/ai\/valuate\/([^/]+)\/approve$/);
  if (!reportId) return sendJson(res, 400, { error: 'report_id is required' });

  const supabase = getSupabase();
  const { error: ownershipError, report } = await verifyReportOwnership(supabase, reportId, user.id);
  if (ownershipError) return sendJson(res, 404, { error: ownershipError });

  let body = {};
  try { body = await parseBody(req); } catch (err) { /* ignore optional body */ }

  const { error } = await supabase
    .from('valuation_ai_reports')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      approved_at: new Date().toISOString(),
      summary: {
        ...report.summary,
        approval_notes: body.notes || null,
        approved_by_name: user.user_metadata?.full_name || user.email || user.id
      }
    })
    .eq('id', reportId);

  if (error) {
    console.error('[approve-report] update error:', error.message);
    return sendJson(res, 500, { error: error.message });
  }

  sendJson(res, 200, {
    success: true,
    report_id: reportId,
    status: 'approved',
    approved_at: new Date().toISOString()
  });
}

/**
 * POST /api/v3/valuations/:asset_valuation_id/certificate
 */
async function handleIssueCertificate(req, res, path) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const user = await getUserOr401(req, res);
  if (!user) return;

  const assetValuationId = extractPathId(path, /^\/valuations\/([^/]+)\/certificate$/);
  if (!assetValuationId) return sendJson(res, 400, { error: 'asset_valuation_id is required' });

  const supabase = getSupabase();
  const { error: ownershipError, valuation } = await verifyValuationOwnership(supabase, assetValuationId, user.id);
  if (ownershipError) return sendJson(res, 404, { error: ownershipError });

  const confidenceScore = safeNumber(valuation.confidence_score);
  const dataQualityScore = safeNumber(valuation.data_quality_score);

  if (confidenceScore < CERTIFICATE_CONFIDENCE_MIN || dataQualityScore < CERTIFICATE_DATA_QUALITY_MIN) {
    return sendJson(res, 400, {
      error: `Certificate requires confidence_score >= ${CERTIFICATE_CONFIDENCE_MIN} and data_quality_score >= ${CERTIFICATE_DATA_QUALITY_MIN}.`,
      error_ar: 'الشهادة تتطلب درجة ثقة ≥ 85 وجودة بيانات ≥ 80.',
      confidence_score: confidenceScore,
      data_quality_score: dataQualityScore
    });
  }

  // Require an approved AI report before issuing a certificate
  const { data: approvedReports, error: reportError } = await supabase
    .from('valuation_ai_reports')
    .select('*')
    .eq('asset_valuation_id', assetValuationId)
    .eq('status', 'approved')
    .order('version', { ascending: false })
    .limit(1);

  if (reportError) {
    console.error('[issue-certificate] report query error:', reportError.message);
    return sendJson(res, 500, { error: reportError.message });
  }

  const report = approvedReports && approvedReports[0];
  if (!report) {
    return sendJson(res, 400, {
      error: 'An approved AI executive report is required before issuing a certificate.',
      error_ar: 'يجب اعتماد تقرير تنفيذي ذكي قبل إصدار الشهادة.'
    });
  }

  // Prevent duplicate certificate for same valuation
  const { data: existingCerts, error: existingError } = await supabase
    .from('valuation_certificates')
    .select('id, certificate_number, status')
    .eq('asset_valuation_id', assetValuationId)
    .in('status', ['issued', 'draft'])
    .limit(1);

  if (existingError) {
    console.error('[issue-certificate] existing query error:', existingError.message);
    return sendJson(res, 500, { error: existingError.message });
  }

  if (existingCerts && existingCerts.length > 0) {
    return sendJson(res, 409, {
      error: 'A certificate already exists for this valuation.',
      error_ar: 'توجد شهادة مسبقة لهذا التقييم.',
      certificate_id: existingCerts[0].id,
      certificate_number: existingCerts[0].certificate_number
    });
  }

  const countryCode = (valuation.valuation_inputs?.country || valuation.market_data_snapshot?.country || 'XX').toUpperCase();

  // Generate unique certificate number via RPC
  const { data: certNumberData, error: rpcError } = await supabase.rpc('generate_bonds_certificate_number', {
    p_country: countryCode
  });

  if (rpcError || !certNumberData) {
    console.error('[issue-certificate] RPC error:', rpcError?.message);
    return sendJson(res, 500, { error: rpcError?.message || 'Failed to generate certificate number' });
  }

  const certificateNumber = certNumberData;
  const issuedAt = new Date().toISOString();
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  const sealHash = computeSealHash(certificateNumber, assetValuationId, issuedAt);
  const verificationUrl = computeVerificationUrl(certificateNumber);
  const sealId = crypto.randomUUID();

  const methodologies = [];
  const results = valuation.results || {};
  if (results.book_value !== undefined) methodologies.push('Cost Approach');
  if (results.market_value !== undefined) methodologies.push('Market Approach');
  if (results.investment_value !== undefined || results.enterprise_value !== undefined) methodologies.push('Income Approach');
  if (results.replacement_value !== undefined) methodologies.push('Replacement Cost');
  if (results.liquidation_value !== undefined) methodologies.push('Liquidation Analysis');

  const certificatePayload = {
    asset_valuation_id: assetValuationId,
    valuation_ai_report_id: report.id,
    certificate_number: certificateNumber,
    asset_class: valuation.asset_class,
    asset_name: valuation.asset_name,
    asset_identifier: valuation.asset_identifier,
    user_id: user.id,
    client_id: valuation.client_id,
    issued_by: user.id,
    issued_at: issuedAt,
    valid_until: validUntil.toISOString().split('T')[0],
    status: 'issued',
    valuation_data: {
      valuation_inputs: valuation.valuation_inputs,
      market_data_snapshot: valuation.market_data_snapshot,
      economic_life_snapshot: valuation.economic_life_snapshot,
      depreciation_snapshot: valuation.depreciation_snapshot,
      condition_snapshot: valuation.condition_snapshot,
      risk_snapshot: valuation.risk_snapshot,
      results: valuation.results
    },
    quality_scores: {
      confidence_score: confidenceScore,
      data_quality_score: dataQualityScore
    },
    methodologies,
    executive_summary: report.executive_summary,
    final_decision: report.final_decision,
    decision_reason: report.decision_reason,
    future_forecast: report.future_forecast,
    seal_metadata: {
      seal_id: sealId,
      seal_hash: sealHash,
      verification_url: verificationUrl,
      algorithm: 'HMAC-SHA256',
      issued_at: issuedAt
    }
  };

  const { data: certificate, error: insertError } = await supabase
    .from('valuation_certificates')
    .insert(certificatePayload)
    .select('id, certificate_number, issued_at, valid_until, status, seal_metadata')
    .single();

  if (insertError) {
    console.error('[issue-certificate] insert error:', insertError.message);
    return sendJson(res, 500, { error: insertError.message });
  }

  // Mark the valuation as final once a certificate is issued
  await supabase
    .from('asset_valuations')
    .update({ status: 'final', updated_at: new Date().toISOString() })
    .eq('id', assetValuationId);

  sendJson(res, 200, {
    success: true,
    certificate_id: certificate.id,
    certificate_number: certificate.certificate_number,
    issued_at: certificate.issued_at,
    valid_until: certificate.valid_until,
    status: certificate.status,
    seal_metadata: certificate.seal_metadata,
    verification_url: verificationUrl
  });
}

/**
 * GET /api/v3/certificates/:certificate_number/verify
 * Public endpoint.
 */
async function handleVerifyCertificate(req, res, path) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const certificateNumber = extractPathId(path, /^\/certificates\/([^/]+)\/verify$/);
  if (!certificateNumber) return sendJson(res, 400, { error: 'certificate_number is required' });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('valuation_certificates')
    .select('id, certificate_number, asset_class, asset_name, asset_identifier, issued_at, valid_until, status, methodologies, executive_summary, final_decision, decision_reason, quality_scores, seal_metadata, created_at')
    .eq('certificate_number', certificateNumber)
    .single();

  if (error || !data) {
    return sendJson(res, 404, {
      valid: false,
      error: 'Certificate not found',
      error_ar: 'الشهادة غير موجودة'
    });
  }

  const now = new Date();
  const validUntil = data.valid_until ? new Date(data.valid_until) : null;
  const isExpired = validUntil && validUntil < now;

  if (data.status !== 'issued' || isExpired) {
    return sendJson(res, 200, {
      valid: false,
      status: data.status,
      expired: isExpired,
      certificate_number: data.certificate_number,
      message: isExpired ? 'Certificate has expired' : 'Certificate is not active',
      message_ar: isExpired ? 'انتهت صلاحية الشهادة' : 'الشهادة غير نشطة'
    });
  }

  // Verify seal hash
  const expectedHash = computeSealHash(
    data.certificate_number,
    data.asset_valuation_id,
    data.issued_at
  );
  const sealValid = data.seal_metadata?.seal_hash === expectedHash;

  sendJson(res, 200, {
    valid: true,
    certificate_number: data.certificate_number,
    asset_class: data.asset_class,
    asset_name: data.asset_name,
    asset_identifier: data.asset_identifier,
    issued_at: data.issued_at,
    valid_until: data.valid_until,
    methodologies: data.methodologies,
    executive_summary: data.executive_summary,
    final_decision: data.final_decision,
    quality_scores: data.quality_scores,
    seal_valid: sealValid,
    verification_url: data.seal_metadata?.verification_url
  });
}

module.exports = {
  handleApproveReport,
  handleIssueCertificate,
  handleVerifyCertificate,
  computeSealHash,
  CERTIFICATE_CONFIDENCE_MIN,
  CERTIFICATE_DATA_QUALITY_MIN
};
