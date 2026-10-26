'use strict';

const INSTITUTIONAL_SOURCE_SCHEMA_VERSION = 1;

const SOURCES = Object.freeze([
  {
    id:'saudi_aramco',
    name:'Saudi Aramco',
    domains:['aramco.com','www.aramco.com'],
    countries:['SA'],
    entity_types:['company','relation'],
    topics:['company','leadership','energy','financials','governance'],
    languages:['ar','en'],
    authority_score:1,
    aliases:['aramco','saudi aramco','أرامكو','ارامكو','شركة أرامكو','شركة ارامكو'],
    freshness_policy:'daily',
    search_templates:['site:aramco.com {query}']
  },
  {
    id:'saudi_exchange',
    name:'Saudi Exchange',
    domains:['saudiexchange.sa','www.saudiexchange.sa'],
    countries:['SA'],
    entity_types:['company','relation','market'],
    topics:['listed companies','filings','market','governance','financials'],
    languages:['ar','en'],
    authority_score:0.99,
    aliases:['saudi exchange','tadawul','تداول','السوق المالية السعودية'],
    freshness_policy:'hourly',
    search_templates:['site:saudiexchange.sa {query}']
  },
  {
    id:'cma_saudi',
    name:'Capital Market Authority',
    domains:['cma.org.sa','www.cma.org.sa'],
    countries:['SA'],
    entity_types:['regulator','company','market'],
    topics:['capital markets','regulation','listed companies','governance'],
    languages:['ar','en'],
    authority_score:0.99,
    aliases:['cma','هيئة السوق المالية','هيئة السوق الماليه'],
    freshness_policy:'daily',
    search_templates:['site:cma.org.sa {query}']
  },
  {
    id:'sama',
    name:'Saudi Central Bank',
    domains:['sama.gov.sa','www.sama.gov.sa'],
    countries:['SA'],
    entity_types:['regulator','bank','country'],
    topics:['banking','credit','monetary','payments','insurance','financial stability'],
    languages:['ar','en'],
    authority_score:1,
    aliases:['sama','saudi central bank','البنك المركزي السعودي','مؤسسة النقد'],
    freshness_policy:'daily',
    search_templates:['site:sama.gov.sa {query}']
  },
  {
    id:'zatca',
    name:'Zakat, Tax and Customs Authority',
    domains:['zatca.gov.sa','www.zatca.gov.sa'],
    countries:['SA'],
    entity_types:['regulator','country'],
    topics:['tax','zakat','customs','vat','e-invoicing'],
    languages:['ar','en'],
    authority_score:1,
    aliases:['zatca','هيئة الزكاة والضريبة والجمارك','الزكاة والضريبة والجمارك'],
    freshness_policy:'daily',
    search_templates:['site:zatca.gov.sa {query}']
  },
  {
    id:'gastat',
    name:'General Authority for Statistics',
    domains:['stats.gov.sa','www.stats.gov.sa'],
    countries:['SA'],
    entity_types:['country','regulator'],
    topics:['statistics','population','gdp','labor','prices','industry'],
    languages:['ar','en'],
    authority_score:1,
    aliases:['gastat','الهيئة العامة للإحصاء','الاحصاء'],
    freshness_policy:'daily',
    search_templates:['site:stats.gov.sa {query}']
  },
  {
    id:'ministry_commerce_sa',
    name:'Ministry of Commerce',
    domains:['mc.gov.sa','www.mc.gov.sa'],
    countries:['SA'],
    entity_types:['regulator','company','country'],
    topics:['companies','commercial registration','regulation','commerce'],
    languages:['ar','en'],
    authority_score:1,
    aliases:['وزارة التجارة','ministry of commerce'],
    freshness_policy:'daily',
    search_templates:['site:mc.gov.sa {query}']
  },
  {
    id:'ministry_finance_sa',
    name:'Ministry of Finance',
    domains:['mof.gov.sa','www.mof.gov.sa'],
    countries:['SA'],
    entity_types:['regulator','country'],
    topics:['fiscal','budget','government finance','debt','economic policy'],
    languages:['ar','en'],
    authority_score:1,
    aliases:['وزارة المالية','وزارة المالية السعودية','ministry of finance','saudi ministry of finance'],
    freshness_policy:'daily',
    search_templates:['site:mof.gov.sa {query}']
  },
  {
    id:'world_bank',
    name:'World Bank',
    domains:['worldbank.org','data.worldbank.org','api.worldbank.org'],
    countries:['*'],
    entity_types:['country','economic_indicator'],
    topics:['gdp','population','debt','development','trade','inflation'],
    languages:['en'],
    authority_score:0.98,
    aliases:['world bank','البنك الدولي'],
    freshness_policy:'daily',
    search_templates:['site:worldbank.org {query}','site:data.worldbank.org {query}']
  },
  {
    id:'imf',
    name:'International Monetary Fund',
    domains:['imf.org','www.imf.org'],
    countries:['*'],
    entity_types:['country','economic_indicator'],
    topics:['macroeconomics','gdp','debt','inflation','fiscal','monetary'],
    languages:['en'],
    authority_score:0.98,
    aliases:['imf','international monetary fund','صندوق النقد الدولي'],
    freshness_policy:'daily',
    search_templates:['site:imf.org {query}']
  },
  {
    id:'oecd',
    name:'OECD',
    domains:['oecd.org','www.oecd.org'],
    countries:['*'],
    entity_types:['country','economic_indicator'],
    topics:['economy','tax','labor','productivity','trade'],
    languages:['en'],
    authority_score:0.96,
    aliases:['oecd','منظمة التعاون الاقتصادي والتنمية'],
    freshness_policy:'daily',
    search_templates:['site:oecd.org {query}']
  }
]);

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g,'')
    .replace(/[إأآٱ]/g,'ا')
    .replace(/ى/g,'ي')
    .replace(/\s+/g,' ')
    .trim();
}

