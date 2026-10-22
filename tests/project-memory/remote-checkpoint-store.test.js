'use strict';

const { RemoteCheckpointStore } = require('../../lib/project-memory/remote-checkpoint-store');
const { withIntegrity } = require('../../lib/project-memory/persistent-state');

const SHA='a'.repeat(40);

function record() {
  return withIntegrity({
    schema_version:1,
    task_id:'task-remote',
    status:'in_progress',
    base_sha:SHA,
    candidate_sha:null,
    current_stage:'remote',
    generation:2,
    updated_at:'2026-10-23T00:00:00Z'
  });
}

describe('remote checkpoint store', () => {
  test('uses governed monotonic RPC for saves', async () => {
    const rpc=jest.fn().mockResolvedValue({data:{task_id:'task-remote'},error:null});
    const supabase={rpc,from:jest.fn()};
    const store=new RemoteCheckpointStore(supabase);
    await store.save(record());
    expect(rpc).toHaveBeenCalledWith('evolution_save_checkpoint', expect.objectContaining({
      p_task_id:'task-remote',
      p_generation:2
    }));
  });

  test('maps stale generation failure', async () => {
    const supabase={
      from:jest.fn(),
      rpc:jest.fn().mockResolvedValue({data:null,error:{message:'EVOLUTION_CHECKPOINT_STALE'}})
    };
    await expect(new RemoteCheckpointStore(supabase).save(record()))
      .rejects.toThrow('PROJECT_MEMORY_REMOTE_STALE');
  });

  test('maps split-brain failure', async () => {
    const supabase={
      from:jest.fn(),
      rpc:jest.fn().mockResolvedValue({data:null,error:{message:'EVOLUTION_CHECKPOINT_SPLIT_BRAIN'}})
    };
    await expect(new RemoteCheckpointStore(supabase).save(record()))
      .rejects.toThrow('PROJECT_MEMORY_REMOTE_SPLIT_BRAIN');
  });
});
