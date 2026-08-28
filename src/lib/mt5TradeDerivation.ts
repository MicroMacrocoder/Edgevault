export type Mt5RawDeal = {
  deal_ticket: string;
  order_ticket?: string | null;
  position_identifier?: string | null;
  time_msc: string | number;
  executed_at_utc: string;
  broker_time_text?: string | null;
  broker_utc_offset_minutes?: number | null;
  deal_type_code?: number | null;
  entry_type_code?: number | null;
  symbol?: string | null;
  volume?: number | string | null;
  price?: number | string | null;
  commission?: number | string | null;
  swap?: number | string | null;
  profit?: number | string | null;
  fee?: number | string | null;
  stop_loss?: number | string | null;
  take_profit?: number | string | null;
  comment?: string | null;
};

export type Mt5OpenPosition = {
  position_identifier: string;
  floating_profit?: number | string | null;
  swap?: number | string | null;
  stop_loss?: number | string | null;
  take_profit?: number | string | null;
  comment?: string | null;
};

type Direction = "buy" | "sell";

type WorkingTrade = {
  positionIdentifier: string;
  tradeCycle: number;
  symbol: string;
  direction: Direction;
  entryTimeMsc: string;
  exitTimeMsc: string | null;
  entryAtUtc: string;
  exitAtUtc: string | null;
  entryBrokerTimeText: string | null;
  exitBrokerTimeText: string | null;
  entryBrokerUtcOffsetMinutes: number | null;
  exitBrokerUtcOffsetMinutes: number | null;
  totalEntryLots: number;
  totalExitLots: number;
  openLots: number;
  entryPriceVolume: number;
  exitPriceVolume: number;
  grossProfit: number;
  commission: number;
  swap: number;
  fees: number;
  stopLoss: number | null;
  takeProfit: number | null;
  tradeComment: string | null;
  balanceAtEntry: number | null;
  entryDealTickets: string[];
  exitDealTickets: string[];
  allDealTickets: string[];
};

export type Mt5DerivedTradeRow = {
  account_id: string;
  position_identifier: string;
  trade_cycle: number;
  symbol: string;
  status: "open" | "win" | "loss" | "breakeven";
  direction: Direction;
  entry_time_msc: string;
  exit_time_msc: string | null;
  entry_at_utc: string;
  exit_at_utc: string | null;
  entry_broker_time_text: string | null;
  exit_broker_time_text: string | null;
  entry_broker_utc_offset_minutes: number | null;
  exit_broker_utc_offset_minutes: number | null;
  total_entry_lots: number;
  total_exit_lots: number;
  open_lots: number;
  weighted_entry_price: number | null;
  weighted_exit_price: number | null;
  gross_profit: number;
  commission: number;
  swap: number;
  fees: number;
  stop_loss: number | null;
  take_profit: number | null;
  trade_comment: string | null;
  realized_net_profit: number;
  floating_profit: number;
  open_position_swap: number;
  net_profit: number;
  account_balance_at_entry: number | null;
  pl_percentage: number | null;
  entry_deal_count: number;
  exit_deal_count: number;
  entry_deal_tickets: string[];
  exit_deal_tickets: string[];
  all_deal_tickets: string[];
  first_deal_ticket: string | null;
  last_deal_ticket: string | null;
  source_version: number;
};

const EPSILON = 1e-9;
const DEAL_TYPE_BUY = 0;
const DEAL_TYPE_SELL = 1;
const DEAL_ENTRY_IN = 0;
const DEAL_ENTRY_OUT = 1;
const DEAL_ENTRY_INOUT = 2;
const DEAL_ENTRY_OUT_BY = 3;

function finiteNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dealNet(deal: Mt5RawDeal) {
  return (
    finiteNumber(deal.profit) +
    finiteNumber(deal.commission) +
    finiteNumber(deal.swap) +
    finiteNumber(deal.fee)
  );
}

function directionFromDealType(value: unknown): Direction | null {
  if (Number(value) === DEAL_TYPE_BUY) return "buy";
  if (Number(value) === DEAL_TYPE_SELL) return "sell";
  return null;
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value);
}

