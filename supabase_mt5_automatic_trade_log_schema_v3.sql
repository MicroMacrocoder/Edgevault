



begin;

alter table public.mt5_trade_records
  add column if not exists stop_loss numeric,
  add column if not exists take_profit numeric,
  add column if not exists trade_comment text,
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mt5_trade_records_custom_fields_object'
      and conrelid = 'public.mt5_trade_records'::regclass
  ) then
    alter table public.mt5_trade_records
      add constraint mt5_trade_records_custom_fields_object
      check (jsonb_typeof(custom_fields) = 'object');
  end if;
end;
$$;

create table if not exists public.mt5_trade_log_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  optional_headers jsonb not null default '[]'::jsonb,
  session_timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mt5_trade_log_settings_headers_array
    check (jsonb_typeof(optional_headers) = 'array')
);

drop trigger if exists mt5_trade_log_settings_set_updated_at
  on public.mt5_trade_log_settings;
create trigger mt5_trade_log_settings_set_updated_at
before update on public.mt5_trade_log_settings
for each row execute function public.set_edgevault_mt5_updated_at();

alter table public.mt5_trade_log_settings enable row level security;
revoke all on public.mt5_trade_log_settings from anon, authenticated;
grant all on public.mt5_trade_log_settings to service_role;

comment on column public.mt5_trade_records.stop_loss is
  'Latest known MT5 stop loss for the logical trade.';
comment on column public.mt5_trade_records.take_profit is
  'Latest known MT5 take profit for the logical trade.';
comment on column public.mt5_trade_records.trade_comment is
  'Latest known MT5 comment for the logical trade.';
comment on column public.mt5_trade_records.custom_fields is
  'User-entered manual values and screenshot metadata; worker synchronization does not overwrite this column.';
comment on table public.mt5_trade_log_settings is
  'One shared optional-header layout and formula timezone for all of a user’s MT5 accounts.';

commit;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (
      table_name = 'mt5_trade_records'
      and column_name in ('stop_loss', 'take_profit', 'trade_comment', 'custom_fields')
    )
    or
    (
      table_name = 'mt5_trade_log_settings'
      and column_name in ('optional_headers', 'session_timezone')
    )
  )
order by table_name, column_name;
