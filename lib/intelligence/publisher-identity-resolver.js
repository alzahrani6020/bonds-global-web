'use strict';

/**
 * Publisher Identity Resolver — rule-based v1.
 *
 * Maps a source URL to a canonical publisher using a curated domain table.
 * Designed for evidence-independence counting: two URLs count as
 * editorially independent only when their `editorialIndependenceGroup`
 * values differ.
 *
 * The three group levels are deliberately DISTINCT:
 * - publisherId: the outlet identity (e.g. "wsj", "the-sun").
 * - ownershipGroup: the legal owner (e.g. "news-corp" for both WSJ and The
 *   Sun). Ownership NEVER implies editorial dependence — News Corp outlets
 *   keep separate editorialIndependenceGroup values because they are
 *   separate editorial operations.
 * - editorialIndependenceGroup: the editorial operation actually counted
 *   for evidence independence. Two domains share it only when they are the
 *   same editorial operation under different addresses (bbc.com/bbc.co.uk,
 *   reuters.com/graphics.reuters.com, ar/en.wikipedia.org). Two outlets
 *   under one owner keep SEPARATE editorialIndependenceGroup values unless
 *   they are the same editorial operation.
 *
 * Unknown domains are editorially unverifiable, so each unknown hostname
 * forms its own independence group ("host:<hostname>") — unknown sources
 * are never collapsed into one bucket. URL shorteners cannot be resolved
 * without network access and are always "unknown" with confidence 0.
 *
 * No network calls, no new dependencies.
 */

const PUBLISHER_RESOLVER_SCHEMA_VERSION = 1;

const SOURCE_TYPES = Object.freeze({
  NEWS:'news',
  AGENCY:'agency',
  OFFICIAL:'official',
  REFERENCE:'reference',
  WIRE:'wire',
  UNKNOWN:'unknown'
});