function createTrade(
  deal: Mt5RawDeal,
  accountBalanceAtEntry: number | null,
  direction: Direction,
  tradeCycle: number,
): WorkingTrade {
  return {
    positionIdentifier: String(deal.position_identifier),
    tradeCycle,
    symbol: String(deal.symbol ?? "").trim(),
    direction,
    entryTimeMsc: String(deal.time_msc),
    exitTimeMsc: null,
    entryAtUtc: deal.executed_at_utc,
    exitAtUtc: null,
    entryBrokerTimeText: deal.broker_time_text ?? null,
    exitBrokerTimeText: null,
    entryBrokerUtcOffsetMinutes: nullableNumber(
      deal.broker_utc_offset_minutes,
    ),
    exitBrokerUtcOffsetMinutes: null,
    totalEntryLots: 0,
    totalExitLots: 0,
    openLots: 0,
    entryPriceVolume: 0,
    exitPriceVolume: 0,
    grossProfit: 0,
    commission: 0,
    swap: 0,
    fees: 0,
    stopLoss: null,
    takeProfit: null,
    tradeComment: String(deal.comment ?? "").trim() || null,
    balanceAtEntry:
      accountBalanceAtEntry !== null &&
      Number.isFinite(accountBalanceAtEntry) &&
      accountBalanceAtEntry !== 0
        ? accountBalanceAtEntry
        : null,
    entryDealTickets: [],
    exitDealTickets: [],
    allDealTickets: [],
  };
}

function addFinancials(
  trade: WorkingTrade,
  deal: Mt5RawDeal,
  fraction = 1,
  includeProfitAndSwap = true,
) {
  trade.commission += finiteNumber(deal.commission) * fraction;
  trade.fees += finiteNumber(deal.fee) * fraction;
  if (includeProfitAndSwap) {
    trade.grossProfit += finiteNumber(deal.profit);
    trade.swap += finiteNumber(deal.swap);
  }
}

function addEntry(
  trade: WorkingTrade,
  deal: Mt5RawDeal,
  volume: number,
  financialFraction = 1,
  includeProfitAndSwap = true,
) {
  trade.totalEntryLots += volume;
  trade.openLots += volume;
  trade.entryPriceVolume += finiteNumber(deal.price) * volume;
  const stopLoss = nullableNumber(deal.stop_loss);
  const takeProfit = nullableNumber(deal.take_profit);
  if (stopLoss !== null && Math.abs(stopLoss) > EPSILON) trade.stopLoss = stopLoss;
  if (takeProfit !== null && Math.abs(takeProfit) > EPSILON) trade.takeProfit = takeProfit;
  const comment = String(deal.comment ?? "").trim();
  if (comment) trade.tradeComment = comment;
  addFinancials(trade, deal, financialFraction, includeProfitAndSwap);
  pushUnique(trade.entryDealTickets, String(deal.deal_ticket));
  pushUnique(trade.allDealTickets, String(deal.deal_ticket));
}

function addExit(
  trade: WorkingTrade,
  deal: Mt5RawDeal,
  volume: number,
  financialFraction = 1,
  includeProfitAndSwap = true,
) {
  trade.totalExitLots += volume;
  trade.openLots = Math.max(0, trade.openLots - volume);
  trade.exitPriceVolume += finiteNumber(deal.price) * volume;
  trade.exitTimeMsc = String(deal.time_msc);
  trade.exitAtUtc = deal.executed_at_utc;
  trade.exitBrokerTimeText = deal.broker_time_text ?? null;
  trade.exitBrokerUtcOffsetMinutes = nullableNumber(
    deal.broker_utc_offset_minutes,
  );
  const stopLoss = nullableNumber(deal.stop_loss);
  const takeProfit = nullableNumber(deal.take_profit);
  if (stopLoss !== null && Math.abs(stopLoss) > EPSILON) trade.stopLoss = stopLoss;
  if (takeProfit !== null && Math.abs(takeProfit) > EPSILON) trade.takeProfit = takeProfit;
  const comment = String(deal.comment ?? "").trim();
  if (comment) trade.tradeComment = comment;
  addFinancials(trade, deal, financialFraction, includeProfitAndSwap);
  pushUnique(trade.exitDealTickets, String(deal.deal_ticket));
  pushUnique(trade.allDealTickets, String(deal.deal_ticket));
}

function statusFromNet(netProfit: number) {
  if (netProfit > EPSILON) return "win" as const;
  if (netProfit < -EPSILON) return "loss" as const;
  return "breakeven" as const;
}

