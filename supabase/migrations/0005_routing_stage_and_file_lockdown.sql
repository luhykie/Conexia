-- Adds explicit "who currently holds this submission" tracking and a
-- revision-cycle counter, then locks IRO Staff out of the attached file
-- (they route based on the filled-out form only; IRO Admin, Legal, the
-- submitting Department user, and Super Admin can still view it).

create type routing_stage_enum as enum ('department', 'iro_staff', 'iro_admin', 'legal');

alter table submissions
  add column if not exists current_stage routing_stage_enum not null default 'iro_staff',
  add column if not exists revision_cycle integer not null default 1;

create index if not exists submissions_current_stage_idx on submissions (current_stage);

-- Backfill existing rows to a sane stage based on their current status.
update submissions set current_stage = case
  when status in ('submitted', 'under_review') then 'iro_staff'
  when status = 'logged' then 'iro_admin'
  when status = 'review_form_generated' then 'legal'
  when status = 'corrections_needed' then 'department'
  when status = 'resubmitted' then 'iro_staff'
  else 'iro_admin'
end::routing_stage_enum;

-- ---------------------------------------------------------------------
-- Lock the attached file away from IRO Staff.
-- ---------------------------------------------------------------------
drop policy if exists "internal roles can view all submission files" on storage.objects;

create policy "restricted roles can view submission files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and (
    owner = auth.uid()
    or (select role_key from profiles where id = auth.uid())
      in ('admin', 'legal', 'super_admin')
  )
);
