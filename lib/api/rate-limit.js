/**
 * In-memory rate limiter for Vercel serverless functions.
 * Note: memory is not shared across instances, so this provides
 * per-instance protection rather than global distributed limiting.
 */

const LIMITS = {
  public: { limit: 100, windowMs: 60_000 },    // market data, calculators
  auth: { limit: 10, windowMs: 60_000 },        // login, register, checkout
  ai: { limit: 20, windowMs: 60_000 },          // /api/v3/ai/chat
  compute: { limit: 20, windowMs: 60_000 },     // heavy calculations
  strict: { limit: 5, windowMs: 60_000 },       // admin operations
  webhook: { limit: 1000, windowMs: 60_000 },   // Stripe/Moyasar webhooks
};

const store = new Map();

function getWindowKey(ip, category, windowMs) {
  const bucket = Math.floor(Date.now() / windowMs);
  return `${ip}:${category}:${bucket}`;
}

function cleanupStore() {
  const now = Date.now();
  for (const [key, meta] of store) {
    if (now > meta.resetAt) store.delete(key);
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function setRateLimitHeaders(res, cfg, meta) {
  const remaining = Math.max(0, cfg.limit - meta.count);
  res.setHeader('X-RateLimit-Limit', String(cfg.limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(meta.resetAt / 1000)));
}

/**
 * Check whether the request is over the rate limit for the given category.
 * If limited, sends a 429 response and returns true. Otherwise sets the
 * rate-limit headers and returns false.
 */
function checkRateLimit(category, req, res) {
  if (!LIMITS[category]) {
    throw new Error(`Unknown rate limit category: ${category}`);
  }

  if (req.method === 'OPTIONS') {
    return false;
  }

  const cfg = LIMITS[category];
  const ip = getClientIp(req);
  const key = getWindowKey(ip, category, cfg.windowMs);
  const resetAt = (Math.floor(Date.now() / cfg.windowMs) + 1) * cfg.windowMs;

  if (store.size > 10_000) cleanupStore();

  let meta = store.get(key);
  if (!meta) {
    meta = { count: 0, resetAt };
    store.set(key, meta);
  }

  meta.count += 1;
  setRateLimitHeaders(res, cfg, meta);

  if (meta.count > cfg.limit) {
    res.setHeader('Retry-After', String(Math.ceil(cfg.windowMs / 1000)));
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return true;
  }

  return false;
}

function withRateLimit(category, handler) {
  if (!LIMITS[category]) {
    throw new Error(`Unknown rate limit category: ${category}`);
  }

  return async function rateLimitedHandler(req, res) {
    if (checkRateLimit(category, req, res)) {
      return;
    }
    return handler(req, res);
  };
}

module.exports = { withRateLimit, checkRateLimit, LIMITS };
