'use strict';

const STUDIES_SERVICE_CODES = Object.freeze([
  'market_research',
  'scientific_research',
  'feasibility_studies',
  'risk_analysis'
]);

const STUDIES_SERVICE_BINDINGS = Object.freeze({
  market_research: Object.freeze({
    intent: 'market_analysis',
    engines: Object.freeze(['market', 'knowledge', 'live_data']),
    capabilities: Object.freeze(['orchestrator_run', 'market_intelligence']),
    topicFields: Object.freeze(['research_question', 'target_customer', 'competitors']),
    forceResearch: true
  }),
  scientific_research: Object.freeze({
    intent: 'scientific_research',
    engines: Object.freeze(['knowledge', 'market', 'evidence']),
    capabilities: Object.freeze(['orchestrator_run', 'market_intelligence', 'research_intelligence_verify']),
    topicFields: Object.freeze(['research_problem', 'research_title', 'hypothesis', 'data_sources']),
    forceResearch: true
  }),
  feasibility_studies: Object.freeze({
    intent: 'feasibility',
    engines: Object.freeze(['feasibility', 'market', 'risk', 'knowledge']),
    capabilities: Object.freeze(['orchestrator_run', 'ucp', 'market_intelligence']),
    topicFields: Object.freeze(['project_brief', 'project_name']),
    forceResearch: false
  }),
  risk_analysis: Object.freeze({
    intent: 'risk_analysis',
    engines: Object.freeze(['risk', 'market', 'knowledge']),
    capabilities: Object.freeze(['orchestrator_run', 'risk_assessment']),
    topicFields: Object.freeze(['risk_question', 'risk_scope']),
    forceResearch: false
  })
});

function cleanText(value, max) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, max || 500);
}

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isStudiesService(code) {
  return STUDIES_SERVICE_CODES.includes(String(code || '').trim());
}

function studiesBindingFor(code) {
  return STUDIES_SERVICE_BINDINGS[String(code || '').trim()] || null;
}

function firstFilled(values, keys) {
  const source = cleanObject(values);
  for (const key of keys || []) {
    const text = cleanText(source[key]);
    if (text) return text;
  }
  return '';
}

function studiesGeoFrom(values, params) {
  const fields = cleanObject(values);
  const query = cleanObject(params);
  const locality = firstFilled(fields, ['locality_name'])
    || cleanText(query.locality_name || query.locality || query.city);
  return {
    country: firstFilled(fields, ['country_code']) || cleanText(query.country || query.country_code).toUpperCase() || null,
    region: firstFilled(fields, ['region_name', 'region_code']) || cleanText(query.region_name || query.region) || null,
    city: locality || null,
    sector: firstFilled(fields, ['sector_code']) || cleanText(query.sector || query.sector_code) || 'company',
    activity: firstFilled(fields, ['activity_code']) || cleanText(query.activity || query.activity_code) || null
  };
}

function studiesQueryVariants(spec, values) {
  const source = cleanObject(values);
  const seen = new Set();
  const out = [];
  for (const key of spec.topicFields || []) {
    const text = cleanText(source[key]);
    if (!text) continue;
    const token = text.toLocaleLowerCase('en-US');
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(text);
  }
  return out.slice(0, 8);
}

function studiesResearchPacket(serviceCode, values, geo) {
  const spec = studiesBindingFor(serviceCode);
  if (!spec) return null;
  const variants = studiesQueryVariants(spec, values);
  const topic = variants[0] || '';
  const place = [geo && geo.city, geo && geo.country].filter(Boolean).join(' ');
  const query = [topic, place].filter(Boolean).join(' — ').slice(0, 500);
  return {
    enabled: spec.forceResearch === true ? true : undefined,
    topic: topic || query,
    query: query || topic,
    queryVariants: variants,
    methodology: cleanText(cleanObject(values).methodology, 80) || null,
    researchType: cleanText(cleanObject(values).research_type, 80) || null
  };
}

function studiesToolHrefs(language) {
  const en = language === 'en';
  return Object.freeze({
    cityIntelligence: '/v3/city-intelligence.html',
    investmentMap: '/v3/investment-map.html',
    feasibilityTemplate: en ? '/en/calculators/feasibility-template.html' : '/calculators/feasibility-template.html',
    fundingSources: en ? '/en/funding-sources.html' : '/funding-sources.html'
  });
}

function enrichStudiesExecutionRequest(service, profile, body, request) {
  const code = String(service && service.code || '').trim();
  const spec = studiesBindingFor(code);
  if (!spec || !request || typeof request !== 'object') return request;

  const values = cleanObject(request.values);
  const geo = studiesGeoFrom(values, {
    country: body.country || body.country_code,
    locality_name: body.city,
    sector: body.sector,
    activity: body.activity,
    ...cleanObject(body.context)
  });
  const packet = studiesResearchPacket(code, values, geo);
  const input = packet && packet.query
    || cleanText(body.input)
    || request.input;

  return {
    ...request,
    input,
    intent: request.intent || spec.intent || (profile && profile.orchestrator_intent) || undefined,
    action: request.action || spec.intent || (profile && profile.orchestrator_intent) || undefined,
    sector: geo.sector || request.sector,
    activity: geo.activity || request.activity,
    country: geo.country || request.country,
    city: geo.city || request.city,
    values,
    research: packet,
    forceResearch: spec.forceResearch === true,
    context: request.context || spec.intent || code
  };
}

function studiesAssistantContext(serviceCode, values, params, language, serviceName) {
  const geo = studiesGeoFrom(values, params);
  const packet = studiesResearchPacket(serviceCode, values, geo);
  return {
    version: 1,
    source: 'service_workspace',
    serviceCode: String(serviceCode || '').trim() || null,
    serviceName: cleanText(serviceName, 200) || null,
    countryCode: geo.country,
    regionName: geo.region,
    localityName: geo.city,
    sectorCode: geo.sector,
    activityCode: geo.activity,
    language: language === 'en' ? 'en' : 'ar',
    studiesBrief: packet && packet.topic || null,
    executionInputs: cleanObject(values)
  };
}

const api = {
  STUDIES_SERVICE_CODES,
  STUDIES_SERVICE_BINDINGS,
  isStudiesService,
  studiesBindingFor,
  studiesGeoFrom,
  studiesResearchPacket,
  studiesToolHrefs,
  enrichStudiesExecutionRequest,
  studiesAssistantContext
};

if (typeof module === 'object' && module.exports) module.exports = api;
if (typeof globalThis === 'object') globalThis.BondsStudiesBindings = api;
