const { enterpriseLifecycleRouter } = require('../../v3/api/enterprise-lifecycle');
const { MemoryLifecycleStore } = require('../../lib/enterprise-lifecycle/store/memory-store');

class MockSupabase {
  constructor() {
    this.store = new MemoryLifecycleStore();
    this.table = null;
    this.query = {};
  }

  from(table) {
    this.table = table;
    this.query = {};
    return this;
  }

  insert(record) {
    this.query.insert = Array.isArray(record) ? record[0] : record;
    return this;
  }

  update(updates) {
    this.query.update = updates;
    return this;
  }

  select(columns) {
    this.query.select = columns || '*';
    return this;
  }

  eq(field, value) {
    this.query.eq = { field, value };
    return this;
  }

  order() { return this; }
  limit() { return this; }

  async single() {
    if (this.query.insert) {
      const record = this.query.insert;
      const saved = await this._save(record);
      return { data: saved, error: null };
    }
    if (this.query.update && this.query.eq && this.query.eq.field === 'id') {
      const updated = await this._update(this.query.eq.value, this.query.update);
      return { data: updated, error: null };
    }
    if (this.query.eq && this.query.eq.field === 'id') {
      const found = await this._getById(this.query.eq.value);
      return { data: found, error: found ? null : { message: 'not found' } };
    }
    return { data: null, error: null };
  }

  async _save(record) {
    switch (this.table) {
      case 'enterprise_lifecycle_instances': return this.store.createInstance(record);
      case 'enterprise_lifecycle_transitions': return this.store.createTransition(record);
      case 'enterprise_lifecycle_gate_evaluations': return this.store.createGateEvaluation(record);
      case 'enterprise_lifecycle_tasks': return this.store.createTask(record);
      case 'enterprise_lifecycle_events': return this.store.createEvent(record);
      case 'enterprise_lifecycle_timeline': return this.store.createTimelineEntry(record);
      case 'enterprise_lifecycle_approvals': return this.store.createApproval(record);
      default: return { id: 'mock-id', ...record };
    }
  }

  async _getById(id) {
    switch (this.table) {
      case 'enterprise_lifecycle_instances': return this.store.getInstance(id);
      case 'enterprise_lifecycle_approvals': return this.store.getApproval(id);
      default: return null;
    }
  }

  async _update(id, updates) {
    switch (this.table) {
      case 'enterprise_lifecycle_instances': return this.store.updateInstance(id, updates);
      case 'enterprise_lifecycle_approvals': return this.store.updateApproval(id, updates);
      default: return { id, ...updates };
    }
  }
}

function mockReq({ method = 'GET', body = null, url = 'http://localhost/enterprise-lifecycle/definitions' }) {
  return {
    method,
    url,
    headers: { host: 'localhost' },
    on(event, cb) {
      if (event === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
      if (event === 'end') cb();
    }
  };
}

function mockRes() {
  return {
    statusCode: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(data) { this.data = data; }
  };
}

describe('Enterprise Lifecycle API Router', () => {
  const user = { id: 'u1' };

  test('GET /definitions returns workflows and stages', async () => {
    const req = mockReq({ url: '/enterprise-lifecycle/definitions' });
    const res = mockRes();
    await enterpriseLifecycleRouter(req, res, '/enterprise-lifecycle/definitions', new MockSupabase(), user);
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.data);
    expect(json.workflows.length).toBeGreaterThan(0);
    expect(json.stages.length).toBeGreaterThan(0);
  });

  test('POST /instances creates instance', async () => {
    const supabase = new MockSupabase();
    const req = mockReq({
      method: 'POST',
      url: '/enterprise-lifecycle/instances',
      body: { entityType: 'project', entityId: 'p1' }
    });
    const res = mockRes();
    await enterpriseLifecycleRouter(req, res, '/enterprise-lifecycle/instances', supabase, user);
    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.data);
    expect(json.instance.current_stage).toBe('idea');
  });

  test('POST /transition moves instance with valid context', async () => {
    const supabase = new MockSupabase();
    const createReq = mockReq({
      method: 'POST',
      url: '/enterprise-lifecycle/instances',
      body: { entityType: 'project', entityId: 'p2' }
    });
    const createRes = mockRes();
    await enterpriseLifecycleRouter(createReq, createRes, '/enterprise-lifecycle/instances', supabase, user);
    const { instance } = JSON.parse(createRes.data);

    const transReq = mockReq({
      method: 'POST',
      url: `/enterprise-lifecycle/instances/${instance.id}/transition`,
      body: {
        toStage: 'feasibility',
        reason: 'ready',
        context: { project: { name: 'Cafe', sector: 'restaurant', city_id: 'c1', capital: 100000 } }
      }
    });
    const transRes = mockRes();
    await enterpriseLifecycleRouter(transReq, transRes, `/enterprise-lifecycle/instances/${instance.id}/transition`, supabase, user);
    expect(transRes.statusCode).toBe(200);
    const json = JSON.parse(transRes.data);
    expect(json.instance.current_stage).toBe('feasibility');
  });
});
