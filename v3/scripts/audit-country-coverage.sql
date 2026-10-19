-- Read-only operational coverage audit for Bonds V3 country context.
-- Run against the active production database. This script does not mutate data.

with
city_stats as (
  select country_code,
         count(*) as cities,
         count(*) filter (where is_active is true) as active_cities
  from public.cities
  group by country_code
),
activity_stats as (
  select country_code,
         count(*) as activity_rows,
         count(*) filter (where availability_status <> 'unknown') as localized_activities,
         count(*) filter (where availability_status = 'unknown') as activities_unknown,
         count(*) filter (where source is not null and source <> '') as activities_sourced
  from public.canonical_activity_country
  group by country_code
),
model_stats as (
  select country_code,
         count(*) as model_rows,
         count(*) filter (where status = 'estimated') as models_estimated,
         count(*) filter (where status = 'verified') as models_verified,
         count(*) filter (where status = 'unverified') as models_unverified
  from public.country_model_overrides
  group by country_code
),
reg_stats as (
  select country_code,
         count(*) as regulatory_rows,
         count(*) filter (where verification_status = 'verified') as regulatory_verified
  from public.country_regulatory_requirements
  group by country_code
),
macro_stats as (
  select country_code,
         count(*) as observation_rows,
         count(distinct metric_code) as macro_metrics,
         min(year) as oldest_metric_year,
         max(year) as newest_metric_year
  from public.country_indicator_observations
  group by country_code
),
market_stats as (
  select c.country_code,
         count(*) as market_rows,
         count(*) filter (where cmd.currency_code = p.currency_code) as market_local_currency_rows,
         count(*) filter (where cmd.currency_code is not null and cmd.currency_code <> p.currency_code) as market_foreign_source_currency_rows,
         count(*) filter (where cmd.currency_code is null) as market_currency_unknown,
         string_agg(distinct coalesce(cmd.currency_code, 'UNKNOWN'), ',' order by coalesce(cmd.currency_code, 'UNKNOWN')) as market_currencies
  from public.city_market_data cmd
  join public.cities c on c.id = cmd.city_id
  join public.country_profiles p on p.country_code = c.country_code
  group by c.country_code
),
indicator_stats as (
  select c.country_code,
         count(*) as indicator_rows,
         count(*) filter (where ci.currency_code is null) as indicator_currency_unknown,
         string_agg(distinct coalesce(ci.currency_code, 'UNKNOWN'), ',' order by coalesce(ci.currency_code, 'UNKNOWN')) as indicator_currencies
  from public.city_indicators ci
  join public.cities c on c.id = ci.city_id
  group by c.country_code
)
select
  p.country_code,
  p.name_ar,
  p.currency_code as profile_currency,
  p.fallback_policy,
  coalesce(cs.cities, 0) as cities,
  coalesce(cs.active_cities, 0) as active_cities,
  coalesce(ac.activity_rows, 0) as activity_rows,
  coalesce(ac.localized_activities, 0) as localized_activities,
  coalesce(ac.activities_unknown, 0) as activities_unknown,
  coalesce(ac.activities_sourced, 0) as activities_sourced,
  coalesce(ms.model_rows, 0) as model_rows,
  coalesce(ms.models_estimated, 0) as models_estimated,
  coalesce(ms.models_verified, 0) as models_verified,
  coalesce(ms.models_unverified, 0) as models_unverified,
  coalesce(rs.regulatory_rows, 0) as regulatory_rows,
  coalesce(rs.regulatory_verified, 0) as regulatory_verified,
  coalesce(mac.observation_rows, 0) as macro_observation_rows,
  coalesce(mac.macro_metrics, 0) as macro_metrics,
  mac.oldest_metric_year,
  mac.newest_metric_year,
  coalesce(mk.market_rows, 0) as market_rows,
  coalesce(mk.market_local_currency_rows, 0) as market_local_currency_rows,
  coalesce(mk.market_foreign_source_currency_rows, 0) as market_foreign_source_currency_rows,
  coalesce(mk.market_currency_unknown, 0) as market_currency_unknown,
  mk.market_currencies,
  coalesce(ind.indicator_rows, 0) as indicator_rows,
  coalesce(ind.indicator_currency_unknown, 0) as indicator_currency_unknown,
  ind.indicator_currencies
from public.country_profiles p
left join city_stats cs using (country_code)
left join activity_stats ac using (country_code)
left join model_stats ms using (country_code)
left join reg_stats rs using (country_code)
left join macro_stats mac using (country_code)
left join market_stats mk using (country_code)
left join indicator_stats ind using (country_code)
order by p.country_code;
