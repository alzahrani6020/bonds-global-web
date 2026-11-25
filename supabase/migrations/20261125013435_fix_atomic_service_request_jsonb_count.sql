-- Applied in production: replaced nonexistent jsonb_object_length(jsonb)
-- with SELECT count(*) FROM jsonb_object_keys(p_values).
-- The final corrected implementation is checked in under migration 20261125013416.
select 1;
