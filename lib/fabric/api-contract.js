/**
 * BONDS Enterprise API Contract Registry
 *
 * Exposes metadata for every API route: version, lifecycle, owner, permission,
 * dependencies, evidence, confidence, caching, retry, audit, tracing, ADR, docs.
 */

class ApiContractRegistry {
  constructor(supabase) {
    this.supabase = supabase;
    this.contracts = new Map();
  }

  register(contract) {
    if (!contract.route) throw new Error('API contract requires route');
    this.contracts.set(contract.route, {
      version: contract.version || '1.0.0',
      lifecycle: contract.lifecycle || 'active',
      owner: contract.owner || null,
      permission: contract.permission || 'public',
      dependencies: contract.dependencies || [],
      evidenceSource: contract.evidenceSource || null,
      confidence: contract.confidence || 95,
      cachePolicy: contract.cachePolicy || {},
      retryPolicy: contract.retryPolicy || {},
      adrReference: contract.adrReference || null,
      documentationUrl: contract.documentationUrl || null,
      ...contract
    });
  }

  get(route) {
    return this.contracts.get(route) || null;
  }

  list() {
    return Array.from(this.contracts.values());
  }

  async persist(route) {
    const contract = this.contracts.get(route);
    if (!contract || !this.supabase) return false;
    const { error } = await this.supabase.from('fabric_api_contracts').upsert(contract, { onConflict: 'route' });
    if (error) throw error;
    return true;
  }
}

module.exports = { ApiContractRegistry };