// Curated seed of major international/Arab publishers. Domains are matched
// exactly or by subdomain (host === domain || host ends with "." + domain).
const PUBLISHER_TABLE = Object.freeze([
  { id:'ap', name:'Associated Press', domains:['apnews.com','ap.org'], parentOrg:'Associated Press', ownershipGroup:'ap', editorialIndependenceGroup:'ap', sourceType:SOURCE_TYPES.WIRE },
  { id:'afp', name:'Agence France-Presse', domains:['afp.com'], parentOrg:'Agence France-Presse', ownershipGroup:'afp', editorialIndependenceGroup:'afp', sourceType:SOURCE_TYPES.WIRE },
  { id:'reuters', name:'Reuters', domains:['reuters.com'], parentOrg:'Thomson Reuters', ownershipGroup:'thomson-reuters', editorialIndependenceGroup:'reuters', sourceType:SOURCE_TYPES.WIRE },
  { id:'bloomberg', name:'Bloomberg', domains:['bloomberg.com'], parentOrg:'Bloomberg L.P.', ownershipGroup:'bloomberg-lp', editorialIndependenceGroup:'bloomberg', sourceType:SOURCE_TYPES.NEWS },
  { id:'cnbc', name:'CNBC', domains:['cnbc.com'], parentOrg:'NBCUniversal (Comcast)', ownershipGroup:'nbcuniversal', editorialIndependenceGroup:'cnbc', sourceType:SOURCE_TYPES.NEWS },
  { id:'cnbc-arabia', name:'CNBC Arabia', domains:['cnbcarabia.com'], parentOrg:'CNBC (licensed)', ownershipGroup:'nbcuniversal', editorialIndependenceGroup:'cnbc-arabia', sourceType:SOURCE_TYPES.NEWS },
  { id:'ft', name:'Financial Times', domains:['ft.com'], parentOrg:'Nikkei Inc.', ownershipGroup:'nikkei', editorialIndependenceGroup:'ft', sourceType:SOURCE_TYPES.NEWS },
  { id:'nyt', name:'The New York Times', domains:['nytimes.com'], parentOrg:'The New York Times Company', ownershipGroup:'nyt-co', editorialIndependenceGroup:'nyt', sourceType:SOURCE_TYPES.NEWS },
  { id:'wsj', name:'The Wall Street Journal', domains:['wsj.com'], parentOrg:'News Corp', ownershipGroup:'news-corp', editorialIndependenceGroup:'wsj', sourceType:SOURCE_TYPES.NEWS },
  { id:'the-sun', name:'The Sun', domains:['thesun.co.uk'], parentOrg:'News Corp', ownershipGroup:'news-corp', editorialIndependenceGroup:'the-sun', sourceType:SOURCE_TYPES.NEWS },
  { id:'the-times', name:'The Times', domains:['thetimes.co.uk'], parentOrg:'News Corp', ownershipGroup:'news-corp', editorialIndependenceGroup:'the-times', sourceType:SOURCE_TYPES.NEWS },
  { id:'bbc', name:'BBC', domains:['bbc.com','bbc.co.uk'], parentOrg:'BBC (public corporation)', ownershipGroup:'bbc', editorialIndependenceGroup:'bbc', sourceType:SOURCE_TYPES.NEWS },
  { id:'guardian', name:'The Guardian', domains:['theguardian.com'], parentOrg:'Guardian Media Group', ownershipGroup:'guardian-media-group', editorialIndependenceGroup:'guardian', sourceType:SOURCE_TYPES.NEWS },
  { id:'al-jazeera', name:'Al Jazeera', domains:['aljazeera.com','aljazeera.net'], parentOrg:'Al Jazeera Media Network', ownershipGroup:'al-jazeera-media-network', editorialIndependenceGroup:'al-jazeera', sourceType:SOURCE_TYPES.NEWS },
  { id:'al-arabiya', name:'Al Arabiya', domains:['alarabiya.net'], parentOrg:'Saudi Research and Media Group (MBC Group)', ownershipGroup:'mbc-group', editorialIndependenceGroup:'al-arabiya', sourceType:SOURCE_TYPES.NEWS },
  { id:'asharq-al-awsat', name:'Asharq Al-Awsat', domains:['aawsat.com'], parentOrg:'Saudi Research and Media Group (MBC Group)', ownershipGroup:'mbc-group', editorialIndependenceGroup:'asharq-al-awsat', sourceType:SOURCE_TYPES.NEWS },
  { id:'okaz', name:'Okaz', domains:['okaz.com.sa'], parentOrg:'Okaz Organization for Press and Publication', ownershipGroup:'okaz', editorialIndependenceGroup:'okaz', sourceType:SOURCE_TYPES.NEWS },
  { id:'spa', name:'Saudi Press Agency', domains:['spa.gov.sa','saudipressagency.com'], parentOrg:'Saudi Press Agency', ownershipGroup:'spa', editorialIndependenceGroup:'spa', sourceType:SOURCE_TYPES.OFFICIAL },
  { id:'argaam', name:'Argaam', domains:['argaam.com'], parentOrg:'Argaam', ownershipGroup:'argaam', editorialIndependenceGroup:'argaam', sourceType:SOURCE_TYPES.NEWS },
  { id:'sky-news-arabia', name:'Sky News Arabia', domains:['skynewsarabia.com'], parentOrg:'Sky News Arabia (Mubadala/Sky JV)', ownershipGroup:'sky-news-arabia-jv', editorialIndependenceGroup:'sky-news-arabia', sourceType:SOURCE_TYPES.NEWS },
  { id:'cnn', name:'CNN', domains:['cnn.com'], parentOrg:'Warner Bros. Discovery', ownershipGroup:'wbd', editorialIndependenceGroup:'cnn', sourceType:SOURCE_TYPES.NEWS },
  { id:'washington-post', name:'The Washington Post', domains:['washingtonpost.com'], parentOrg:'Nash Holdings (Jeff Bezos)', ownershipGroup:'nash-holdings', editorialIndependenceGroup:'washington-post', sourceType:SOURCE_TYPES.NEWS },
  { id:'economist', name:'The Economist', domains:['economist.com'], parentOrg:'The Economist Group', ownershipGroup:'economist-group', editorialIndependenceGroup:'economist', sourceType:SOURCE_TYPES.NEWS },
  { id:'npr', name:'NPR', domains:['npr.org'], parentOrg:'National Public Radio', ownershipGroup:'npr', editorialIndependenceGroup:'npr', sourceType:SOURCE_TYPES.NEWS },
  { id:'dw', name:'Deutsche Welle', domains:['dw.com'], parentOrg:'Deutsche Welle', ownershipGroup:'dw', editorialIndependenceGroup:'dw', sourceType:SOURCE_TYPES.NEWS },
  { id:'france24', name:'France 24', domains:['france24.com'], parentOrg:'France Medias Monde', ownershipGroup:'france-medias-monde', editorialIndependenceGroup:'france24', sourceType:SOURCE_TYPES.NEWS },
  { id:'xinhua', name:'Xinhua', domains:['xinhuanet.com','xinhua.net'], parentOrg:'Xinhua News Agency', ownershipGroup:'xinhua', editorialIndependenceGroup:'xinhua', sourceType:SOURCE_TYPES.WIRE },
  { id:'un', name:'United Nations', domains:['un.org'], parentOrg:'United Nations', ownershipGroup:'un', editorialIndependenceGroup:'un', sourceType:SOURCE_TYPES.OFFICIAL },
  { id:'imf', name:'International Monetary Fund', domains:['imf.org'], parentOrg:'International Monetary Fund', ownershipGroup:'imf', editorialIndependenceGroup:'imf', sourceType:SOURCE_TYPES.OFFICIAL },
  { id:'world-bank', name:'World Bank', domains:['worldbank.org'], parentOrg:'World Bank Group', ownershipGroup:'world-bank-group', editorialIndependenceGroup:'world-bank', sourceType:SOURCE_TYPES.OFFICIAL },
  { id:'wikipedia', name:'Wikipedia', domains:['wikipedia.org'], parentOrg:'Wikimedia Foundation', ownershipGroup:'wikimedia-foundation', editorialIndependenceGroup:'wikipedia', sourceType:SOURCE_TYPES.REFERENCE },
  { id:'britannica', name:'Encyclopaedia Britannica', domains:['britannica.com'], parentOrg:'Britannica Group', ownershipGroup:'britannica-group', editorialIndependenceGroup:'britannica', sourceType:SOURCE_TYPES.REFERENCE },
  { id:'marefa', name:'Marefa', domains:['marefa.org'], parentOrg:'Marefa', ownershipGroup:'marefa', editorialIndependenceGroup:'marefa', sourceType:SOURCE_TYPES.REFERENCE }
]);

