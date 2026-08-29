begin;

alter table public.mt5_accounts
  add column if not exists disconnected_at timestamp with time zone;

create index if not exists mt5_accounts_user_status_idx
  on public.mt5_accounts (user_id, status);

create index if not exists mt5_connection_jobs_account_created_idx
  on public.mt5_connection_jobs (account_id, created_at desc);

comment on column public.mt5_accounts.disconnected_at is
  'The last time EdgeVault deliberately released this saved account from a hosted MT5 slot. Disconnecting never deletes its synchronized Trade Log.';

commit;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'mt5_accounts'
  and column_name = 'disconnected_at';
