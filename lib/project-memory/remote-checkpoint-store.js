'use strict';

const { verifyIntegrity } = require('./persistent-state');

class RemoteCheckpointStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function' || typeof supabase.rpc !== 'function') {
      throw new Error('PROJECT_MEMORY_REMOTE_STORE_UNAVAILABLE');
    }
    this.supabase = supabase;
  }

  async save(record) {
    const payload = verifyIntegrity(record);
    const { data, error } = await this.supabase.rpc('evolution_save_checkpoint', {
      p_task_id: payload.task_id,
      p_generation: Number(payload.generation || 0),
      p_status: payload.status,
      p_base_sha: payload.base_sha,
      p_candidate_sha: payload.candidate_sha || null,
      p_current_stage: payload.current_stage,
      p_checkpoint: record,
      p_integrity_checksum: record.integrity.checksum,
      p_updated_at: payload.updated_at
    });
    if (error) {
      const message = String(error.message || '');
      if (message.includes('EVOLUTION_CHECKPOINT_STALE')) {
        throw new Error('PROJECT_MEMORY_REMOTE_STALE');
      }
      if (message.includes('EVOLUTION_CHECKPOINT_SPLIT_BRAIN')) {
        throw new Error('PROJECT_MEMORY_REMOTE_SPLIT_BRAIN');
      }
      throw new Error('PROJECT_MEMORY_REMOTE_SAVE_FAILED');
    }
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
