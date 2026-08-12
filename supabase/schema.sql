create table if not exists public.reading_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  status text not null default 'reading' check (status in ('reading', 'finished', 'paused')),
  rating integer check (rating between 1 and 5),
  notes text,
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reading_entries enable row level security;

drop policy if exists "Users can read own reading entries" on public.reading_entries;
drop policy if exists "Users can create own reading entries" on public.reading_entries;
drop policy if exists "Users can update own reading entries" on public.reading_entries;
drop policy if exists "Users can delete own reading entries" on public.reading_entries;

create policy "Users can read own reading entries"
on public.reading_entries
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own reading entries"
on public.reading_entries
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own reading entries"
on public.reading_entries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own reading entries"
on public.reading_entries
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reading_entries_set_updated_at on public.reading_entries;

create trigger reading_entries_set_updated_at
before update on public.reading_entries
for each row
execute function public.set_updated_at();

create table if not exists public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  total_pages integer not null default 300 check (total_pages > 0),
  final_summary text not null default '',
  final_review text not null default '',
  favorite_scene text not null default '',
  favorite_scene_image text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reading_logs
add column if not exists is_public boolean not null default false;

create table if not exists public.reading_log_entries (
  id uuid primary key default gen_random_uuid(),
  reading_log_id uuid not null references public.reading_logs(id) on delete cascade,
  entry_date date not null,
  note text not null default '',
  current_page integer not null default 0 check (current_page >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reading_logs enable row level security;
alter table public.reading_log_entries enable row level security;

drop policy if exists "Users can read own reading logs" on public.reading_logs;
drop policy if exists "Users can create own reading logs" on public.reading_logs;
drop policy if exists "Users can update own reading logs" on public.reading_logs;
drop policy if exists "Users can delete own reading logs" on public.reading_logs;
drop policy if exists "Anyone can read public reading logs" on public.reading_logs;
drop policy if exists "Users can read own reading log entries" on public.reading_log_entries;
drop policy if exists "Users can create own reading log entries" on public.reading_log_entries;
drop policy if exists "Users can update own reading log entries" on public.reading_log_entries;
drop policy if exists "Users can delete own reading log entries" on public.reading_log_entries;
drop policy if exists "Anyone can read entries for public reading logs" on public.reading_log_entries;

create policy "Users can read own reading logs"
on public.reading_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own reading logs"
on public.reading_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own reading logs"
on public.reading_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own reading logs"
on public.reading_logs
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Anyone can read public reading logs"
on public.reading_logs
for select
to anon, authenticated
using (is_public = true);

create policy "Users can read own reading log entries"
on public.reading_log_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.reading_logs
    where reading_logs.id = reading_log_entries.reading_log_id
      and reading_logs.user_id = auth.uid()
  )
);

create policy "Anyone can read entries for public reading logs"
on public.reading_log_entries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.reading_logs
    where reading_logs.id = reading_log_entries.reading_log_id
      and reading_logs.is_public = true
  )
);

create policy "Users can create own reading log entries"
on public.reading_log_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.reading_logs
    where reading_logs.id = reading_log_entries.reading_log_id
      and reading_logs.user_id = auth.uid()
  )
);

create policy "Users can update own reading log entries"
on public.reading_log_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.reading_logs
    where reading_logs.id = reading_log_entries.reading_log_id
      and reading_logs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.reading_logs
    where reading_logs.id = reading_log_entries.reading_log_id
      and reading_logs.user_id = auth.uid()
  )
);

create policy "Users can delete own reading log entries"
on public.reading_log_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.reading_logs
    where reading_logs.id = reading_log_entries.reading_log_id
      and reading_logs.user_id = auth.uid()
  )
);

drop trigger if exists reading_logs_set_updated_at on public.reading_logs;
drop trigger if exists reading_log_entries_set_updated_at on public.reading_log_entries;

create trigger reading_logs_set_updated_at
before update on public.reading_logs
for each row
execute function public.set_updated_at();

create trigger reading_log_entries_set_updated_at
before update on public.reading_log_entries
for each row
execute function public.set_updated_at();

create index if not exists reading_logs_user_id_created_at_idx
on public.reading_logs (user_id, created_at desc);

create index if not exists reading_logs_public_title_idx
on public.reading_logs (title)
where is_public = true;

create index if not exists reading_log_entries_log_position_idx
on public.reading_log_entries (reading_log_id, position);

insert into public.reading_logs (
  id,
  user_id,
  title,
  total_pages,
  final_summary,
  final_review,
  created_at,
  updated_at
)
select
  id,
  user_id,
  title,
  300,
  coalesce(notes, ''),
  concat_ws(
    ' · ',
    case status
      when 'finished' then '완독'
      when 'paused' then '잠시 멈춤'
      else '읽는 중'
    end,
    case when rating is null then '별점 없음' else '별점 ' || rating || '/5' end,
    case when author is null or author = '' then '저자 미입력' else '저자: ' || author end
  ),
  created_at,
  updated_at
from public.reading_entries
on conflict (id) do nothing;

insert into public.reading_log_entries (
  reading_log_id,
  entry_date,
  note,
  current_page,
  position,
  created_at,
  updated_at
)
select
  id,
  coalesce(finished_at, started_at, created_at::date),
  coalesce(notes, ''),
  case when status = 'finished' then 300 else 0 end,
  0,
  created_at,
  updated_at
from public.reading_entries
where not exists (
  select 1
  from public.reading_log_entries
  where reading_log_entries.reading_log_id = reading_entries.id
);
