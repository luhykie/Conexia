-- Requirement 2:
-- Store original drafts, reviewed versions, signed copies, notarized copies,
-- and supporting documents in the private `submissions` bucket. Every object
-- path starts with its submission UUID: <submission-id>/<unique-file-name>.

alter table submission_versions
  add column if not exists mime_type text,
  add column if not exists file_size bigint;

alter table submission_versions
  drop constraint if exists submission_versions_file_size_check;
alter table submission_versions
  add constraint submission_versions_file_size_check
  check (file_size is null or file_size >= 0);

-- Replace broad storage rules with record-aware policies. IRO Staff remains
-- unable to open document contents, as required by the routing workflow.
drop policy if exists "authenticated users can upload submission files" on storage.objects;
drop policy if exists "authenticated users can view own submission files" on storage.objects;
drop policy if exists "authenticated users can update own submission files" on storage.objects;
drop policy if exists "authenticated users can delete own submission files" on storage.objects;
drop policy if exists "restricted roles can view submission files" on storage.objects;

create policy "authorized users can upload submission files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and owner = auth.uid()
  and exists (
    select 1
      from submissions s
     where s.id::text = (storage.foldername(name))[1]
       and (
         s.submitted_by = auth.uid()
         or s.assigned_legal_counsel = auth.uid()
         or (select role_key from profiles where id = auth.uid()) = 'admin'
       )
  )
);

create policy "authorized users can view submission files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1
      from submissions s
     where s.id::text = (storage.foldername(name))[1]
       and (
         s.submitted_by = auth.uid()
         or s.assigned_legal_counsel = auth.uid()
         or (select role_key from profiles where id = auth.uid())
           in ('admin', 'super_admin')
       )
  )
);

create policy "authorized owners can update submission files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'submissions'
  and owner = auth.uid()
  and exists (
    select 1 from submissions s
     where s.id::text = (storage.foldername(name))[1]
       and (
         s.submitted_by = auth.uid()
         or s.assigned_legal_counsel = auth.uid()
         or (select role_key from profiles where id = auth.uid()) = 'admin'
       )
  )
)
with check (bucket_id = 'submissions' and owner = auth.uid());

create policy "authorized owners can delete submission files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'submissions'
  and owner = auth.uid()
  and exists (
    select 1 from submissions s
     where s.id::text = (storage.foldername(name))[1]
       and (
         s.submitted_by = auth.uid()
         or s.assigned_legal_counsel = auth.uid()
         or (select role_key from profiles where id = auth.uid()) = 'admin'
       )
  )
);

drop policy if exists "users can view versions for accessible submissions" on submission_versions;
drop policy if exists "department staff can insert own submission versions" on submission_versions;
drop policy if exists "internal roles can insert submission versions" on submission_versions;

create policy "authorized users can view submission versions"
on submission_versions for select
to authenticated
using (
  exists (
    select 1 from submissions s
     where s.id = submission_versions.submission_id
       and (
         s.submitted_by = auth.uid()
         or s.assigned_legal_counsel = auth.uid()
         or (select role_key from profiles where id = auth.uid())
           in ('admin', 'super_admin')
       )
  )
);

-- Registration is centralized to allocate version numbers safely and to keep
-- storage metadata tied to an authorized submission record.
create or replace function register_submission_version(
  p_submission_id uuid,
  p_storage_path text,
  p_file_name text,
  p_upload_reason version_reason_enum,
  p_mime_type text default null,
  p_file_size bigint default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role role_key_enum;
  v_submitted_by uuid;
  v_assigned_legal uuid;
  v_next_version integer;
  v_version submission_versions%rowtype;
begin
  select role_key into v_role
    from profiles
   where id = auth.uid() and status = 'active';

  select submitted_by, assigned_legal_counsel
    into v_submitted_by, v_assigned_legal
    from submissions
   where id = p_submission_id
   for update;

  if not found then
    raise exception 'Submission not found.';
  end if;

  if auth.uid() is null or not (
    v_submitted_by = auth.uid()
    or v_assigned_legal = auth.uid()
    or v_role = 'admin'
  ) then
    raise exception 'You are not authorized to upload files for this submission.';
  end if;

  if p_storage_path not like p_submission_id::text || '/%' then
    raise exception 'The storage path must belong to the submission.';
  end if;

  if p_file_size is not null and p_file_size < 0 then
    raise exception 'File size cannot be negative.';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
    from submission_versions
   where submission_id = p_submission_id;

  insert into submission_versions (
    submission_id, version_number, storage_path, file_name, uploaded_by,
    upload_reason, mime_type, file_size, notes
  ) values (
    p_submission_id, v_next_version, p_storage_path, p_file_name, auth.uid(),
    p_upload_reason, p_mime_type, p_file_size, p_notes
  ) returning * into v_version;

  return to_jsonb(v_version);
end;
$$;

revoke all on function register_submission_version(
  uuid, text, text, version_reason_enum, text, bigint, text
) from public;
grant execute on function register_submission_version(
  uuid, text, text, version_reason_enum, text, bigint, text
) to authenticated;