// URL shorteners: the real publisher is unknowable without network access.
const URL_SHORTENERS = new Set([
  'bit.ly','t.co','tinyurl.com','goo.gl','ow.ly','is.gd','buff.ly',
  'rebrand.ly','cutt.ly','rb.gy','shorturl.at','dub.sh','tr.ee','t.ly','v.gd','x.gd'
]);

const EXACT_DOMAIN_MATCH_CONFIDENCE = 0.95;
const SUBDOMAIN_MATCH_CONFIDENCE = 0.85;
const UNKNOWN_DOMAIN_CONFIDENCE = 0.35;

function normalizeHostname(rawUrl) {
  const raw = String(rawUrl === null || rawUrl === undefined ? '' : rawUrl).trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch (_) {
    // Tolerate bare hostnames and protocol-less inputs.
    const candidate = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].replace(/:\d+$/, '');
    try {
      return new URL('https://' + candidate).hostname.toLowerCase();
    } catch (__) {
      return candidate.toLowerCase().replace(/[^a-z0-9.-]+/g, '');
    }
  }
}

function stripWww(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

function findPublisher(hostname) {
  const host = stripWww(hostname);
  if (!host) return { row:null, exact:false };
  let subdomainMatch = null;
  for (const row of PUBLISHER_TABLE) {
    for (const domain of row.domains) {
      const normalized = stripWww(domain);
      if (host === normalized) return { row, exact:true };
      if (!subdomainMatch && host.endsWith('.' + normalized)) subdomainMatch = row;
    }
  }
  return { row: subdomainMatch, exact:false };
}

function resolvePublisher(rawUrl) {
  const raw = String(rawUrl === null || rawUrl === undefined ? '' : rawUrl).trim();
  const hostname = stripWww(normalizeHostname(raw));

  if (hostname && URL_SHORTENERS.has(hostname)) {
    return {
      url: raw,
      hostname,
      canonicalPublisher: hostname,
      publisherId: hostname,
      parentOrg: null,
      ownershipGroup: 'unknown',
      independenceGroup: 'unknown:' + hostname,
      sourceType: SOURCE_TYPES.UNKNOWN,
      ownershipConfidence: 0
    };
  }

  const { row, exact } = findPublisher(hostname);
  if (row) {
    return {
      url: raw,
      hostname,
      canonicalPublisher: row.name,
      publisherId: row.id,
      parentOrg: row.parentOrg,
      ownershipGroup: row.ownershipGroup,
      independenceGroup: row.editorialIndependenceGroup,
      sourceType: row.sourceType,
      ownershipConfidence: exact ? EXACT_DOMAIN_MATCH_CONFIDENCE : SUBDOMAIN_MATCH_CONFIDENCE
    };
  }

  // Unknown domain: editorially unverifiable, so it forms its own
  // independence group (never collapsed with other unknowns).
  return {
    url: raw,
    hostname,
    canonicalPublisher: hostname,
    publisherId: hostname,
    parentOrg: null,
    ownershipGroup: 'unknown',
    independenceGroup: hostname ? 'host:' + hostname : 'unknown',
    sourceType: SOURCE_TYPES.UNKNOWN,
    ownershipConfidence: UNKNOWN_DOMAIN_CONFIDENCE
  };
}

// Groups URLs by editorialIndependenceGroup — the counting primitive used
// by evidence-independence policy checks.
function groupSources(urls) {
  const groups = new Map();
  for (const value of Array.isArray(urls) ? urls : []) {
    const url = String(value === null || value === undefined ? '' : value).trim();
    if (!url) continue;
    const resolved = resolvePublisher(url);
    const key = resolved.independenceGroup || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(url);
  }
  return [...groups.entries()]
    .map(([group, groupUrls]) => ({ group, urls: groupUrls, count: groupUrls.length }))
    .sort((a, b) => b.count - a.count || (a.group < b.group ? -1 : a.group > b.group ? 1 : 0));
}

module.exports = {
  PUBLISHER_RESOLVER_SCHEMA_VERSION,
  SOURCE_TYPES,
  PUBLISHER_TABLE,
  URL_SHORTENERS,
  normalizeHostname,
  resolvePublisher,
  groupSources
};
