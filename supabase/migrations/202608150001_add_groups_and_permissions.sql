-- 공개 ID: 한글 허용, 익명은 profiles 행을 삭제해 기본 표시값으로 처리한다.
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check
check (username ~ '^[가-힣a-zA-Z0-9_]{2,24}$');
alter table public.profiles drop constraint if exists profiles_username_key;
create unique index if not exists profiles_username_unique_lower_idx
on public.profiles ((lower(username)));

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
on public.profiles for delete to authenticated
using (auth.uid() = id);

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin1@seojae.kr'; $$;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  kind text not null default 'group' check (kind in ('group', 'class')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'group_admin')),
  can_publish boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.reading_logs
add column if not exists group_id uuid references public.groups(id) on delete set null;

create or replace function public.is_group_user()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.group_members where user_id = auth.uid()); $$;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid()); $$;

create or replace function public.can_publish_to_group(target_group_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid() and (can_publish or role = 'group_admin')); $$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid() and role = 'group_admin'); $$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "Users can read own reading logs" on public.reading_logs;
drop policy if exists "Users can create own reading logs" on public.reading_logs;
drop policy if exists "Users can update own reading logs" on public.reading_logs;
drop policy if exists "Anyone can read public reading logs" on public.reading_logs;
drop policy if exists "Group members can read group reading logs" on public.reading_logs;
drop policy if exists "Group administrators can update group reading logs" on public.reading_logs;
drop policy if exists "Group administrators can delete group reading logs" on public.reading_logs;
drop policy if exists "Super administrator can manage all reading logs" on public.reading_logs;

create policy "Users can read own reading logs" on public.reading_logs
for select to authenticated using (auth.uid() = user_id);

create policy "Users can create own reading logs" on public.reading_logs
for insert to authenticated
with check (
  auth.uid() = user_id
  and ((group_id is null and not public.is_group_user()) or (group_id is not null and public.can_publish_to_group(group_id)))
  and (group_id is null or is_public = false)
);

create policy "Users can update own reading logs" on public.reading_logs
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and ((group_id is null and not public.is_group_user()) or (group_id is not null and public.can_publish_to_group(group_id)))
  and (group_id is null or is_public = false)
);

create policy "Anyone can read public reading logs" on public.reading_logs
for select to anon, authenticated using (is_public = true and group_id is null);

create policy "Group members can read group reading logs" on public.reading_logs
for select to authenticated using (group_id is not null and public.is_group_member(group_id));

create policy "Group administrators can update group reading logs" on public.reading_logs
for update to authenticated
using (group_id is not null and public.is_group_admin(group_id))
with check (group_id is not null and public.is_group_admin(group_id) and is_public = false);

create policy "Group administrators can delete group reading logs" on public.reading_logs
for delete to authenticated using (group_id is not null and public.is_group_admin(group_id));

create policy "Super administrator can manage all reading logs" on public.reading_logs
for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Users can read groups they belong to" on public.groups;
drop policy if exists "Users can read own group memberships" on public.group_members;
drop policy if exists "Group administrators can manage group memberships" on public.group_members;
drop policy if exists "Super administrator can manage all groups" on public.groups;
drop policy if exists "Super administrator can manage all group memberships" on public.group_members;

create policy "Users can read groups they belong to" on public.groups
for select to authenticated using (public.is_group_member(id));
create policy "Users can read own group memberships" on public.group_members
for select to authenticated using (auth.uid() = user_id);
create policy "Group administrators can manage group memberships" on public.group_members
for all to authenticated
using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "Super administrator can manage all groups" on public.groups
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "Super administrator can manage all group memberships" on public.group_members
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Group members can read group reading log entries" on public.reading_log_entries;
drop policy if exists "Group administrators can update group reading log entries" on public.reading_log_entries;
drop policy if exists "Group administrators can delete group reading log entries" on public.reading_log_entries;
drop policy if exists "Super administrator can manage all reading log entries" on public.reading_log_entries;

create policy "Group members can read group reading log entries" on public.reading_log_entries
for select to authenticated using (
  exists (select 1 from public.reading_logs where id = reading_log_entries.reading_log_id and group_id is not null and public.is_group_member(group_id))
);
create policy "Group administrators can update group reading log entries" on public.reading_log_entries
for update to authenticated
using (exists (select 1 from public.reading_logs where id = reading_log_entries.reading_log_id and group_id is not null and public.is_group_admin(group_id)))
with check (exists (select 1 from public.reading_logs where id = reading_log_entries.reading_log_id and group_id is not null and public.is_group_admin(group_id)));
create policy "Group administrators can delete group reading log entries" on public.reading_log_entries
for delete to authenticated
using (exists (select 1 from public.reading_logs where id = reading_log_entries.reading_log_id and group_id is not null and public.is_group_admin(group_id)));
create policy "Super administrator can manage all reading log entries" on public.reading_log_entries
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at before update on public.groups
for each row execute function public.set_updated_at();

create index if not exists reading_logs_group_id_idx on public.reading_logs (group_id, updated_at desc);
create index if not exists group_members_user_id_idx on public.group_members (user_id, role);
