-- Narrow the platform-owner invitation INSERT policy to the existing
-- invitation identity and validity invariants. This is a security fix:
-- owner billing exemption must not allow spoofed created_by or stale tokens.
ALTER POLICY hr_platform_owner_insert ON public.hr_saas_invitations
WITH CHECK (
 (SELECT public.is_super_admin())
 AND created_by=(SELECT auth.uid())
 AND status='pending'
 AND accepted_by IS NULL AND accepted_at IS NULL
 AND expires_at>now() AND expires_at<=now()+interval '7 days'
 AND invited_email=lower(btrim(invited_email))
 AND EXISTS (
  SELECT 1 FROM public.hr_saas_workspaces w
  WHERE w.id=workspace_id AND w.owner_user_id=(SELECT auth.uid())
 )
);
