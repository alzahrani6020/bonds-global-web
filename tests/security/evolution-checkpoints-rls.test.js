'use strict';

const fs=require('fs');
const path=require('path');

const migration=fs.readFileSync(
  path.join(__dirname,'../../supabase/migrations/20261023011500_evolution_checkpoint_metadata.sql'),
  'utf8'
);

describe('evolution checkpoint persistence security',()=>{
  test('enables RLS and removes browser roles',()=>{
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on table public\.evolution_checkpoints from anon/i);
    expect(migration).toMatch(/revoke all on table public\.evolution_checkpoints from authenticated/i);
  });

  test('remote checkpoint writer is service-role only and security invoker',()=>{
    expect(migration).toMatch(/security invoker/i);
    expect(migration).toMatch(/revoke all on function public\.evolution_save_checkpoint[\s\S]*from authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.evolution_save_checkpoint[\s\S]*to service_role/i);
  });

  test('rejects stale and split-brain generations',()=>{
    expect(migration).toContain('EVOLUTION_CHECKPOINT_STALE');
    expect(migration).toContain('EVOLUTION_CHECKPOINT_SPLIT_BRAIN');
  });
});
