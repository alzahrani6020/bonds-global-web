'use strict';

const crypto = require('crypto');

const SECURITY_POLICY_VERSION = '1';
const QUARANTINE_BUCKET = 'client-documents-quarantine';
const APPROVED_BUCKET = 'client-documents';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SCAN_TIMEOUT_MS = 120000;

function securityFailure(code, httpStatus = 503, extra = {}) {
  const error = new Error(code);
  error.code = code;
  error.httpStatus = httpStatus;
  Object.assign(error, extra);
  return error;
}

function scannerConfig() {
  const baseUrl = String(process.env.BONDS_FILE_SECURITY_REMOTE_URL || '').trim().replace(/\/$/, '');
  const token = String(process.env.BONDS_FILE_SECURITY_TOKEN || '').trim();
  return { baseUrl, token };
}

async function boundedJson(response) {
  const text = await response.text();
  if (text.length > 128 * 1024) throw securityFailure('FILE_SECURITY_RESPONSE_TOO_LARGE');
  try { return JSON.parse(text); } catch (_) { throw securityFailure('FILE_SECURITY_RESPONSE_INVALID'); }
}

async function callScanner(payload) {
  const { baseUrl, token } = scannerConfig();
  if (!baseUrl || !token) throw securityFailure('FILE_SECURITY_SCANNER_UNAVAILABLE', 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    const response = await fetch(baseUrl + '/scan', {
      method:'POST',
      signal:controller.signal,
      headers:{
        'content-type':'application/json',
        authorization:'Bearer ' + token
      },
      body:JSON.stringify(payload)
    });
    const data = await boundedJson(response);
    if (!response.ok || data?.ok !== true || !data?.result) {
      throw securityFailure(data?.error?.code || 'FILE_SECURITY_SCAN_FAILED', response.status || 503);
    }
    return data.result;
  } catch (error) {
    if (error?.name === 'AbortError') throw securityFailure('FILE_SECURITY_SCAN_TIMEOUT', 503);
    if (error?.code) throw error;
    throw securityFailure('FILE_SECURITY_SCANNER_UNAVAILABLE', 503);
  } finally {
    clearTimeout(timer);
  }
}

async function event(db, documentId, eventType, verdict, severity, details = {}) {
  await db.from('file_security_events').insert({
    document_id:documentId,
    event_type:eventType,
    verdict:verdict || null,
    severity:severity || 'info',
    details
  });
}

function normalizeScannerResult(result = {}) {
  const verdict = String(result.verdict || 'unknown').toLowerCase();
  const allowed = new Set(['clean','suspicious','malicious','unknown']);
  const safeVerdict = allowed.has(verdict) ? verdict : 'unknown';
  const sha256 = String(result.sha256 || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw securityFailure('FILE_SECURITY_HASH_INVALID');
  const risk = Number(result.risk_score);
  return {
    verdict:safeVerdict,
    sha256,
    detected_mime:String(result.detected_mime || 'application/octet-stream').slice(0, 200),
    risk_score:Number.isFinite(risk) ? Math.max(0, Math.min(100, Math.round(risk))) : null,
    scanner_name:String(result.scanner_name || 'clamav').slice(0, 100),
    scanner_version:String(result.scanner_version || '').slice(0, 100) || null,
    signature_version:String(result.signature_version || '').slice(0, 100) || null,
    details:result.details && typeof result.details === 'object' ? result.details : {}
  };
}

async function ownedDocument(db, userId, documentId) {
  const { data, error } = await db
    .from('client_documents')
    .select('id,client_id,filename,storage_path,storage_bucket,mime_type,size_bytes,status,security_status,security_verdict,sha256,advisory_clients!inner(auth_user_id)')
    .eq('id', String(documentId))
    .eq('advisory_clients.auth_user_id', userId)
    .maybeSingle();
  if (error) throw securityFailure('FILE_SECURITY_DOCUMENT_LOOKUP_FAILED');
  return data || null;
}

async function markScanError(db, doc, code) {
  const verdict = code === 'FILE_SECURITY_SCANNER_UNAVAILABLE'
    ? 'scanner_unavailable'
    : 'unknown';
  await db.from('client_documents').update({
    security_status:'scan_error',
    security_verdict:verdict,
    scan_completed_at:new Date().toISOString(),
    security_details:{ error_code:code, fail_closed:true }
  }).eq('id', doc.id);
  await event(db, doc.id, 'scan_failed', verdict, 'high', { code, fail_closed:true });
}

async function promoteCleanObject(db, doc, scan) {
  const { data:blob, error:downloadError } = await db.storage
    .from(QUARANTINE_BUCKET)
    .download(doc.storage_path);
  if (downloadError || !blob) throw securityFailure('FILE_SECURITY_PROMOTION_DOWNLOAD_FAILED');

  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.length !== Number(doc.size_bytes)) throw securityFailure('FILE_SECURITY_SIZE_CHANGED');
  const localHash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (localHash !== scan.sha256) throw securityFailure('FILE_SECURITY_HASH_CHANGED');

  const { error:uploadError } = await db.storage
    .from(APPROVED_BUCKET)
    .upload(doc.storage_path, buffer, {
      contentType:scan.detected_mime || doc.mime_type || 'application/octet-stream',
      upsert:false,
      cacheControl:'3600'
    });
  if (uploadError) throw securityFailure('FILE_SECURITY_PROMOTION_UPLOAD_FAILED');

  const { error:removeError } = await db.storage
    .from(QUARANTINE_BUCKET)
    .remove([doc.storage_path]);
  if (removeError) {
    await db.storage.from(APPROVED_BUCKET).remove([doc.storage_path]);
    throw securityFailure('FILE_SECURITY_QUARANTINE_REMOVE_FAILED');
  }
}

