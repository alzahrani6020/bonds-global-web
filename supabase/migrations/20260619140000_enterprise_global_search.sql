-- Enterprise Global Search
-- Materialized view across clients, projects, assets, studies, reports.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.global_search_index AS
SELECT
  'advisory_client'::text AS entity_type,
  c.id AS entity_id,
  c.name AS title,
  coalesce(c.email, '') || ' ' || coalesce(c.company_name, '') || ' ' || coalesce(c.phone, '') AS content,
  c.created_at
FROM public.advisory_clients c
WHERE c.deleted_at IS NULL
UNION ALL
SELECT
  'advisory_project'::text,
  p.id,
  p.name,
  coalesce(c.name, '') || ' ' || coalesce(p.description, '') || ' ' || p.status,
  p.created_at
FROM public.advisory_projects p
LEFT JOIN public.advisory_clients c ON c.id = p.client_id
WHERE p.deleted_at IS NULL
UNION ALL
SELECT
  'recovery_asset'::text,
  r.id,
  r.name,
  coalesce(r.category, '') || ' ' || coalesce(r.status, '') || ' ' || coalesce(r.priority, ''),
  r.created_at
FROM public.recovery_assets r
WHERE r.deleted_at IS NULL
UNION ALL
SELECT
  'advisory_feasibility_study'::text,
  s.id,
  s.title,
  coalesce(c.name, '') || ' ' || coalesce(s.sector, '') || ' ' || coalesce(s.country, '') || ' ' || s.status,
  s.created_at
FROM public.advisory_feasibility_studies s
LEFT JOIN public.advisory_clients c ON c.id = s.client_id
UNION ALL
SELECT
  'ai_advisor_report'::text,
  rep.id,
  rep.title,
  coalesce(rep.summary->>'health_label', '') || ' ' || coalesce(rep.summary->>'risk_level', ''),
  rep.created_at
FROM public.ai_advisor_reports rep;

CREATE INDEX IF NOT EXISTS idx_global_search_title_trgm ON public.global_search_index USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_content_trgm ON public.global_search_index USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_search_entity ON public.global_search_index(entity_type, entity_id);

-- RPC: fuzzy ranked search
CREATE OR REPLACE FUNCTION public.global_search(p_query text, p_limit int DEFAULT 20, p_entity_types text[] DEFAULT NULL)
RETURNS TABLE(entity_type text, entity_id uuid, title text, content text, rank real) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.entity_type,
    g.entity_id,
    g.title,
    g.content,
    (
      similarity(lower(g.title), lower(p_query)) * 2.0 +
      similarity(lower(g.content), lower(p_query)) * 1.0
    )::real AS rank
  FROM public.global_search_index g
  WHERE
    (p_entity_types IS NULL OR g.entity_type = ANY(p_entity_types))
    AND (
      lower(g.title) % lower(p_query)
      OR lower(g.content) % lower(p_query)
      OR g.title ILIKE '%' || p_query || '%'
      OR g.content ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh index
CREATE OR REPLACE FUNCTION public.refresh_global_search_index()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.global_search_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
