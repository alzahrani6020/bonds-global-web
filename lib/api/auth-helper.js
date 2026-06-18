/**
 * Shared auth helpers for Vercel serverless APIs.
 */

const getSupabase = require('./supabase');

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Extract and verify a Supabase Bearer JWT from the request headers.
 * Returns the Supabase user object.
 */
async function verifyBearer(req) {
  const auth = req.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) {
    throw new AuthError('Missing Authorization header', 401);
  }

  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError('Invalid or expired token', 401);
  }
  return data.user;
}

/**
 * Verify a Bearer token and optionally ensure the request body userId
 * matches the token subject.
 */
async function verifyBearerAndUser(req) {
  const user = await verifyBearer(req);
  const bodyUserId = req.body?.userId;
  if (bodyUserId && bodyUserId !== user.id) {
    throw new AuthError('userId does not match authenticated user', 403);
  }
  return user;
}

module.exports = { verifyBearer, verifyBearerAndUser, AuthError };
