alter table submissions
  add column if not exists submission_type text not null default 'new_partnership',
  add column if not exists partner_classification text not null default 'local',
  add column if not exists created_by uuid,
  add column if not exists department_id text,
  add column if not exists version integer not null default 1;
