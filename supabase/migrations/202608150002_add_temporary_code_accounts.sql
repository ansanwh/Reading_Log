create table if not exists public.temporary_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '3 years')
);

alter table public.temporary_accounts enable row level security;

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = public
as $$
  select not exists (
    select 1 from public.temporary_accounts
    where user_id = auth.uid() and expires_at <= now()
  );
$$;

drop policy if exists "Only active accounts can access profiles" on public.profiles;
drop policy if exists "Only active accounts can access reading logs" on public.reading_logs;
drop policy if exists "Only active accounts can access reading log entries" on public.reading_log_entries;
drop policy if exists "Only active accounts can access groups" on public.groups;
drop policy if exists "Only active accounts can access group memberships" on public.group_members;

create policy "Only active accounts can access profiles" on public.profiles
as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "Only active accounts can access reading logs" on public.reading_logs
as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "Only active accounts can access reading log entries" on public.reading_log_entries
as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "Only active accounts can access groups" on public.groups
as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy "Only active accounts can access group memberships" on public.group_members
as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());

create index if not exists temporary_accounts_group_id_idx on public.temporary_accounts (group_id, expires_at);
