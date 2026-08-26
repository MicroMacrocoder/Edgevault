-- EdgeVault hosted MT5 automatic trade-log schema v1
-- Additive migration: does not alter or delete the existing legacy MT5/trade-log tables.
-- Raw MT5 writes are performed only by the trusted EdgeVault backend (service role).

begin;

-- Keep updated_at reliable on records that are repeatedly refreshed.
create or replace function public.set_edgevault_mt5_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Periodic account-level facts used later for balance/equity curves and drawdown.
create table if not exists public.mt5_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mt5_accounts(id) on delete cascade,
  captured_at_utc timestamptz not null default now(),
  mt5_server_time_msc numeric(20,0),
  broker_time_text text,
  broker_utc_offset_minutes integer,
  login text,
  server text,
  company text,
  account_name text,
  currency text,
  leverage integer,
  trade_mode_code integer,
  margin_mode_code integer,
  stopout_mode_code integer,
  balance numeric,
  credit numeric,
  equity numeric,
  account_profit numeric,
  margin numeric,
  free_margin numeric,
  margin_level numeric,
  margin_so_call numeric,
  margin_so_stopout numeric,
  trade_allowed boolean,
  expert_trading_allowed boolean,
  terminal_connected boolean,
  positions_payload jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (account_id, captured_at_utc)
);

create index if not exists mt5_account_snapshots_account_time_idx
  on public.mt5_account_snapshots (account_id, captured_at_utc desc);

-- Exact MT5 order facts, including pending, filled, cancelled and rejected orders.
create table if not exists public.mt5_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mt5_accounts(id) on delete cascade,
  order_ticket text not null,
  position_identifier text,
  position_by_identifier text,
  magic_number text,
  symbol text,
  order_type_code integer,
  order_type text,
  order_state_code integer,
  order_state text,
  order_reason_code integer,
  order_reason text,
  filling_type_code integer,
  time_type_code integer,
  setup_time_msc numeric(20,0),
  done_time_msc numeric(20,0),
  expiration_time_msc numeric(20,0),
  setup_at_utc timestamptz,
  done_at_utc timestamptz,
  expiration_at_utc timestamptz,
  setup_broker_time_text text,
  done_broker_time_text text,
  broker_utc_offset_minutes integer,
  volume_initial numeric,
  volume_current numeric,
  price_open numeric,
  price_current numeric,
  stop_limit_price numeric,
  stop_loss numeric,
  take_profit numeric,
  comment text,
  external_id text,
  is_history boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, order_ticket)
);

create index if not exists mt5_orders_account_position_idx
  on public.mt5_orders (account_id, position_identifier);

create index if not exists mt5_orders_account_done_time_idx
  on public.mt5_orders (account_id, done_time_msc desc);

-- Latest exact state for each MT5 position identifier.
create table if not exists public.mt5_positions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mt5_accounts(id) on delete cascade,
  position_identifier text not null,
  position_ticket text,
  magic_number text,
  symbol text not null,
  position_type_code integer,
  direction text check (direction in ('buy', 'sell')),
  reason_code integer,
  reason text,
  opened_time_msc numeric(20,0),
  updated_time_msc numeric(20,0),
  opened_at_utc timestamptz,
  position_updated_at_utc timestamptz,
  opened_broker_time_text text,
  updated_broker_time_text text,
  broker_utc_offset_minutes integer,
  volume numeric,
  price_open numeric,
  price_current numeric,
  stop_loss numeric,
  take_profit numeric,
  swap numeric,
  floating_profit numeric,
  comment text,
  external_id text,
  is_open boolean not null default true,
  closed_at_utc timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, position_identifier)
);

create index if not exists mt5_positions_account_open_idx
  on public.mt5_positions (account_id, is_open, last_seen_at desc);

-- Immutable raw MT5 deal ledger. Text is used for tickets/identifiers so JavaScript
-- never loses precision on large MT5 integer values.
create table if not exists public.mt5_deals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mt5_accounts(id) on delete cascade,
  deal_ticket text not null,
  order_ticket text,
  position_identifier text,
  time_msc numeric(20,0) not null,
  executed_at_utc timestamptz not null,
  broker_time_text text,
  broker_utc_offset_minutes integer,
  deal_type_code integer,
  deal_type text,
  entry_type_code integer,
  entry_type text,
  reason_code integer,
  reason text,
  magic_number text,
  symbol text,
  volume numeric,
  price numeric,
  commission numeric not null default 0,
  swap numeric not null default 0,
  profit numeric not null default 0,
  fee numeric not null default 0,
  stop_loss numeric,
  take_profit numeric,
  account_currency text,
  comment text,
  external_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, deal_ticket)
);

create index if not exists mt5_deals_account_time_idx
  on public.mt5_deals (account_id, time_msc, deal_ticket);

create index if not exists mt5_deals_account_position_idx
  on public.mt5_deals (account_id, position_identifier, time_msc);

