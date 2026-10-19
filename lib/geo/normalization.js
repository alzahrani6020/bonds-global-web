'use strict';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function haversineMeters(aLat, aLng, bLat, bLng) {
  const values = [aLat, aLng, bLat, bLng].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [lat1, lon1, lat2, lon2] = values.map(v => v * Math.PI / 180);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function scoreCandidate(raw, canonical) {
  if (!raw || !canonical) return null;
  if (raw.source_code && raw.source_id &&
      raw.source_code === canonical.source_code &&
      raw.source_id === canonical.source_id) {
    return { matchType: 'source_identity', score: 100, decision: 'auto_match', distanceM: 0 };
  }

  const rawNames = [raw.name_ar, raw.name_en, raw.canonical_name].map(normalizeKey).filter(Boolean);
  const canonicalNames = [canonical.name_ar, canonical.name_en, canonical.canonical_name].map(normalizeKey).filter(Boolean);
  const exactName = rawNames.some(name => canonicalNames.includes(name));
  if (!exactName) return null;

  const distanceM = haversineMeters(raw.lat, raw.lng, canonical.lat, canonical.lng);
  if (distanceM === null) {
    return { matchType: 'exact_name', score: 82, decision: 'review', distanceM: null };
  }
  if (distanceM <= 1000) {
    return { matchType: 'name_and_distance', score: 98, decision: 'auto_match', distanceM };
  }
  if (distanceM <= 10000) {
    return { matchType: 'name_and_distance', score: 88, decision: 'review', distanceM };
  }
  return { matchType: 'ambiguous', score: 55, decision: 'review', distanceM };
}

module.exports = { normalizeText, normalizeKey, haversineMeters, scoreCandidate };
