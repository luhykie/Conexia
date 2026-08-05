insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "authenticated users can upload submission files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and owner = auth.uid()
);

create policy "authenticated users can view own submission files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and owner = auth.uid()
);

create policy "authenticated users can update own submission files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'submissions'
  and owner = auth.uid()
)
with check (
  bucket_id = 'submissions'
  and owner = auth.uid()
);

create policy "authenticated users can delete own submission files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'submissions'
  and owner = auth.uid()
);
