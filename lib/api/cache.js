/**
 * Simple in-memory cache with TTL for API responses
 */
const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, ttlMs) {
  ttlMs = ttlMs || 60000; // default 1 minute
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

function clearCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

module.exports = { getCache, setCache, clearCache };
