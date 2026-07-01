/**
 * BONDS Fabric API Router
 *
 * Handles /fabric/* endpoints for the Trusted Data Fabric.
 */

const {
  TrustedDataFabric,
  ConnectorRegistry,
  SourceRegistry,
  DatabaseConnector,
  ManualConnector,
  MarketplaceFoundation,
  PluginSDK,
  Monitoring,
  Observability,
  SmartOverride,
  DecisionImpactEngine,
  ApiContractRegistry
} = require('../../lib/fabric');

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

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function createFabric(supabase) {
  const registry = new ConnectorRegistry();
  registry.register(new DatabaseConnector({ supabase, sourceCode: 'database_metrics', sourceName: 'Normalized Metrics DB' }));
  registry.register(new ManualConnector({ supabase, sourceCode: 'manual', sourceName: 'Manual Override' }));
  const sourceRegistry = supabase ? new SourceRegistry(supabase) : null;
  return new TrustedDataFabric({ supabase, connectorRegistry: registry, sourceRegistry });
}

async function fabricRouter(req, res, path, supabase) {
  const fabric = createFabric(supabase);
  const observability = new Observability(supabase);
  const monitoring = new Monitoring({ supabase, observability });
  const marketplace = new MarketplaceFoundation(supabase);
  const smartOverride = new SmartOverride({ supabase });
  const impactEngine = new DecisionImpactEngine({ supabase });
  const apiContracts = new ApiContractRegistry(supabase);

  try {
    if (path === '/fabric/connectors' && req.method === 'GET') {
      return sendJson(res, 200, { connectors: fabric.connectorRegistry.list() });
    }

    if (path === '/fabric/connectors/health' && req.method === 'GET') {
      const results = await fabric.connectorRegistry.healthCheck();
      return sendJson(res, 200, { health: results });
    }

    const healthMatch = path.match(/^\/fabric\/connectors\/([^/]+)\/health$/);
    if (healthMatch && req.method === 'GET') {
      const results = await fabric.connectorRegistry.healthCheck([healthMatch[1]]);
      return sendJson(res, 200, { health: results[0] || null });
    }

    const fetchMatch = path.match(/^\/fabric\/connectors\/([^/]+)\/fetch$/);
    if (fetchMatch && req.method === 'POST') {
      const body = await parseBody(req);
      const items = await fabric.connectorRegistry.fetch(fetchMatch[1], body);
      return sendJson(res, 200, { items });
    }

    if (path === '/fabric/sources' && req.method === 'GET') {
      if (!supabase) return sendJson(res, 503, { error: 'Supabase not available' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      const filters = {
        status: url.searchParams.get('status') || undefined,
        category: url.searchParams.get('category') || undefined,
        country: url.searchParams.get('country') || undefined,
        connectorCode: url.searchParams.get('connector_code') || undefined
      };
      const sources = await fabric.sourceRegistry.list(filters);
      return sendJson(res, 200, { sources });
    }

    const rankMatch = path.match(/^\/fabric\/sources\/([^/]+)\/rank$/);
    if (rankMatch && req.method === 'GET') {
      if (!supabase) return sendJson(res, 503, { error: 'Supabase not available' });
      const source = await fabric.sourceRegistry.getByCode(rankMatch[1]);
      const rank = fabric.rankingEngine.rank(source);
      return sendJson(res, 200, { source, rank });
    }

    if (path === '/fabric/resolve' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = await fabric.resolve(body);
      return sendJson(res, 200, result);
    }

    if (path === '/fabric/quality' && req.method === 'GET') {
      const summary = await monitoring.qualitySummary();
      return sendJson(res, 200, summary);
    }

    if (path === '/fabric/monitoring/summary' && req.method === 'GET') {
      const summary = await monitoring.summary();
      return sendJson(res, 200, summary);
    }

    if (path === '/fabric/override' && req.method === 'POST') {
      if (!supabase) return sendJson(res, 503, { error: 'Supabase not available' });
      const body = await parseBody(req);
      const result = await smartOverride.apply(body);
      return sendJson(res, 200, result);
    }

    if (path === '/fabric/impact' && req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const params = Object.fromEntries(url.searchParams.entries());
      const result = await impactEngine.analyze(params);
      return sendJson(res, 200, result);
    }

    if (path === '/fabric/marketplace' && req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const items = await marketplace.list({
        itemType: url.searchParams.get('type') || undefined,
        status: url.searchParams.get('status') || 'active'
      });
      return sendJson(res, 200, { items });
    }

    if (path === '/fabric/plugins' && req.method === 'GET') {
      if (!supabase) return sendJson(res, 503, { error: 'Supabase not available' });
      const { data, error } = await supabase.from('fabric_plugins').select('*').order('name');
      if (error) throw error;
      return sendJson(res, 200, { plugins: data || [] });
    }

    if (path === '/fabric/plugins/validate' && req.method === 'POST') {
      const body = await parseBody(req);
      const validation = PluginSDK.validateManifest(body);
      return sendJson(res, 200, validation);
    }

    return sendJson(res, 404, { error: 'Fabric endpoint not found' });
  } catch (err) {
    console.error('[fabric]', err.message);
    sendJson(res, 400, { error: err.message });
  }
}

module.exports = { fabricRouter };