-- Per-account durable cursor. The worker can resend an overlap window safely because
-- mt5_deals is protected by (account_id, deal_ticket).
create table if not exists public.mt5_sync_state (
  account_id uuid primary key references public.mt5_accounts(id) on delete cascade,
  schema_version integer not null default 1,
  initial_history_complete boolean not null default false,
  history_start_time_msc numeric(20,0),
  last_deal_time_msc numeric(20,0) not null default 0,
  last_deal_ticket text,
  last_order_time_msc numeric(20,0) not null default 0,
  last_successful_sync_at timestamptz,
  last_snapshot_at timestamptz,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'syncing', 'ready', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Derived logical trades used by the automatic Trade Log. trade_cycle is required
-- because a netting reversal can retain the same MT5 position identifier.
create table if not exists public.mt5_trade_records (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mt5_accounts(id) on delete cascade,
  position_identifier text not null,
  trade_cycle integer not null default 1 check (trade_cycle > 0),
  symbol text not null,
  status text not null default 'open'
    check (status in ('open', 'win', 'loss', 'breakeven')),
  direction text not null check (direction in ('buy', 'sell')),
  entry_time_msc numeric(20,0) not null,
  exit_time_msc numeric(20,0),
  entry_at_utc timestamptz not null,
  exit_at_utc timestamptz,
  entry_broker_time_text text,
  exit_broker_time_text text,
  entry_broker_utc_offset_minutes integer,
  exit_broker_utc_offset_minutes integer,
  total_entry_lots numeric not null default 0,
  total_exit_lots numeric not null default 0,
  open_lots numeric not null default 0,
  weighted_entry_price numeric,
  weighted_exit_price numeric,
  gross_profit numeric not null default 0,
  commission numeric not null default 0,
  swap numeric not null default 0,
  fees numeric not null default 0,
  net_profit numeric not null default 0,
  account_balance_at_entry numeric,
  pl_percentage numeric,
  entry_deal_count integer not null default 0,
  exit_deal_count integer not null default 0,
  entry_deal_tickets jsonb not null default '[]'::jsonb,
  exit_deal_tickets jsonb not null default '[]'::jsonb,
  all_deal_tickets jsonb not null default '[]'::jsonb,
  first_deal_ticket text,
  last_deal_ticket text,
  source_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, position_identifier, trade_cycle)
);

create index if not exists mt5_trade_records_account_entry_idx
  on public.mt5_trade_records (account_id, entry_at_utc desc);

create index if not exists mt5_trade_records_account_status_idx
  on public.mt5_trade_records (account_id, status, entry_at_utc desc);

-- Automatic updated_at maintenance.
drop trigger if exists mt5_orders_set_updated_at on public.mt5_orders;
create trigger mt5_orders_set_updated_at
before update on public.mt5_orders
for each row execute function public.set_edgevault_mt5_updated_at();

drop trigger if exists mt5_positions_set_updated_at on public.mt5_positions;
create trigger mt5_positions_set_updated_at
before update on public.mt5_positions
for each row execute function public.set_edgevault_mt5_updated_at();

drop trigger if exists mt5_deals_set_updated_at on public.mt5_deals;
create trigger mt5_deals_set_updated_at
before update on public.mt5_deals
for each row execute function public.set_edgevault_mt5_updated_at();

drop trigger if exists mt5_sync_state_set_updated_at on public.mt5_sync_state;
create trigger mt5_sync_state_set_updated_at
before update on public.mt5_sync_state
for each row execute function public.set_edgevault_mt5_updated_at();

drop trigger if exists mt5_trade_records_set_updated_at on public.mt5_trade_records;
create trigger mt5_trade_records_set_updated_at
before update on public.mt5_trade_records
for each row execute function public.set_edgevault_mt5_updated_at();

-- These exact/raw tables are backend-only. EdgeVault API routes authenticate the
-- user, query with the service role, and return only the approved frontend fields.
alter table public.mt5_account_snapshots enable row level security;
alter table public.mt5_orders enable row level security;
alter table public.mt5_positions enable row level security;
alter table public.mt5_deals enable row level security;
alter table public.mt5_sync_state enable row level security;
alter table public.mt5_trade_records enable row level security;

revoke all on public.mt5_account_snapshots from anon;
revoke all on public.mt5_orders from anon;
revoke all on public.mt5_positions from anon;
revoke all on public.mt5_deals from anon;
revoke all on public.mt5_sync_state from anon;
revoke all on public.mt5_trade_records from anon;

revoke all
  on public.mt5_account_snapshots, public.mt5_orders, public.mt5_positions,
     public.mt5_deals, public.mt5_sync_state, public.mt5_trade_records
  from authenticated;

grant all
  on public.mt5_account_snapshots, public.mt5_orders, public.mt5_positions,
     public.mt5_deals, public.mt5_sync_state, public.mt5_trade_records
  to service_role;

comment on table public.mt5_deals is
  'Immutable, account-scoped raw MT5 deal ledger used for idempotent history synchronization.';
comment on table public.mt5_trade_records is
  'Derived logical MT5 trades grouped from raw deals, including scaling and partial exits.';
comment on table public.mt5_sync_state is
  'Durable per-account MT5 history cursor and synchronization health.';

commit;

-- Expected result: six rows, one for each new automatic-MT5 table.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'mt5_account_snapshots',
    'mt5_orders',
    'mt5_positions',
    'mt5_deals',
    'mt5_sync_state',
    'mt5_trade_records'
  )
order by table_name;
