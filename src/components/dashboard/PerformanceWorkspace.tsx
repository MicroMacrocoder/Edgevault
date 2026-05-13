"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  CalendarDays,
  DollarSign,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { supabase, getUserTradeLogsWithRows } from "@/lib/supabase";
import {
  calculatePerformanceMetrics,
  formatMoney,
  formatNumber,
  formatPercent,
  type PerformanceChartMode,
  type PerformanceDateRange,
  type TradeLogWithRows,
} from "@/lib/performanceMetrics";

const DATE_RANGES: PerformanceDateRange[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "ALL",
];

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-cyan-400/10 bg-[#111827]/70 shadow-[0_0_40px_rgba(34,211,238,0.06)] " +
        className
      }
    >
      {children}
    </div>
  );
}

function MiniMetricCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
          {icon}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className="mt-1 text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
    </Panel>
  );
}

function getGuestTradeLogsWithRows(): TradeLogWithRows[] {
  if (typeof window === "undefined") {
    return [];
  }

  const guestLogs = JSON.parse(localStorage.getItem("guestTradeLogs") || "[]");

  return (guestLogs || []).map((log: any) => {
    const rows = JSON.parse(localStorage.getItem(`rows-${log.id}`) || "[]");

    return {
      id: String(log.id),
      logName: log.logName || "Untitled Trade Log",
      headers: Array.isArray(log.headers) ? log.headers : [],
      initialBalance: Number(log.initialBalance || 0),
      accountCurrency: log.accountCurrency || "USD",
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
      rows: rows || [],
    };
  });
}

