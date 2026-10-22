'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { withIntegrity, verifyIntegrity } = require('./persistent-state');

class SqliteCheckpointStore {
  constructor(dbPath) {
    if (!dbPath) throw new Error('PROJECT_MEMORY_DB_PATH_REQUIRED');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode=WAL;');
    this.db.exec('PRAGMA synchronous=FULL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS evolution_checkpoints (
        task_id TEXT PRIMARY KEY,
        generation INTEGER NOT NULL,
        status TEXT NOT NULL,
        base_sha TEXT NOT NULL,
        candidate_sha TEXT,
        current_stage TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_evolution_checkpoints_updated_at
      ON evolution_checkpoints(updated_at DESC);
    `);
  }

  save(checkpoint, generation = null) {
    const current = this.load(checkpoint.task_id);
    const nextGeneration = generation == null
      ? ((current?.generation || 0) + 1)
      : generation;
    if (!Number.isInteger(nextGeneration) || nextGeneration < 1) {
      throw new Error('PROJECT_MEMORY_GENERATION_INVALID');
    }
    const record = withIntegrity({
      ...checkpoint,
      generation: nextGeneration,
      updated_at: new Date().toISOString()
    });

    this.db.prepare(`
      INSERT INTO evolution_checkpoints(
        task_id,generation,status,base_sha,candidate_sha,current_stage,record_json,updated_at
      ) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(task_id) DO UPDATE SET
        generation=excluded.generation,
        status=excluded.status,
        base_sha=excluded.base_sha,
        candidate_sha=excluded.candidate_sha,
        current_stage=excluded.current_stage,
        record_json=excluded.record_json,
        updated_at=excluded.updated_at
      WHERE excluded.generation >= evolution_checkpoints.generation
    `).run(
      record.task_id,
      record.generation,
      record.status,
      record.base_sha,
      record.candidate_sha || null,
      record.current_stage,
      JSON.stringify(record),
      record.updated_at
    );
    return record;
  }

  load(taskId) {
    const row = this.db.prepare(
      'SELECT record_json FROM evolution_checkpoints WHERE task_id = ?'
    ).get(taskId);
    if (!row) return null;
    const record = JSON.parse(row.record_json);
    const payload = verifyIntegrity(record);
    return { ...payload, generation: Number(payload.generation || 0) };
  }

  list(limit = 50) {
    const rows = this.db.prepare(
      'SELECT record_json FROM evolution_checkpoints ORDER BY updated_at DESC LIMIT ?'
    ).all(Math.max(1, Math.min(500, Number(limit) || 50)));
    return rows.map(row => {
      const payload = verifyIntegrity(JSON.parse(row.record_json));
      return { ...payload, generation: Number(payload.generation || 0) };
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = { SqliteCheckpointStore };
