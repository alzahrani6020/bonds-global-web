-- Fix missing foreign key relationship between bonds_projects and cities.
-- Supabase PostgREST requires this to resolve the city:city_id embedded resource.

ALTER TABLE public.bonds_projects
  DROP CONSTRAINT IF EXISTS bonds_projects_city_id_fkey;

ALTER TABLE public.bonds_projects
  ADD CONSTRAINT bonds_projects_city_id_fkey
  FOREIGN KEY (city_id)
  REFERENCES public.cities(id)
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT bonds_projects_city_id_fkey ON public.bonds_projects IS 'Links a project to its canonical city for City Intelligence / ECC lookups.';
