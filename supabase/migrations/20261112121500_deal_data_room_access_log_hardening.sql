-- F.2 hardening: keep the deal data-room access log append-only for service_role.
-- The API only needs SELECT + INSERT on this ledger.

revoke update, delete, truncate on table public.bonds_deal_document_access_log from service_role;
grant select, insert on table public.bonds_deal_document_access_log to service_role;
