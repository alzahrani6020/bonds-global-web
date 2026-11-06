'use strict';

const PUBLISHER_DOMAIN_FAMILIES = Object.freeze([
  'wikipedia.org',
  'wikimedia.org',
  'britannica.com',
  'bbc.com',
  'bbc.co.uk',
  'reuters.com',
  'apnews.com',
  'bloomberg.com',
  'cnn.com',
  'aljazeera.com',
  'nytimes.com',
  'ft.com',
  'wsj.com'
]);

const SAFE_PREFIXES = /^(?:www|m|mobile|amp)\./;

function cleanHost(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function hostFrom(value) {
  try {
    return cleanHost(new URL(String(value || '')).hostname);
  } catch (_) {
    return cleanHost(value);
  }
}

function familyForHost(host) {
  const clean = cleanHost(host).replace(SAFE_PREFIXES, '');
  for (const family of PUBLISHER_DOMAIN_FAMILIES) {
    if (clean === family || clean.endsWith('.' + family)) return family;
  }
  return clean || null;
}

function canonicalPublisherIdentity(value, fallback = null) {
  const host = hostFrom(value);
  if (host) return familyForHost(host);
  const fallbackHost = hostFrom(fallback);
  return fallbackHost ? familyForHost(fallbackHost) : null;
}

function samePublisher(left, right) {
  const a = canonicalPublisherIdentity(left);
  const b = canonicalPublisherIdentity(right);
  return Boolean(a && b && a === b);
}

module.exports = {
  PUBLISHER_DOMAIN_FAMILIES,
  canonicalPublisherIdentity,
  samePublisher
};
