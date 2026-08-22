alter table public.reading_logs
add column if not exists genre text not null default '' check (char_length(genre) <= 40);

drop index if exists public.reading_logs_public_search_idx;
create index reading_logs_public_search_idx
on public.reading_logs
using gin ((coalesce(title, '') || ' ' || coalesce(genre, '') || ' ' || coalesce(final_summary, '') || ' ' || coalesce(final_review, '')) gin_trgm_ops)
where is_public = true;
