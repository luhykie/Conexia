-- IRO Staff must-haves:
-- log incoming submissions, complete a Review Form, and route that form to
-- IRO Admin. Legal decisions and final approval are intentionally absent from
-- these staff-only functions.

create sequence if not exists submission_tracking_number_seq;

create or replace function enforce_iro_staff_submission_limits()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_role role_key_enum;
begin
  select role_key into v_role from profiles where id = auth.uid();

  if v_role = 'staff' then
    if new.assigned_legal_counsel is distinct from old.assigned_legal_counsel
       or new.validated_by is distinct from old.validated_by
       or new.validated_at is distinct from old.validated_at
       or new.legal_comments is distinct from old.legal_comments
       or new.legal_reviewed_by is distinct from old.legal_reviewed_by
       or new.legal_reviewed_at is distinct from old.legal_reviewed_at
       or new.pair_review_status is distinct from old.pair_review_status
       or new.notarial_reference is distinct from old.notarial_reference
       or new.notarial_date is distinct from old.notarial_date then
      raise exception 'IRO Staff cannot make or override Legal and final-approval decisions.';
    end if;

    if new.status is distinct from old.status and not (
      (old.status in ('submitted', 'resubmitted') and new.status = 'logged')
      or (old.status = 'logged' and new.status = 'review_form_generated')
    ) then
      raise exception 'IRO Staff is not authorized for this workflow transition.';
    end if;

    if new.current_stage is distinct from old.current_stage
       and new.current_stage not in ('iro_staff', 'iro_admin') then
      raise exception 'IRO Staff can only route a record to IRO Admin.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_enforce_iro_staff_limits on submissions;
create trigger submissions_enforce_iro_staff_limits
before update on submissions
for each row execute function enforce_iro_staff_submission_limits();

create or replace function log_incoming_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role role_key_enum;
  v_submission submissions%rowtype;
  v_from_status submission_status_enum;
begin
  select role_key into v_role
    from profiles
   where id = auth.uid() and status = 'active';

  if v_role is null or v_role not in ('staff', 'admin') then
    raise exception 'Only IRO Staff or IRO Admin can log incoming submissions.';
  end if;

  select * into v_submission
    from submissions
   where id = p_submission_id
   for update;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if v_submission.status not in ('submitted', 'resubmitted') then
    raise exception 'Only submitted or resubmitted records can be logged.';
  end if;

  v_from_status := v_submission.status;

  update submissions
     set tracking_number = coalesce(
           tracking_number,
           'PAIR-' || to_char(now(), 'YYYY') || '-' ||
           lpad(nextval('submission_tracking_number_seq')::text, 5, '0')
         ),
         logged_by = auth.uid(),
         logged_at = now(),
         assigned_iro_staff = auth.uid(),
         current_stage = 'iro_staff',
         status = 'logged'
   where id = p_submission_id
   returning * into v_submission;

  insert into workflow_events (
    submission_id, actor_id, from_status, to_status, action, notes
  ) values (
    p_submission_id, auth.uid(), v_from_status, 'logged',
    'submission_logged', 'Incoming submission logged by IRO.'
  );

  return to_jsonb(v_submission);
end;
$$;

create or replace function save_iro_review_form(
  p_submission_id uuid,
  p_form_data jsonb,
  p_complete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role role_key_enum;
  v_submission submissions%rowtype;
  v_form review_forms%rowtype;
begin
  select role_key into v_role
    from profiles
   where id = auth.uid() and status = 'active';

  if v_role is null or v_role not in ('staff', 'admin') then
    raise exception 'Only IRO Staff or IRO Admin can complete the Review Form.';
  end if;

  select * into v_submission
    from submissions
   where id = p_submission_id
   for update;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if v_role = 'staff' and v_submission.assigned_iro_staff is distinct from auth.uid() then
    raise exception 'This submission is assigned to another IRO Staff member.';
  end if;

  if v_submission.status <> 'logged' or v_submission.current_stage <> 'iro_staff' then
    raise exception 'The submission must be logged and held by IRO Staff.';
  end if;

  select * into v_form
    from review_forms
   where submission_id = p_submission_id
   order by created_at desc
   limit 1
   for update;

  if not found then
    insert into review_forms (submission_id, generated_by, form_data)
    values (p_submission_id, auth.uid(), coalesce(p_form_data, '{}'::jsonb))
    returning * into v_form;
  else
    update review_forms
       set form_data = coalesce(form_data, '{}'::jsonb) || coalesce(p_form_data, '{}'::jsonb)
     where id = v_form.id
     returning * into v_form;
  end if;

  if p_complete then
    update review_forms
       set completed_by = auth.uid(), completed_at = now()
     where id = v_form.id
     returning * into v_form;

    update submissions
       set current_stage = 'iro_admin', status = 'review_form_generated'
     where id = p_submission_id;

    insert into workflow_events (
      submission_id, actor_id, from_status, to_status, action, notes,
      metadata
    ) values (
      p_submission_id, auth.uid(), 'logged', 'review_form_generated',
      'review_form_submitted_to_admin',
      'IRO Review Form completed and routed to IRO Admin for validation.',
      jsonb_build_object('review_form_id', v_form.id)
    );
  end if;

  return to_jsonb(v_form) || jsonb_build_object(
    'review_form_status', case when p_complete then 'submitted' else 'draft' end
  );
end;
$$;

revoke all on function log_incoming_submission(uuid) from public;
grant execute on function log_incoming_submission(uuid) to authenticated;
revoke all on function save_iro_review_form(uuid, jsonb, boolean) from public;
grant execute on function save_iro_review_form(uuid, jsonb, boolean) to authenticated;
