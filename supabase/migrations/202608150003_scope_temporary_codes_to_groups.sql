alter table public.temporary_accounts drop constraint if exists temporary_accounts_code_hash_key;
drop index if exists public.temporary_accounts_code_hash_key;
create unique index if not exists temporary_accounts_group_code_unique_idx
on public.temporary_accounts (group_id, code_hash);
