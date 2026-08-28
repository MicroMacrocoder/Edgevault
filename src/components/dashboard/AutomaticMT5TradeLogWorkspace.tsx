"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardPreferences } from "@/components/dashboard/DashboardPreferencesProvider";

type Account = {
  id: string;
  login: string;
  server: string;
  company?: string | null;
  account_name?: string | null;
  currency?: string | null;
  broker_utc_offset_minutes?: number | null;
  status: string;
};

type Trade = {
  id: string;
  account_id: string;
  position_identifier: string;
  trade_cycle: number;
  symbol: string;
  status: "open" | "win" | "loss" | "breakeven";
  direction: "buy" | "sell";
  entry_at_utc: string;
  exit_at_utc: string | null;
  entry_broker_time_text: string | null;
  exit_broker_time_text: string | null;
  total_entry_lots: number | string;
  weighted_entry_price: number | string | null;
  weighted_exit_price: number | string | null;
  net_profit: number | string;
  account_balance_at_entry: number | string | null;
  pl_percentage: number | string | null;
};

type DateRange = "today" | "7d" | "30d" | "3m" | "all" | "custom";

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function price(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function brokerText(value: string | null) {
  if (!value) return "—";
  return value.replace(/^(\d{4})\.(\d{2})\.(\d{2})\s/, "$1-$2-$3 ");
}

function dateKeyInTimezone(date: Date, timezone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyAtFixedOffset(date: Date, offsetMinutes: number) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function moveDateKey(
  dateKey: string,
  change: { days?: number; months?: number },
) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (change.months) date.setUTCMonth(date.getUTCMonth() + change.months);
  if (change.days) date.setUTCDate(date.getUTCDate() + change.days);
  return date.toISOString().slice(0, 10);
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-cyan-400/10 bg-[#111827]/70 ${className}`}
    >
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

function CumulativeChart({ trades }: { trades: Trade[] }) {
  const points = useMemo(() => {
    const closed = trades
      .filter((trade) => trade.status !== "open")
      .sort(
        (left, right) =>
          new Date(left.exit_at_utc || left.entry_at_utc).getTime() -
          new Date(right.exit_at_utc || right.entry_at_utc).getTime(),
      );
    let cumulative = 0;
    return closed.map((trade) => {
      cumulative += numberValue(trade.net_profit);
      return cumulative;
    });
  }, [trades]);

  const path = useMemo(() => {
    if (!points.length) return "";
    const minimum = Math.min(0, ...points);
    const maximum = Math.max(0, ...points);
    const spread = Math.max(1, maximum - minimum);
    return points
      .map((value, index) => {
        const x = points.length === 1 ? 100 : (index / (points.length - 1)) * 200;
        const y = 76 - ((value - minimum) / spread) * 64;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);

  return (
    <div className="h-24 rounded-xl border border-slate-800 bg-slate-950/70 p-2">
      {path ? (
        <svg viewBox="0 0 200 84" className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="mt5-pl-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L200,84 L0,84 Z`} fill="url(#mt5-pl-gradient)" />
          <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          Closed-trade P/L will appear here.
        </div>
      )}
    </div>
  );
}

export default function AutomaticMT5TradeLogWorkspace() {
  const { preferences, updateSection } = useDashboardPreferences();
  const timezonePreference = preferences.tradeLog;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showTimezoneSettings, setShowTimezoneSettings] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState("");

  const availableTimezones = useMemo(() => {
    const supported =
      typeof (Intl as any).supportedValuesOf === "function"
        ? ((Intl as any).supportedValuesOf("timeZone") as string[])
        : ["UTC", "Africa/Lagos", "Europe/London", "America/New_York", "Asia/Tokyo"];
    const query = timezoneSearch.trim().toLowerCase();
    const filtered = query
      ? supported.filter((timezone) => timezone.toLowerCase().includes(query))
      : supported;
    return Array.from(new Set(["UTC", ...filtered])).slice(0, 150);
  }, [timezoneSearch]);

  const effectiveTimezone = useMemo(() => {
    if (timezonePreference.timezoneMode === "utc") return "UTC";
    if (timezonePreference.timezoneMode === "custom") {
      return timezonePreference.customTimezone || "UTC";
    }
    if (timezonePreference.timezoneMode === "device") return undefined;
    if (selectedAccountId === "all") return "UTC";
    return null;
  }, [selectedAccountId, timezonePreference]);

  const selectedBrokerOffset = useMemo(() => {
    if (
      timezonePreference.timezoneMode !== "broker" ||
      selectedAccountId === "all"
    ) {
      return null;
    }
    const account = accounts.find((item) => item.id === selectedAccountId);
    const offset = Number(account?.broker_utc_offset_minutes);
    return Number.isFinite(offset) ? offset : null;
  }, [accounts, selectedAccountId, timezonePreference.timezoneMode]);

  const loadTrades = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setMessage("Log in to view your automatic MT5 Trade Log.");
      setLoading(false);
      return;
    }

    const response = await fetch(
      `/api/mt5/trades?accountId=${encodeURIComponent(selectedAccountId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Could not load automatic MT5 trades.");
    }
    setAccounts(result.accounts ?? []);
    setTrades(result.trades ?? []);
    setMessage("");
    setLoading(false);
  }, [selectedAccountId]);

  useEffect(() => {
    setLoading(true);
    loadTrades().catch((error) => {
      setMessage(error?.message || "Could not load automatic MT5 trades.");
      setLoading(false);
    });
    const interval = window.setInterval(() => {
      loadTrades().catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loadTrades]);

  const displayDateKey = useCallback(
    (trade: Trade) => {
      if (
        timezonePreference.timezoneMode === "broker" &&
        selectedAccountId !== "all" &&
        trade.entry_broker_time_text
      ) {
        return trade.entry_broker_time_text.slice(0, 10).replaceAll(".", "-");
      }
      return dateKeyInTimezone(new Date(trade.entry_at_utc), effectiveTimezone ?? undefined);
    },
    [effectiveTimezone, selectedAccountId, timezonePreference.timezoneMode],
  );

  const filteredTrades = useMemo(() => {
    const now = new Date();
    const todayKey =
      selectedBrokerOffset === null
        ? dateKeyInTimezone(now, effectiveTimezone ?? undefined)
        : dateKeyAtFixedOffset(now, selectedBrokerOffset);
    const cutoffKey =
      dateRange === "7d"
        ? moveDateKey(todayKey, { days: -6 })
        : dateRange === "30d"
          ? moveDateKey(todayKey, { days: -29 })
          : dateRange === "3m"
            ? moveDateKey(todayKey, { months: -3 })
            : null;

    return trades.filter((trade) => {
      const key = displayDateKey(trade);
      if (dateRange === "today") return key === todayKey;
      if (cutoffKey) return key >= cutoffKey && key <= todayKey;
      if (dateRange === "custom") {
        if (customFrom && key < customFrom) return false;
        if (customTo && key > customTo) return false;
      }
      return true;
    });
  }, [
    customFrom,
    customTo,
    dateRange,
    displayDateKey,
    effectiveTimezone,
    selectedBrokerOffset,
    trades,
  ]);

  const metrics = useMemo(() => {
    const wins = filteredTrades.filter((trade) => trade.status === "win");
    const losses = filteredTrades.filter((trade) => trade.status === "loss");
    const open = filteredTrades.filter((trade) => trade.status === "open");
    const breakeven = filteredTrades.filter((trade) => trade.status === "breakeven");
    const closedCount = wins.length + losses.length + breakeven.length;
    const netProfit = filteredTrades.reduce(
      (total, trade) => total + numberValue(trade.net_profit),
      0,
    );
    const firstTradeByAccount = new Map<string, Trade>();
    for (const trade of filteredTrades) {
      const existing = firstTradeByAccount.get(trade.account_id);
      if (
        !existing ||
        new Date(trade.entry_at_utc).getTime() <
          new Date(existing.entry_at_utc).getTime()
      ) {
        firstTradeByAccount.set(trade.account_id, trade);
      }
    }
    const startingBalance = Array.from(firstTradeByAccount.values()).reduce(
      (total, trade) => total + numberValue(trade.account_balance_at_entry),
      0,
    );
    const plPercentage = startingBalance
      ? (netProfit / startingBalance) * 100
      : null;
    return {
      wins: wins.length,
      losses: losses.length,
      open: open.length,
      breakeven: breakeven.length,
      winRate: closedCount ? (wins.length / closedCount) * 100 : 0,
      lossRate: closedCount ? (losses.length / closedCount) * 100 : 0,
      averageWin: wins.length
        ? wins.reduce((sum, trade) => sum + numberValue(trade.net_profit), 0) / wins.length
        : 0,
      averageLoss: losses.length
        ? losses.reduce((sum, trade) => sum + numberValue(trade.net_profit), 0) / losses.length
        : 0,
      netProfit,
      plPercentage,
    };
  }, [filteredTrades]);

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selectedCurrency =
    selectedAccountId === "all"
      ? null
      : accountMap.get(selectedAccountId)?.currency || "USD";
  const filteredCurrencies = useMemo(
    () =>
      new Set(
        filteredTrades.map(
          (trade) => accountMap.get(trade.account_id)?.currency || "USD",
        ),
      ),
    [accountMap, filteredTrades],
  );
  const aggregateCurrency =
    selectedCurrency ||
    (filteredCurrencies.size === 1
      ? Array.from(filteredCurrencies)[0]
      : null);

  const formatTradeDate = useCallback(
    (trade: Trade, kind: "entry" | "exit") => {
      const utcValue = kind === "entry" ? trade.entry_at_utc : trade.exit_at_utc;
      const brokerValue =
        kind === "entry"
          ? trade.entry_broker_time_text
          : trade.exit_broker_time_text;
      if (!utcValue) return "—";
      if (
        timezonePreference.timezoneMode === "broker" &&
        selectedAccountId !== "all"
      ) {
        return brokerText(brokerValue);
      }
      return new Intl.DateTimeFormat(undefined, {
        timeZone: effectiveTimezone ?? undefined,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(utcValue));
    },
    [effectiveTimezone, selectedAccountId, timezonePreference.timezoneMode],
  );

  return (
    <div className="space-y-5">
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Automatic MT5 Trade Log
            </p>
            <h1 className="mt-2 text-3xl font-black text-white">Trade Log</h1>
            <p className="mt-2 text-sm text-slate-400">
              Execution facts are synchronized directly from your saved MT5 accounts.
            </p>
          </div>
          <select
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
          >
            <option value="all">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_name || account.company || "MT5"} · {account.login}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {(["today", "7d", "30d", "3m", "all"] as DateRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDateRange(range)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase ${
                dateRange === range
                  ? "border-cyan-300 bg-cyan-400/15 text-cyan-200"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              {range === "today" ? "Today" : range === "all" ? "All" : range}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDateRange("custom")}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase ${
              dateRange === "custom"
                ? "border-cyan-300 bg-cyan-400/15 text-cyan-200"
                : "border-slate-700 text-slate-400"
            }`}
          >
            Custom
          </button>
          <button
            type="button"
            onClick={() => setShowTimezoneSettings((current) => !current)}
            className="ml-auto rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200"
          >
            Timezone Settings
          </button>
        </div>

        {dateRange === "custom" ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
        ) : null}

        {showTimezoneSettings ? (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/90 p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["broker", "MT5/Broker Time"],
                ["device", "Device Local Time"],
                ["utc", "UTC"],
                ["custom", "Custom Timezone"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => void updateSection("tradeLog", { ...timezonePreference, timezoneMode: mode })}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${timezonePreference.timezoneMode === mode ? "border-cyan-300 bg-cyan-400/15 text-cyan-200" : "border-slate-700 text-slate-400"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {timezonePreference.timezoneMode === "custom" ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={timezoneSearch} onChange={(event) => setTimezoneSearch(event.target.value)} placeholder="Search timezone" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                <select value={timezonePreference.customTimezone} onChange={(event) => void updateSection("tradeLog", { timezoneMode: "custom", customTimezone: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                  {availableTimezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
                </select>
              </div>
            ) : null}
            {selectedAccountId === "all" && timezonePreference.timezoneMode === "broker" ? (
              <p className="mt-3 text-xs text-amber-300">All Accounts uses UTC so every broker is compared in one timezone.</p>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel className="p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <CumulativeChart trades={filteredTrades} />
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="P/L($)"
              value={
                aggregateCurrency
                  ? money(metrics.netProfit, aggregateCurrency)
                  : "Mixed currencies"
              }
            />
            <Metric
              label="P/L(%)"
              value={
                aggregateCurrency && metrics.plPercentage !== null
                  ? `${metrics.plPercentage.toFixed(2)}%`
                  : "—"
              }
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric label="Wins" value={String(metrics.wins)} detail={`${metrics.winRate.toFixed(1)}% win rate`} />
          <Metric label="Losses" value={String(metrics.losses)} detail={`${metrics.lossRate.toFixed(1)}% loss rate`} />
          <Metric label="Open" value={String(metrics.open)} />
          <Metric label="Breakeven" value={String(metrics.breakeven)} />
          <Metric
            label="Average Win"
            value={aggregateCurrency ? money(metrics.averageWin, aggregateCurrency) : "—"}
          />
          <Metric
            label="Average Loss"
            value={aggregateCurrency ? money(metrics.averageLoss, aggregateCurrency) : "—"}
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        {message ? <p className="p-5 text-sm text-amber-200">{message}</p> : null}
        {loading ? <p className="p-5 text-sm text-slate-400">Loading automatic MT5 trades...</p> : null}
        {!loading && !filteredTrades.length ? <p className="p-5 text-sm text-slate-400">No MT5 trades match this account and date range.</p> : null}
        {filteredTrades.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {selectedAccountId === "all" ? <th className="px-4 py-3">Account</th> : null}
                  <th className="px-4 py-3">Ent Date</th><th className="px-4 py-3">Ext Date</th><th className="px-4 py-3">Symbol</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Direction</th><th className="px-4 py-3">Lot</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">Exit</th><th className="px-4 py-3">P/L($)</th><th className="px-4 py-3">P/L(%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/50 text-slate-200">
                {filteredTrades.map((trade) => {
                  const account = accountMap.get(trade.account_id);
                  const net = numberValue(trade.net_profit);
                  return (
                    <tr key={trade.id}>
                      {selectedAccountId === "all" ? <td className="px-4 py-3 text-xs">{account?.login || "—"}</td> : null}
                      <td className="px-4 py-3 whitespace-nowrap">{formatTradeDate(trade, "entry")}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTradeDate(trade, "exit")}</td>
                      <td className="px-4 py-3 font-bold text-white">{trade.symbol}</td>
                      <td className="px-4 py-3 capitalize">{trade.status}</td>
                      <td className={`px-4 py-3 font-bold capitalize ${trade.direction === "buy" ? "text-emerald-400" : "text-red-400"}`}>{trade.direction}</td>
                      <td className="px-4 py-3">{numberValue(trade.total_entry_lots).toFixed(2)}</td>
                      <td className="px-4 py-3">{price(trade.weighted_entry_price)}</td>
                      <td className="px-4 py-3">{price(trade.weighted_exit_price)}</td>
                      <td className={`px-4 py-3 font-bold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{money(net, account?.currency || "USD")}</td>
                      <td className={`px-4 py-3 font-bold ${numberValue(trade.pl_percentage) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{numberValue(trade.pl_percentage).toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
