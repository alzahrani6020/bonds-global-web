const { getSupabaseClient } = require('../lib/supabase');
const { loadProjectModel } = require('../engine/loader');
const { calculate, recommend } = require('../engine/calculator');
const { generateInsights } = require('../engine/ai');
const { adminRouter } = require('./admin');
const { calibrateCompetitorCounts } = require('../engine/data-acquisition/CompetitorCalibration');
const SourceQualityMonitor = require('../engine/data-acquisition/SourceQualityMonitor');
const { authRouter } = require('./auth');
const { projectsRouter } = require('./projects');
const { billingRouter } = require('./billing');
const { dataEngineRouter } = require('./data-engine');
const { getUserFromToken } = require('../lib/auth');
const { requireAdminAccess, constantTimeEqual } = require('../lib/admin-access');
const { checkRateLimit } = require('../../lib/api/rate-limit');
const { assessOpportunityRow } = require('../../lib/truth/opportunity-reliability');
const { deriveEvidenceAges } = require('../../lib/truth/evidence-record');
// AI handlers from the main project are optional; V3 can be deployed standalone.
// If the files are not available, stub handlers return 503 so the rest of the API works.
function aiNotAvailable(req, res) {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    error: 'AI analyze service not available in standalone V3 deployment',
    hint: 'Deploy from the monorepo root or copy lib/ai/analyze-handler.js and review-handler.js into v3/lib/ai/'
  }));
}

let handleAiAnalyze = aiNotAvailable;
let handleAiReviewRequest = aiNotAvailable;
let handleValuationAnalyze = aiNotAvailable;
let handleApproveReport = aiNotAvailable;
let handleIssueCertificate = aiNotAvailable;
let handleVerifyCertificate = aiNotAvailable;
try {
  ({ handleAiAnalyze } = require('../../lib/ai/analyze-handler'));
} catch (err) {
  console.warn('[v3/api] analyze-handler not available, AI analyze endpoint disabled');
}
try {
  ({ handleAiReviewRequest } = require('../../lib/ai/review-handler'));
} catch (err) {
  console.warn('[v3/api] review-handler not available, AI request-review endpoint disabled');
}
try {
  ({ handleValuationAnalyze } = require('../../lib/ai/valuation-analyze-handler'));
} catch (err) {
  console.warn('[v3/api] valuation-analyze-handler not available, AI valuation endpoint disabled');
}
try {
  ({
    handleApproveReport,
    handleIssueCertificate,
    handleVerifyCertificate
  } = require('../../lib/ai/valuation-certificate-handler'));
} catch (err) {
  console.warn('[v3/api] valuation-certificate-handler not available, certificate endpoints disabled');
}

const { aiChatHandler } = require('./ai');
const { scenariosRouter } = require('./scenarios');
const { alertsRouter } = require('./alerts');
const { compareRouter } = require('./compare');
const { fabricRouter } = require('./fabric');
const { intelligenceRouter } = require('./intelligence');
const { investmentIntelligenceRouter } = require('./investment-intelligence');
const { capabilitiesRouter } = require('./capabilities');
const { assistantRouter } = require('./assistant');
const { waterFactoryDataRouter } = require('./water-factory-data');
const { sectorDataRouter } = require('./sector-data');
const { enterpriseLifecycleRouter } = require('./enterprise-lifecycle');
const { eccRouter } = require('./ecc');
const { UniversalCalculationPlatform } = require('../../lib/ucp');
const { adaptToUcp, adaptFromUcp } = require('../../lib/ucp/adapters');
const { run: orchestratorRun, buildIntentForm } = require('../../lib/orchestrator/intelligence-orchestrator');
const { listIntents } = require('../../lib/intent/intent-engine');
const { setAllowedOrigin } = require('../../lib/api/cors');
const { resolveOpportunityYear } = require('../lib/opportunity-query');
const { COUNTRY_NAMES, canonicalizeCities, canonicalizeActivities, buildCountryCatalog } = require('../../lib/catalog/canonical-registry');
const { ARAB_COUNTRIES_GEO } = require('../master-data/countries-governorates-cities');
const { CountryIndicatorEngine } = require('../../lib/data/country-indicator-engine');
const { servicesRouter } = require('./services');
const { calculateSiteIntelligence } = require('../../lib/geo/local-intelligence');

function setCors(res, req) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-token,x-bonds-service-token');
}

function getCategory(path) {
  if (path === '/billing/webhook' || path.startsWith('/billing/webhook/')) return 'webhook';
  if (path === '/billing/checkout' || path === '/billing/subscription') return 'auth';
  if (path.startsWith('/auth')) return 'auth';
  if (path.startsWith('/admin') || path.startsWith('/cron')) return 'strict';
  if (path === '/ai/chat') return 'ai';
  if (path === '/assistant' || path.startsWith('/assistant/')) return 'compute';
  if (path === '/services/execute' || path.startsWith('/services/intake/') || path.startsWith('/services/accounting/') || /^\/services\/[^/]+\/execution$/.test(path)) return 'compute';
  if (path === '/calculate' || path.startsWith('/calculate/') || path === '/compare/cities' || path.startsWith('/ucp/') || path.startsWith('/wave4/') || path.startsWith('/orchestrate') || path.startsWith('/fabric') || path.startsWith('/intelligence') || path.startsWith('/investment-intelligence') || path.startsWith('/capabilities') || path.startsWith('/enterprise-lifecycle') || path.startsWith('/ecc') || path === '/water-factory-data' || path === '/sector-data') return 'compute';
  return 'public';
}

async function resolveRequestTier(req) {
  let user = null;
  try {
    user = await getUserFromToken(req);
  } catch (_error) {
    return { user: null, userTier: 'free' };
  }

  if (!user) return { user: null, userTier: 'free' };

  try {
    const supabase = getSupabaseClient();
    const [{ data: profile }, { data: adminRole }] = await Promise.all([
      supabase
        .from('profiles')
        .select('tier,status')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
    ]);

    if (adminRole && ['super_admin', 'admin'].includes(adminRole.role)) {
      return { user, userTier: 'enterprise' };
    }

    const tier = String(profile?.tier || 'free').toLowerCase();
    const status = String(profile?.status || '').toLowerCase();
    const entitled = status === 'active' || status === 'trialing';

    return {
      user,
      userTier: entitled && ['pro', 'enterprise'].includes(tier) ? tier : 'free'
    };
  } catch (_error) {
    return { user, userTier: 'free' };
  }
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function getQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return url;
}

async function handleHealth(req, res) {
  sendJson(res, 200, { status: 'ok', version: 'v3.0.0-alpha' });
}

async function handleSectors(req, res) {
  const supabase = getSupabaseClient();

  const { data: sectors, error } = await supabase
    .from('economic_sectors')
    .select(`
      *,
      economic_sub_sectors (
        *,
        economic_activities (
          *,
          economic_activity_details (*)
        )
      )
    `)
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[sectors]', error.message);
    return sendJson(res, 500, { error: 'Failed to load sectors' });
  }

  // Filter out inactive taxonomy rows
  const activeSectors = (sectors || []).map(sector => ({
    ...sector,
    economic_sub_sectors: (sector.economic_sub_sectors || [])
      .filter(ss => ss.is_active !== false)
      .map(ss => ({
        ...ss,
        economic_activities: (ss.economic_activities || [])
          .filter(a => a.is_active !== false)
          .map(a => ({
            ...a,
            economic_activity_details: (a.economic_activity_details || [])
              .filter(d => d.is_active !== false)
          }))
      }))
  }));

  sendJson(res, 200, { sectors: activeSectors });
}