function hostOf(value) {
  try { return new URL(String(value || '')).hostname.toLowerCase(); }
  catch (_) { return String(value || '').toLowerCase().replace(/^www\./,''); }
}

function sourceMatchesEntity(source, entityFrame) {
  if (!entityFrame) return false;
  const haystack = norm([
    entityFrame.canonical_name,
    ...(entityFrame.organizations || []).map(item => item?.value),
    ...(entityFrame.qualifiers || []).map(item => item?.value)
  ].filter(Boolean).join(' '));
  if (!haystack) return false;
  return source.aliases.some(alias => haystack.includes(norm(alias)) || norm(alias).includes(haystack));
}

function sourceMatchesQuery(source, query) {
  const text = norm(query);
  return Boolean(text) && source.aliases.some(alias => text.includes(norm(alias)));
}

function findInstitutionalSources({ entityFrame = null, query = '', intent = '', country = null, limit = 6 } = {}) {
  const entityType = String(entityFrame?.entity_type || '').trim();
  const countryCode = String(country || '').trim().toUpperCase();

  return SOURCES
    .map(source => {
      let score = 0;
      if (sourceMatchesEntity(source, entityFrame)) score += 100;
      if (sourceMatchesQuery(source, query)) score += 80;
      if (entityType && source.entity_types.includes(entityType)) score += 20;
      if (String(intent || '').includes('relation') && source.topics.includes('leadership')) score += 25;
      if (countryCode && (source.countries.includes(countryCode) || source.countries.includes('*'))) score += 10;
      return { ...source, match_score:score };
    })
    .filter(source => source.match_score > 0)
    .sort((a,b) => b.match_score - a.match_score || b.authority_score - a.authority_score)
    .slice(0, Math.max(1, Math.min(Number(limit || 6), 12)));
}

function isInstitutionalDomain(urlOrHost) {
  const host = hostOf(urlOrHost).replace(/^www\./,'');
  for (const source of SOURCES) {
    if (source.domains.some(domain => {
      const d = domain.toLowerCase().replace(/^www\./,'');
      return host === d || host.endsWith('.' + d);
    })) return source;
  }
  return null;
}

module.exports = {
  INSTITUTIONAL_SOURCE_SCHEMA_VERSION,
  SOURCES,
  findInstitutionalSources,
  isInstitutionalDomain
};
