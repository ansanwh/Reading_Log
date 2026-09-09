alter table public.reading_logs
add column if not exists final_rating integer;

alter table public.reading_logs
drop constraint if exists reading_logs_final_rating_check;

alter table public.reading_logs
add constraint reading_logs_final_rating_check
check (final_rating between 1 and 5);
