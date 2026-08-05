-- Expand submission schema for official MOA/MOU Review & Notarization forms.
-- Aligns with PAIR/ILRO procedure and fixes frontend/schema drift.

create type urgency_level_enum as enum ('normal', 'urgent', 'highly_urgent');
create type pair_review_status_enum as enum ('approved', 'for_revision', 'disapproved');
create type signing_mode_enum as enum ('virtual', 'in_person', 'none');
create type version_reason_enum as enum (
  'original_draft',
  'correction',
  'partner_revision',
  'signed_copy',
  'notarized_copy',
  'supporting_document'
);

-- Extend lifecycle statuses used by the official workflow.
alter type submission_status_enum add value if not exists 'review_form_generated';
alter type submission_status_enum add value if not exists 'resubmitted';
alter type submission_status_enum add value if not exists 'notarization_form_generated';
alter type submission_status_enum add value if not exists 'archived';
alter type submission_status_enum add value if not exists 'distributed';

alter table submissions
  add column if not exists tracking_number text,
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists contact_person text,
  add column if not exists contact_position text,
  add column if not exists contact_email text,
  add column if not exists contact_number text,
  add column if not exists agreement_title text,
  add column if not exists requested_completion_date date,
  add column if not exists urgency_level urgency_level_enum not null default 'normal',
  add column if not exists requested_by_name text,
  add column if not exists requested_by_date date,
  add column if not exists noted_by_name text,
  add column if not exists noted_by_date date,
  add column if not exists date_received timestamptz,
  add column if not exists received_by uuid references profiles(id) on delete set null,
  add column if not exists pair_remarks text,
  add column if not exists date_completed timestamptz,
  add column if not exists pair_review_status pair_review_status_enum,
  add column if not exists signing_date date,
  add column if not exists signing_mode signing_mode_enum,
  add column if not exists copies_for_notarization integer,
  add column if not exists notarial_reference text,
  add column if not exists notarial_date date,
  add column if not exists legal_comments text,
  add column if not exists legal_reviewed_by uuid references profiles(id) on delete set null,
  add column if not exists legal_reviewed_at timestamptz,
  add column if not exists review_form_generated_at timestamptz,
  add column if not exists notarization_form_generated_at timestamptz;

create unique index if not exists submissions_tracking_number_idx
  on submissions (tracking_number)
  where tracking_number is not null;

create or replace function set_submissions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists submissions_set_updated_at on submissions;
create trigger submissions_set_updated_at
before update on submissions
for each row execute function set_submissions_updated_at();

create table if not exists submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  version_number integer not null,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid not null references profiles(id) on delete restrict,
  upload_reason version_reason_enum not null default 'original_draft',
  notes text,
  created_at timestamptz not null default now(),
  unique (submission_id, version_number)
);

create table if not exists workflow_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  from_status submission_status_enum,
  to_status submission_status_enum not null,
  action text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists review_forms (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  generated_by uuid references profiles(id) on delete set null,
  form_data jsonb not null,
  pdf_storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists notarization_forms (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  generated_by uuid references profiles(id) on delete set null,
  form_data jsonb not null,
  pdf_storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists submission_versions_submission_id_idx on submission_versions (submission_id);
create index if not exists workflow_events_submission_id_idx on workflow_events (submission_id);
create index if not exists notifications_user_id_idx on notifications (user_id);

alter table submission_versions enable row level security;
alter table workflow_events enable row level security;
alter table review_forms enable row level security;
alter table notarization_forms enable row level security;
alter table notifications enable row level security;

-- Fix internal-role read policy: enum value is super_admin, not super.
drop policy if exists "internal roles can view all submissions" on submissions;
create policy "internal roles can view all submissions"
on submissions for select
using (
  (select role_key from profiles where id = auth.uid())
    in ('staff', 'admin', 'legal', 'super_admin')
);

-- Department staff can read their own submissions regardless of office filter edge cases.
create policy "department staff can view own submissions"
on submissions for select
using (
  submitted_by = auth.uid()
);

-- Department staff can update own submissions while corrections are requested.
create policy "department staff can update own submissions for resubmit"
on submissions for update
using (
  submitted_by = auth.uid()
  and status in ('corrections_needed', 'submitted')
)
with check (
  submitted_by = auth.uid()
);

-- IRO staff/admin can update submissions for logging and routing.
create policy "iro roles can update submissions"
on submissions for update
using (
  (select role_key from profiles where id = auth.uid()) in ('staff', 'admin')
);

-- Legal counsel can update submissions during review.
create policy "legal can update submissions"
on submissions for update
using (
  (select role_key from profiles where id = auth.uid()) = 'legal'
);

-- Shared read policies for workflow tables.
create policy "users can view versions for accessible submissions"
on submission_versions for select
using (
  exists (
    select 1 from submissions s
    where s.id = submission_versions.submission_id
      and (
        s.submitted_by = auth.uid()
        or (select role_key from profiles where id = auth.uid())
          in ('staff', 'admin', 'legal', 'super_admin')
        or s.office = (select office from profiles where id = auth.uid())
      )
  )
);

create policy "department staff can insert own submission versions"
on submission_versions for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from submissions s
    where s.id = submission_versions.submission_id
      and s.submitted_by = auth.uid()
  )
);

create policy "internal roles can insert submission versions"
on submission_versions for insert
with check (
  uploaded_by = auth.uid()
  and (select role_key from profiles where id = auth.uid())
    in ('staff', 'admin', 'legal')
);

create policy "users can view workflow events for accessible submissions"
on workflow_events for select
using (
  exists (
    select 1 from submissions s
    where s.id = workflow_events.submission_id
      and (
        s.submitted_by = auth.uid()
        or (select role_key from profiles where id = auth.uid())
          in ('staff', 'admin', 'legal', 'super_admin')
      )
  )
);

create policy "users can view own notifications"
on notifications for select
using (user_id = auth.uid());

create policy "users can update own notifications"
on notifications for update
using (user_id = auth.uid());

create policy "internal roles can view review forms"
on review_forms for select
using (
  exists (
    select 1 from submissions s
    where s.id = review_forms.submission_id
      and (
        s.submitted_by = auth.uid()
        or (select role_key from profiles where id = auth.uid())
          in ('staff', 'admin', 'legal', 'super_admin')
      )
  )
);

create policy "internal roles can view notarization forms"
on notarization_forms for select
using (
  exists (
    select 1 from submissions s
    where s.id = notarization_forms.submission_id
      and (
        s.submitted_by = auth.uid()
        or (select role_key from profiles where id = auth.uid())
          in ('staff', 'admin', 'legal', 'super_admin')
      )
  )
);

-- Allow internal roles to read submission files for review (not only uploader).
create policy "internal roles can view all submission files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and (
    owner = auth.uid()
    or (select role_key from profiles where id = auth.uid())
      in ('staff', 'admin', 'legal', 'super_admin')
  )
);
