-- Persistent AI model routing lifecycle state.
-- Stores only operational routing metadata; no prompts, customer content, or model outputs.
-- Service-role only. One logical row ("global") controls the active production routing state.

CREATE TABLE IF NOT EXISTS public.ai_model_lifecycle_state (
  scope text PRIMARY KEY,
  lifecycle_version text NOT NULL,
  generation bigint NOT NULL CHECK (generation >= 1),
  champion_model_id text NOT NULL,
  previous_champion_model_id text,
  canary jsonb,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_model_lifecycle_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_model_lifecycle_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_model_lifecycle_state TO service_role;

DROP POLICY IF EXISTS "service_role_manage_ai_model_lifecycle_state"
  ON public.ai_model_lifecycle_state;

CREATE POLICY "service_role_manage_ai_model_lifecycle_state"
  ON public.ai_model_lifecycle_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ai_model_lifecycle_state IS
  'Persistent AI model champion/canary routing state. Service-role only; contains no customer prompts or model outputs.';
COMMENT ON COLUMN public.ai_model_lifecycle_state.state_hash IS
  'SHA-256 integrity hash of the canonical lifecycle state payload.';
