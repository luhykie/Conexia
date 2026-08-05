-- Requirement 1:
-- Route a logged submission and its completed Review Form to an assigned
-- Legal Counsel. The transition is performed atomically so the submission,
-- form, and workflow history cannot disagree.

alter table submissions
  add column if not exists logged_by uuid references profiles(id) on delete set null,
  add column if not exists logged_at timestamptz,
  add column if not exists assigned_iro_staff uuid references profiles(id) on delete set null,
  add column if not exists assigned_legal_counsel uuid references profiles(id) on delete set null,
  add column if not exists validated_by uuid references profiles(id) on delete set null,
  add column if not exists validated_at timestamptz,
  add column if not exists routed_to_legal_at timestamptz;

alter table review_forms
  add column if not exists completed_by uuid references profiles(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists validated_by uuid references profiles(id) on delete set null,
  add column if not exists validated_at timestamptz,
  add column if not exists routed_to_legal_at timestamptz;

create index if not exists submissions_assigned_iro_staff_idx
  on submissions (assigned_iro_staff);

create index if not exists submissions_assigned_legal_counsel_idx
  on submissions (assigned_legal_counsel);

-- IRO Staff and IRO Admin can create and complete Review Forms. Validation
-- and routing are restricted by the function below to IRO Admin.
drop policy if exists "iro roles can create review forms" on review_forms;
create policy "iro roles can create review forms"
on review_forms for insert
to authenticated
with check (
  generated_by = auth.uid()
  and (select role_key from profiles where id = auth.uid()) in ('staff', 'admin')
);

drop policy if exists "iro roles can update review forms" on review_forms;
create policy "iro roles can update review forms"
on review_forms for update
to authenticated
using (
  (select role_key from profiles where id = auth.uid()) in ('staff', 'admin')
)
with check (
  (select role_key from profiles where id = auth.uid()) in ('staff', 'admin')
);

create or replace function route_submission_to_legal(
  p_submission_id uuid,
  p_legal_counsel_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role role_key_enum;
  v_legal_role role_key_enum;
  v_from_status submission_status_enum;
  v_current_stage routing_stage_enum;
  v_review_form_id uuid;
  v_form_completed_at timestamptz;
begin
  select role_key
    into v_actor_role
    from profiles
   where id = auth.uid()
     and status = 'active';

  if v_actor_role is distinct from 'admin' then
    raise exception 'Only an active IRO Admin can validate and route a Review Form.';
  end if;

  select role_key
    into v_legal_role
    from profiles
   where id = p_legal_counsel_id
     and status = 'active';

  if v_legal_role is distinct from 'legal' then
    raise exception 'The selected assignee must be an active Legal Counsel.';
  end if;

  select status, current_stage
    into v_from_status, v_current_stage
    from submissions
   where id = p_submission_id
   for update;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if v_current_stage is distinct from 'iro_admin' then
    raise exception 'The submission must be held by IRO Admin before Legal routing.';
  end if;

  if v_from_status not in ('logged', 'review_form_generated') then
    raise exception 'Only a logged submission with a Review Form can be routed to Legal.';
  end if;

  select id, completed_at
    into v_review_form_id, v_form_completed_at
    from review_forms
   where submission_id = p_submission_id
     and completed_at is not null
   order by completed_at desc, created_at desc
   limit 1
   for update;

  if not found then
    raise exception 'The Review Form must be completed before validation.';
  end if;

  update review_forms
     set validated_by = auth.uid(),
         validated_at = now(),
         routed_to_legal_at = now()
   where id = v_review_form_id;

  update submissions
     set assigned_legal_counsel = p_legal_counsel_id,
         validated_by = auth.uid(),
         validated_at = now(),
         routed_to_legal_at = now(),
         current_stage = 'legal',
         status = 'review_form_generated'
   where id = p_submission_id;

  insert into workflow_events (
    submission_id,
    actor_id,
    from_status,
    to_status,
    action,
    notes,
    metadata
  ) values (
    p_submission_id,
    auth.uid(),
    v_from_status,
    'review_form_generated',
    'routed_to_legal',
    'IRO Admin validated the Review Form and routed the record to Legal Counsel.',
    jsonb_build_object(
      'review_form_id', v_review_form_id,
      'legal_counsel_id', p_legal_counsel_id
    )
  );
end;
$$;

revoke all on function route_submission_to_legal(uuid, uuid) from public;
grant execute on function route_submission_to_legal(uuid, uuid) to authenticated;