function toDatabaseRow(
  accountId: string,
  trade: WorkingTrade,
  openPositions: Map<string, Mt5OpenPosition>,
): Mt5DerivedTradeRow {
  const isOpen = trade.openLots > EPSILON;
  const position = isOpen
    ? openPositions.get(trade.positionIdentifier)
    : undefined;
  const floatingProfit = finiteNumber(position?.floating_profit);
  const openPositionSwap = finiteNumber(position?.swap);
  const realizedNetProfit =
    trade.grossProfit + trade.commission + trade.swap + trade.fees;
  const netProfit =
    realizedNetProfit +
    (isOpen ? floatingProfit + openPositionSwap : 0);
  const balance = trade.balanceAtEntry;
  const positionStopLoss = nullableNumber(position?.stop_loss);
  const positionTakeProfit = nullableNumber(position?.take_profit);
  const positionComment = String(position?.comment ?? "").trim();

  return {
    account_id: accountId,
    position_identifier: trade.positionIdentifier,
    trade_cycle: trade.tradeCycle,
    symbol: trade.symbol,
    status: isOpen ? "open" : statusFromNet(netProfit),
    direction: trade.direction,
    entry_time_msc: trade.entryTimeMsc,
    exit_time_msc: isOpen ? null : trade.exitTimeMsc,
    entry_at_utc: trade.entryAtUtc,
    exit_at_utc: isOpen ? null : trade.exitAtUtc,
    entry_broker_time_text: trade.entryBrokerTimeText,
    exit_broker_time_text: isOpen ? null : trade.exitBrokerTimeText,
    entry_broker_utc_offset_minutes:
      trade.entryBrokerUtcOffsetMinutes,
    exit_broker_utc_offset_minutes: isOpen
      ? null
      : trade.exitBrokerUtcOffsetMinutes,
    total_entry_lots: trade.totalEntryLots,
    total_exit_lots: trade.totalExitLots,
    open_lots: isOpen ? trade.openLots : 0,
    weighted_entry_price:
      trade.totalEntryLots > EPSILON
        ? trade.entryPriceVolume / trade.totalEntryLots
        : null,
    weighted_exit_price:
      trade.totalExitLots > EPSILON
        ? trade.exitPriceVolume / trade.totalExitLots
        : null,
    gross_profit: trade.grossProfit,
    commission: trade.commission,
    swap: trade.swap,
    fees: trade.fees,
    stop_loss:
      isOpen && positionStopLoss !== null && Math.abs(positionStopLoss) > EPSILON
        ? positionStopLoss
        : trade.stopLoss,
    take_profit:
      isOpen && positionTakeProfit !== null && Math.abs(positionTakeProfit) > EPSILON
        ? positionTakeProfit
        : trade.takeProfit,
    trade_comment: positionComment || trade.tradeComment,
    realized_net_profit: realizedNetProfit,
    floating_profit: floatingProfit,
    open_position_swap: openPositionSwap,
    net_profit: netProfit,
    account_balance_at_entry: balance,
    pl_percentage:
      balance !== null && Math.abs(balance) > EPSILON
        ? (netProfit / balance) * 100
        : null,
    entry_deal_count: trade.entryDealTickets.length,
    exit_deal_count: trade.exitDealTickets.length,
    entry_deal_tickets: trade.entryDealTickets,
    exit_deal_tickets: trade.exitDealTickets,
    all_deal_tickets: trade.allDealTickets,
    first_deal_ticket: trade.allDealTickets[0] ?? null,
    last_deal_ticket:
      trade.allDealTickets[trade.allDealTickets.length - 1] ?? null,
    source_version: 3,
  };
}

