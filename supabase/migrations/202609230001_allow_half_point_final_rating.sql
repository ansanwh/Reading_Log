alter table public.reading_logs
drop constraint if exists reading_logs_final_rating_check;

alter table public.reading_logs
alter column final_rating type numeric(2,1) using final_rating::numeric(2,1);

alter table public.reading_logs
add constraint reading_logs_final_rating_check
check (final_rating between 0.5 and 5 and mod(final_rating * 2, 1) = 0);
