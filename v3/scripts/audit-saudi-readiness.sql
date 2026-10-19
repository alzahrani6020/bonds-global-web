-- Saudi Arabia V3 readiness audit. Read-only.
with sa_profile as (
  select *
  from public.country_profiles
  where country_code='SA'
),
activity as (
  select
    count(*) as total,
    count(*) filter (where availability_status='unknown') as unknown,
    count(*) filter (where availability_status<>'unknown') as localized,
    count(*) filter (where source is not null and source<>'') as sourced
  from public.canonical_activity_country
  where country_code='SA'
),
models as (
  select
    count(*) as total,
    count(*) filter (where status='estimated') as estimated,
    count(*) filter (where status='verified') as verified,
    count(*) filter (where status='unverified') as unverified,
    count(*) filter (where source is not null and source<>'') as sourced,
    count(*) filter (where tax_rate is not null) as with_tax,
    count(*) filter (where financing_rate is not null) as with_financing,
    count(*) filter (where inflation_rate is not null) as with_inflation
  from public.country_model_overrides
  where country_code='SA'
),
regs as (
  select
    count(*) as total,
    count(*) filter (where verification_status='verified') as verified,
    count(*) filter (where source is not null and source<>'') as sourced
  from public.country_regulatory_requirements
  where country_code='SA'
),
market as (
  select
    count(*) as total,
    count(*) filter (where cmd.currency_code='SAR') as sar_rows,
    count(*) filter (where cmd.currency_code is null) as unknown_currency,
    count(*) filter (where cmd.source is not null and cmd.source<>'') as sourced
  from public.city_market_data cmd
  join public.cities c on c.id=cmd.city_id
  where c.country_code='SA'
),
indicators as (
  select
    count(*) as total,
    count(*) filter (where ci.currency_code='SAR') as sar_rows,
    count(*) filter (where ci.currency_code is null) as unknown_currency,
    count(*) filter (where ci.overall_confidence is not null) as with_confidence
  from public.city_indicators ci
  join public.cities c on c.id=ci.city_id
  where c.country_code='SA'
),
macro as (
  select
    count(*) as total,
    count(distinct metric_code) as metrics
  from public.country_indicator_observations
  where country_code='SA'
)
select
  p.country_code,
  p.currency_code,
  p.fallback_policy,
  (select count(*) from public.cities where country_code='SA') as cities,
  a.total as activity_rows,
  a.unknown as activity_unknown,
  a.localized as activity_localized,
  a.sourced as activity_sourced,
  m.total as model_rows,
  m.estimated as models_estimated,
  m.verified as models_verified,
  m.unverified as models_unverified,
  m.sourced as models_sourced,
  m.with_tax as models_with_tax,
  m.with_financing as models_with_financing,
  m.with_inflation as models_with_inflation,
  r.total as regulatory_rows,
  r.verified as regulations_verified,
  r.sourced as regulations_sourced,
  mk.total as market_rows,
  mk.sar_rows as market_sar_rows,
  mk.unknown_currency as market_unknown_currency,
  mk.sourced as market_sourced,
  i.total as indicator_rows,
  i.sar_rows as indicator_sar_rows,
  i.unknown_currency as indicator_unknown_currency,
  i.with_confidence as indicator_with_confidence,
  mc.total as macro_rows,
  mc.metrics as macro_metrics,
  case when p.currency_code='SAR' and p.fallback_policy='no_cross_country_fallback' then 'PASS' else 'FAIL' end as gate_country_profile,
  case when (select count(*) from public.cities where country_code='SA') > 0 then 'PASS' else 'FAIL' end as gate_cities,
  case when mk.total > 0 and mk.unknown_currency=0 and mk.sourced=mk.total then 'PASS' else 'PARTIAL' end as gate_market_data,
  case when i.total > 0 and i.unknown_currency=0 and i.with_confidence=i.total then 'PASS' else 'PARTIAL' end as gate_city_indicators,
  case when mc.metrics >= 6 then 'PASS' else 'PARTIAL' end as gate_macro,
  case when a.unknown=0 and a.sourced=a.total and a.total>0 then 'PASS' else 'BLOCKED' end as gate_activities,
  case when m.verified=m.total and m.total>0 then 'PASS' else 'BLOCKED' end as gate_financial_models,
  case when r.verified=r.total and r.total>0 then 'PASS' else 'BLOCKED' end as gate_regulations
from sa_profile p
cross join activity a
cross join models m
cross join regs r
cross join market mk
cross join indicators i
cross join macro mc;
