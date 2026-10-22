'use strict';

const fs=require('fs');
const path=require('path');

const migration=fs.readFileSync(
  path.join(__dirname,'../../supabase/migrations/20261023024500_evolution_proposal_aggregation.sql'),
  'utf8'
);

describe('evolution proposal persistence security',()=>{
  test('is server-only',()=>{
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on table public\.evolution_proposals from anon/i);
    expect(migration).toMatch(/revoke all on table public\.evolution_proposals from authenticated/i);
    expect(migration).toMatch(/grant select, insert, update on table public\.evolution_proposals to service_role/i);
  });

  test('proposal rows never authorize execution automatically',()=>{
    expect(migration).toContain('execution_authorized boolean not null default false');
    expect(migration).toContain('auto_execute boolean not null default false');
  });

  test('aggregation RPC is security invoker and service-role only',()=>{
    expect(migration).toMatch(/security invoker/i);
    expect(migration).toMatch(/revoke all on function public\.evolution_aggregate_signal[\s\S]*from authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.evolution_aggregate_signal[\s\S]*to service_role/i);
  });
});
