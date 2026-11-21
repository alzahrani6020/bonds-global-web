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

function realTaxonomyValue(value) {
  const cleaned = cleanText(value, 120);
  // UI commands are not taxonomy IDs; never forward them to the orchestrator.
  return cleaned === '__add_custom_sector__' || cleaned === '__add_custom_activity__'
    ? '' : cleaned;
}

function firstFilled(values, keys) {
  const source = cleanObject(values);
  for (const key of keys || []) {
    const text = cleanText(source[key]);
    if (text) return text;
  }
  return '';
}

const STUDY_ENGINE_SECTORS = Object.freeze(['restaurant', 'manufacturing', 'hotel', 'company', 'education', 'healthcare', 'retail', 'trade']);

function studiesGeoFrom(values, params) {
  const fields = cleanObject(values);
  const query = cleanObject(params);
  const locality = firstFilled(fields, ['locality_name'])
    || cleanText(query.locality_name || query.locality || query.city);
  return {
    country: firstFilled(fields, ['country_code']) || cleanText(query.country || query.country_code).toUpperCase() || null,
    region: firstFilled(fields, ['region_name', 'region_code']) || cleanText(query.region_name || query.region) || null,
    city: locality || null,
    // Catalog sector stays in values.sector_code/name. Only an explicitly
    // selected compatible analytical model may override the engine sector.
    sector: STUDY_ENGINE_SECTORS.includes(cleanText(fields.sector_engine_profile))
      ? cleanText(fields.sector_engine_profile)
      : (realTaxonomyValue(fields.sector_code) || realTaxonomyValue(query.sector || query.sector_code) || 'company'),
    activity: realTaxonomyValue(fields.activity_code) || realTaxonomyValue(query.activity || query.activity_code) || null
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
    cityIntelligence: en ? '/en/v3/city-intelligence' : '/v3/city-intelligence',
    investmentMap: '/v3/investment-map.html',
    feasibilityTemplate: en ? '/en/calculators/feasibility-template.html' : '/calculators/feasibility-template.html',
    fundingSources: en ? '/en/funding-sources.html' : '/funding-sources.html'
  });
}

function enrichStudiesExecutionRequest(service, profile, body, request) {
  const code = String(service && service.code || '').trim();
  const spec = studiesBindingFor(code);
  if (!spec || !request || typeof request !== 'object') return request;

  const values = { ...cleanObject(request.values) };
  // Old URLs and draft payloads may still carry a dropdown action sentinel.
  if (!realTaxonomyValue(values.sector_code)) delete values.sector_code;
  if (!realTaxonomyValue(values.activity_code)) delete values.activity_code;
  const geo = studiesGeoFrom(values, {
    country: body.country || body.country_code,
    locality_name: body.city,
    sector: body.sector,
    activity: body.activity,
    ...cleanObject(body.context)
  });
  const packet = studiesResearchPacket(code, values, geo);
  // Preserve explicit research settings and cited sources supplied by the user.
  // Generated defaults fill gaps; they must not silently replace user input.
  const providedResearch = cleanObject(request.research);
  const mergedResearch = packet ? { ...packet, ...providedResearch } : providedResearch;
  // Mandatory research services cannot be disabled by an untrusted request.
  if (spec.forceResearch === true) mergedResearch.enabled = true;
  const input = cleanText(body.input)
    || (packet && packet.query)
    || request.input;

  return {
    ...request,
    input,
    intent: request.intent || spec.intent || (profile && profile.orchestrator_intent) || undefined,
    action: request.action || spec.intent || (profile && profile.orchestrator_intent) || undefined,
    sector: geo.sector || request.sector,
    activity: geo.activity,
    country: geo.country || request.country,
    city: geo.city || request.city,
    values,
    research: mergedResearch,
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
