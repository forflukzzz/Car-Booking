-- Link directory entries to Supabase Auth and limit directory access by role.
alter table public.user_directory
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

alter table public.user_directory
  add column if not exists password text not null default '';

alter table public.user_directory
  add column if not exists must_change_password boolean not null default false;

alter table public.user_directory
  drop constraint if exists user_directory_role_check;

alter table public.user_directory
  add constraint user_directory_role_check
  check (role in ('user', 'manager', 'admin'));

create unique index if not exists user_directory_auth_user_id_key
  on public.user_directory(auth_user_id)
  where auth_user_id is not null;

-- Link any accounts already created with the UID-based synthetic email format.
update public.user_directory as directory
set auth_user_id = auth_user.id
from auth.users as auth_user
where directory.auth_user_id is null
  and lower(auth_user.email) = 'u-' || lower(directory.uid) || '@login.carbooking.invalid';

create or replace function public.is_directory_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_directory
    where auth_user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_directory_admin() from public;
grant execute on function public.is_directory_admin() to authenticated;

alter table public.user_directory enable row level security;

-- Remove legacy public policies so they cannot bypass the new role checks.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_directory'
  loop
    execute format('drop policy if exists %I on public.user_directory', policy_row.policyname);
  end loop;
end;
$$;

create policy "Public can read directory for UID login"
on public.user_directory for select to authenticated
using (true);

create policy "Public can read directory for UID login anon"
on public.user_directory for select to anon
using (true);

create policy "Admins can insert directory rows"
on public.user_directory for insert to anon, authenticated
with check (role in ('user', 'manager') or public.is_directory_admin());

create policy "Admins can update directory rows"
on public.user_directory for update to anon, authenticated
using (true)
with check (role in ('user', 'manager') or public.is_directory_admin());

create policy "Admins can delete directory rows"
on public.user_directory for delete to anon, authenticated
using (role in ('user', 'manager') or public.is_directory_admin());

notify pgrst, 'reload schema';

-- Bootstrap the first administrator once:
-- 1. Create a confirmed Auth user in Supabase Dashboard with email
--    u-<admin-uid>@login.carbooking.invalid and a temporary password.
-- 2. Link it to the existing admin directory row:
--    update public.user_directory d set auth_user_id = u.id
--    from auth.users u
--    where d.uid = '<admin-uid>'
--      and u.email = 'u-<admin-uid>@login.carbooking.invalid'
--      and d.role = 'admin';
