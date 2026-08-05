create type role_key_enum as enum ('super_admin', 'admin', 'staff', 'legal', 'department');
create type status_enum as enum ('active', 'inactive');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null,
  role_key role_key_enum not null,
  office text not null,
  department text,
  status status_enum not null default 'active'
);

alter table profiles enable row level security;

create policy "users can view own profile"
on profiles for select
using (
  id = auth.uid()
);
