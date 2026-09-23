-- Harden Moyasar invoices RLS.
-- Server-side administrative access uses service_role, which bypasses RLS.
-- Browser roles receive least-privilege access only.

ALTER TABLE public.moyasar_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moyasar_invoices FORCE ROW LEVEL SECURITY;

-- Remove the dangerously broad policy that applies to PUBLIC.
DROP POLICY IF EXISTS "Service role can manage all moyasar invoices"
  ON public.moyasar_invoices;

-- Recreate user read policy with an explicit authenticated role.
DROP POLICY IF EXISTS "Users can view own moyasar invoices"
  ON public.moyasar_invoices;

CREATE POLICY "Users can view own moyasar invoices"
  ON public.moyasar_invoices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Browser roles should not have unrestricted invoice write access.
REVOKE ALL ON TABLE public.moyasar_invoices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.moyasar_invoices
  FROM authenticated;

-- Authenticated users only need SELECT, constrained by RLS above.
GRANT SELECT ON TABLE public.moyasar_invoices TO authenticated;

-- service_role retains server-side table privileges.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.moyasar_invoices
  TO service_role;
