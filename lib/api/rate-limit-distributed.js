/**
 * Distributed rate-limit backend using Supabase.
 *
 * Falls back to the local in-memory limiter if Supabase is unavailable or the
 * RPC call fails, so a transient DB outage does not block all traffic.
 */

const getSupabase = require('./supabase');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function isDistributedAvailable() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

function setRateLimitHeaders(res, cfg, meta) {
  const remaining = Math.max(0, cfg.limit - meta.count);
  res.setHeader('X-RateLimit-Limit', String(cfg.limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(meta.resetAt / 1000)));
}

async function checkRateLimitDistributed(category, cfg, req, res) {
  if (!isDistributedAvailable()) return null;

  const sb = getSupabase();
  if (!sb) return null;

  const ip = getClientIp(req);
  const nowMs = Date.now();
  const key = `${ip}:${category}:${Math.floor(nowMs / cfg.windowMs)}`;

  try {
    const { data, error } = await sb.rpc('check_rate_limit_bucket', {
      p_key: key,
      p_limit: cfg.limit,
      p_window_ms: cfg.windowMs,
      p_now_ms: nowMs
    });

    if (error) throw error;
    if (!data) throw new Error('Empty RPC response');

    const { allowed, count, reset_at } = data;
    setRateLimitHeaders(res, cfg, { count, resetAt: reset_at });

    if (!allowed) {
      res.setHeader('Retry-After', String(Math.ceil(cfg.windowMs / 1000)));
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return true;
    }

    return false;
  } catch (err) {
    // Log once and fail open so the local limiter can still protect the instance.
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[rate-limit-distributed] RPC failed:', err.message);
    }
    return null;
  }
}

module.exports = { isDistributedAvailable, checkRateLimitDistributed };