export function deriveMt5TradeRows({
  accountId,
  accountBalance,
  deals,
  openPositions = [],
}: {
  accountId: string;
  accountBalance: number | null;
  deals: Mt5RawDeal[];
  openPositions?: Mt5OpenPosition[];
}) {
  const sortedDeals = [...deals].sort((left, right) => {
    const timeDifference =
      Number(left.time_msc) - Number(right.time_msc);
    if (timeDifference !== 0) return timeDifference;
    return String(left.deal_ticket).localeCompare(
      String(right.deal_ticket),
      undefined,
      { numeric: true },
    );
  });

  const currentBalance = nullableNumber(accountBalance);
  const completeLedgerNet = sortedDeals.reduce(
    (total, deal) => total + dealNet(deal),
    0,
  );
  let runningBalance =
    currentBalance === null ? null : currentBalance - completeLedgerNet;
  const activeTrades = new Map<string, WorkingTrade>();
  const latestTrades = new Map<string, WorkingTrade>();
  const completedTrades: WorkingTrade[] = [];
  const cycleCounts = new Map<string, number>();

  const nextTrade = (
    deal: Mt5RawDeal,
    direction: Direction,
    balanceAtEntry: number | null,
  ) => {
    const positionIdentifier = String(deal.position_identifier);
    const cycle = (cycleCounts.get(positionIdentifier) ?? 0) + 1;
    cycleCounts.set(positionIdentifier, cycle);
    const trade = createTrade(
      deal,
      balanceAtEntry,
      direction,
      cycle,
    );
    activeTrades.set(positionIdentifier, trade);
    return trade;
  };

  for (const deal of sortedDeals) {
    const balanceBeforeDeal = runningBalance;
    const direction = directionFromDealType(deal.deal_type_code);
    const positionIdentifier = String(
      deal.position_identifier ?? "",
    ).trim();
    const symbol = String(deal.symbol ?? "").trim();
    const volume = finiteNumber(deal.volume);
    const entryType = Number(deal.entry_type_code);
    const isTradingDeal =
      direction !== null &&
      positionIdentifier !== "" &&
      positionIdentifier !== "0" &&
      symbol !== "" &&
      volume > EPSILON;

    if (isTradingDeal && direction) {
      let trade = activeTrades.get(positionIdentifier);

      if (entryType === DEAL_ENTRY_IN) {
        if (!trade || trade.openLots <= EPSILON) {
          trade = nextTrade(deal, direction, balanceBeforeDeal);
        }
        addEntry(trade, deal, volume);
      } else if (
        entryType === DEAL_ENTRY_OUT ||
        entryType === DEAL_ENTRY_OUT_BY
      ) {
        if (trade) {
          addExit(trade, deal, volume);
          if (trade.openLots <= EPSILON) {
            completedTrades.push(trade);
            latestTrades.set(positionIdentifier, trade);
            activeTrades.delete(positionIdentifier);
          }
        }
      } else if (entryType === DEAL_ENTRY_INOUT) {
        // A reversal can only be split correctly when its original position
        // exists in the imported ledger. Never invent a missing entry because
        // that would fabricate its lot, entry price and P/L percentage.
        if (!trade) {
          if (runningBalance !== null) runningBalance += dealNet(deal);
          continue;
        }

        const closingLots = Math.min(trade.openLots, volume);
        const closingFraction = Math.min(1, closingLots / volume);
        addExit(trade, deal, closingLots, closingFraction, true);
        completedTrades.push(trade);
        latestTrades.set(positionIdentifier, trade);
        activeTrades.delete(positionIdentifier);

        const openingLots = Math.max(0, volume - closingLots);
        if (openingLots > EPSILON) {
          const closingNet =
            finiteNumber(deal.profit) +
            finiteNumber(deal.swap) +
            finiteNumber(deal.commission) * closingFraction +
            finiteNumber(deal.fee) * closingFraction;
          const reversal = nextTrade(
            deal,
            direction,
            balanceBeforeDeal + closingNet,
          );
          addEntry(
            reversal,
            deal,
            openingLots,
            1 - closingFraction,
            false,
          );
        }
      }
    } else if (
      positionIdentifier !== "" &&
      positionIdentifier !== "0"
    ) {
      // Some brokers post commission, fee or swap as a separate non-buy/sell
      // deal. Attach it to the matching logical position instead of losing it.
      const relatedTrade =
        activeTrades.get(positionIdentifier) ??
        latestTrades.get(positionIdentifier);
      if (relatedTrade && Math.abs(dealNet(deal)) > EPSILON) {
        addFinancials(relatedTrade, deal);
        pushUnique(relatedTrade.allDealTickets, String(deal.deal_ticket));
      }
    }

    if (runningBalance !== null) runningBalance += dealNet(deal);
  }

  const positionMap = new Map(
    openPositions.map((position) => [
      String(position.position_identifier),
      position,
    ]),
  );
  const allTrades = [
    ...completedTrades,
    ...Array.from(activeTrades.values()),
  ].sort((left, right) => {
    const timeDifference =
      Number(left.entryTimeMsc) - Number(right.entryTimeMsc);
    if (timeDifference !== 0) return timeDifference;
    if (left.positionIdentifier !== right.positionIdentifier) {
      return left.positionIdentifier.localeCompare(
        right.positionIdentifier,
        undefined,
        { numeric: true },
      );
    }
    return left.tradeCycle - right.tradeCycle;
  });

  return allTrades.map((trade) =>
    toDatabaseRow(accountId, trade, positionMap),
  );
}
