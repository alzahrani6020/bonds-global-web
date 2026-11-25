-- Align staff workspace access and invitation acceptance with the verified
-- platform-owner exemption while retaining workspace ownership, active
-- membership, confirmed email and invitation-token checks.
CREATE OR REPLACE FUNCTION hr_saas_private.has_active_access(target_workspace uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.hr_saas_workspaces w
  WHERE w.id=target_workspace
    AND (
      EXISTS (
       SELECT 1 FROM public.company_program_entitlements e
       WHERE e.owner_user_id=w.owner_user_id AND e.product_code IN ('hr','suite')
        AND e.status IN ('active','trial') AND e.starts_at<=now()
        AND (e.ends_at IS NULL OR e.ends_at>now())
      )
      OR EXISTS (
       SELECT 1 FROM public.admin_roles a
       WHERE a.user_id=w.owner_user_id AND a.role='super_admin'
      )
    )
    AND (
      w.owner_user_id=(SELECT auth.uid())
      OR EXISTS (
       SELECT 1 FROM public.hr_saas_memberships m
       WHERE m.workspace_id=w.id AND m.user_id=(SELECT auth.uid()) AND m.status='active'
      )
    )
 );
$function$
;
CREATE OR REPLACE FUNCTION public.hr_saas_accept_invitation(invite_token uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 invite public.hr_saas_invitations%rowtype;
 actor_id uuid := (SELECT auth.uid());
 verified_email text;
 new_membership_id uuid;
BEGIN
 IF actor_id IS NULL OR invite_token IS NULL THEN
  RAISE EXCEPTION 'Invitation cannot be accepted' USING errcode='42501';
 END IF;
 SELECT lower(btrim(u.email)) INTO verified_email FROM auth.users u
 WHERE u.id=actor_id AND u.email_confirmed_at IS NOT NULL;
 IF verified_email IS NULL THEN
  RAISE EXCEPTION 'Verified email required' USING errcode='42501';
 END IF;
 SELECT * INTO invite FROM public.hr_saas_invitations i WHERE i.token=invite_token FOR UPDATE;
 IF NOT FOUND OR invite.status<>'pending' OR invite.expires_at<=now()
 OR invite.invited_email<>verified_email THEN
  RAISE EXCEPTION 'Invitation cannot be accepted' USING errcode='42501';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.hr_saas_workspaces w WHERE w.id=invite.workspace_id
  AND (
   EXISTS (
    SELECT 1 FROM public.company_program_entitlements e
    WHERE e.owner_user_id=w.owner_user_id AND e.product_code IN ('hr','suite')
     AND e.status IN ('active','trial') AND e.starts_at<=now()
     AND (e.ends_at IS NULL OR e.ends_at>now())
   ) OR EXISTS (
    SELECT 1 FROM public.admin_roles a
    WHERE a.user_id=w.owner_user_id AND a.role='super_admin'
   )
  )
 ) THEN
  RAISE EXCEPTION 'Invitation cannot be accepted' USING errcode='42501';
 END IF;
 INSERT INTO public.hr_saas_memberships(workspace_id,user_id,employee_id,role,status)
 VALUES(invite.workspace_id,actor_id,invite.employee_id,invite.role,'active')
 RETURNING id INTO new_membership_id;
 UPDATE public.hr_saas_invitations SET status='accepted',accepted_by=actor_id,accepted_at=now()
 WHERE id=invite.id;
 RETURN new_membership_id;
END
$function$
;
REVOKE ALL ON FUNCTION public.hr_saas_accept_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_saas_accept_invitation(uuid) TO authenticated;
