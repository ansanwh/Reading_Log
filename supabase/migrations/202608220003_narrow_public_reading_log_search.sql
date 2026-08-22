drop index if exists public.reading_logs_public_search_idx;
create index reading_logs_public_search_idx
on public.reading_logs
using gin ((coalesce(title, '') || ' ' || coalesce(genre, '')) gin_trgm_ops)
where is_public = true;
