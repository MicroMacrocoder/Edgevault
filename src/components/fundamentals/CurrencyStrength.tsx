"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { COTReport } from "@/types/cot";

const CURRENCIES = [
  { symbol: "EUR", label: "Euro", color: "#22d3ee" },
  { symbol: "GBP", label: "British Pound", color: "#a78bfa" },
  { symbol: "JPY", label: "Japanese Yen", color: "#facc15" },
  { symbol: "CAD", label: "Canadian Dollar", color: "#f97316" },
  { symbol: "CHF", label: "Swiss Franc", color: "#ec4899" },
  { symbol: "AUD", label: "Australian Dollar", color: "#34d399" },
  { symbol: "DXY", label: "US Dollar Index", color: "#60a5fa" },
];

type StrengthData = {
  symbol: string;
  label: string;
  color: string;
  netPosition: number;
  previousNet: number;
  change: number;
  changePercent: number;
  strength: number; // normalized 0-100
  trend: "bullish" | "bearish" | "neutral";
};

type HistoricalPoint = {
  date: string;
  [key: string]: number | string;
};

function normalizeStrength(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) return 50;
  return Math.round(((value - min) / (max - min)) * 100);
}

export default function CurrencyStrength() {
  const [allReports, setAllReports] = useState<Record<string, COTReport[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"meter" | "chart">("meter");
  const [positionGroup, setPositionGroup] = useState<
    "noncommercial" | "commercial"
  >("noncommercial");

  useEffect(() => {
    let isMounted = true;

    async function loadAllCOT() {
      setLoading(true);
      setError("");

      try {
        const results: Record<string, COTReport[]> = {};

        await Promise.all(
          CURRENCIES.map(async (currency) => {
            try {
              const response = await fetch(
                "/api/cot?symbol=" + currency.symbol,
                { cache: "no-store" }
              );
              const data = await response.json();
              if (data.reports && Array.isArray(data.reports)) {
                results[currency.symbol] = data.reports.sort(
                  (a: COTReport, b: COTReport) =>
                    a.report_date.localeCompare(b.report_date)
                );
              } else {
                results[currency.symbol] = [];
              }
            } catch {
              results[currency.symbol] = [];
            }
          })
        );

        if (isMounted) {
          setAllReports(results);
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load currency strength data.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAllCOT();
    return () => {
      isMounted = false;
    };
  }, []);

  const strengthData = useMemo<StrengthData[]>(() => {
    const items: StrengthData[] = [];

    for (const currency of CURRENCIES) {
      const reports = allReports[currency.symbol] || [];
      if (reports.length < 2) {
        items.push({
          symbol: currency.symbol,
          label: currency.label,
          color: currency.color,
          netPosition: 0,
          previousNet: 0,
          change: 0,
          changePercent: 0,
          strength: 50,
          trend: "neutral",
        });
        continue;
      }

      const latest = reports[reports.length - 1];
      const previous = reports[reports.length - 2];

      const netPosition =
        positionGroup === "commercial"
          ? latest.commercial_net
          : latest.noncommercial_net;
      const previousNet =
        positionGroup === "commercial"
          ? previous.commercial_net
          : previous.noncommercial_net;

      const change = netPosition - previousNet;
      const changePercent =
        previousNet === 0 ? 0 : (change / Math.abs(previousNet)) * 100;

      items.push({
        symbol: currency.symbol,
        label: currency.label,
        color: currency.color,
        netPosition,
        previousNet,
        change,
        changePercent,
        strength: 50, // will be normalized below
        trend: change > 0 ? "bullish" : change < 0 ? "bearish" : "neutral",
      });
    }

    // Normalize strength across all currencies
    const nets = items.map((i) => i.netPosition);
    const minNet = Math.min(...nets);
    const maxNet = Math.max(...nets);

    for (const item of items) {
      item.strength = normalizeStrength(item.netPosition, minNet, maxNet);
    }

    // Sort by strength descending
    items.sort((a, b) => b.strength - a.strength);

    return items;
  }, [allReports, positionGroup]);

  const historicalData = useMemo<HistoricalPoint[]>(() => {
    // Get last 12 reports for each currency and create time series
    const allDates = new Set<string>();
    const reportsByDate: Record<string, Record<string, number>> = {};

    for (const currency of CURRENCIES) {
      const reports = (allReports[currency.symbol] || []).slice(-12);
      for (const report of reports) {
        allDates.add(report.report_date);
        if (!reportsByDate[report.report_date]) {
          reportsByDate[report.report_date] = {};
        }
        reportsByDate[report.report_date][currency.symbol] =
          positionGroup === "commercial"
            ? report.commercial_net
            : report.noncommercial_net;
      }
    }

    const sortedDates = Array.from(allDates).sort();

    return sortedDates.map((date) => {
      const point: HistoricalPoint = {
        date: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
      for (const currency of CURRENCIES) {
        point[currency.symbol] = reportsByDate[date]?.[currency.symbol] ?? 0;
      }
      return point;
    });
  }, [allReports, positionGroup]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <span className="ml-3 font-mono text-sm text-gray-400">
          Loading currency strength...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-8 font-mono text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
              Futures-Based Analysis
            </p>
            <h2 className="font-mono text-3xl font-bold text-white">
              Currency <span className="text-cyan-400">Strength</span>
            </h2>
            <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-gray-400">
              Relative strength derived from COT net positioning across major
              currency futures. Shows which currencies have the strongest
              speculator/commercial conviction.
            </p>
          </div>

          <div className="flex gap-3">
            <select
              value={positionGroup}
              onChange={(e) =>
                setPositionGroup(
                  e.target.value as "noncommercial" | "commercial"
                )
              }
              className="rounded-xl border border-gray-800 bg-black px-4 py-2 font-mono text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="noncommercial">Non-Commercials (Specs)</option>
              <option value="commercial">Commercials (Hedgers)</option>
            </select>

            <div className="flex rounded-xl border border-gray-800 overflow-hidden">
              <button
                onClick={() => setViewMode("meter")}
                className={`px-4 py-2 font-mono text-xs uppercase ${
                  viewMode === "meter"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-black text-gray-500 hover:text-gray-300"
                }`}
              >
                Meter
              </button>
              <button
                onClick={() => setViewMode("chart")}
                className={`px-4 py-2 font-mono text-xs uppercase ${
                  viewMode === "chart"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-black text-gray-500 hover:text-gray-300"
                }`}
              >
                Chart
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === "meter" ? (
        <>
          {/* Strength Meter Bars */}
          <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
            <h3 className="mb-6 font-mono text-lg font-bold text-white">
              Relative Strength Index
            </h3>

            <div className="space-y-4">
              {strengthData.map((item) => (
                <div key={item.symbol} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-mono text-sm font-bold text-white">
                        {item.symbol}
                      </span>
                      <span className="font-mono text-xs text-gray-500">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`font-mono text-xs font-bold ${
                          item.trend === "bullish"
                            ? "text-emerald-400"
                            : item.trend === "bearish"
                            ? "text-red-400"
                            : "text-gray-400"
                        }`}
                      >
                        {item.change > 0 ? "+" : ""}
                        {new Intl.NumberFormat("en-US").format(item.change)}
                      </span>
                      <span className="font-mono text-sm font-bold text-white">
                        {item.strength}
                      </span>
                    </div>
                  </div>

                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-900">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${item.strength}%`,
                        backgroundColor: item.color,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bar Chart Comparison */}
          <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
            <h3 className="mb-6 font-mono text-lg font-bold text-white">
              Net Position Comparison
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strengthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="symbol"
                    stroke="#9ca3af"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("en-US", {
                        notation: "compact",
                      }).format(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#050505",
                      border: "1px solid #374151",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    formatter={(value: number) =>
                      new Intl.NumberFormat("en-US").format(value)
                    }
                  />
                  <Bar dataKey="netPosition" name="Net Position" radius={[6, 6, 0, 0]}>
                    {strengthData.map((entry) => (
                      <Cell key={entry.symbol} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        /* Historical Line Chart */
        <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
          <h3 className="mb-6 font-mono text-lg font-bold text-white">
            Historical Net Positioning (Last 12 Reports)
          </h3>
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("en-US", {
                      notation: "compact",
                    }).format(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#050505",
                    border: "1px solid #374151",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                  formatter={(value: number) =>
                    new Intl.NumberFormat("en-US").format(value)
                  }
                />
                <Legend />
                {CURRENCIES.map((currency) => (
                  <Line
                    key={currency.symbol}
                    type="monotone"
                    dataKey={currency.symbol}
                    name={currency.symbol}
                    stroke={currency.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary Table */}
      <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
        <h3 className="mb-6 font-mono text-lg font-bold text-white">
          Strength Summary
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-left font-mono text-xs uppercase tracking-widest text-gray-500">
                <th className="py-3 pr-4">Rank</th>
                <th className="py-3 pr-4">Currency</th>
                <th className="py-3 pr-4">Net Position</th>
                <th className="py-3 pr-4">Change</th>
                <th className="py-3 pr-4">% Change</th>
                <th className="py-3 pr-4">Strength</th>
                <th className="py-3 pr-4">Bias</th>
              </tr>
            </thead>
            <tbody>
              {strengthData.map((item, index) => (
                <tr
                  key={item.symbol}
                  className="border-b border-gray-900 font-mono text-sm text-gray-300"
                >
                  <td className="py-4 pr-4 text-gray-500">#{index + 1}</td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-bold text-white">
                        {item.symbol}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    {new Intl.NumberFormat("en-US").format(item.netPosition)}
                  </td>
                  <td
                    className={`py-4 pr-4 ${
                      item.change > 0
                        ? "text-emerald-400"
                        : item.change < 0
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {item.change > 0 ? "+" : ""}
                    {new Intl.NumberFormat("en-US").format(item.change)}
                  </td>
                  <td
                    className={`py-4 pr-4 ${
                      item.changePercent > 0
                        ? "text-emerald-400"
                        : item.changePercent < 0
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {item.changePercent > 0 ? "+" : ""}
                    {item.changePercent.toFixed(2)}%
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-900">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.strength}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <span className="text-white">{item.strength}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                        item.trend === "bullish"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : item.trend === "bearish"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {item.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
