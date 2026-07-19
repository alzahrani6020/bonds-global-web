/**
 * Shared CORS origin helper.
 * Returns an allowed origin based on the incoming request Origin header.
 */

const DEFAULT_ORIGIN = 'https://bonds-global.com';

const ALLOWED_ORIGINS = [
  'https://bonds-global.com',
  'https://www.bonds-global.com',
  'http://localhost:3005',
  'http://localhost:3000'
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Vercel preview deployments for this project
  if (/^https:\/\/bonds-global-[a-z0-9-]+-alzahrani6020\.vercel\.app$/i.test(origin)) return true;
  return false;
}

function getAllowedOrigin(req) {
  const origin = req?.headers?.origin;
  return isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN;
}

function setAllowedOrigin(res, req) {
  res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin(req));
  res.setHeader('Vary', 'Origin');
}

function setCors(res, req, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = { setAllowedOrigin, setCors, getAllowedOrigin, ALLOWED_ORIGINS };