export default function PerformanceWorkspace() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tradeLogs, setTradeLogs] = useState<TradeLogWithRows[]>([]);
  const [selectedTradeLogId, setSelectedTradeLogId] = useState("all");
  const [dateRange, setDateRange] = useState<PerformanceDateRange>("ALL");
  const [chartMode, setChartMode] = useState<PerformanceChartMode>("balance");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPerformanceData() {
    setIsLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      setCurrentUser(user);

      if (user) {
        const { error, tradeLogs: loadedTradeLogs } = await getUserTradeLogsWithRows(
          user.id
        );

        if (error) {
          setTradeLogs([]);
          setMessage("Could not load performance data from your trade logs.");
          setIsLoading(false);
          return;
        }

        setTradeLogs(loadedTradeLogs || []);
        setIsLoading(false);
        return;
      }

      setTradeLogs(getGuestTradeLogsWithRows());
      setIsLoading(false);
    } catch (error) {
      console.log("LOAD PERFORMANCE DATA ERROR:", error);
      setTradeLogs([]);
      setMessage("Something went wrong while loading performance data.");
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!mounted) return;
      await loadPerformanceData();
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (mounted) {
        loadPerformanceData();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const metrics = useMemo(
    () =>
      calculatePerformanceMetrics({
        tradeLogs,
        selectedTradeLogId,
        dateRange,
      }),
    [tradeLogs, selectedTradeLogId, dateRange]
  );

  const chartData = useMemo(() => {
    const basePoint = {
      label: "Start",
      date: "",
      tradeNumber: 0,
      profitLoss: 0,
      cumulativeProfit: 0,
      balance: metrics.initialBalance,
      returnPercent: 0,
    };

    return [basePoint, ...metrics.equityCurve];
  }, [metrics.equityCurve, metrics.initialBalance]);

  const chartDataKey = chartMode === "balance" ? "balance" : "returnPercent";
  const mainChartValue =
    chartMode === "balance"
      ? formatMoney(metrics.currentBalance, metrics.accountCurrency)
      : formatPercent(metrics.totalReturnPercent);
  const mainChartLabel = chartMode === "balance" ? "Current Balance" : "Total Return";

  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-yellow-400">
              EdgeVault Performance
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
              Performance Overview
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Select one trade log or view your general overview. Metrics are
              calculated from saved and synced trade log rows.
            </p>

            <p className="mt-3 text-sm font-medium text-slate-300">
              {currentUser
                ? `Logged in as ${currentUser.email}`
                : "Guest mode — using local trade logs"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:min-w-[620px]">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Performance Source
              </label>

              <select
                value={selectedTradeLogId}
                onChange={(event) => setSelectedTradeLogId(event.target.value)}
                className="w-full rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-400"
              >
                <option value="all">General Overview</option>
                {tradeLogs.map((log) => (
                  <option key={log.id} value={log.id}>
                    {log.logName || "Untitled Trade Log"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Chart Mode
              </label>

              <button
                type="button"
                onClick={() =>
                  setChartMode((previousMode) =>
                    previousMode === "balance" ? "percentage" : "balance"
                  )
                }
                className="flex w-full items-center justify-between rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm font-semibold text-white transition hover:border-yellow-400/50"
              >
                <span>{chartMode === "balance" ? "Balance" : "Percentage"}</span>
                <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
                  {chartMode === "balance" ? "$" : "%"}
                </span>
              </button>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Refresh
              </label>

              <button
                type="button"
                onClick={loadPerformanceData}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/10 bg-[#0F0F1F] px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400/50"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Data
              </button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {mainChartLabel}
            </p>
            <p className="mt-2 text-5xl font-black tracking-tight text-white">
              {mainChartValue}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Net P/L: {formatMoney(metrics.netProfit, metrics.accountCurrency)}
              <span className="mx-2">•</span>
              Source: {metrics.selectedTradeLogName}
            </p>
          </div>

          <div className="flex flex-wrap overflow-hidden rounded-xl border border-cyan-400/10 text-xs font-semibold text-slate-400">
            {DATE_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={
                  dateRange === range
                    ? "bg-yellow-400 px-4 py-2 text-black"
                    : "border-r border-cyan-400/10 px-4 py-2 transition hover:bg-[#0F0F1F] hover:text-white"
                }
              >
                {range}
              </button>
            ))}

            <button
              type="button"
              className="px-3 py-2 text-slate-400 hover:bg-[#0F0F1F] hover:text-white"
              title="Date ranges use your trade entry/exit time"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#facc15" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#0f172a" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                orientation="right"
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) =>
                  chartMode === "balance"
                    ? `${metrics.accountCurrency} ${Number(value || 0).toFixed(0)}`
                    : `${Number(value || 0).toFixed(0)}%`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F0F1F",
                  border: "1px solid rgba(250,204,21,0.22)",
                  borderRadius: "12px",
                  color: "#e2e8f0",
                }}
                formatter={(value: any) =>
                  chartMode === "balance"
                    ? formatMoney(Number(value || 0), metrics.accountCurrency)
                    : formatPercent(Number(value || 0))
                }
              />
              <Area
                type="monotone"
                dataKey={chartDataKey}
                stroke="#facc15"
                strokeWidth={3}
                fill="url(#performanceFill)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <MiniMetricCard
          icon={<BarChart3 className="h-7 w-7" />}
          title="Total Trades"
          value={String(metrics.totalTrades)}
          subtitle="Total executed trades"
        />

        <MiniMetricCard
          icon={<PieChartIcon className="h-7 w-7" />}
          title="Win Rate"
          value={formatPercent(metrics.winRate)}
          subtitle={`${metrics.winningTrades} wins / ${metrics.losingTrades} losses`}
        />

        <MiniMetricCard
          icon={<DollarSign className="h-7 w-7" />}
          title="Net Profit"
          value={formatMoney(metrics.netProfit, metrics.accountCurrency)}
          subtitle="Closed trade result"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.8fr_1fr]">
        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-white">
            Equity Curve
          </h2>

          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="#0f172a" />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F0F1F",
                    border: "1px solid rgba(34,211,238,0.15)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                  formatter={(value: any) =>
                    formatMoney(Number(value || 0), metrics.accountCurrency)
                  }
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill="#22d3ee"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-white">
            Trade Performance
          </h2>

          <div className="relative flex h-[260px] items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.winLossData}
                  dataKey="value"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {metrics.winLossData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.name === "Win"
                          ? "#22d3ee"
                          : entry.name === "Loss"
                            ? "#ef4444"
                            : "#64748b"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F0F1F",
                    border: "1px solid rgba(34,211,238,0.15)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute text-center">
              <p className="text-3xl font-black text-white">{metrics.totalTrades}</p>
              <p className="text-xs text-slate-400">Trades</p>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white">
              Recent Trades
            </h2>
            <span className="text-xs font-semibold text-cyan-300">Latest 8</span>
          </div>

          {metrics.recentTrades.length === 0 ? (
            <p className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-4 text-sm text-slate-400">
              No recent trades found for this source and date range.
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.recentTrades.map((trade) => (
                <div
                  key={`${trade.tradeLogId}-${trade.id}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {trade.symbol || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {trade.direction || "No direction"} • {trade.tradeLogName}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={
                        trade.profitLoss >= 0
                          ? "text-sm font-semibold text-emerald-400"
                          : "text-sm font-semibold text-red-400"
                      }
                    >
                      {formatMoney(trade.profitLoss, metrics.accountCurrency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {trade.tradeDate
                        ? trade.tradeDate.toLocaleDateString()
                        : "No date"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ["Initial Balance", formatMoney(metrics.initialBalance, metrics.accountCurrency), "text-white"],
          ["Current Balance", formatMoney(metrics.currentBalance, metrics.accountCurrency), "text-white"],
          ["Total Return", formatPercent(metrics.totalReturnPercent), metrics.totalReturnPercent >= 0 ? "text-emerald-400" : "text-red-400"],
          ["Best Trade", metrics.bestTrade ? formatMoney(metrics.bestTrade.profitLoss, metrics.accountCurrency) : formatMoney(0, metrics.accountCurrency), "text-emerald-400"],
          ["Worst Trade", metrics.worstTrade ? formatMoney(metrics.worstTrade.profitLoss, metrics.accountCurrency) : formatMoney(0, metrics.accountCurrency), "text-red-400"],
          ["Profit Factor", formatNumber(metrics.profitFactor, 2), "text-white"],
          ["Total Volume", formatNumber(metrics.totalVolume, 2), "text-white"],
        ].map(([label, value, color]) => (
          <div key={label} className="border-cyan-400/10 lg:border-r lg:last:border-r-0">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className={`mt-2 text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white">
            <Activity className="h-4 w-4 text-cyan-300" /> Pair Performance
          </h2>

          {metrics.pairPerformance.length === 0 ? (
            <p className="text-sm text-slate-400">No pair performance yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.pairPerformance.slice(0, 8).map((item) => (
                <div
                  key={item.name}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.trades} trades • {formatPercent(item.winRate)} win rate
                    </p>
                  </div>
                  <p className="text-slate-400">{item.wins}W / {item.losses}L</p>
                  <p className={item.netProfit >= 0 ? "font-bold text-emerald-400" : "font-bold text-red-400"}>
                    {formatMoney(item.netProfit, metrics.accountCurrency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white">
            <TrendingUp className="h-4 w-4 text-yellow-400" /> Monthly Performance
          </h2>

          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.monthlyPerformance.slice(0, 12)}>
                <CartesianGrid stroke="#0f172a" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F0F1F",
                    border: "1px solid rgba(250,204,21,0.22)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                  formatter={(value: any) =>
                    formatMoney(Number(value || 0), metrics.accountCurrency)
                  }
                />
                <Bar dataKey="netProfit" fill="#facc15" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {isLoading && (
        <Panel className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">
            Loading performance data...
          </p>
        </Panel>
      )}

      {!isLoading && message && (
        <Panel className="p-6">
          <p className="text-sm font-semibold text-red-400">{message}</p>
        </Panel>
      )}

      {!isLoading && tradeLogs.length === 0 && (
        <Panel className="p-6 text-center">
          <p className="text-lg font-bold text-white">No Trade Logs Found</p>
          <p className="mt-2 text-sm text-slate-400">
            Create a trade log and add/import trade rows before Performance can
            calculate your stats.
          </p>
        </Panel>
      )}
    </div>
  );
}
