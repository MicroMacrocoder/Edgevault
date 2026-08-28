"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { useDashboardPreferences } from "@/components/dashboard/DashboardPreferencesProvider";
import AutomaticMT5TradeDetails, {
  type AutomaticMt5DetailTrade,
} from "@/components/dashboard/AutomaticMT5TradeDetails";
import {
  AUTOMATIC_MT5_CALCULATED_HEADERS,
  AUTOMATIC_MT5_MANUAL_HEADERS,
  DEFAULT_AUTOMATIC_MT5_OPTIONAL_HEADERS,
  type AutomaticMt5Header,
} from "@/lib/automaticMt5TradeLog";

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

type Trade = AutomaticMt5DetailTrade & {
  account_balance_at_entry: number | string | null;
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

function CumulativeChart({
  trades,
  currency,
  formatDate,
}: {
  trades: Trade[];
  currency: string | null;
  formatDate: (trade: Trade, kind: "entry" | "exit") => string;
}) {
  const points = useMemo(() => {
    const closed = trades
      .filter((trade) => trade.status !== "open")
      .sort(
        (left, right) =>
          new Date(left.exit_at_utc || left.entry_at_utc).getTime() -
          new Date(right.exit_at_utc || right.entry_at_utc).getTime(),
      );
    let cumulative = 0;
    return [
      {
        trade: "Start",
        date: "Starting point",
        result: 0,
        cumulative: 0,
      },
      ...closed.map((trade, index) => {
        cumulative += numberValue(trade.net_profit);
        return {
          trade: `Trade ${index + 1}`,
          date: formatDate(trade, "exit"),
          result: numberValue(trade.net_profit),
          cumulative,
        };
      }),
    ];
  }, [formatDate, trades]);

  const hasClosedTrades = points.length > 1;

  return (
    <div className="h-64 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      {!currency ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-amber-300">
          Select one account to chart P/L when saved accounts use different currencies.
        </div>
      ) : hasClosedTrades ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="automaticMt5CumulativeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="trade"
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              orientation="right"
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={72}
              tickFormatter={(value) =>
                new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency,
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(Number(value || 0))
              }
            />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
            <Tooltip
              labelFormatter={(_label, payload) =>
                payload?.[0]?.payload?.date || "Starting point"
              }
              formatter={(value: number, name: string, item: any) => [
                money(Number(value || 0), currency),
                name === "cumulative"
                  ? `Cumulative P/L · Result ${money(Number(item?.payload?.result || 0), currency)}`
                  : name,
              ]}
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid #334155",
                borderRadius: "12px",
                color: "#e2e8f0",
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#22d3ee"
              strokeWidth={3}
              fill="url(#automaticMt5CumulativeFill)"
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          The cumulative P/L chart will start after the first MT5 trade closes.
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState("");
  const [showTimezoneSettings, setShowTimezoneSettings] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [showDetailSettings, setShowDetailSettings] = useState(false);
  const [optionalHeaders, setOptionalHeaders] = useState<AutomaticMt5Header[]>(
    DEFAULT_AUTOMATIC_MT5_OPTIONAL_HEADERS,
  );
  const [sessionTimezone, setSessionTimezone] = useState("UTC");
  const [newCustomHeaderName, setNewCustomHeaderName] = useState("");
  const [savingDetailSettings, setSavingDetailSettings] = useState(false);
  const settingsInitialized = useRef(false);

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
    if (!settingsInitialized.current) {
      if (result.settings) {
        setOptionalHeaders(
          Array.isArray(result.settings.optional_headers)
            ? result.settings.optional_headers
            : DEFAULT_AUTOMATIC_MT5_OPTIONAL_HEADERS,
        );
        setSessionTimezone(result.settings.session_timezone || "UTC");
      } else {
        setOptionalHeaders(DEFAULT_AUTOMATIC_MT5_OPTIONAL_HEADERS);
      }
      settingsInitialized.current = true;
    }
    setLastUpdatedAt(new Date());
    setMessage("");
    setLoading(false);
  }, [selectedAccountId]);

  const refreshTrades = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTrades();
    } catch (error: any) {
      setMessage(error?.message || "Could not refresh automatic MT5 trades.");
    } finally {
      setRefreshing(false);
    }
  }, [loadTrades]);

  const optionalHeaderIds = useMemo(
    () => new Set(optionalHeaders.map((header) => header.id)),
    [optionalHeaders],
  );

  const toggleOptionalHeader = useCallback((header: AutomaticMt5Header) => {
    setOptionalHeaders((current) =>
      current.some((item) => item.id === header.id)
        ? current.filter((item) => item.id !== header.id)
        : [...current, header],
    );
  }, []);

  const addCustomManualHeader = useCallback(() => {
    const name = newCustomHeaderName.trim();
    if (!name) {
      setMessage("Type a custom header name first.");
      return;
    }
    if (optionalHeaders.some((header) => header.name.toLowerCase() === name.toLowerCase())) {
      setMessage("That optional header already exists.");
      return;
    }
    setOptionalHeaders((current) => [
      ...current,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name,
        group: "manual",
        type: "text",
      },
    ]);
    setNewCustomHeaderName("");
    setMessage(`Added “${name}” to the shared Trade Details layout. Save the layout to keep it.`);
  }, [newCustomHeaderName, optionalHeaders]);

  const saveDetailSettings = useCallback(async () => {
    setSavingDetailSettings(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Log in to save Trade Details settings.");
      const response = await fetch("/api/mt5/trades/custom-fields", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ optionalHeaders, sessionTimezone }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Could not save Trade Details settings.");
      }
      setOptionalHeaders(result.optionalHeaders ?? optionalHeaders);
      setSessionTimezone(result.sessionTimezone || sessionTimezone);
      setMessage("Shared Trade Details layout saved for every MT5 account.");
      setShowDetailSettings(false);
    } catch (error: any) {
      setMessage(error?.message || "Could not save Trade Details settings.");
    } finally {
      setSavingDetailSettings(false);
    }
  }, [optionalHeaders, sessionTimezone]);

  const saveTradeFields = useCallback(
    async (tradeId: string, customFields: Record<string, any>) => {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return false;
        const response = await fetch("/api/mt5/trades/custom-fields", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tradeId, customFields }),
        });
        const result = await response.json();
        if (!response.ok || !result?.success) return false;
        setTrades((current) =>
          current.map((trade) =>
            trade.id === tradeId
              ? { ...trade, custom_fields: result.customFields }
              : trade,
          ),
        );
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

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

  const customRangeInvalid =
    dateRange === "custom" &&
    Boolean(customFrom && customTo && customFrom > customTo);

  const resetFilters = useCallback(() => {
    setSelectedAccountId("all");
    setDateRange("all");
    setCustomFrom("");
    setCustomTo("");
  }, []);

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

  const selectedTrade = trades.find((trade) => trade.id === selectedTradeId);
  if (selectedTrade) {
    const serialIndex = filteredTrades.findIndex((trade) => trade.id === selectedTrade.id);
    return (
      <AutomaticMT5TradeDetails
        trade={selectedTrade}
        serialNumber={serialIndex >= 0 ? serialIndex + 1 : 1}
        account={accountMap.get(selectedTrade.account_id)}
        optionalHeaders={optionalHeaders}
        sessionTimezone={sessionTimezone}
        formatTradeDate={(trade, kind) => formatTradeDate(trade as Trade, kind)}
        onBack={() => setSelectedTradeId("")}
        onSaveFields={saveTradeFields}
      />
    );
  }

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              aria-label="Filter by MT5 account"
            >
              <option value="all">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name || account.company || "MT5"} · {account.login}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void refreshTrades()}
              disabled={refreshing}
              className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-200 disabled:cursor-wait disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
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
          {selectedAccountId !== "all" || dateRange !== "all" ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold uppercase text-slate-300"
            >
              Reset filters
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowDetailSettings((current) => !current)}
            className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200"
          >
            Configure Trade Details
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              From
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              To
              <input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </label>
            {customRangeInvalid ? (
              <p className="text-xs font-semibold text-red-300">The From date must be before the To date.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p>Showing {customRangeInvalid ? 0 : filteredTrades.length} of {trades.length} trades</p>
          <p>
            {lastUpdatedAt
              ? `Updated ${lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Waiting for the first update"}
          </p>
        </div>

        {showDetailSettings ? (
          <div className="mt-4 rounded-xl border border-cyan-400/20 bg-slate-950/90 p-5">
            <div>
              <h2 className="text-base font-black text-white">Shared Trade Details Layout</h2>
              <p className="mt-1 text-xs text-slate-400">
                The same optional fields will appear for trades from every MT5 account. The 13 required table headers remain locked.
              </p>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Manual Builder Headers</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {AUTOMATIC_MT5_MANUAL_HEADERS.map((header) => (
                    <label key={header.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-200">
                      <input type="checkbox" checked={optionalHeaderIds.has(header.id)} onChange={() => toggleOptionalHeader(header)} className="h-4 w-4 accent-cyan-400" />
                      {header.name}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">Automatic Builder Headers</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {AUTOMATIC_MT5_CALCULATED_HEADERS.map((header) => (
                    <label key={header.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-200">
                      <input type="checkbox" checked={optionalHeaderIds.has(header.id)} onChange={() => toggleOptionalHeader(header)} className="h-4 w-4 accent-emerald-400" />
                      {header.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Additional Manual Header</p>
                <div className="mt-3 flex gap-2">
                  <input value={newCustomHeaderName} maxLength={60} onChange={(event) => setNewCustomHeaderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustomManualHeader(); }} placeholder="Type a header name" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                  <button type="button" onClick={addCustomManualHeader} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-200">Add</button>
                </div>
                {optionalHeaders.some((header) => header.id.startsWith("custom-")) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {optionalHeaders.filter((header) => header.id.startsWith("custom-")).map((header) => (
                      <button key={header.id} type="button" onClick={() => toggleOptionalHeader(header)} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-200">
                        {header.name} ×
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Session Formula Timezone</span>
                <select value={sessionTimezone} onChange={(event) => setSessionTimezone(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                  {availableTimezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveDetailSettings()} disabled={savingDetailSettings} className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-black text-black disabled:opacity-50">
                {savingDetailSettings ? "Saving..." : "Save Shared Layout"}
              </button>
              <button type="button" onClick={() => setShowDetailSettings(false)} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-300">Close</button>
            </div>
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
          <CumulativeChart
            trades={customRangeInvalid ? [] : filteredTrades}
            currency={aggregateCurrency}
            formatDate={formatTradeDate}
          />
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
        {!loading && customRangeInvalid ? <p className="p-5 text-sm text-red-300">Correct the custom date range to display trades.</p> : null}
        {!loading && !customRangeInvalid && !filteredTrades.length ? <p className="p-5 text-sm text-slate-400">No MT5 trades match this account and date range.</p> : null}
        {!customRangeInvalid && filteredTrades.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {selectedAccountId === "all" ? <th className="px-4 py-3">Account</th> : null}
                  <th className="px-4 py-3">S/N</th><th className="px-4 py-3">Ent Date</th><th className="px-4 py-3">Ext Date</th><th className="px-4 py-3">Symbol</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Direction</th><th className="px-4 py-3">Lot</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">Stop Loss</th><th className="px-4 py-3">Take Profit</th><th className="px-4 py-3">Exit</th><th className="px-4 py-3">P/L($)</th><th className="px-4 py-3">P/L(%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/50 text-slate-200">
                {filteredTrades.map((trade, index) => {
                  const account = accountMap.get(trade.account_id);
                  const net = numberValue(trade.net_profit);
                  return (
                    <tr
                      key={trade.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedTradeId(trade.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTradeId(trade.id);
                        }
                      }}
                      className="cursor-pointer transition hover:bg-cyan-400/5 focus:bg-cyan-400/10 focus:outline-none"
                      title="Open Trade Details"
                    >
                      {selectedAccountId === "all" ? <td className="px-4 py-3 text-xs">{account?.login || "—"}</td> : null}
                      <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTradeDate(trade, "entry")}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTradeDate(trade, "exit")}</td>
                      <td className="px-4 py-3 font-bold text-white">{trade.symbol}</td>
                      <td className="px-4 py-3 capitalize">{trade.status}</td>
                      <td className={`px-4 py-3 font-bold capitalize ${trade.direction === "buy" ? "text-emerald-400" : "text-red-400"}`}>{trade.direction}</td>
                      <td className="px-4 py-3">{numberValue(trade.total_entry_lots).toFixed(2)}</td>
                      <td className="px-4 py-3">{price(trade.weighted_entry_price)}</td>
                      <td className="px-4 py-3">{price(trade.stop_loss)}</td>
                      <td className="px-4 py-3">{price(trade.take_profit)}</td>
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
