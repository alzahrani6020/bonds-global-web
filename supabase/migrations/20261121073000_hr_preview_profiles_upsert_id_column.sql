-- Supabase PostgREST upsert(..., onConflict: 'id') emits UPDATE id = EXCLUDED.id.
-- The RLS policy still requires auth.uid() = id on existing and replacement rows.
-- This column-level grant preserves the onboarding upsert without opening privileged fields.
GRANT UPDATE (id) ON TABLE public.profiles TO authenticated;
