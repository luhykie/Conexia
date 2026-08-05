-- Requirement 3:
-- Produce IRO Admin performance indicators from immutable workflow events.
-- Optional bounds apply to event counts and the departmental submission set.

create index if not exists workflow_events_reporting_idx
  on workflow_events (created_at, to_status, action);

create or replace function get_review_turnaround_report(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role role_key_enum;
  v_result jsonb;
begin
  select role_key into v_role
    from profiles
   where id = auth.uid() and status = 'active';

  if v_role not in ('admin', 'super_admin') then
    raise exception 'Only IRO Admin or Super Admin can generate performance reports.';
  end if;

  if p_from is not null and p_to is not null and p_to < p_from then
    raise exception 'The report end date must not be earlier than its start date.';
  end if;

  with milestones as (
    select
      s.id,
      s.department,
      s.created_at as submitted_at,
      min(e.created_at) filter (where e.to_status = 'logged') as logged_at,
      min(e.created_at) filter (
        where e.action = 'routed_to_legal'
           or e.to_status = 'review_form_generated'
      ) as validated_at,
      min(e.created_at) filter (
        where e.to_status in ('approved', 'corrections_needed')
      ) as legal_decision_at,
      min(e.created_at) filter (where e.to_status = 'approved') as approved_at,
      min(e.created_at) filter (where e.to_status = 'notarized') as notarized_at
    from submissions s
    left join workflow_events e on e.submission_id = s.id
    where (p_from is null or s.created_at >= p_from)
      and (p_to is null or s.created_at <= p_to)
    group by s.id, s.department, s.created_at
  ),
  averages as (
    select
      round((avg(extract(epoch from (logged_at - submitted_at)))
        filter (where logged_at >= submitted_at) / 3600)::numeric, 1)
        as submission_to_logging,
      round((avg(extract(epoch from (validated_at - logged_at)))
        filter (where validated_at >= logged_at) / 3600)::numeric, 1)
        as logging_to_validation,
      round((avg(extract(epoch from (legal_decision_at - validated_at)))
        filter (where legal_decision_at >= validated_at) / 3600)::numeric, 1)
        as validation_to_legal_decision,
      round((avg(extract(epoch from (notarized_at - approved_at)))
        filter (where notarized_at >= approved_at) / 3600)::numeric, 1)
        as approval_to_notarization
    from milestones
  ),
  event_counts as (
    select
      count(*) filter (
        where to_status in ('approved', 'corrections_needed')
      ) as reviewed,
      count(*) filter (where to_status = 'corrections_needed') as returned,
      count(*) filter (where to_status = 'approved') as approved,
      count(*) filter (where to_status = 'notarized') as notarized
    from workflow_events
    where (p_from is null or created_at >= p_from)
      and (p_to is null or created_at <= p_to)
  ),
  department_rows as (
    select
      coalesce(nullif(trim(department), ''), 'Unknown department') as department,
      count(*) as total,
      count(*) filter (where status = 'approved') as approved,
      count(*) filter (where status = 'corrections_needed') as returned
    from submissions
    where (p_from is null or created_at >= p_from)
      and (p_to is null or created_at <= p_to)
    group by coalesce(nullif(trim(department), ''), 'Unknown department')
  )
  select jsonb_build_object(
    'reviewed', ec.reviewed,
    'returned', ec.returned,
    'approved', ec.approved,
    'notarized', ec.notarized,
    'averageStageHours', jsonb_build_object(
      'submissionToLogging', a.submission_to_logging,
      'loggingToValidation', a.logging_to_validation,
      'validationToLegalDecision', a.validation_to_legal_decision,
      'approvalToNotarization', a.approval_to_notarization
    ),
    'departments', coalesce(
      (select jsonb_agg(to_jsonb(d) order by d.department) from department_rows d),
      '[]'::jsonb
    ),
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'generatedAt', now()
  ) into v_result
  from event_counts ec cross join averages a;

  return v_result;
end;
$$;

revoke all on function get_review_turnaround_report(timestamptz, timestamptz) from public;
grant execute on function get_review_turnaround_report(timestamptz, timestamptz) to authenticated;
