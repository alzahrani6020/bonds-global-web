create or replace function public.enforce_correspondence_register_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if old.outgoing_number is not null and new.outgoing_number is distinct from old.outgoing_number then
    raise exception 'Outgoing register number is immutable once assigned' using errcode = '55000';
  end if;
  if old.incoming_number is not null and new.incoming_number is distinct from old.incoming_number then
    raise exception 'Incoming register number is immutable once assigned' using errcode = '55000';
  end if;
  if old.archive_number is not null and new.archive_number is distinct from old.archive_number then
    raise exception 'Archive register number is immutable once assigned' using errcode = '55000';
  end if;

  if (old.outgoing_number is not null or old.incoming_number is not null)
     and new.direction is distinct from old.direction then
    raise exception 'Correspondence direction is immutable after register numbering' using errcode = '55000';
  end if;

  if new.outgoing_number is not null and new.direction <> 'outgoing' then
    raise exception 'Outgoing number requires outgoing direction' using errcode = '23514';
  end if;
  if new.incoming_number is not null and new.direction <> 'incoming' then
    raise exception 'Incoming number requires incoming direction' using errcode = '23514';
  end if;
  if new.related_document_id is not null and new.related_document_id = new.id then
    raise exception 'A correspondence document cannot relate to itself' using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_correspondence_register_immutability on public.correspondence_documents;
create trigger trg_correspondence_register_immutability
before update on public.correspondence_documents
for each row execute function public.enforce_correspondence_register_immutability();

revoke execute on function public.enforce_correspondence_register_immutability() from public, anon, authenticated;
grant execute on function public.enforce_correspondence_register_immutability() to service_role;