async function handleInvestmentTaxonomy(req, res) {
  const url = getQuery(req);
  const countryCode = (url.searchParams.get('country') || '').toUpperCase() || null;
  const sectorCode = url.searchParams.get('sector') || null;
  const depth = url.searchParams.get('depth') || 'subsector';
  const includeSubsectors = depth !== 'sector';
  const include = new Set(
    (url.searchParams.get('include') || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
  const includeActivities = include.has('activities') || include.has('all');
  const includeDimensions = include.has('dimensions') || include.has('all');

  if (countryCode && !COUNTRY_NAMES[countryCode]) {
    return sendJson(res, 400, { error: 'Invalid country parameter' });
  }

  const supabase = getSupabaseClient();
  let sectors = [];
  let subsectors = [];

  if (!sectorCode) {
    const [sectorsResult, subsectorsResult] = await Promise.all([
      supabase
        .from('canonical_investment_sectors')
        .select('id,code,name_ar,name_en,description,sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      includeSubsectors
        ? supabase
            .from('canonical_investment_subsectors')
            .select('id,sector_id,code,name_ar,name_en,description,sort_order')
            .eq('is_active', true)
            .order('sort_order')
        : Promise.resolve({ data: [], error: null })
    ]);

    if (sectorsResult.error || subsectorsResult.error) {
      console.error('[investment-taxonomy/summary]', sectorsResult.error?.message || subsectorsResult.error?.message);
      return sendJson(res, 500, { error: 'Failed to load investment taxonomy' });
    }
    sectors = sectorsResult.data || [];
    subsectors = subsectorsResult.data || [];
  } else {
    const sectorsResult = await supabase
      .from('canonical_investment_sectors')
      .select('id,code,name_ar,name_en,description,sort_order')
      .eq('is_active', true)
      .eq('code', sectorCode)
      .order('sort_order');

    if (sectorsResult.error) {
      console.error('[investment-taxonomy/sectors]', sectorsResult.error.message);
      return sendJson(res, 500, { error: 'Failed to load investment taxonomy' });
    }

    sectors = sectorsResult.data || [];
    const filteredSectorIds = sectors.map(row => row.id);

    if (includeSubsectors && filteredSectorIds.length) {
      const subsectorsResult = await supabase
        .from('canonical_investment_subsectors')
        .select('id,sector_id,code,name_ar,name_en,description,sort_order')
        .eq('is_active', true)
        .in('sector_id', filteredSectorIds)
        .order('sort_order');

      if (subsectorsResult.error) {
        console.error('[investment-taxonomy/subsectors]', subsectorsResult.error.message);
        return sendJson(res, 500, { error: 'Failed to load investment taxonomy' });
      }
      subsectors = subsectorsResult.data || [];
    }
  }

  const sectorIds = sectors.map(row => row.id);
  let activities = [];

  if (includeActivities && sectorIds.length) {
    let sectorMapQuery = supabase
      .from('canonical_activity_investment_sectors')
      .select('canonical_activity_id,sector_id,is_primary,confidence')
      .eq('is_primary', true);

    if (sectorCode) sectorMapQuery = sectorMapQuery.in('sector_id', sectorIds);

    const { data: sectorMappings, error: sectorMapError } = await sectorMapQuery;
    if (sectorMapError) {
      console.error('[investment-taxonomy/activity-sectors]', sectorMapError.message);
      return sendJson(res, 500, { error: 'Failed to load investment taxonomy activities' });
    }

    const activityIds = [...new Set((sectorMappings || []).map(row => row.canonical_activity_id))];
    let activityRows = [];
    let subsectorMappings = [];
    let businessFormEligibility = [];
    let countryActivityRows = [];

    if (activityIds.length) {
      const [activitiesResult, subsectorMapResult, businessFormsResult, countryActivitiesResult] = await Promise.all([
        supabase
          .from('canonical_activity_catalog')
          .select('id,code,name_ar,name_en,description,is_active,sort_order,aliases')
          .in('id', activityIds)
          .order('sort_order')
          .order('name_ar'),
        includeSubsectors
          ? supabase
              .from('canonical_activity_investment_subsectors')
              .select('canonical_activity_id,subsector_id,is_primary,confidence')
              .in('canonical_activity_id', activityIds)
              .eq('is_primary', true)
          : Promise.resolve({ data: [], error: null }),
        countryCode
          ? supabase
              .from('canonical_activity_business_forms')
              .select('canonical_activity_id,business_form_code,country_code,verification_status,confidence')
              .eq('country_code', countryCode)
              .in('canonical_activity_id', activityIds)
          : Promise.resolve({ data: [], error: null }),
        countryCode
          ? supabase
              .from('canonical_activity_country')
              .select('canonical_activity_id,country_code,availability_status,regulatory_status,classification_system,classification_code,classification_label,source,source_url,confidence,metadata')
              .eq('country_code', countryCode)
              .in('canonical_activity_id', activityIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      const failed = [activitiesResult, subsectorMapResult, businessFormsResult, countryActivitiesResult]
        .find(result => result.error);
      if (failed?.error) {
        console.error('[investment-taxonomy/activities]', failed.error.message);
        return sendJson(res, 500, { error: 'Failed to load investment taxonomy activities' });
      }

      activityRows = activitiesResult.data || [];
      subsectorMappings = subsectorMapResult.data || [];
      businessFormEligibility = businessFormsResult.data || [];
      countryActivityRows = countryActivitiesResult.data || [];
    }

    const primarySectorByActivity = new Map(
      (sectorMappings || []).map(row => [row.canonical_activity_id, row])
    );
    const primarySubsectorByActivity = new Map(
      subsectorMappings.map(row => [row.canonical_activity_id, row])
    );
    const eligibilityByActivity = new Map();
    for (const row of businessFormEligibility) {
      if (!eligibilityByActivity.has(row.canonical_activity_id)) eligibilityByActivity.set(row.canonical_activity_id, []);
      eligibilityByActivity.get(row.canonical_activity_id).push(row);
    }
    const countryByActivity = new Map(
      countryActivityRows.map(row => [row.canonical_activity_id, row])
    );

    activities = activityRows.map(activity => ({
      ...activity,
      primary_sector: primarySectorByActivity.get(activity.id) || null,
      primary_subsector: primarySubsectorByActivity.get(activity.id) || null,
      country: countryByActivity.get(activity.id) || null,
      business_forms: eligibilityByActivity.get(activity.id) || []
    }));
  }

  let projectSizes = [];
  let businessForms = [];
  let opportunityTypes = [];

  if (includeDimensions) {
    const [sizesResult, formsResult, opportunityTypesResult] = await Promise.all([
      supabase.from('investment_project_sizes').select('code,name_ar,name_en,sort_order').order('sort_order'),
      supabase.from('investment_business_forms').select('code,name_ar,name_en,sort_order').order('sort_order'),
      supabase.from('investment_opportunity_types').select('code,name_ar,name_en,sort_order').order('sort_order')
    ]);

    const failed = [sizesResult, formsResult, opportunityTypesResult].find(result => result.error);
    if (failed?.error) {
      console.error('[investment-taxonomy/dimensions]', failed.error.message);
      return sendJson(res, 500, { error: 'Failed to load investment taxonomy dimensions' });
    }

    projectSizes = sizesResult.data || [];
    businessForms = formsResult.data || [];
    opportunityTypes = opportunityTypesResult.data || [];
  }

  const subsectorsBySector = new Map();
  for (const row of subsectors) {
    if (!subsectorsBySector.has(row.sector_id)) subsectorsBySector.set(row.sector_id, []);
    subsectorsBySector.get(row.sector_id).push(row);
  }

  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  return sendJson(res, 200, {
    taxonomy_version: 'v3-canonical-investment-1',
    country_code: countryCode,
    sector_filter: sectorCode,
    depth,
    included: {
      subsectors: includeSubsectors,
      activities: includeActivities,
      dimensions: includeDimensions
    },
    sectors: (sectors || []).map(sector => ({
      ...sector,
      subsectors: includeSubsectors ? (subsectorsBySector.get(sector.id) || []) : []
    })),
    activities,
    project_sizes: projectSizes,
    business_forms: businessForms,
    opportunity_types: opportunityTypes,
    counts: {
      sectors: (sectors || []).length,
      subsectors: subsectors.length,
      activities: activities.length,
      project_sizes: projectSizes.length,
      business_forms: businessForms.length,
      opportunity_types: opportunityTypes.length
    }
  });
}

async function resolveActivitySelection(supabase, activityCode) {
  if (!activityCode) {
    return { canonicalCode: null, canonicalNameAr: null, canonicalNameEn: null, aliases: [], ids: [] };
  }

  // Prefer the persisted canonical registry. If the additive migration has not
  // been applied yet, fall back to the legacy activity code so deployments can
  // roll forward without a flag day.
  try {
    let canonical = null;

    const { data: direct, error: directError } = await supabase
      .from('canonical_activity_catalog')
      .select('id,code,name_ar,name_en,aliases')
      .eq('code', activityCode)
      .maybeSingle();

    if (!directError && direct) {
      canonical = direct;
    } else {
      const { data: alias, error: aliasError } = await supabase
        .from('canonical_activity_legacy_aliases')
        .select('canonical_activity_id')
        .eq('legacy_code', activityCode)
        .maybeSingle();

      if (!aliasError && alias?.canonical_activity_id) {
        const { data: aliasedCanonical, error: canonicalError } = await supabase
          .from('canonical_activity_catalog')
          .select('id,code,name_ar,name_en,aliases')
          .eq('id', alias.canonical_activity_id)
          .maybeSingle();
        if (!canonicalError && aliasedCanonical) canonical = aliasedCanonical;
      }
    }

    if (canonical) {
      const aliases = [...new Set([...(canonical.aliases || []), activityCode].filter(Boolean))];
      const { data: legacyRows, error: legacyError } = await supabase
        .from('economic_activities')
        .select('id,code')
        .in('code', aliases);

      if (!legacyError) {
        return {
          canonicalCode: canonical.code,
          canonicalNameAr: canonical.name_ar,
          canonicalNameEn: canonical.name_en,
          aliases,
          ids: (legacyRows || []).map(row => row.id).filter(Boolean)
        };
      }
    }
  } catch (err) {
    console.warn('[activity resolver] canonical registry unavailable:', err.message);
  }

  const { data: legacy, error: legacyError } = await supabase
    .from('economic_activities')
    .select('id,code,name_ar,name_en')
    .eq('code', activityCode)
    .maybeSingle();

  if (legacyError || !legacy) {
    return {
      canonicalCode: activityCode,
      canonicalNameAr: null,
      canonicalNameEn: null,
      aliases: [activityCode],
      ids: []
    };
  }

  return {
    canonicalCode: legacy.code,
    canonicalNameAr: legacy.name_ar,
    canonicalNameEn: legacy.name_en,
    aliases: [legacy.code],
    ids: [legacy.id]
  };
}

async function resolveInvestmentSectorSelection(supabase, sectorCode) {
  if (!sectorCode) {
    return {
      sector: null,
      canonicalActivityIds: [],
      legacyIds: [],
      canonicalByLegacyId: new Map()
    };
  }

  const { data: sector, error: sectorError } = await supabase
    .from('canonical_investment_sectors')
    .select('id,code,name_ar,name_en')
    .eq('code', sectorCode)
    .eq('is_active', true)
    .maybeSingle();

  if (sectorError) throw sectorError;
  if (!sector) {
    return {
      sector: null,
      canonicalActivityIds: [],
      legacyIds: [],
      canonicalByLegacyId: new Map()
    };
  }

  const { data: mappingRows, error: mappingError } = await supabase
    .from('canonical_activity_investment_sectors')
    .select('canonical_activity_id')
    .eq('sector_id', sector.id)
    .eq('is_primary', true);

  if (mappingError) throw mappingError;

  const canonicalActivityIds = [...new Set(
    (mappingRows || []).map(row => row.canonical_activity_id).filter(Boolean)
  )];

  if (!canonicalActivityIds.length) {
    return {
      sector,
      canonicalActivityIds: [],
      legacyIds: [],
      canonicalByLegacyId: new Map()
    };
  }

  const [aliasesResult, catalogResult] = await Promise.all([
    supabase
      .from('canonical_activity_legacy_aliases')
      .select('canonical_activity_id,legacy_activity_id')
      .in('canonical_activity_id', canonicalActivityIds),
    supabase
      .from('canonical_activity_catalog')
      .select('id,code,name_ar,name_en,aliases')
      .in('id', canonicalActivityIds)
  ]);

  if (aliasesResult.error || catalogResult.error) {
    throw aliasesResult.error || catalogResult.error;
  }

  const canonicalById = new Map(
    (catalogResult.data || []).map(row => [row.id, row])
  );
  const canonicalByLegacyId = new Map();
  const legacyIds = [];

  for (const row of aliasesResult.data || []) {
    if (!row.legacy_activity_id) continue;
    legacyIds.push(row.legacy_activity_id);
    const canonical = canonicalById.get(row.canonical_activity_id);
    if (canonical) canonicalByLegacyId.set(row.legacy_activity_id, canonical);
  }

  return {
    sector,
    canonicalActivityIds,
    legacyIds: [...new Set(legacyIds)],
    canonicalByLegacyId
  };
}

async function loadCountryProfile(supabase, countryCode) {
  if (!countryCode) return null;
  const code = String(countryCode).toUpperCase();
  const { data, error } = await supabase
    .from('country_profiles')
    .select('country_code,name_ar,name_en,currency_code,currency_symbol,locale_ar,locale_en,default_language,timezone,is_supported,is_active,fallback_policy,metadata')
    .eq('country_code', code)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function loadCountryModelOverride(supabase, projectModelId, countryCode) {
  if (!projectModelId || !countryCode) return null;
  const { data, error } = await supabase
    .from('country_model_overrides')
    .select('*')
    .eq('project_model_id', projectModelId)
    .eq('country_code', String(countryCode).toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function handleModelDetail(req, res, path) {
  const match = path.match(/^\/models\/([^\/]+)$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const modelCode = match[1];
  const url = getQuery(req);
  const countryCode = (url.searchParams.get('country') || '').toUpperCase() || null;
  const cityCode = url.searchParams.get('city') || null;

  if (countryCode && !COUNTRY_NAMES[countryCode]) {
    return sendJson(res, 400, { error: 'Invalid country parameter' });
  }

  try {
    const supabase = getSupabaseClient();
    const modelData = await loadProjectModel(supabase, modelCode, cityCode, countryCode);
    sendJson(res, 200, {
      model: modelData.projectModel,
      assumptions: modelData.assumptions,
      risks: modelData.risks,
      countryContext: modelData.countryContext || null
    });
  } catch (err) {
    console.error('[model detail]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleModels(req, res) {
  const url = getQuery(req);
  const sectorCode = url.searchParams.get('sector');
  const subSectorCode = url.searchParams.get('sub_sector');
  const activityCode = url.searchParams.get('activity');
  const cityCode = url.searchParams.get('city');
  const countryCode = (url.searchParams.get('country') || '').toUpperCase() || null;

  if (countryCode && !COUNTRY_NAMES[countryCode]) {
    return sendJson(res, 400, { error: 'Invalid country parameter' });
  }

  const supabase = getSupabaseClient();

  let query = supabase
    .from('project_models')
    .select(`
      *,
      sector:sector_id (code, name_ar, name_en),
      sub_sector:sub_sector_id (code, name_ar, name_en),
      activity:activity_id (code, name_ar, name_en)
    `)
    .eq('is_published', true)
    .eq('is_active', true);

  if (sectorCode) {
    const { data: sector } = await supabase.from('economic_sectors').select('id').eq('code', sectorCode).single();
    if (sector) query = query.eq('sector_id', sector.id);
  }

  if (subSectorCode) {
    const { data: sub } = await supabase.from('economic_sub_sectors').select('id').eq('code', subSectorCode).single();
    if (sub) query = query.eq('sub_sector_id', sub.id);
  }

  if (activityCode) {
    const activitySelection = await resolveActivitySelection(supabase, activityCode);
    if (!activitySelection.ids.length) {
      return sendJson(res, 200, { models: [], city: null, count: 0 });
    }
    query = query.in('activity_id', activitySelection.ids);
  }

  const { data: models, error } = await query.order('name_ar');

  if (error) {
    console.error('[models]', error.message);
    return sendJson(res, 500, { error: 'Failed to load models' });
  }

  let city = null;
  if (cityCode) {
    const { data } = await supabase.from('cities').select('*').eq('code', cityCode).single();
    city = data;
  }

  let countryProfile = null;
  let localizedModels = models || [];

  if (countryCode) {
    countryProfile = await loadCountryProfile(supabase, countryCode);
    const modelIds = localizedModels.map(model => model.id).filter(Boolean);
    let overrides = [];
    if (modelIds.length) {
      const { data, error: overridesError } = await supabase
        .from('country_model_overrides')
        .select('*')
        .eq('country_code', countryCode)
        .in('project_model_id', modelIds);
      if (overridesError) throw overridesError;
      overrides = data || [];
    }
    const byModel = new Map(overrides.map(row => [row.project_model_id, row]));

    localizedModels = localizedModels.map(model => {
      const override = byModel.get(model.id) || null;
      return {
        ...model,
        country_code: countryCode,
        country_currency: countryProfile?.currency_code || null,
        country_model_status: override?.status || 'unverified',
        localized: Boolean(override && ['estimated', 'verified'].includes(override.status)),
        base_currency: model.default_currency,
        country_override: override
      };
    });
  }

  sendJson(res, 200, {
    models: localizedModels,
    city,
    country: countryProfile,
    count: localizedModels.length
  });
}

async function handleGeocode(req, res) {
  const url = getQuery(req);
  const q = url.searchParams.get('q');
  if (!q) return sendJson(res, 400, { error: 'Missing q parameter' });
  try {
    const query = encodeURIComponent(q);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'BondsGlobal/1.0 (contact@bonds-global.com)',
        'Accept-Language': 'ar,en'
      }
    });
    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
    const data = await response.json();
    if (!data || !data[0]) return sendJson(res, 404, { error: 'No results found' });
    return sendJson(res, 200, {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display_name: data[0].display_name
    });
  } catch (err) {
    console.error('[geocode] error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

function loadMasterCatalogCities(countryCode = null) {
  const countries = countryCode
    ? (ARAB_COUNTRIES_GEO[countryCode] ? [ARAB_COUNTRIES_GEO[countryCode]] : [])
    : Object.values(ARAB_COUNTRIES_GEO || {});

  const rows = [];
  for (const country of countries) {
    for (const governorate of country.governorates || []) {
      for (const city of governorate.cities || []) {
        rows.push({
          id: null,
          code: city.code,
          canonical_code: city.code,
          name_ar: city.name,
          name_en: city.nameEn,
          region: governorate.name,
          region_en: governorate.nameEn,
          admin_level_2: null,
          locality_type: 'city',
          country_code: country.code,
          population: null,
          purchasing_power_index: null,
          lat: null,
          lng: null,
          city_types: [],
          catalog_source: 'arab_master_catalog',
          data_available: false
        });
      }
    }
  }
  return rows;
}

function mergeMasterAndDatabaseCities(countryCode, databaseRows = []) {
  const masterRows = loadMasterCatalogCities(countryCode);
  const byCode = new Map(masterRows.map(row => [row.code, row]));

  for (const row of databaseRows || []) {
    for (const aliasCode of row.alias_codes || []) {
      if (aliasCode && aliasCode !== row.code) byCode.delete(aliasCode);
    }
    const current = byCode.get(row.code) || {};
    byCode.set(row.code, {
      ...current,
      ...row,
      canonical_code: row.code || current.canonical_code,
      name_ar: row.name_ar || current.name_ar,
      name_en: row.name_en || current.name_en,
      region: row.region || current.region,
      admin_level_2: row.admin_level_2 || current.admin_level_2 || null,
      locality_type: row.locality_type || current.locality_type || 'city',
      country_code: row.country_code || current.country_code || countryCode,
      catalog_source: current.code ? 'database+arab_master_catalog' : 'database',
      data_available: true
    });
  }

  return [...byCode.values()].sort((a, b) =>
    String(a.name_ar || a.name_en || a.code).localeCompare(
      String(b.name_ar || b.name_en || b.code),
      'ar',
      { sensitivity: 'base' }
    )
  );
}

async function loadCatalogCityRows(supabase, countryCode = null) {
  let legacyQuery = supabase
    .from('cities')
    .select('id, code, geo_place_id, name_ar, name_en, region, admin_level_2, locality_type, country_code, population, purchasing_power_index, lat, lng, city_types')
    .eq('is_active', true)
    .limit(2000);
  if (countryCode) legacyQuery = legacyQuery.eq('country_code', countryCode);

  const { data: legacyRows, error: legacyError } = await legacyQuery;
  if (legacyError) throw legacyError;

  // Country listing is intentionally cheap. Canonical supplemental places are
  // loaded only after a country is selected, avoiding a full-world place scan.
  if (!countryCode) return legacyRows || [];

  const pageSize = 1000;
  const geoRows = [];
  for (let from = 0; ; from += pageSize) {
    const { data: page, error: geoError } = await supabase
      .from('geo_places')
      .select('id,canonical_code,country_code,admin1_id,admin2_id,name_ar,name_en,place_type,lat,lng,population,confidence')
      .eq('country_code', countryCode)
      .eq('is_active', true)
      .eq('is_canonical', true)
      .range(from, from + pageSize - 1);
    if (geoError) throw geoError;
    geoRows.push(...(page || []));
    if (!page || page.length < pageSize) break;
    if (geoRows.length >= 20000) {
      console.warn('[catalog/cities] canonical geo page cap reached for', countryCode);
      break;
    }
  }

  const linkedGeoIds = new Set((legacyRows || []).map(row => row.geo_place_id).filter(Boolean));
  const supplemental = geoRows.filter(row => !linkedGeoIds.has(row.id));

  const adminIds = [...new Set(supplemental.flatMap(row => [row.admin1_id, row.admin2_id]).filter(Boolean))];
  let adminById = new Map();
  if (adminIds.length) {
    const { data: adminRows, error: adminError } = await supabase
      .from('geo_admin_areas')
      .select('id,name_ar,name_en,admin_level')
      .in('id', adminIds);
    if (adminError) throw adminError;
    adminById = new Map((adminRows || []).map(row => [row.id, row]));
  }

  const geoCatalogRows = supplemental.map(place => {
    const admin1 = adminById.get(place.admin1_id) || null;
    const admin2 = adminById.get(place.admin2_id) || null;
    return {
      id: place.id,
      code: place.canonical_code,
      geo_place_id: place.id,
      name_ar: place.name_ar,
      name_en: place.name_en,
      region: admin1?.name_ar || admin1?.name_en || null,
      region_en: admin1?.name_en || admin1?.name_ar || null,
      admin_level_2: admin2?.name_ar || admin2?.name_en || null,
      locality_type: place.place_type || 'other',
      country_code: place.country_code,
      population: place.population,
      purchasing_power_index: null,
      lat: place.lat,
      lng: place.lng,
      city_types: [],
      geo_confidence: place.confidence,
      catalog_source: 'geo_places'
    };
  });

  const geoById = new Map(geoRows.map(place => [place.id, place]));
  const enrichedLegacyRows = (legacyRows || []).map(row => {
    const place = row.geo_place_id ? geoById.get(row.geo_place_id) : null;
    if (!place) return row;

    const rowHasCoords =
      row.lat !== null && row.lat !== undefined &&
      row.lng !== null && row.lng !== undefined;
    const placeHasCoords =
      place.lat !== null && place.lat !== undefined &&
      place.lng !== null && place.lng !== undefined;

    if (rowHasCoords || !placeHasCoords) return row;
    return {
      ...row,
      lat: place.lat,
      lng: place.lng,
      geo_confidence: place.confidence,
      coordinate_source: 'geo_places'
    };
  });

  return [...enrichedLegacyRows, ...geoCatalogRows];
}

async function handleCatalogCountries(req, res) {
  try {
    const supabase = getSupabaseClient();
    const rows = await loadCatalogCityRows(supabase);
    const canonicalDatabaseCities = canonicalizeCities(rows);
    const databaseCounts = {};
    for (const city of canonicalDatabaseCities) {
      databaseCounts[city.country_code] = (databaseCounts[city.country_code] || 0) + 1;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('country_profiles')
      .select('country_code,currency_code,currency_symbol,locale_ar,locale_en,timezone,fallback_policy,is_supported,is_active');
    if (profileError) throw profileError;
    const profilesByCode = new Map((profileRows || []).map(row => [row.country_code, row]));

    const countries = Object.entries(COUNTRY_NAMES).map(([code, names]) => {
      const countryDbRows = canonicalDatabaseCities.filter(city => city.country_code === code);
      const mergedCount = mergeMasterAndDatabaseCities(code, countryDbRows).length;
      const profile = profilesByCode.get(code) || null;
      return {
        code,
        name_ar: names.ar,
        name_en: names.en,
        flag: ARAB_COUNTRIES_GEO[code]?.flag || null,
        currency_code: profile?.currency_code || null,
        currency_symbol: profile?.currency_symbol || null,
        locale_ar: profile?.locale_ar || `ar-${code}`,
        locale_en: profile?.locale_en || `en-${code}`,
        timezone: profile?.timezone || null,
        fallback_policy: profile?.fallback_policy || 'no_cross_country_fallback',
        is_supported: profile?.is_supported !== false,
        cityCount: mergedCount,
        dataCityCount: databaseCounts[code] || 0,
        recordStatus: databaseCounts[code] ? 'data_available' : 'catalog_only'
      };
    }).sort((a, b) => {
      if (a.code === 'SA') return -1;
      if (b.code === 'SA') return 1;
      return a.name_ar.localeCompare(b.name_ar, 'ar');
    });

    return sendJson(res, 200, {
      countries,
      count: countries.length,
      source: 'arab_master_catalog+canonical_registry'
    });
  } catch (err) {
    console.error('[catalog/countries]', err.message);
    return sendJson(res, 500, { error: 'Failed to load country catalog' });
  }
}

async function handleCatalogActivities(req, res) {
  const url = getQuery(req);
  const countryCode = (url.searchParams.get('country') || '').toUpperCase() || null;

  if (countryCode && !COUNTRY_NAMES[countryCode]) {
    return sendJson(res, 400, { error: 'Invalid country parameter' });
  }

  try {
    const supabase = getSupabaseClient();

    // Durable path: canonical identities are persisted in the database and
    // legacy activity rows are aliases/context, not separate dropdown entries.
    const { data: canonicalRows, error: canonicalError } = await supabase
      .from('canonical_activity_catalog')
      .select('id,code,name_ar,name_en,description,is_active,sort_order,aliases,sector_codes,sub_sector_codes,legacy_count,sub_sector_count')
      .order('sort_order')
      .order('name_ar');

    if (!canonicalError && canonicalRows) {
      let countryCoverage = new Map();
      let countryProfile = null;
      if (countryCode) {
        countryProfile = await loadCountryProfile(supabase, countryCode);
        const { data: coverageRows, error: coverageError } = await supabase
          .from('canonical_activity_country')
          .select('canonical_activity_id,availability_status,classification_system,classification_code,classification_label,regulatory_status,source,source_url,confidence')
          .eq('country_code', countryCode);
        if (coverageError) throw coverageError;
        countryCoverage = new Map((coverageRows || []).map(row => [row.canonical_activity_id, row]));
      }

      const activities = canonicalRows.map(row => ({
        id: row.id,
        code: row.code,
        canonical_code: row.code,
        name_ar: row.name_ar,
        name_en: row.name_en,
        description: row.description,
        aliases: row.aliases || [],
        sector_codes: row.sector_codes || [],
        sub_sector_codes: row.sub_sector_codes || [],
        alias_count: Math.max(0, Number(row.legacy_count || 0) - 1),
        applicability_count: Number(row.sub_sector_count || 0),
        is_active: row.is_active !== false,
        recordStatus: row.is_active === false ? 'inactive' : (row.name_ar ? 'complete' : 'incomplete'),
        warnings: row.name_ar ? [] : ['missing_activity_name'],
        country: countryCode ? {
          code: countryCode,
          currency_code: countryProfile?.currency_code || null,
          ...(countryCoverage.get(row.id) || {
            availability_status: 'unknown',
            regulatory_status: 'unknown'
          })
        } : null
      }));

      const rawCount = activities.reduce((sum, row) => sum + Math.max(1, Number(row.aliases?.length || 0)), 0);
      return sendJson(res, 200, {
        activities,
        count: activities.length,
        rawCount,
        duplicatesCollapsed: Math.max(0, rawCount - activities.length),
        country: countryCode || null,
        source: 'canonical_activity_catalog'
      });
    }

    // Compatibility fallback for deployments where the additive migration has
    // not reached the database yet.
    const { data: sectors, error } = await supabase
      .from('economic_sectors')
      .select(`
        code, name_ar, name_en, is_active,
        economic_sub_sectors (
          code, name_ar, name_en, is_active,
          economic_activities (
            id, code, name_ar, name_en, is_active, sort_order
          )
        )
      `)
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;

    const flat = [];
    for (const sector of sectors || []) {
      for (const sub of sector.economic_sub_sectors || []) {
        if (sub.is_active === false) continue;
        for (const activity of sub.economic_activities || []) {
          if (activity.is_active === false) continue;
          flat.push({
            ...activity,
            sector_code: sector.code,
            sector_name_ar: sector.name_ar,
            sub_sector_code: sub.code,
            sub_sector_name_ar: sub.name_ar
          });
        }
      }
    }

    const activities = canonicalizeActivities(flat);
    return sendJson(res, 200, {
      activities,
      count: activities.length,
      rawCount: flat.length,
      duplicatesCollapsed: Math.max(0, flat.length - activities.length),
      source: 'canonical_registry_fallback'
    });
  } catch (err) {
    console.error('[catalog/activities]', err.message);
    return sendJson(res, 500, { error: 'Failed to load activity catalog' });
  }
}

async function handleCatalogYears(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const url = getQuery(req);
  const countryCode = (url.searchParams.get('country') || '').toUpperCase();
  const cityCode = url.searchParams.get('city');
  const activityCode = url.searchParams.get('activity');

  if (countryCode && !COUNTRY_NAMES[countryCode]) {
    return sendJson(res, 400, { error: 'Invalid country parameter' });
  }

  try {
    const supabase = getSupabaseClient();
    const sourceYears = new Set();
    const legacyYears = new Set();

    let cityIds = [];
    if (cityCode) {
      const { data: city, error } = await supabase
        .from('cities')
        .select('id,country_code')
        .eq('code', cityCode)
        .maybeSingle();
      if (error) throw error;
      if (city?.id) cityIds = [city.id];
    } else if (countryCode) {
      const { data: cityRows, error } = await supabase
        .from('cities')
        .select('id')
        .eq('country_code', countryCode)
        .limit(2000);
      if (error) throw error;
      cityIds = (cityRows || []).map(row => row.id);
    }

    let activityIds = [];
    if (activityCode) {
      const activitySelection = await resolveActivitySelection(supabase, activityCode);
      activityIds = activitySelection.ids;

      if (!activityIds.length) {
        return sendJson(res, 200, {
          years: [],
          latest: null,
          sourceYears: [],
          legacyYears: [],
          sourceBacked: false,
          fallbackToLegacy: false,
          count: 0,
          country: countryCode || null,
          city: cityCode || null,
          activity: activityCode,
          generatedAt: new Date().toISOString()
        });
      }
    }

    if (cityIds.length) {
      const [{ data: indicators }, { data: normalized }] = await Promise.all([
        supabase.from('city_indicators').select('year').in('city_id', cityIds).limit(5000),
        supabase
          .from('normalized_metrics')
          .select('year,source_url,source_id,metadata')
          .in('city_id', cityIds)
          .limit(5000)
      ]);

      for (const row of indicators || []) {
        const year = Number(row.year);
        if (Number.isInteger(year)) legacyYears.add(year);
      }

      for (const row of normalized || []) {
        const year = Number(row.year);
        if (!Number.isInteger(year)) continue;
        const quality = String(row.metadata?.dataQuality || '').toLowerCase();
        const observed = row.metadata?.observationKind === 'observed' ||
          (row.metadata?.estimated !== true && Boolean(row.source_url) &&
            ['official', 'open_data'].includes(quality));
        if (observed) sourceYears.add(year);
        else legacyYears.add(year);
      }

      let marketQuery = supabase
        .from('city_market_data')
        .select('data_year,source')
        .in('city_id', cityIds)
        .limit(5000);
      if (activityIds.length) marketQuery = marketQuery.in('activity_id', activityIds);
      const { data: marketRows } = await marketQuery;
      for (const row of marketRows || []) {
        const year = Number(row.data_year);
        if (Number.isInteger(year)) legacyYears.add(year);
      }
    }

    if (countryCode) {
      async function loadCountryYearRows() {
        const { data } = await supabase
          .from('country_indicator_observations')
          .select('year,fetched_at')
          .eq('country_code', countryCode)
          .limit(1000);
        return data || [];
      }

      let countryRows = await loadCountryYearRows();
      const newestFetchMs = countryRows
        .map(row => row.fetched_at ? Date.parse(row.fetched_at) : NaN)
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0] || 0;
      const cacheAgeMs = newestFetchMs ? Date.now() - newestFetchMs : Infinity;
      const uniqueCountryYears = new Set(countryRows.map(row => row.year)).size;

      if (!countryRows.length || uniqueCountryYears === 0 || cacheAgeMs > 6 * 60 * 60 * 1000) {
        try {
          const engine = new CountryIndicatorEngine({ timeoutMs: 12000 });
          await engine.refresh(supabase, {
            countryCodes: [countryCode],
            runType: 'incremental'
          });
          countryRows = await loadCountryYearRows();
        } catch (refreshErr) {
          console.warn('[catalog-years refresh]', countryCode, refreshErr.message);
        }
      }

      for (const row of countryRows) {
        const year = Number(row.year);
        if (Number.isInteger(year)) sourceYears.add(year);
      }
    }

    const verified = [...sourceYears].filter(year => year >= 1900 && year <= 2200).sort((a, b) => b - a);
    const legacy = [...legacyYears].filter(year => year >= 1900 && year <= 2200).sort((a, b) => b - a);
    const years = verified.length ? verified : legacy;

    return sendJson(res, 200, {
      years,
      latest: years[0] || null,
      sourceYears: verified,
      legacyYears: legacy,
      sourceBacked: verified.length > 0,
      fallbackToLegacy: verified.length === 0 && legacy.length > 0,
      count: years.length,
      country: countryCode || null,
      city: cityCode || null,
      activity: activityCode || null,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[catalog/years]', err.message);
    return sendJson(res, 500, { error: 'Failed to load available years' });
  }
}

async function handleCatalogCities(req, res) {
  const url = getQuery(req);
  const countryCode = url.searchParams.get('country');
  const activityCodes = (url.searchParams.get('activity_codes') || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  const yearParam = url.searchParams.get('year') || 'latest';

  if (!countryCode || !COUNTRY_NAMES[countryCode]) {
    return sendJson(res, 400, { error: 'Valid country parameter is required' });
  }

  try {
    const supabase = getSupabaseClient();
    const rawCities = await loadCatalogCityRows(supabase, countryCode);
    const databaseCities = canonicalizeCities(rawCities).map(city => ({
      ...city,
      // A canonical geo record is discoverable geography, not proof that
      // city-level market/evidence data exists. Keep these concepts separate.
      data_available: city.catalog_source === 'geo_places' ? false : true,
      geo_available: Boolean(city.geo_place_id),
      catalog_source: city.catalog_source || 'database'
    }));
    let catalogCities = mergeMasterAndDatabaseCities(countryCode, databaseCities);

    if (activityCodes.length && rawCities.length) {
      const activitySelections = await Promise.all(
        activityCodes.map(code => resolveActivitySelection(supabase, code))
      );
      const activityIds = [...new Set(
        activitySelections.flatMap(selection => selection.ids || []).filter(Boolean)
      )];
      const rawIdToCanonical = new Map();
      const rawIdToCode = new Map(rawCities.map(city => [city.id, city.code]));
      for (const city of databaseCities) {
        if (city.id) rawIdToCanonical.set(city.id, city.canonical_code);
        for (const alias of city.aliases || []) {
          if (alias.id) rawIdToCanonical.set(alias.id, city.canonical_code);
        }
      }

      const availability = new Map();
      if (activityIds.length) {
        let marketQuery = supabase
          .from('city_market_data')
          .select('city_id, activity_id, data_year, opportunity_score, confidence')
          .in('activity_id', activityIds)
          .in('city_id', rawCities.map(city => city.id));

        if (/^\d{4}$/.test(yearParam)) {
          marketQuery = marketQuery.eq('data_year', Number(yearParam));
        }

        const { data: marketRows, error: marketError } = await marketQuery;
        if (marketError) throw marketError;

        let effectiveRows = marketRows || [];
        if (yearParam === 'latest' && effectiveRows.length) {
          const latestYear = Math.max(...effectiveRows.map(row => Number(row.data_year) || 0));
          effectiveRows = effectiveRows.filter(row => Number(row.data_year) === latestYear);
        }

        for (const row of effectiveRows) {
          const canonicalCode = rawIdToCanonical.get(row.city_id);
          if (!canonicalCode) continue;
          const current = availability.get(canonicalCode);
          const next = {
            dataYear: row.data_year,
            opportunityScore: row.opportunity_score,
            confidence: row.confidence,
            comparisonCode: rawIdToCode.get(row.city_id) || canonicalCode
          };
          if (!current || Number(next.confidence || 0) > Number(current.confidence || 0)) {
            availability.set(canonicalCode, next);
          }
        }
      }

      catalogCities = catalogCities.map(city => ({
        ...city,
        comparison_code: availability.get(city.canonical_code)?.comparisonCode || city.canonical_code,
        activityAvailability: availability.get(city.canonical_code) || null
      }));
    } else {
      catalogCities = catalogCities.map(city => ({
        ...city,
        comparison_code: city.comparison_code || city.canonical_code,
        activityAvailability: null
      }));
    }

    return sendJson(res, 200, {
      cities: catalogCities,
      count: catalogCities.length,
      dataCount: catalogCities.filter(city => city.data_available).length,
      rawCount: rawCities.length,
      country: {
        code: countryCode,
        name_ar: COUNTRY_NAMES[countryCode].ar,
        name_en: COUNTRY_NAMES[countryCode].en
      },
      source: 'arab_master_catalog+canonical_registry'
    });
  } catch (err) {
    console.error('[catalog/cities]', err.message);
    return sendJson(res, 500, { error: 'Failed to load city catalog' });
  }
}

async function handleGeoSiteIntelligence(req, res) {
  const url = getQuery(req);
  const code = (url.searchParams.get('code') || '').trim();
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const country = (url.searchParams.get('country') || '').trim().toUpperCase() || null;
  const supabase = getSupabaseClient();

  try {
    let place = null;

    if (code) {
      const { data, error } = await supabase
        .from('geo_places')
        .select('id,canonical_code,country_code,name_ar,name_en,place_type,lat,lng,population,elevation_m,source_code,confidence')
        .eq('canonical_code', code)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      place = data || null;
    } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const { data, error } = await supabase.rpc('geo_nearest_place', {
        p_lat: lat,
        p_lng: lng,
        p_country_code: country,
        p_limit: 1
      });
      if (error) throw error;
      const nearest = data?.[0] || null;
      if (nearest?.id) {
        const { data: full, error: fullError } = await supabase
          .from('geo_places')
          .select('id,canonical_code,country_code,name_ar,name_en,place_type,lat,lng,population,elevation_m,source_code,confidence')
          .eq('id', nearest.id)
          .maybeSingle();
        if (fullError) throw fullError;
        place = full ? { ...full, distance_m: nearest.distance_m } : null;
      }
    } else {
      return sendJson(res, 400, { error: 'code or valid lat/lng is required' });
    }

    if (!place) return sendJson(res, 404, { error: 'Geo place not found' });

    const { data: features, error: featureError } = await supabase
      .from('geo_place_features')
      .select('*')
      .eq('place_id', place.id)
      .maybeSingle();
    if (featureError) throw featureError;

    const result = calculateSiteIntelligence(place, features || {});
    if (place.distance_m !== undefined) result.distance_m = Number(place.distance_m);
    result.place = {
      name_ar: place.name_ar || null,
      name_en: place.name_en || null,
      source_code: place.source_code || null,
      confidence: place.confidence ?? null
    };

    return sendJson(res, 200, result);
  } catch (err) {
    console.error('[geo/site-intelligence]', err.message);
    return sendJson(res, 500, { error: 'Failed to calculate local geo intelligence' });
  }
}


async function enrichCitiesWithGeoCoordinates(supabase, rows = []) {
  const linkedIds = [...new Set((rows || []).map(row => row.geo_place_id).filter(Boolean))];
  if (!linkedIds.length) return rows || [];

  const { data: places, error } = await supabase
    .from('geo_places')
    .select('id,lat,lng,confidence,source_code,source_updated_at')
    .in('id', linkedIds);

  if (error) {
    console.warn('[geo-coordinate-fallback]', error.message);
    return rows || [];
  }

  const byId = new Map((places || []).map(place => [place.id, place]));
  return (rows || []).map(row => {
    const place = byId.get(row.geo_place_id);
    if (!place) return row;

    const rowHasCoords =
      row.lat !== null && row.lat !== undefined &&
      row.lng !== null && row.lng !== undefined;

    const placeHasCoords =
      place.lat !== null && place.lat !== undefined &&
      place.lng !== null && place.lng !== undefined;

    if (rowHasCoords || !placeHasCoords) return row;

    return {
      ...row,
      lat: place.lat,
      lng: place.lng,
      geo_confidence: place.confidence,
      coordinate_source: place.source_code || 'geo_places',
      coordinate_source_updated_at: place.source_updated_at || null
    };
  });
}

async function handleCities(req, res) {
  const url = getQuery(req);
  const include = url.searchParams.get('include') || '';
  const countryCode = url.searchParams.get('country');
  const activityCode = url.searchParams.get('activity');
  const minScore = url.searchParams.get('min_score');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '2000', 10), 2000);

  const supabase = getSupabaseClient();

  const cityTypeParam = url.searchParams.get('city_type');

  let selectFields = 'id, code, geo_place_id, name_ar, name_en, region, admin_level_2, locality_type, country_code, population, purchasing_power_index, lat, lng, city_types';
  let query = supabase.from('cities').select(selectFields).eq('is_active', true);

  if (countryCode) query = query.eq('country_code', countryCode);
  if (cityTypeParam) {
    const requestedTypes = cityTypeParam.split(',').map(t => t.trim()).filter(Boolean);
    if (requestedTypes.length > 0) {
      query = query.overlaps('city_types', requestedTypes);
    }
  }
  query = query.order('name_ar').limit(limit);

  const { data: cities, error } = await query;
  if (error) {
    console.error('[cities]', error.message);
    return sendJson(res, 500, { error: 'Failed to load cities' });
  }

  let enriched = await enrichCitiesWithGeoCoordinates(supabase, cities || []);

  if (include.includes('opportunity') && activityCode) {
    const activitySelection = await resolveActivitySelection(supabase, activityCode);

    if (activitySelection.ids.length) {
      let year = parseInt(url.searchParams.get('year') || new Date().getFullYear(), 10);

      // If year=latest, resolve the most recent data_year across all aliases of
      // the canonical activity.
      if (url.searchParams.get('year') === 'latest') {
        const { data: latestRows } = await supabase
          .from('city_market_data')
          .select('data_year')
          .in('activity_id', activitySelection.ids)
          .order('data_year', { ascending: false })
          .limit(1);
        year = latestRows?.[0]?.data_year || new Date().getFullYear();
      }

      const cityIds = enriched.map(c => c.id);

      const { data: marketRows, error: marketError } = await supabase
        .from('city_market_data')
        .select('city_id, opportunity_score, opportunity_rank, market_size, competitors_count, market_saturation_score, avg_salary, expected_demand, confidence, currency_code')
        .in('activity_id', activitySelection.ids)
        .eq('data_year', year)
        .in('city_id', cityIds);

      if (!marketError && marketRows) {
        const marketMap = new Map();
        for (const row of marketRows) {
          const existing = marketMap.get(row.city_id);
          if (!existing || Number(row.confidence || 0) > Number(existing.confidence || 0)) {
            marketMap.set(row.city_id, row);
          }
        }
        enriched = enriched.map(city => {
          const market = marketMap.get(city.id) || null;
          const includeCity = minScore && market
            ? Number(market.opportunity_score) >= Number(minScore)
            : true;
          if (!includeCity) return null;
          return {
            ...city,
            opportunity: market
              ? {
                  score: market.opportunity_score,
                  rank: market.opportunity_rank,
                  marketSize: market.market_size,
                  competitorsCount: market.competitors_count,
                  saturation: market.market_saturation_score,
                  avgSalary: market.avg_salary,
                  expectedDemand: market.expected_demand,
                  confidence: market.confidence,
                  currencyCode: market.currency_code || null
                }
              : null
          };
        }).filter(Boolean);
      }
    }
  }

  sendJson(res, 200, { cities: enriched });
}

async function handleOpportunitiesTop(req, res) {
  const url = getQuery(req);
  const countryCode = url.searchParams.get('country');
  const sectorCode = url.searchParams.get('sector');
  const activityCode = url.searchParams.get('activity');
  const minScoreParam = url.searchParams.get('min_score');
  const minDecisionScore = Number.isFinite(Number(minScoreParam)) ? Number(minScoreParam) : null;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1), 100);
  const candidateLimit = Math.min(Math.max(limit * 20, 200), 1000);
  const requestedYear = url.searchParams.get('year');
  const isLatest = requestedYear === 'latest';
  const fallbackYear = resolveOpportunityYear(requestedYear);
  const supabase = getSupabaseClient();
  const [activitySelection, sectorSelection] = await Promise.all([
    activityCode
      ? resolveActivitySelection(supabase, activityCode)
      : Promise.resolve({ canonicalCode: null, canonicalNameAr: null, canonicalNameEn: null, aliases: [], ids: [] }),
    sectorCode
      ? resolveInvestmentSectorSelection(supabase, sectorCode)
      : Promise.resolve({ sector: null, canonicalActivityIds: [], legacyIds: [], canonicalByLegacyId: new Map() })
  ]);

  if (activityCode && !activitySelection.ids.length) {
    return sendJson(res, 200, {
      opportunities: [],
      count: 0,
      rankingBasis: 'decision_score',
      minScoreBasis: 'decision_score'
    });
  }

  if (sectorCode && !sectorSelection.sector) {
    return sendJson(res, 200, {
      opportunities: [],
      count: 0,
      rankingBasis: 'decision_score',
      minScoreBasis: 'decision_score'
    });
  }

  let filteredActivityIds = [];
  if (activityCode && sectorCode) {
    const sectorIds = new Set(sectorSelection.legacyIds);
    filteredActivityIds = activitySelection.ids.filter(id => sectorIds.has(id));
    if (!filteredActivityIds.length) {
      return sendJson(res, 200, {
        opportunities: [],
        count: 0,
        rankingBasis: 'decision_score',
        minScoreBasis: 'decision_score'
      });
    }
  } else if (activityCode) {
    filteredActivityIds = activitySelection.ids;
  } else if (sectorCode) {
    filteredActivityIds = sectorSelection.legacyIds;
    if (!filteredActivityIds.length) {
      return sendJson(res, 200, {
        opportunities: [],
        count: 0,
        rankingBasis: 'decision_score',
        minScoreBasis: 'decision_score'
      });
    }
  }

  function buildOpportunitiesQuery(yearCondition, filters = {}) {
    let q = supabase
      .from('city_market_data')
      .select('*, cities!inner(*), economic_activities!inner(code, name_ar, name_en)')
      .not('opportunity_score', 'is', null);

    if (yearCondition === 'exact') {
      q = q.eq('data_year', fallbackYear);
    } else {
      q = q.lte('data_year', fallbackYear);
    }

    if (filters.countryCode) q = q.eq('cities.country_code', filters.countryCode);
    if (filters.activityIds?.length) q = q.in('activity_id', filters.activityIds);

    return q
      .order('data_year', { ascending: false })
      .order('opportunity_score', { ascending: false })
      .limit(candidateLimit);
  }

  async function tryQuery(filters) {
    if (isLatest) {
      const { data, error } = await buildOpportunitiesQuery('latest', filters);
      return { data, error };
    }
    let { data, error } = await buildOpportunitiesQuery('exact', filters);
    if (!error && (!data || data.length === 0)) {
      ({ data, error } = await buildOpportunitiesQuery('latest', filters));
    }
    return { data, error };
  }

  let { data, error } = await tryQuery({ countryCode, activityIds: filteredActivityIds });

  if (error) {
    console.error('[opportunities/top]', error.message);
    return sendJson(res, 500, { error: 'Failed to load opportunities' });
  }

  // For latest/fallback queries, keep only the newest row for each city/activity
  // before ranking. This prevents older snapshots from competing with current data.
  const latestRows = [];
  const seen = new Set();
  for (const row of data || []) {
    const sectorCanonical = sectorSelection.canonicalByLegacyId.get(row.activity_id) || null;
    const activityIdentity = activityCode
      ? (activitySelection.canonicalCode || activityCode)
      : (sectorCanonical?.code || row.economic_activities?.code || row.activity_id || 'activity');
    const key = `${row.city_id || row.cities?.id || 'city'}:${activityIdentity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latestRows.push({ ...row, _sectorCanonical: sectorCanonical });
  }

  const opportunityCities = await enrichCitiesWithGeoCoordinates(
    supabase,
    latestRows.map(row => row.cities).filter(Boolean)
  );
  const opportunityCityById = new Map(opportunityCities.map(city => [city.id, city]));

  const assessed = latestRows.map(row => {
    const reliability = assessOpportunityRow(row);
    return {
      city: opportunityCityById.get(row.cities?.id) || row.cities,
      activity: activityCode
        ? {
            ...(row.economic_activities || {}),
            code: activitySelection.canonicalCode || activityCode,
            name_ar: activitySelection.canonicalNameAr || row.economic_activities?.name_ar,
            name_en: activitySelection.canonicalNameEn || row.economic_activities?.name_en,
            aliases: activitySelection.aliases
          }
        : row._sectorCanonical
          ? {
              ...(row.economic_activities || {}),
              code: row._sectorCanonical.code,
              name_ar: row._sectorCanonical.name_ar || row.economic_activities?.name_ar,
              name_en: row._sectorCanonical.name_en || row.economic_activities?.name_en,
              aliases: row._sectorCanonical.aliases || []
            }
          : row.economic_activities,
      score: row.opportunity_score,
      rawScore: reliability.rawPotential,
      decisionScore: reliability.decisionScore,
      reliability: reliability.reliability,
      reliabilityBand: reliability.reliabilityBand,
      scoringCoverage: reliability.scoringCoverage,
      scoringCoverageSource: reliability.scoringCoverageSource,
      decisionStatus: reliability.decisionStatus,
      uncertainty: reliability.uncertainty,
      sourceType: reliability.sourceType,
      warnings: reliability.warnings,
      rawRank: row.opportunity_rank,
      breakdown: row.opportunity_breakdown,
      marketSize: row.market_size,
      competitorsCount: row.competitors_count,
      saturation: row.market_saturation_score,
      growthRate: row.annual_growth_rate,
      confidence: row.confidence,
      avgSalary: row.avg_salary,
      currencyCode: row.currency_code || null,
      expectedDemand: row.expected_demand,
      dataYear: row.data_year
    };
  });

  const ranked = assessed
    .filter(item => minDecisionScore === null || item.decisionScore >= minDecisionScore)
    .sort((a, b) =>
      b.decisionScore - a.decisionScore ||
      b.reliability - a.reliability ||
      b.rawScore - a.rawScore
    )
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      decisionRank: index + 1
    }));

  sendJson(res, 200, {
    opportunities: ranked,
    count: ranked.length,
    rankingBasis: 'decision_score',
    minScoreBasis: 'decision_score'
  });
}

async function handleCountryContext(req, res, path) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const match = path.match(/^\/countries\/([^\/]+)\/context$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const countryCode = match[1].toUpperCase();
  if (!COUNTRY_NAMES[countryCode]) return sendJson(res, 404, { error: 'Country not found' });

  const url = getQuery(req);
  const requestedYear = url.searchParams.get('year') || 'latest';
  const supabase = getSupabaseClient();

  const countryProfile = await loadCountryProfile(supabase, countryCode);
  const [
    { count: activityCount },
    { count: localizedActivityCount },
    { count: unknownActivityCount },
    { count: sourcedActivityCount },
    { count: estimatedModelCount },
    { count: verifiedModelCount },
    { count: unverifiedModelCount },
    { count: regulationCount },
    { count: verifiedRegulationCount }
  ] = await Promise.all([
    supabase.from('canonical_activity_country').select('*', { count: 'exact', head: true }).eq('country_code', countryCode),
    supabase.from('canonical_activity_country').select('*', { count: 'exact', head: true }).eq('country_code', countryCode).neq('availability_status', 'unknown'),
    supabase.from('canonical_activity_country').select('*', { count: 'exact', head: true }).eq('country_code', countryCode).eq('availability_status', 'unknown'),
    supabase.from('canonical_activity_country').select('*', { count: 'exact', head: true }).eq('country_code', countryCode).not('source', 'is', null),
    supabase.from('country_model_overrides').select('*', { count: 'exact', head: true }).eq('country_code', countryCode).eq('status', 'estimated'),
    supabase.from('country_model_overrides').select('*', { count: 'exact', head: true }).eq('country_code', countryCode).eq('status', 'verified'),
    supabase.from('country_model_overrides').select('*', { count: 'exact', head: true }).eq('country_code', countryCode).eq('status', 'unverified'),
    supabase.from('country_regulatory_requirements').select('*', { count: 'exact', head: true }).eq('country_code', countryCode),
    supabase.from('country_regulatory_requirements').select('*', { count: 'exact', head: true }).eq('country_code', countryCode).eq('verification_status', 'verified')
  ]);

  async function loadObservationRows() {
    try {
      let query = supabase
        .from('country_indicator_observations')
        .select('metric_code,year,value,unit,source_id,source_name,source_url,observed_at,fetched_at,confidence,geographic_scope,metadata')
        .eq('country_code', countryCode)
        .order('year', { ascending: false })
        .order('fetched_at', { ascending: false })
        .limit(200);

      if (/^\d{4}$/.test(requestedYear)) query = query.eq('year', Number(requestedYear));
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    } catch (_) {
      return [];
    }
  }

  let observationRows = await loadObservationRows();

  // Self-heal an empty/stale latest cache on demand. We use fetched_at for cache
  // freshness, not observed_at, because some countries' newest official release
  // is legitimately old and must still be represented as their latest available data.
  if (requestedYear === 'latest') {
    const newestFetchMs = observationRows
      .map(row => row.fetched_at ? Date.parse(row.fetched_at) : NaN)
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0] || 0;
    const cacheAgeMs = newestFetchMs ? Date.now() - newestFetchMs : Infinity;
    const uniqueMetricCount = new Set(observationRows.map(row => row.metric_code)).size;
    const incompleteCoverage = uniqueMetricCount < 3;
    if (!observationRows.length || incompleteCoverage || cacheAgeMs > 6 * 60 * 60 * 1000) {
      try {
        const engine = new CountryIndicatorEngine({ timeoutMs: 12000 });
        await engine.refresh(supabase, {
          countryCodes: [countryCode],
          runType: 'incremental'
        });
        observationRows = await loadObservationRows();
      } catch (refreshErr) {
        console.warn('[country-context refresh]', countryCode, refreshErr.message);
      }
    }
  }

  if (requestedYear === 'latest' && observationRows.length) {
    const latestByMetric = new Map();
    for (const row of observationRows) {
      if (!latestByMetric.has(row.metric_code)) latestByMetric.set(row.metric_code, row);
    }
    observationRows = [...latestByMetric.values()];
  }

  const countryFreshnessSlaDays = {
    inflation_rate: 365,
    interest_rate: 180,
    economic_growth_rate: 730,
    unemployment_rate: 730,
    population_total: 730,
    gdp_per_capita_usd: 730,
    fdi_net_inflows_pct_gdp: 730
  };
  const nowMs = Date.now();

  const metrics = observationRows.map(row => {
    const observedMs = row.observed_at ? Date.parse(row.observed_at) : NaN;
    const ageDays = Number.isFinite(observedMs) ? Math.max(0, Math.floor((nowMs - observedMs) / 86400000)) : null;
    const freshnessSlaDays = Number(countryFreshnessSlaDays[row.metric_code] || 730);
    return {
      metric: row.metric_code,
      value: Number(row.value),
      unit: row.unit || null,
      source: row.source_name || row.source_id,
      source_url: row.source_url || null,
      observed_at: row.observed_at || (row.year ? String(row.year) : null),
      fetched_at: row.fetched_at || null,
      confidence: row.confidence ?? null,
      geographic_scope: 'country',
      country_code: countryCode,
      year: row.year,
      age_days: ageDays,
      freshness_sla_days: freshnessSlaDays,
      freshness_status: ageDays == null ? 'unknown' : (ageDays > freshnessSlaDays ? 'stale' : 'fresh'),
      metadata: row.metadata || {}
    };
  });

  metrics.sort((a, b) => String(a.metric).localeCompare(String(b.metric)));

  return sendJson(res, 200, {
    country: {
      code: countryCode,
      ...COUNTRY_NAMES[countryCode],
      ...(countryProfile || {})
    },
    coverage: {
      canonical_activities: activityCount || 0,
      localized_activities: localizedActivityCount || 0,
      activities_unknown: unknownActivityCount || 0,
      activities_sourced: sourcedActivityCount || 0,
      localized_models: (estimatedModelCount || 0) + (verifiedModelCount || 0),
      models_estimated: estimatedModelCount || 0,
      models_verified: verifiedModelCount || 0,
      models_unverified: unverifiedModelCount || 0,
      regulations: regulationCount || 0,
      regulations_verified: verifiedRegulationCount || 0,
      macro_metrics: metrics.length,
      gaps: [
        ...(unknownActivityCount ? ['activity_country_verification'] : []),
        ...(unverifiedModelCount ? ['financial_model_localization'] : []),
        ...(!regulationCount ? ['country_regulations'] : []),
        ...(metrics.length < 6 ? ['macro_indicator_coverage'] : [])
      ]
    },
    metrics,
    count: metrics.length,
    scope: 'country',
    requestedYear,
    years: [...new Set(metrics.map(row => Number(row.year)).filter(Number.isFinite))].sort((a,b)=>b-a),
    label: 'latest_available_external_context'
  });
}

async function resolveLatestSourceBackedCityYear(supabase, cityId) {
  const { data: rows, error } = await supabase
    .from('normalized_metrics')
    .select('year,source_url,source_id,is_override,metadata')
    .eq('city_id', cityId)
    .order('year', { ascending: false })
    .order('fetched_at', { ascending: false })
    .limit(500);

  if (error) return null;

  for (const row of rows || []) {
    const quality = String(row.metadata?.dataQuality || '').toLowerCase();
    const observed = row.metadata?.observationKind === 'observed' ||
      row.is_override === true ||
      (
        row.metadata?.estimated !== true &&
        Boolean(row.source_url) &&
        ['official', 'open_data'].includes(quality)
      );
    const year = Number(row.year);
    if (observed && Number.isInteger(year)) return year;
  }
  return null;
}

async function handleCityDetail(req, res, path) {
  const match = path.match(/^\/cities\/([^\/]+)$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const cityCode = match[1];
  const url = getQuery(req);
  const requestedYear = url.searchParams.get('year');

  const supabase = getSupabaseClient();

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('*')
    .eq('code', cityCode)
    .single();

  if (cityError || !city) {
    return sendJson(res, 404, { error: 'City not found' });
  }

  let targetYear = requestedYear && requestedYear !== 'latest' ? parseInt(requestedYear, 10) : null;

  // "latest" means latest source-backed city observation, never the newest
  // modeled/legacy Gold row. If no source-backed city observation exists, return
  // an explicit no-data state and let the UI show sourced national context.
  if (!targetYear) {
    targetYear = await resolveLatestSourceBackedCityYear(supabase, city.id);
    if (!targetYear) {
      const [{ data: latestIndicator }, { data: latestMarket }] = await Promise.all([
        supabase
          .from('city_indicators')
          .select('year')
          .eq('city_id', city.id)
          .order('year', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('city_market_data')
          .select('data_year')
          .eq('city_id', city.id)
          .order('data_year', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);
      const legacyAvailableYear = Math.max(
        Number(latestIndicator?.year || 0),
        Number(latestMarket?.data_year || 0)
      ) || null;
      return sendJson(res, 200, {
        city,
        indicators: null,
        marketData: [],
        year: null,
        requestedYear: 'latest',
        dataStatus: 'no_source_backed_city_data',
        legacyAvailableYear
      });
    }
  }

  const [{ data: indicators }, { data: marketData }] = await Promise.all([
    supabase
      .from('city_indicators')
      .select('*')
      .eq('city_id', city.id)
      .eq('year', targetYear)
      .maybeSingle(),
    supabase
      .from('city_market_data')
      .select('*, economic_activities(code, name_ar, name_en)')
      .eq('city_id', city.id)
      .eq('data_year', targetYear)
  ]);

  sendJson(res, 200, {
    city,
    indicators: indicators || null,
    marketData: marketData || [],
    year: targetYear
  });
}

async function handleCityIndicators(req, res, path) {
  const match = path.match(/^\/cities\/([^\/]+)\/indicators$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const cityCode = match[1];
  const url = getQuery(req);
  const requestedYear = url.searchParams.get('year');

  const supabase = getSupabaseClient();

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .eq('code', cityCode)
    .single();

  if (cityError || !city) {
    return sendJson(res, 404, { error: 'City not found' });
  }

  let targetYear = requestedYear && requestedYear !== 'latest' ? parseInt(requestedYear, 10) : null;

  if (!targetYear) {
    targetYear = await resolveLatestSourceBackedCityYear(supabase, city.id);
    if (!targetYear) {
      const { data: latest } = await supabase
        .from('city_indicators')
        .select('year')
        .eq('city_id', city.id)
        .order('year', { ascending: false })
        .limit(1)
        .maybeSingle();
      return sendJson(res, 200, {
        indicators: null,
        year: null,
        requestedYear: 'latest',
        dataStatus: 'no_source_backed_city_data',
        legacyAvailableYear: Number(latest?.year) || null
      });
    }
  }

  const { data, error } = await supabase
    .from('city_indicators')
    .select('*')
    .eq('city_id', city.id)
    .eq('year', targetYear)
    .maybeSingle();

  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { indicators: data || null, year: targetYear });
}

async function handleCityEvidence(req, res, path) {
  const match = path.match(/^\/cities\/([^\/]+)\/evidence$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const cityCode = match[1];
  const url = getQuery(req);
  const activityCode = url.searchParams.get('activity');
  const requestedYear = url.searchParams.get('year') || 'latest';
  const supabase = getSupabaseClient();

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id,code,name_ar,name_en,country_code,region')
    .eq('code', cityCode)
    .maybeSingle();

  if (cityError) return sendJson(res, 500, { error: cityError.message });
  if (!city) {
    return sendJson(res, 200, {
      city: null,
      evidence: [],
      count: 0,
      status: 'catalog_only',
      message: 'No verified database evidence is stored for this catalog city yet.'
    });
  }

  let activityIds = [];
  if (activityCode) {
    try {
      const activitySelection = await resolveActivitySelection(supabase, activityCode);
      activityIds = activitySelection.ids;
    } catch (activityError) {
      return sendJson(res, 500, { error: activityError.message });
    }
  }

  let query = supabase
    .from('normalized_metrics')
    .select('metric_code,activity_id,year,value,value_text,source_id,source_name,source_url,confidence,confidence_reason,fetched_at,is_override,metadata')
    .eq('city_id', city.id)
    .order('fetched_at', { ascending: false })
    .limit(300);

  if (/^\d{4}$/.test(requestedYear)) query = query.eq('year', Number(requestedYear));

  const { data: rows, error } = await query;
  if (error) return sendJson(res, 500, { error: error.message });

  const relevant = (rows || []).filter(row =>
    row.activity_id == null || (activityIds.length && activityIds.includes(row.activity_id))
  );
  const latestByMetric = new Map();
  for (const row of relevant) {
    const scope = row.activity_id ? 'activity' : 'city';
    const key = `${scope}:${row.metric_code}`;
    if (!latestByMetric.has(key)) latestByMetric.set(key, row);
  }

  const freshnessSlaDays = {
    population: 730,
    purchasing_power_index: 365,
    gdp_city: 365,
    growth_rate: 365,
    unemployment_rate: 180,
    inflation_rate: 90,
    establishments_count: 180,
    business_ease_index: 365,
    avg_rent_per_sqm: 90,
    avg_land_price_per_sqm: 90,
    warehouse_rent_per_sqm: 90,
    factory_rent_per_sqm: 90,
    opportunity_score: 30
  };

  const nowMs = Date.now();

  const evidence = [...latestByMetric.values()].map(row => {
    const quality = String(row.metadata?.dataQuality || '').toLowerCase();
    const method = String(row.metadata?.method || '').toLowerCase();
    const estimated = row.metadata?.estimated === true ||
      quality === 'fallback' ||
      quality === 'estimated' ||
      method === 'inference' ||
      row.source_id === 'inference_engine';
    const verified = !estimated &&
      Boolean(row.source_url) &&
      (quality === 'official' || quality === 'open_data' || row.is_override === true);

    const slaDays = Number(row.metadata?.freshness_sla_days || freshnessSlaDays[row.metric_code] || 365);
    const ages = deriveEvidenceAges({
      ...row,
      period: row.metadata?.sourcePeriod || (verified ? row.year : null),
      year: verified ? row.year : null,
      data_year: verified ? row.data_year : null,
      observation_year: verified ? row.observation_year : null,
      retrieved_at: row.fetched_at
    }, nowMs);
    const observationAgeDays = ages.observation_age_days;
    const stale = observationAgeDays != null && observationAgeDays > slaDays;

    return {
      ...row,
      freshness_sla_days: slaDays,
      age_days: observationAgeDays,
      observation_age_days: observationAgeDays,
      fetched_age_days: ages.retrieval_age_days,
      freshness_basis: ages.freshness_basis,
      observation_at: ages.observation_at,
      freshness_status: observationAgeDays == null ? 'unknown' : (stale ? 'stale' : 'fresh'),
      evidence_status: verified ? (stale ? 'stale' : 'verified') : (estimated ? 'estimated' : 'unverified')
    };
  });

  return sendJson(res, 200, {
    city,
    evidence,
    count: evidence.length,
    verifiedCount: evidence.filter(row => row.evidence_status === 'verified').length,
    estimatedCount: evidence.filter(row => row.evidence_status === 'estimated').length,
    staleCount: evidence.filter(row => row.evidence_status === 'stale').length,
    status: evidence.length ? 'evidence_available' : 'no_evidence'
  });
}

async function handleCityMarket(req, res, path) {
  const match = path.match(/^\/cities\/([^\/]+)\/market$/);
  if (!match) return sendJson(res, 404, { error: 'Invalid path' });
  const cityCode = match[1];
  const url = getQuery(req);
  const activityCode = url.searchParams.get('activity');
  const requestedYear = url.searchParams.get('year');

  const supabase = getSupabaseClient();

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .eq('code', cityCode)
    .single();

  if (cityError || !city) {
    return sendJson(res, 404, { error: 'City not found' });
  }

  let targetYear = requestedYear && requestedYear !== 'latest' ? parseInt(requestedYear, 10) : null;

  if (!targetYear) {
    targetYear = await resolveLatestSourceBackedCityYear(supabase, city.id);
    if (!targetYear) {
      let q = supabase
        .from('city_market_data')
        .select('data_year')
        .eq('city_id', city.id)
        .order('data_year', { ascending: false })
        .limit(1);
      if (activityCode) {
        const activitySelection = await resolveActivitySelection(supabase, activityCode);
        if (activitySelection.ids.length) q = q.in('activity_id', activitySelection.ids);
      }
      const { data: latest } = await q.maybeSingle();
      return sendJson(res, 200, {
        marketData: [],
        year: null,
        requestedYear: 'latest',
        dataStatus: 'no_source_backed_city_data',
        legacyAvailableYear: Number(latest?.data_year) || null
      });
    }
  }

  let query = supabase
    .from('city_market_data')
    .select('*, economic_activities(code, name_ar, name_en)')
    .eq('city_id', city.id)
    .eq('data_year', targetYear);

  if (activityCode) {
    const activitySelection = await resolveActivitySelection(supabase, activityCode);
    if (!activitySelection.ids.length) {
      return sendJson(res, 200, { marketData: [], year: targetYear });
    }
    query = query.in('activity_id', activitySelection.ids);
  }

  const { data, error } = await query;
  if (error) return sendJson(res, 500, { error: error.message });
  sendJson(res, 200, { marketData: data || [], year: targetYear });
}

async function handleUcpCalculate(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const body = await parseBody(req);
  const {
    sector, country, templateCode, inputs = {}, scenarioCodes, weightCode,
    policyCodes, businessFormulaCodes, context = {}, asset, legacyAdapter
  } = body;

  try {
    const supabase = getSupabaseClient();
    const ucp = await UniversalCalculationPlatform.create({ supabase, preferStatic: true });

    let ucpInputs = inputs;
    let resolvedSector = sector;
    if (legacyAdapter) {
      const adapted = adaptToUcp(legacyAdapter, inputs);
      resolvedSector = adapted.sector;
      ucpInputs = adapted.inputs;
    }

    const result = await ucp.calculate({
      templateCode,
      sector: resolvedSector,
      country,
      inputs: ucpInputs,
      scenarioCodes,
      weightCode,
      policyCodes,
      businessFormulaCodes,
      context,
      asset
    });

    if (legacyAdapter) {
      result.legacyOutputs = adaptFromUcp(legacyAdapter, result.outputs);
    }

    sendJson(res, 200, result);
  } catch (err) {
    console.error('[ucp/calculate]', err.message);
    sendJson(res, 400, { error: err.message });
  }
}

async function handleUcpTemplates(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const url = getQuery(req);
  const sector = url.searchParams.get('sector');
  const country = url.searchParams.get('country');

  try {
    const ucp = await UniversalCalculationPlatform.create({ preferStatic: true });
    const template = ucp.resolveTemplate({ sector, country });
    const all = ucp.templates.list();
    sendJson(res, 200, { template, all, count: all.length });
  } catch (err) {
    console.error('[ucp/templates]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleWave4Intents(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    sendJson(res, 200, { intents: listIntents() });
  } catch (err) {
    console.error('[wave4/intents]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleWave4Intent(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const body = await parseBody(req);
    const entitlement = await resolveRequestTier(req);
    body.userTier = entitlement.userTier;
    body.userId = entitlement.user?.id || null;
    body.requestId = req.headers['x-request-id'] || body.requestId || null;
    const { result, trace } = await buildIntentForm(body);
    sendJson(res, 200, { ...result, trace });
  } catch (err) {
    console.error('[wave4/intent]', err.message);
    sendJson(res, err.status || 400, {
      error: err.message,
      code: err.code || undefined,
      requiredTier: err.requiredTier || undefined
    });
  }
}

async function handleWave4Run(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const body = await parseBody(req);
    const entitlement = await resolveRequestTier(req);
    body.userTier = entitlement.userTier;
    body.userId = entitlement.user?.id || null;
    body.requestId = req.headers['x-request-id'] || body.requestId || null;
    const { result, trace } = await orchestratorRun(body);
    sendJson(res, 200, { ...result, trace });
  } catch (err) {
    console.error('[wave4/run]', err.message);
    sendJson(res, err.status || 400, {
      error: err.message,
      code: err.code || undefined,
      requiredTier: err.requiredTier || undefined
    });
  }
}

async function handleCalculate(req, res) {
  const body = await parseBody(req);
  const { projectModelCode, cityCode, countryCode: requestedCountryCode, assumptions: customAssumptions = {}, projectionYears = 5 } = body;
  const countryCode = requestedCountryCode ? String(requestedCountryCode).toUpperCase() : null;

  if (countryCode && !COUNTRY_NAMES[countryCode]) {
    return sendJson(res, 400, { error: 'Invalid countryCode' });
  }

  if (!projectModelCode) {
    return sendJson(res, 400, { error: 'projectModelCode is required' });
  }

  try {
    const supabase = getSupabaseClient();
    const modelData = await loadProjectModel(supabase, projectModelCode, cityCode, countryCode);

    // An explicit country request must never calculate using another country's
    // financial baseline. Missing localization is a data-coverage state, not a
    // reason to silently reuse the Saudi SAR model.
    if (countryCode && modelData.countryContext?.localized !== true) {
      return sendJson(res, 422, {
        error: 'Country financial model is not localized',
        code: 'COUNTRY_MODEL_UNVERIFIED',
        countryCode,
        projectModelCode,
        countryContext: modelData.countryContext || null
      });
    }

    const result = calculate(modelData, {
      revenue: customAssumptions.revenue,
      capex: customAssumptions.capex,
      projectionYears
    });

    const recommendation = recommend(result, modelData.marketData || {});
    const ai = await generateInsights(
      result,
      modelData.marketData || null,
      modelData.marketData?.city?.name_ar || cityCode
    );

    sendJson(res, 200, {
      ...result,
      recommendation,
      ai,
      marketData: modelData.marketData || null,
      countryContext: modelData.countryContext || null,
      warnings: modelData.countryContext?.localized === false
        ? ['country_financial_model_unverified']
        : []
    });
  } catch (err) {
    console.error('[calculate]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function requireCronOrAdmin(req) {
  const authHeader = String(req.headers.authorization || '');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && constantTimeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return null;
  }

  return (await requireAdminAccess(req)) ? null : { error: 'Unauthorized' };
}

async function handleCronCalibrate(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const authError = await requireCronOrAdmin(req);
  if (authError) return sendJson(res, 401, authError);

  const body = await parseBody(req);
  const activityCodes = body.activity_codes || ['dental_clinics'];
  const year = parseInt(body.year || new Date().getFullYear(), 10);
  const supabase = getSupabaseClient();

  const results = [];
  for (const activityCode of activityCodes) {
    try {
      const result = await calibrateCompetitorCounts({ supabase, activityCode, year });
      results.push({ activityCode, status: 'ok', result: { upserted: result.upserted.length, skipped: result.skipped.length } });
    } catch (err) {
      results.push({ activityCode, status: 'error', error: err.message });
    }
  }

  sendJson(res, 200, { cron: 'calibrate-competitors', results });
}

async function handleCronCheckQuality(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const authError = await requireCronOrAdmin(req);
  if (authError) return sendJson(res, 401, authError);

  const url = getQuery(req);
  const minSuccessRate = parseFloat(url.searchParams.get('min_success_rate') || '0.5');
  const recentDays = parseInt(url.searchParams.get('recent_days') || '7', 10);

  const supabase = getSupabaseClient();
  const monitor = new SourceQualityMonitor(supabase);
  const alerts = await monitor.checkAlerts({ minSuccessRate, recentDays });
  const [webhookResult, emailResult] = await Promise.all([
    monitor.sendWebhook(alerts),
    monitor.sendEmailAlerts(alerts)
  ]);

  sendJson(res, 200, { cron: 'check-source-quality', alerts, webhookResult, emailResult });
}

module.exports = async function handler(req, res) {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  // Support both /api/v3/... (production under main site) and /api/... (standalone dev)
  const path = url.pathname.replace(/^\/api\/v3/, '').replace(/^\/api/, '') || '/';

  // Legacy analyze-document proxy (previously handled by api/v3/index.js wrapper)
  if (path === '/analyze-document' || path === '/analyze-document/') {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    return require('../../lib/api/analyze-document')(req, res);
  }

  const category = getCategory(path);
  if (await checkRateLimit(category, req, res)) {
    return;
  }

  // Support both /api/v3/... (production under main site) and /api/... (standalone dev)
  // `path` already computed above before rate limiting.

  try {
    if (path === '/health' || path === '/') return await handleHealth(req, res);
    if (path === '/sectors' && req.method === 'GET') return await handleSectors(req, res);
    if (path === '/investment-taxonomy' && req.method === 'GET') return await handleInvestmentTaxonomy(req, res);
    if (path === '/catalog/countries' && req.method === 'GET') return await handleCatalogCountries(req, res);
    if (path === '/catalog/activities' && req.method === 'GET') return await handleCatalogActivities(req, res);
    if (path === '/catalog/years' && req.method === 'GET') return await handleCatalogYears(req, res);
    if (path === '/catalog/cities' && req.method === 'GET') return await handleCatalogCities(req, res);
    if (path === '/geo/site-intelligence' && req.method === 'GET') return await handleGeoSiteIntelligence(req, res);
    if (path.startsWith('/services')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      return await servicesRouter(req, res, path, supabase, user);
    }
    if (path.match(/^\/countries\/[^\/]+\/context$/) && req.method === 'GET') return await handleCountryContext(req, res, path);
    if (path === '/models' && req.method === 'GET') return await handleModels(req, res);
    if (path.match(/^\/models\/[^\/]+$/) && req.method === 'GET') return await handleModelDetail(req, res, path);
    if (path === '/cities' && req.method === 'GET') return await handleCities(req, res);
    if (path === '/geocode' && req.method === 'GET') return await handleGeocode(req, res);
    if (path === '/opportunities/top' && req.method === 'GET') return await handleOpportunitiesTop(req, res);
    if (path.match(/^\/cities\/[^\/]+\/indicators$/) && req.method === 'GET') return await handleCityIndicators(req, res, path);
    if (path.match(/^\/cities\/[^\/]+\/evidence$/) && req.method === 'GET') return await handleCityEvidence(req, res, path);
    if (path.match(/^\/cities\/[^\/]+\/market$/) && req.method === 'GET') return await handleCityMarket(req, res, path);
    if (path.match(/^\/cities\/[^\/]+$/) && req.method === 'GET') return await handleCityDetail(req, res, path);
    if (path === '/calculate' && req.method === 'POST') return await handleCalculate(req, res);
    if (path === '/ucp/calculate' && req.method === 'POST') return await handleUcpCalculate(req, res);
    if (path === '/ucp/templates' && req.method === 'GET') return await handleUcpTemplates(req, res);
    if (path === '/wave4/intents' && req.method === 'GET') return await handleWave4Intents(req, res);
    if (path === '/wave4/intent' && req.method === 'POST') return await handleWave4Intent(req, res);
    if (path === '/wave4/run' && req.method === 'POST') return await handleWave4Run(req, res);
    if (path === '/orchestrate/intents' && req.method === 'GET') return await handleWave4Intents(req, res);
    if (path === '/orchestrate/form' && req.method === 'POST') return await handleWave4Intent(req, res);
    if (path === '/orchestrate' && req.method === 'POST') return await handleWave4Run(req, res);
    if (path.startsWith('/calculate/scenarios')) return await scenariosRouter(req, res, path);
    if (path === '/ai/chat' && req.method === 'POST') return await aiChatHandler(req, res);
    if (path === '/ai/analyze' && req.method === 'POST') return await handleAiAnalyze(req, res);
    if (path === '/ai/valuate' && req.method === 'POST') return await handleValuationAnalyze(req, res);
    if (path.match(/^\/ai\/valuate\/[^/]+\/approve$/) && req.method === 'POST') return await handleApproveReport(req, res, path);
    if (path === '/ai/request-review' && req.method === 'POST') return await handleAiReviewRequest(req, res);
    if (path.match(/^\/valuations\/[^/]+\/certificate$/) && req.method === 'POST') return await handleIssueCertificate(req, res, path);
    if (path.match(/^\/certificates\/[^/]+\/verify$/) && req.method === 'GET') return await handleVerifyCertificate(req, res, path);
    if (path.startsWith('/scenarios')) return await scenariosRouter(req, res, path);
    if (path.startsWith('/admin/alert-rules') || path.startsWith('/admin/alerts') || path.startsWith('/alerts')) {
      return await alertsRouter(req, res, path);
    }
    if (path === '/compare/cities') return await compareRouter(req, res, path);
    if (path.startsWith('/fabric')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      return await fabricRouter(req, res, path, supabase, user);
    }
    if (path.startsWith('/intelligence')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      return await intelligenceRouter(req, res, path, supabase, user);
    }
    if (path.startsWith('/investment-intelligence')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await investmentIntelligenceRouter(req, res, path, supabase, user);
    }
    if (path.startsWith('/assistant')) {
      const user = await getUserFromToken(req);
      return await assistantRouter(req, res, path, user);
    }
    if (path.startsWith('/capabilities')) {
      const user = await getUserFromToken(req);
      return await capabilitiesRouter(req, res, path, user);
    }
    if (path === '/water-factory-data') {
      const supabase = getSupabaseClient();
      return await waterFactoryDataRouter(req, res, path, supabase);
    }
    if (path === '/sector-data') {
      const supabase = getSupabaseClient();
      return await sectorDataRouter(req, res, path, supabase);
    }
    if (path.startsWith('/enterprise-lifecycle')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await enterpriseLifecycleRouter(req, res, path, supabase, user);
    }
    if (path.startsWith('/ecc')) {
      const supabase = getSupabaseClient();
      const user = await getUserFromToken(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await eccRouter(req, res, path, supabase, user);
    }
    if (path === '/cron/calibrate-competitors') return await handleCronCalibrate(req, res);
    if (path === '/cron/check-source-quality') return await handleCronCheckQuality(req, res);

    if (path.startsWith('/admin')) {
      return await adminRouter(req, res, path);
    }

    if (path.startsWith('/auth')) {
      return await authRouter(req, res, path);
    }

    if (path.startsWith('/projects')) {
      const user = await getUserFromToken(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
      return await projectsRouter(req, res, path, user);
    }

    if (path.startsWith('/data')) {
      return await dataEngineRouter(req, res, path);
    }

    if (path.startsWith('/billing')) {
      if (path === '/billing/subscription') {
        const user = await getUserFromToken(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        return await billingRouter(req, res, path, user);
      }
      return await billingRouter(req, res, path);
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[api]', err.message);
    sendJson(res, 500, { error: err.message });
  }
};