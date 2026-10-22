'use strict';

const { verifyIntegrity } = require('./persistent-state');

class RemoteCheckpointStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('PROJECT_MEMORY_REMOTE_STORE_UNAVAILABLE');
    }
    this.supabase = supabase;
  }

  async save(record) {
    const payload = verifyIntegrity(record);
    const row = {
      task_id: payload.task_id,
      generation: Number(payload.generation || 0),
      status: payload.status,
      base_sha: payload.base_sha,
      candidate_sha: payload.candidate_sha || null,
      current_stage: payload.current_stage,
      checkpoint: record,
      integrity_checksum: record.integrity.checksum,
      updated_at: payload.updated_at
    };
    const { data, error } = await this.supabase
      .from('evolution_checkpoints')
      .upsert(row, { onConflict: 'task_id' })
      .select('*')
      .single();
    if (error) throw new Error('PROJECT_MEMORY_REMOTE_SAVE_FAILED');
    return data;
  }

  async load(taskId) {
    const { data, error } = await this.supabase
      .from('evolution_checkpoints')
      .select('checkpoint,generation')
      .eq('task_id', taskId)
      .maybeSingle();
    if (error) throw new Error('PROJECT_MEMORY_REMOTE_LOAD_FAILED');
    if (!data) return null;
    const payload = verifyIntegrity(data.checkpoint);
    if (Number(data.generation) !== Number(payload.generation || 0)) {
      throw new Error('PROJECT_MEMORY_REMOTE_GENERATION_MISMATCH');
    }
    return { record: data.checkpoint, payload };
  }
}

module.exports = { RemoteCheckpointStore };
