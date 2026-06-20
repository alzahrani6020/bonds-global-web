/**
 * Bonds AI Review Request Handler
 *
 * POST /api/v3/ai/request-review
 * Body: { requestId, note? }
 *
 * Saves a review request and notifies the admin team.
 */

const { getUserFromToken } = require('../../v3/lib/auth');
const getSupabase = require('../api/supabase');
const { sendEmail } = require('../api/email');

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

async function handleAiReviewRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { requestId, note } = body;
  if (!requestId) {
    return sendJson(res, 400, { error: 'requestId is required' });
  }

  const supabase = getSupabase();

  // Verify the AI request belongs to this user
  const { data: aiRequest, error: fetchError } = await supabase
    .from('ai_requests')
    .select('id, type, user_id, created_at')
    .eq('id', requestId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !aiRequest) {
    return sendJson(res, 404, { error: 'AI request not found' });
  }

  // Save review request
  const { data: review, error: insertError } = await supabase
    .from('ai_review_requests')
    .insert({
      request_id: requestId,
      user_id: user.id,
      note: note || null,
      status: 'pending_review'
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[ai/request-review] Insert error:', insertError.message);
    return sendJson(res, 500, { error: 'Failed to save review request' });
  }

  // Notify admin (best-effort)
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bonds-global.com';
    await sendEmail({
      to: adminEmail,
      subject: 'طلب مراجعة استشارية جديد — بوندز',
      text: `User ${user.email} requested an expert review for AI request ${requestId} (${aiRequest.type}).\nNote: ${note || 'N/A'}`,
      html: `<p>User <strong>${user.email}</strong> requested an expert review.</p>
             <p>AI Request ID: <strong>${requestId}</strong></p>
             <p>Type: <strong>${aiRequest.type}</strong></p>
             <p>Note: ${note || 'N/A'}</p>`
    });
  } catch (e) {
    console.warn('[ai/request-review] Email notification failed:', e.message);
  }

  sendJson(res, 200, {
    success: true,
    reviewId: review.id,
    status: 'pending_review'
  });
}

module.exports = { handleAiReviewRequest };
