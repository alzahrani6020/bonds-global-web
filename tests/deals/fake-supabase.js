/**
 * Minimal in-memory Supabase query-builder double for deal workspace tests.
 * Supports: select, insert, update, delete, eq, neq, in, is, order, limit,
 * maybeSingle, single.
 */

const crypto = require('crypto');

const TABLE_DEFAULTS = {
  bonds_deals: row => ({
    status: 'active',
    stage: 'draft',
    deal_type: 'other',
    currency: 'SAR',
    project_id: null,
    lifecycle_instance_id: null,
    funding_case_id: null,
    ...row
  }),
  bonds_deal_members: row => ({
    user_id: null,
    status: 'invited',
    nda_status: 'not_required',
    access_expires_at: null,
    ...row
  }),
  bonds_deal_documents: row => ({ status: 'requested', confidentiality: 'confidential', visibility: 'team', version: 1, ...row }),
  bonds_deal_document_requests: row => ({ status: 'open', ...row }),
  bonds_deal_document_grants: row => ({ status: 'active', access_level: 'download', ...row }),
  bonds_deal_document_versions: row => ({ upload_status: 'pending', ...row }),
  bonds_deal_due_diligence_items: row => ({ status: 'not_started', risk_rating: null, ...row }),
  bonds_deal_pipeline_entries: row => ({ status: 'identified', ...row }),
  bonds_deal_offers: row => ({ status: 'received', currency: 'SAR', ...row }),
  bonds_deal_closing_items: row => ({ status: 'pending', required: true, ...row }),
  bonds_deal_closing_records: row => ({ status: 'pending', currency: 'SAR', ...row })
};

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.op = 'select';
    this.filters = [];
    this.payload = null;
    this.returning = false;
    this.orderBy = null;
    this.limitN = null;
    this.mode = 'many';
  }

  rows() {
    if (!this.db.tables[this.table]) this.db.tables[this.table] = [];
    return this.db.tables[this.table];
  }

  select() { if (this.op !== 'select') this.returning = true; return this; }
  insert(payload) { this.op = 'insert'; this.payload = Array.isArray(payload) ? payload : [payload]; return this; }
  update(patch) { this.op = 'update'; this.payload = patch; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(col, v) { this.filters.push(r => r[col] === v); return this; }
  neq(col, v) { this.filters.push(r => r[col] !== v); return this; }
  in(col, arr) { this.filters.push(r => arr.includes(r[col])); return this; }
  is(col, v) { this.filters.push(r => (r[col] === undefined ? null : r[col]) === v); return this; }
  order(col, { ascending = true } = {}) { this.orderBy = { col, ascending }; return this; }
  limit(n) { this.limitN = n; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  single() { this.mode = 'single'; return this; }

  match(rows) { return rows.filter(r => this.filters.every(f => f(r))); }

  execute() {
    const db = this.db;
    if (db.failOn && db.failOn(this.table, this.op)) return { data: null, error: { message: 'forced failure' } };
    let result;
    if (this.op === 'insert') {
      const now = new Date().toISOString();
      const defaults = TABLE_DEFAULTS[this.table] || (r => r);
      result = this.payload.map(r => defaults({ id: crypto.randomUUID(), created_at: now, updated_at: now, ...r }, db));
      this.rows().push(...result);
      if (!this.returning) return { data: null, error: null };
    } else if (this.op === 'update') {
      result = this.match(this.rows());
      result.forEach(r => Object.assign(r, this.payload, { updated_at: new Date().toISOString() }));
      if (!this.returning) return { data: null, error: null };
    } else if (this.op === 'delete') {
      const victims = new Set(this.match(this.rows()));
      db.tables[this.table] = this.rows().filter(r => !victims.has(r));
      return { data: null, error: null };
    } else {
      result = this.match(this.rows());
    }

    result = result.map(r => ({ ...r }));
    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      result.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (ascending ? 1 : -1));
    }
    if (this.limitN !== null) result = result.slice(0, this.limitN);
    if (this.mode === 'maybe') return { data: result[0] || null, error: null };
    if (this.mode === 'single') {
      return result[0] ? { data: result[0], error: null } : { data: null, error: { message: 'not found', code: 'PGRST116' } };
    }
    return { data: result, error: null };
  }

  then(resolve, reject) {
    try {
      resolve(this.execute());
    } catch (err) {
      reject(err);
    }
  }
}

function createFakeSupabase(seed = {}) {
  const db = {
    tables: JSON.parse(JSON.stringify(seed)),
    seq: 1,
    failOn: null,
    storageObjects: {}
  };
  return {
    db,
    from(table) { return new Query(db, table); },
    storage: {
      from(bucket) {
        if (!db.storageObjects[bucket]) db.storageObjects[bucket] = new Set();
        return {
          async createSignedUploadUrl(objectPath) {
            return {
              data: {
                path: objectPath,
                token: 'signed-upload-token',
                signedUrl: 'https://storage.example/upload/' + encodeURIComponent(objectPath)
              },
              error: null
            };
          },
          async list(folder, options = {}) {
            const prefix = folder ? folder.replace(/\/$/, '') + '/' : '';
            const names = [...db.storageObjects[bucket]]
              .filter(key => key.startsWith(prefix))
              .map(key => key.slice(prefix.length))
              .filter(name => !options.search || name.includes(options.search))
              .map(name => ({ name }));
            return { data: names.slice(0, options.limit || names.length), error: null };
          },
          async createSignedUrl(objectPath) {
            if (!db.storageObjects[bucket].has(objectPath)) {
              return { data: null, error: { message: 'not found' } };
            }
            return {
              data: { signedUrl: 'https://storage.example/download/' + encodeURIComponent(objectPath) },
              error: null
            };
          }
        };
      }
    }
  };
}

module.exports = { createFakeSupabase };
