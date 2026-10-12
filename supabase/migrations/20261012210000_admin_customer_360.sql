-- Admin Customer 360 metadata
-- Additive tables for internal notes and tags that work for every auth user.

CREATE TABLE IF NOT EXISTS public.admin_customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_customer_notes_user_created
  ON public.admin_customer_notes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_customer_tags (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL CHECK (char_length(trim(tag)) BETWEEN 1 AND 64),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_admin_customer_tags_tag
  ON public.admin_customer_tags(tag);

ALTER TABLE public.admin_customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_customer_tags ENABLE ROW LEVEL SECURITY;

-- Browser clients do not need direct table access. Admin access is mediated by
-- the server-side service role through /api/admin.
REVOKE ALL ON public.admin_customer_notes FROM anon, authenticated;
REVOKE ALL ON public.admin_customer_tags FROM anon, authenticated;
