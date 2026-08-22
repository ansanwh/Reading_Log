update public.reading_logs
set genre = array_to_string(
  array(
    select trim(item)
    from unnest(regexp_split_to_array(genre, ',')) as item
    where trim(item) <> ''
    limit 5
  ),
  ', '
);

alter table public.reading_logs drop constraint if exists reading_logs_genre_check;
alter table public.reading_logs add constraint reading_logs_genre_check check (
  char_length(genre) <= 100
  and cardinality(regexp_split_to_array(genre, ',')) <= 5
  and genre !~ '(^[[:space:]]*,|,[[:space:]]*$|,[[:space:]]*,)'
);
