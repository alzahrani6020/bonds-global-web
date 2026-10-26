begin;

-- Financial Core Wave 19: deterministic FX translation capability.
-- Reuses the existing consolidation service; no parallel service, ledger,
-- exchange-rate table, or external rate provider is created.

insert into public.service_capability_map(
  service_id,capability_code,run_order,is_required,metadata
)
select
  s.id,
  'fx_translation_run',
  25,
  false,
  '{"wave":19,"deterministic":true,"explicit_rates":true,"no_external_rate_provider":true}'::jsonb
from public.service_catalog s
where s.code='consolidation_analysis'
on conflict(service_id,capability_code) do update set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
