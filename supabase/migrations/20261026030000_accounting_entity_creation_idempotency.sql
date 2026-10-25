-- Prevent duplicate accounting entity creation when the same governed request is retried.
-- Idempotency is scoped to the authenticated creator and request key stored in metadata.

create unique index if not exists uq_accounting_entities_creation_request
on public.accounting_entities (
  created_by,
  ((metadata ->> 'creation_request_id'))
)
where created_by is not null
  and nullif(metadata ->> 'creation_request_id', '') is not null;