async function scanOwnedDocument({ db, userId, documentId }) {
  if (!db || !userId || !documentId) throw securityFailure('FILE_SECURITY_INPUT_REQUIRED', 400);
  const doc = await ownedDocument(db, userId, documentId);
  if (!doc) return null;

  if (doc.security_verdict === 'clean' && doc.security_status === 'clean' && doc.storage_bucket === APPROVED_BUCKET) {
    return {
      document_id:doc.id,
      verdict:'clean',
      security_status:'clean',
      sha256:doc.sha256 || null,
      already_scanned:true
    };
  }

  if (doc.storage_bucket !== QUARANTINE_BUCKET) {
    throw securityFailure('FILE_SECURITY_INVALID_STORAGE_STATE', 409);
  }

  await db.from('client_documents').update({
    security_status:'scanning',
    security_verdict:'pending',
    scan_started_at:new Date().toISOString(),
    security_policy_version:SECURITY_POLICY_VERSION
  }).eq('id', doc.id);
  await event(db, doc.id, 'scan_started', 'pending', 'info', { policy_version:SECURITY_POLICY_VERSION });

  try {
    const { data:signed, error:signedError } = await db.storage
      .from(QUARANTINE_BUCKET)
      .createSignedUrl(doc.storage_path, 60);
    if (signedError || !signed?.signedUrl) throw securityFailure('FILE_SECURITY_SIGNED_URL_FAILED');

    const raw = await callScanner({
      document_id:doc.id,
      signed_url:signed.signedUrl,
      expected_size:Number(doc.size_bytes),
      expected_mime:String(doc.mime_type || ''),
      filename:String(doc.filename || '').slice(0,255),
      policy_version:SECURITY_POLICY_VERSION
    });
    const scan = normalizeScannerResult(raw);

    if (scan.verdict !== 'clean') {
      const securityStatus = scan.verdict === 'malicious'
        ? 'infected'
        : scan.verdict === 'suspicious'
          ? 'suspicious'
          : 'rejected';
      await db.from('client_documents').update({
        security_status:securityStatus,
        security_verdict:scan.verdict,
        sha256:scan.sha256,
        detected_mime:scan.detected_mime,
        risk_score:scan.risk_score,
        scanner_name:scan.scanner_name,
        scanner_version:scan.scanner_version,
        signature_version:scan.signature_version,
        scan_completed_at:new Date().toISOString(),
        security_details:{ ...scan.details, fail_closed:true }
      }).eq('id', doc.id);
      await event(db, doc.id, 'scan_rejected', scan.verdict, scan.verdict === 'malicious' ? 'critical' : 'high', scan.details);
      return {
        document_id:doc.id,
        verdict:scan.verdict,
        security_status:securityStatus,
        sha256:scan.sha256,
        approved:false
      };
    }

    await promoteCleanObject(db, doc, scan);

    await db.from('client_documents').update({
      storage_bucket:APPROVED_BUCKET,
      security_status:'clean',
      security_verdict:'clean',
      sha256:scan.sha256,
      detected_mime:scan.detected_mime,
      risk_score:scan.risk_score,
      scanner_name:scan.scanner_name,
      scanner_version:scan.scanner_version,
      signature_version:scan.signature_version,
      scan_completed_at:new Date().toISOString(),
      security_details:scan.details
    }).eq('id', doc.id);
    await event(db, doc.id, 'scan_approved', 'clean', 'info', {
      sha256:scan.sha256,
      detected_mime:scan.detected_mime,
      scanner_name:scan.scanner_name
    });

    return {
      document_id:doc.id,
      verdict:'clean',
      security_status:'clean',
      sha256:scan.sha256,
      detected_mime:scan.detected_mime,
      risk_score:scan.risk_score,
      approved:true
    };
  } catch (error) {
    await markScanError(db, doc, error.code || error.message || 'FILE_SECURITY_SCAN_FAILED');
    throw error;
  }
}

module.exports = {
  SECURITY_POLICY_VERSION,
  QUARANTINE_BUCKET,
  APPROVED_BUCKET,
  scanOwnedDocument,
  scannerConfig
};
