begin;

-- BONDS Financial Operations Core
-- Server-mediated, fail-closed accounting foundation.
-- No SCC implementation is copied; this schema integrates with existing BONDS services.

create table if not exists public.accounting_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.crm_organizations(id) on delete set null,
  name text not null,
  base_currency text not null default 'SAR'
    check (base_currency ~ '^[A-Z]{3}$'),
  status text not null default 'active'
    check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounting_entities_org
  on public.accounting_entities(organization_id);
create index if not exists idx_accounting_entities_status
  on public.accounting_entities(status);

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null references public.accounting_entities(id) on delete cascade,
  period_code text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open'
    check (status in ('open','soft_closed','closed')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on),
  check (
    (status = 'closed' and closed_at is not null) or
    (status <> 'closed')
  ),
  unique(accounting_entity_id, period_code),
  unique(accounting_entity_id, starts_on, ends_on),
  unique(accounting_entity_id, id)
);

create index if not exists idx_accounting_periods_entity_dates
  on public.accounting_periods(accounting_entity_id, starts_on, ends_on);

create table if not exists public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null references public.accounting_entities(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null
    check (account_type in ('asset','liability','equity','revenue','expense','contra_asset','contra_liability','contra_equity','contra_revenue','contra_expense')),
  parent_id uuid,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, code),
  unique(accounting_entity_id, id),
  foreign key (accounting_entity_id, parent_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_accounting_accounts_entity_type
  on public.accounting_accounts(accounting_entity_id, account_type);

create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null references public.accounting_entities(id) on delete restrict,
  event_key text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  effective_at timestamptz not null,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  source_system text not null,
  source_record_id text not null,
  service_code text,
  idempotency_key text not null check (idempotency_key ~ '^[0-9a-f]{64}$'),
  payload jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'accepted'
    check (status in ('accepted','posted','rejected','reversed')),
  created_at timestamptz not null default now(),
  unique(accounting_entity_id, event_key),
  unique(accounting_entity_id, idempotency_key),
  unique(accounting_entity_id, source_system, source_record_id, event_type),
  unique(accounting_entity_id, id)
);

create index if not exists idx_financial_events_entity_effective
  on public.financial_events(accounting_entity_id, effective_at desc);
create index if not exists idx_financial_events_type
  on public.financial_events(event_type, effective_at desc);

create table if not exists public.accounting_subledger_entries (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null references public.accounting_entities(id) on delete restrict,
  financial_event_id uuid not null,
  subledger_code text not null,
  source_record_id text not null,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending','posted','reversed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(accounting_entity_id, financial_event_id),
  foreign key (accounting_entity_id, financial_event_id)
    references public.financial_events(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_subledger_entity_code
  on public.accounting_subledger_entries(accounting_entity_id, subledger_code, created_at desc);

create table if not exists public.accounting_journal_entries (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null references public.accounting_entities(id) on delete restrict,
  financial_event_id uuid not null,
  period_id uuid,
  effective_at timestamptz not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  description text not null,
  status text not null default 'posted'
    check (status in ('draft','posted','reversed')),
  total_debit numeric(20,2) not null check (total_debit >= 0),
  total_credit numeric(20,2) not null check (total_credit >= 0),
  reversal_of uuid,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (total_debit = total_credit),
  check (
    (status = 'posted' and posted_at is not null) or
    (status <> 'posted')
  ),
  unique(accounting_entity_id, financial_event_id),
  unique(accounting_entity_id, id),
  foreign key (accounting_entity_id, financial_event_id)
    references public.financial_events(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, period_id)
    references public.accounting_periods(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, reversal_of)
    references public.accounting_journal_entries(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_journal_entries_entity_effective
  on public.accounting_journal_entries(accounting_entity_id, effective_at desc);
create index if not exists idx_journal_entries_period
  on public.accounting_journal_entries(period_id, status);

create table if not exists public.accounting_journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null,
  accounting_entity_id uuid not null references public.accounting_entities(id) on delete restrict,
  line_no integer not null check (line_no > 0),
  account_id uuid not null,
  account_code text not null,
  account_name text not null,
  debit numeric(20,2) not null default 0 check (debit >= 0),
  credit numeric(20,2) not null default 0 check (credit >= 0),
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (debit > 0 and credit = 0) or
    (credit > 0 and debit = 0)
  ),
  unique(journal_entry_id, line_no),
  foreign key (accounting_entity_id, journal_entry_id)
    references public.accounting_journal_entries(accounting_entity_id, id)
    on delete cascade,
  foreign key (accounting_entity_id, account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_journal_lines_entity_account
  on public.accounting_journal_lines(accounting_entity_id, account_code);
create index if not exists idx_journal_lines_entry
  on public.accounting_journal_lines(journal_entry_id, line_no);

-- Enforce that postings cannot target a closed period.
create or replace function public.accounting_assert_open_period()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  if new.period_id is null then
    return new;
  end if;

  select status into v_status
  from public.accounting_periods
  where id = new.period_id
    and accounting_entity_id = new.accounting_entity_id;

  if v_status is null then
    raise exception 'ACCOUNTING_PERIOD_ENTITY_MISMATCH';
  end if;

  if v_status <> 'open' then
    raise exception 'ACCOUNTING_PERIOD_NOT_OPEN';
  end if;

  return new;
end;
$$;

revoke execute on function public.accounting_assert_open_period() from public, anon, authenticated;
grant execute on function public.accounting_assert_open_period() to service_role;

drop trigger if exists trg_accounting_assert_open_period on public.accounting_journal_entries;
create trigger trg_accounting_assert_open_period
before insert or update of period_id, status, effective_at
on public.accounting_journal_entries
for each row execute function public.accounting_assert_open_period();

-- All writes and reads are server-mediated until a dedicated tenant-aware API is approved.
alter table public.accounting_entities enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.accounting_accounts enable row level security;
alter table public.financial_events enable row level security;
alter table public.accounting_subledger_entries enable row level security;
alter table public.accounting_journal_entries enable row level security;
alter table public.accounting_journal_lines enable row level security;

revoke all on public.accounting_entities from anon, authenticated;
revoke all on public.accounting_periods from anon, authenticated;
revoke all on public.accounting_accounts from anon, authenticated;
revoke all on public.financial_events from anon, authenticated;
revoke all on public.accounting_subledger_entries from anon, authenticated;
revoke all on public.accounting_journal_entries from anon, authenticated;
revoke all on public.accounting_journal_lines from anon, authenticated;

grant select, insert, update, delete on public.accounting_entities to service_role;
grant select, insert, update, delete on public.accounting_periods to service_role;
grant select, insert, update, delete on public.accounting_accounts to service_role;
grant select, insert, update, delete on public.financial_events to service_role;
grant select, insert, update, delete on public.accounting_subledger_entries to service_role;
grant select, insert, update, delete on public.accounting_journal_entries to service_role;
grant select, insert, update, delete on public.accounting_journal_lines to service_role;

commit;
