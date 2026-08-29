import { getUserTradeLogsWithRows } from "@/lib/supabase";
import type { TradeLogWithRows } from "@/lib/performanceMetrics";

export type AutomaticMt5Account = {
  id: string;
  login: string;
  server: string;
  account_name?: string | null;
  company?: string | null;
  currency?: string | null;
  balance?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_connected_at?: string | null;
};

export type AutomaticMt5Trade = {
  id: string;
  account_id: string;
  position_identifier: string;
  trade_cycle: number;
  symbol: string;
  status: "open" | "win" | "loss" | "breakeven";
  direction: "buy" | "sell";
  entry_at_utc: string;
  entry_time_msc: number | string;
  exit_at_utc: string | null;
  total_entry_lots: number | string;
  weighted_entry_price: number | string | null;
  weighted_exit_price: number | string | null;
  net_profit: number | string;
  pl_percentage?: number | string | null;
  account_balance_at_entry: number | string | null;
  updated_at?: string | null;
};

export type AutomaticMt5BalanceEvent = {
  account_id: string;
  deal_ticket: string;
  time_msc: number | string;
  executed_at_utc: string;
  broker_time_text?: string | null;
  deal_type?: string | null;
  amount: number | string;
  comment?: string | null;
};

type AutomaticMt5Response = {
  success?: boolean;
  message?: string;
  accounts?: AutomaticMt5Account[];
  trades?: AutomaticMt5Trade[];
  balanceEvents?: AutomaticMt5BalanceEvent[];
};

export type CombinedPerformanceTradeLogsResult = {
  tradeLogs: TradeLogWithRows[];
  warnings: string[];
  automaticAccounts: AutomaticMt5Account[];
  automaticTrades: AutomaticMt5Trade[];
  automaticBalanceEvents: AutomaticMt5BalanceEvent[];
};

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function automaticLogName(account: AutomaticMt5Account) {
  const identity =
    account.account_name || account.company || `MT5 ${account.login}`;
  return `Automatic MT5 · ${identity}`;
}

export function convertAutomaticMt5TradesToPerformanceLogs({
  accounts,
  trades,
  balanceEvents = [],
}: {
  accounts: AutomaticMt5Account[];
  trades: AutomaticMt5Trade[];
  balanceEvents?: AutomaticMt5BalanceEvent[];
}): TradeLogWithRows[] {
  return accounts.map((account) => {
    const allAccountTrades = trades
      .filter((trade) => trade.account_id === account.id)
      .sort(
        (left, right) =>
          new Date(left.entry_at_utc).getTime() -
          new Date(right.entry_at_utc).getTime(),
      );
    const accountTrades = allAccountTrades.filter(
      (trade) => trade.status !== "open",
    );

    const firstTrade = allAccountTrades.find(
      (trade) =>
        trade.account_balance_at_entry !== null &&
        Number.isFinite(Number(trade.account_balance_at_entry)),
    );
    const firstBalance = firstTrade?.account_balance_at_entry;
    const firstTradeTimeMsc = firstTrade
      ? Number(firstTrade.entry_time_msc)
      : null;
    const accountBalanceEvents =
      firstTradeTimeMsc === null || !Number.isFinite(firstTradeTimeMsc)
        ? []
        : balanceEvents
            .filter(
              (event) =>
                event.account_id === account.id &&
                Number(event.time_msc) >= firstTradeTimeMsc,
            )
            .map((event) => ({
              id: `mt5-balance:${account.id}:${event.deal_ticket}`,
              date: event.executed_at_utc,
              amount: finiteNumber(event.amount),
              type: event.deal_type || "balance_operation",
              comment: event.comment || undefined,
            }));

    return {
      id: `mt5:${account.id}`,
      logName: automaticLogName(account),
      initialBalance:
        firstBalance === null || firstBalance === undefined
          ? finiteNumber(account.balance)
          : finiteNumber(firstBalance),
      accountCurrency: account.currency || "USD",
      createdAt: account.created_at || account.last_connected_at || undefined,
      updatedAt: account.updated_at || account.last_connected_at || undefined,
      balanceEvents: accountBalanceEvents,
      rows: accountTrades.map((trade) => ({
        id: `mt5:${trade.account_id}:${trade.position_identifier}:${trade.trade_cycle}`,
        rowData: {
          Symbol: trade.symbol,
          Status: trade.status,
          Direction: trade.direction,
          Lot: finiteNumber(trade.total_entry_lots),
          "Ent Date": trade.entry_at_utc,
          "Ext Date": trade.exit_at_utc || "",
          Entry:
            trade.weighted_entry_price === null
              ? ""
              : finiteNumber(trade.weighted_entry_price),
          Exit:
            trade.weighted_exit_price === null
              ? ""
              : finiteNumber(trade.weighted_exit_price),
          "P/L($)": finiteNumber(trade.net_profit),
          "P/L(%)": finiteNumber(trade.pl_percentage),
          Source: "Automatic MT5",
        },
        createdAt: trade.entry_at_utc,
        updatedAt: trade.updated_at || trade.exit_at_utc || trade.entry_at_utc,
      })),
    };
  });
}

async function getAutomaticMt5Data(accessToken: string) {
  const response = await fetch("/api/mt5/trades?accountId=all", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const result = (await response.json()) as AutomaticMt5Response;

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Could not load automatic MT5 performance data.",
    );
  }

  return {
    accounts: result.accounts ?? [],
    trades: result.trades ?? [],
    balanceEvents: result.balanceEvents ?? [],
  };
}

export async function getAutomaticMt5PerformanceLogs(accessToken: string) {
  const result = await getAutomaticMt5Data(accessToken);
  return convertAutomaticMt5TradesToPerformanceLogs(result);
}

export async function getCombinedPerformanceTradeLogs({
  userId,
  accessToken,
}: {
  userId: string;
  accessToken: string;
}): Promise<CombinedPerformanceTradeLogsResult> {
  const [manualResult, automaticResult] = await Promise.allSettled([
    getUserTradeLogsWithRows(userId),
    getAutomaticMt5Data(accessToken),
  ]);

  const warnings: string[] = [];
  let manualLogs: TradeLogWithRows[] = [];
  let automaticLogs: TradeLogWithRows[] = [];
  let automaticAccounts: AutomaticMt5Account[] = [];
  let automaticTrades: AutomaticMt5Trade[] = [];
  let automaticBalanceEvents: AutomaticMt5BalanceEvent[] = [];

  if (manualResult.status === "fulfilled") {
    if (manualResult.value?.error) {
      warnings.push("Manual Trade Logs could not be loaded.");
    } else {
      manualLogs = manualResult.value?.tradeLogs ?? [];
    }
  } else {
    warnings.push("Manual Trade Logs could not be loaded.");
  }

  if (automaticResult.status === "fulfilled") {
    automaticAccounts = automaticResult.value.accounts;
    automaticTrades = automaticResult.value.trades;
    automaticBalanceEvents = automaticResult.value.balanceEvents;
    automaticLogs = convertAutomaticMt5TradesToPerformanceLogs({
      accounts: automaticAccounts,
      trades: automaticTrades,
      balanceEvents: automaticBalanceEvents,
    });
  } else {
    warnings.push("Automatic MT5 trades could not be loaded.");
  }

  return {
    tradeLogs: [...automaticLogs, ...manualLogs],
    warnings,
    automaticAccounts,
    automaticTrades,
    automaticBalanceEvents,
  };
}
