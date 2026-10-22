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

comment on table public.evolution_checkpoints is
  'Server-only recovery metadata for BONDS evolution checkpoints. No direct browser access.';
