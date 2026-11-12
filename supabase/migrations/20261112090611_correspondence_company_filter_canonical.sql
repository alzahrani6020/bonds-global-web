create or replace function public.get_correspondence_summary_v2(
  p_user_id uuid,
  p_company_ids uuid[],
  p_read_all boolean,
  p_workspace_context jsonb,
  p_filter_company_id uuid
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  with visible as (
    select d.status, d.priority, d.delivery_status
    from public.correspondence_documents d
    where (
      p_read_all
      or d.owner_user_id = p_user_id
      or (
        d.company_id = any(coalesce(p_company_ids, array[]::uuid[]))
        and d.confidentiality in ('public','internal')
      )
    )
    and (p_filter_company_id is null or d.company_id = p_filter_company_id)
    and (
      coalesce(p_workspace_context, '{}'::jsonb) = '{}'::jsonb
      or d.workspace_context @> p_workspace_context
    )
  )
  select jsonb_build_object(
    'total', count(*),
    'urgent', count(*) filter (where priority = 'urgent'),
    'failed_delivery', count(*) filter (where delivery_status in ('failed','bounced','complained')),
    'by_status', jsonb_build_object(
      'draft', count(*) filter (where status = 'draft'),
      'submitted', count(*) filter (where status = 'submitted'),
      'under_review', count(*) filter (where status = 'under_review'),
      'approved', count(*) filter (where status = 'approved'),
      'issued', count(*) filter (where status = 'issued'),
      'sent', count(*) filter (where status = 'sent'),
      'archived', count(*) filter (where status = 'archived'),
      'returned', count(*) filter (where status = 'returned'),
      'rejected', count(*) filter (where status = 'rejected'),
      'cancelled', count(*) filter (where status = 'cancelled')
    )
  )
  from visible;
$$;

revoke all on function public.get_correspondence_summary_v2(uuid,uuid[],boolean,jsonb,uuid)
from public, anon, authenticated;
grant execute on function public.get_correspondence_summary_v2(uuid,uuid[],boolean,jsonb,uuid)
to service_role;

create or replace function public.get_correspondence_my_work_v2(
  p_user_id uuid,
  p_role text,
  p_permissions text[],
  p_read_all boolean,
  p_company_ids uuid[],
  p_workspace_context jsonb,
  p_filter_company_id uuid,
  p_offset integer,
  p_limit integer
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  with filtered as (
    select
      t.id, t.document_id, t.task_type, t.assigned_user_id, t.assigned_role,
      t.status, t.due_at, t.completed_at, t.completed_by, t.metadata,
      t.created_at, t.updated_at,
      jsonb_build_object(
        'id', d.id,
        'reference_number', d.reference_number,
        'title', d.title,
        'subject', d.subject,
        'status', d.status,
        'priority', d.priority,
        'confidentiality', d.confidentiality,
        'owner_user_id', d.owner_user_id,
        'company_id', d.company_id,
        'updated_at', d.updated_at,
        'workspace_context', d.workspace_context
      ) as correspondence_documents
    from public.correspondence_tasks t
    join public.correspondence_documents d on d.id = t.document_id
    where t.status = 'open'
      and (
        p_read_all
        or d.owner_user_id = p_user_id
        or (
          d.company_id = any(coalesce(p_company_ids, array[]::uuid[]))
          and d.confidentiality in ('public','internal')
        )
      )
      and (p_filter_company_id is null or d.company_id = p_filter_company_id)
      and (
        t.assigned_user_id = p_user_id
        or (
          t.assigned_user_id is null
          and (
            p_read_all
            or t.assigned_role is null
            or t.assigned_role = p_role
            or t.task_type = any(coalesce(p_permissions, array[]::text[]))
          )
        )
      )
      and (
        coalesce(p_workspace_context, '{}'::jsonb) = '{}'::jsonb
        or d.workspace_context @> p_workspace_context
      )
  ),
  paged as (
    select *
    from filtered
    order by due_at asc nulls last, created_at asc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'tasks', coalesce(
      (select jsonb_agg(to_jsonb(paged) order by due_at asc nulls last, created_at asc) from paged),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_correspondence_my_work_v2(uuid,text,text[],boolean,uuid[],jsonb,uuid,integer,integer)
from public, anon, authenticated;
grant execute on function public.get_correspondence_my_work_v2(uuid,text,text[],boolean,uuid[],jsonb,uuid,integer,integer)
to service_role;
