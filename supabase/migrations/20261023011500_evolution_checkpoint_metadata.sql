-- Durable remote checkpoint metadata for BONDS self-evolving project memory.
create table if not exists public.evolution_checkpoints (
  task_id text primary key,
  generation bigint not null check (generation > 0),
  status text not null,
  base_sha text not null check (base_sha ~ '^[0-9a-f]{40}$'),
  candidate_sha text check (candidate_sha is null or candidate_sha ~ '^[0-9a-f]{40}$'),
  current_stage text not null,
  checkpoint jsonb not null,
  integrity_checksum text not null check (integrity_checksum ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.evolution_checkpoints enable row level security;

revoke all on table public.evolution_checkpoints from public;
revoke all on table public.evolution_checkpoints from anon;
revoke all on table public.evolution_checkpoints from authenticated;
grant select, insert, update, delete on table public.evolution_checkpoints to service_role;

create index if not exists evolution_checkpoints_updated_at_idx
  on public.evolution_checkpoints(updated_at desc);

create or replace function public.evolution_save_checkpoint(
  p_task_id text,
  p_generation bigint,
  p_status text,
  p_base_sha text,
  p_candidate_sha text,
  p_current_stage text,
  p_checkpoint jsonb,
  p_integrity_checksum text,
  p_updated_at timestamptz
)
returns public.evolution_checkpoints
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_row public.evolution_checkpoints%rowtype;
  saved public.evolution_checkpoints%rowtype;
begin
  select *
    into current_row
    from public.evolution_checkpoints
   where task_id = p_task_id
   for update;

  if found then
    if p_generation < current_row.generation then
      raise exception 'EVOLUTION_CHECKPOINT_STALE';
    end if;
    if p_generation = current_row.generation
       and p_integrity_checksum <> current_row.integrity_checksum then
      raise exception 'EVOLUTION_CHECKPOINT_SPLIT_BRAIN';
    end if;
  end if;

  insert into public.evolution_checkpoints(
    task_id, generation, status, base_sha, candidate_sha,
    current_stage, checkpoint, integrity_checksum, updated_at
  )
  values (
    p_task_id, p_generation, p_status, p_base_sha, p_candidate_sha,
    p_current_stage, p_checkpoint, p_integrity_checksum, p_updated_at
  )
  on conflict (task_id) do update set
    generation = excluded.generation,
    status = excluded.status,
    base_sha = excluded.base_sha,
    candidate_sha = excluded.candidate_sha,
    current_stage = excluded.current_stage,
    checkpoint = excluded.checkpoint,
    integrity_checksum = excluded.integrity_checksum,
    updated_at = excluded.updated_at
  returning * into saved;

  return saved;
end;
$$;

revoke all on function public.evolution_save_checkpoint(
  text,bigint,text,text,text,text,jsonb,text,timestamptz
) from public;
revoke all on function public.evolution_save_checkpoint(
  text,bigint,text,text,text,text,jsonb,text,timestamptz
) from anon;
revoke all on function public.evolution_save_checkpoint(
  text,bigint,text,text,text,text,jsonb,text,timestamptz
) from authenticated;
grant execute on function public.evolution_save_checkpoint(
  text,bigint,text,text,text,text,jsonb,text,timestamptz
) to service_role;

comment on table public.evolution_checkpoints is
  'Server-only recovery metadata for BONDS evolution checkpoints. No direct browser access.';
