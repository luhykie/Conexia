create type submission_status_enum as enum (
  'submitted', 'logged', 'under_review', 'corrections_needed', 'approved',
  'pending_notarization', 'notarized'
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references profiles(id) on delete restrict,
  office text not null,
  department text,
  partner_institution_name text not null,
  agreement_type text not null,
  expected_duration text not null,
  partner_contact_email text not null,
  status submission_status_enum not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table submissions enable row level security;

-- Department staff: can insert their own submissions
create policy "department staff can insert own submissions"
on submissions for insert
with check (
  submitted_by = auth.uid()
);

-- Department staff: can only read submissions from their own office
create policy "department staff can view own office submissions"
on submissions for select
using (
  office = (select office from profiles where id = auth.uid())
);

-- IRO staff/admin/legal/super: can read everything (refine per-role later)
create policy "internal roles can view all submissions"
on submissions for select
using (
  (select role_key from profiles where id = auth.uid()) in ('staff', 'admin', 'legal', 'super')
);