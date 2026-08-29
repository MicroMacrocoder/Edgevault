begin;

alter table public.mt5_accounts
  add column if not exists pending_deletion boolean not null default false;

comment on column public.mt5_accounts.pending_deletion is
  'When true, the hosted worker must release this account terminal before the account and its cascaded MT5 data are permanently deleted.';

commit;

select
  column_name,
  data_type,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'mt5_accounts'
  and column_name = 'pending_deletion';
