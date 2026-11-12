-- Harden governed investment-interest leads to service-role only.
-- Additive privilege hardening only; no data mutation.

revoke all on public.bonds_investment_interest_leads from public;
revoke all on public.bonds_investment_interest_leads from anon;
revoke all on public.bonds_investment_interest_leads from authenticated;

grant all on public.bonds_investment_interest_leads to service_role;
