-- EdgeVault hosted MT5 automatic trade-log schema v2
-- Additive migration for exact open/realized P&L separation.

begin;

alter table public.mt5_trade_records
  add column if not exists realized_net_profit numeric not null default 0,
  add column if not exists floating_profit numeric not null default 0,
  add column if not exists open_position_swap numeric not null default 0;

comment on column public.mt5_trade_records.realized_net_profit is
  'Profit, commission, swap and fees already posted to MT5 balance.';
comment on column public.mt5_trade_records.floating_profit is
  'Latest floating position profit; zero after the logical trade closes.';
comment on column public.mt5_trade_records.open_position_swap is
  'Latest swap reported on an open MT5 position; zero after close.';
comment on column public.mt5_trade_records.net_profit is
  'Display net P/L: realized net plus current floating profit and open-position swap while open.';

commit;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'mt5_trade_records'
  and column_name in (
    'realized_net_profit',
    'floating_profit',
    'open_position_swap'
  )
order by column_name;
