alter table public.correspondence_documents
  add column if not exists outgoing_number text,
  add column if not exists incoming_number text,
  add column if not exists archive_number text,
  add column if not exists related_document_id uuid references public.correspondence_documents(id) on delete set null;

create unique index if not exists correspondence_documents_outgoing_number_key
  on public.correspondence_documents(outgoing_number)
  where outgoing_number is not null;

create unique index if not exists correspondence_documents_incoming_number_key
  on public.correspondence_documents(incoming_number)
  where incoming_number is not null;

create unique index if not exists correspondence_documents_archive_number_key
  on public.correspondence_documents(archive_number)
  where archive_number is not null;

create index if not exists idx_correspondence_related_document
  on public.correspondence_documents(related_document_id)
  where related_document_id is not null;

create table if not exists public.correspondence_register_sequences (
  kind text not null check (kind in ('outgoing','incoming','archive')),
  year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (kind, year)
);

alter table public.correspondence_register_sequences enable row level security;

revoke all on table public.correspondence_register_sequences from anon, authenticated;
grant select, insert, update on table public.correspondence_register_sequences to service_role;

create or replace function public.next_correspondence_register(p_kind text)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  y integer := extract(year from now())::integer;
  n integer;
  prefix text;
begin
  if p_kind not in ('outgoing','incoming','archive') then
    raise exception 'Invalid correspondence register kind' using errcode = '22023';
  end if;

  insert into public.correspondence_register_sequences(kind, year, last_number, updated_at)
  values (p_kind, y, 1, now())
  on conflict(kind, year) do update
    set last_number = public.correspondence_register_sequences.last_number + 1,
        updated_at = now()
  returning last_number into n;

  prefix := case p_kind
    when 'outgoing' then 'OUT'
    when 'incoming' then 'IN'
    when 'archive' then 'ARC'
  end;

  return prefix || '-' || y::text || '-' || lpad(n::text, 6, '0');
end;
$function$;

revoke execute on function public.next_correspondence_register(text) from public, anon, authenticated;
grant execute on function public.next_correspondence_register(text) to service_role;
