"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VolumeOIReport } from "@/types/volumeOi";

type VolumeOIChartRow = VolumeOIReport & {
  volume_change: number;
  volume_change_percent: number;
  open_interest_change: number;
  open_interest_change_percent: number;
  volume_ma: number | null;
  open_interest_ma: number | null;
  volume_direction: "up" | "down" | "flat";
};

type VolumeOIApiResponse = {
  error: boolean;
  message: string;
  reports: VolumeOIReport[];
};

const SYMBOL_OPTIONS = [
  { label: "Euro FX", value: "EUR" },
  { label: "British Pound", value: "GBP" },
  { label: "Japanese Yen", value: "JPY" },
  { label: "Canadian Dollar", value: "CAD" },
  { label: "Swiss Franc", value: "CHF" },
  { label: "Australian Dollar", value: "AUD" },
  { label: "US Dollar Index", value: "DXY" },
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return new Intl.NumberFormat("en-US").format(Number(value));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";
  return sign + value.toFixed(2) + "%";
}

function formatSignedNumber(value: number) {
  if (value > 0) {
    return "+" + formatNumber(value);
  }

  return formatNumber(value);
}

function getChangeClass(value: number) {
  if (value > 0) {
    return "text-emerald-400";
  }

  if (value < 0) {
    return "text-red-400";
  }

  return "text-slate-400";
}

function formatDate(value: string) {
  const date = new Date(value + "T00:00:00");

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(date);
}

function getMetricName(name: string) {
  if (name === "volume") return "Volume";
  if (name === "open_interest") return "Open Interest";
  if (name === "volume_ma") return "Volume MA";
  if (name === "open_interest_ma") return "OI MA";

  return name;
}

function calculateMovingAverage(
  rows: VolumeOIReport[],
  index: number,
  key: "volume" | "open_interest",
  period: number
) {
  const startIndex = Math.max(0, index - period + 1);
  const windowRows = rows.slice(startIndex, index + 1);

  if (!windowRows.length) {
    return null;
  }

  const total = windowRows.reduce((sum, row) => {
    return sum + Number(row[key] || 0);
  }, 0);

  return Math.round(total / windowRows.length);
}

function enrichReports(
  reports: VolumeOIReport[],
  movingAveragePeriod: number
): VolumeOIChartRow[] {
  const sortedReports = [...reports].sort((a, b) => {
    return a.trade_date.localeCompare(b.trade_date);
  });

  return sortedReports.map((report, index) => {
    const previousReport = sortedReports[index - 1];

    const volume = Number(report.volume || 0);
    const openInterest = Number(report.open_interest || 0);

    const previousVolume = previousReport ? Number(previousReport.volume || 0) : 0;
    const previousOpenInterest = previousReport
      ? Number(previousReport.open_interest || 0)
      : 0;

    const volumeChange = previousReport ? volume - previousVolume : 0;
    const openInterestChange = previousReport
      ? openInterest - previousOpenInterest
      : 0;

    const volumeChangePercent =
      previousReport && previousVolume !== 0
        ? (volumeChange / previousVolume) * 100
        : 0;

    const openInterestChangePercent =
      previousReport && previousOpenInterest !== 0
        ? (openInterestChange / previousOpenInterest) * 100
        : 0;

    let volumeDirection: "up" | "down" | "flat" = "flat";

    if (previousReport && volumeChange > 0) {
      volumeDirection = "up";
    }

    if (previousReport && volumeChange < 0) {
      volumeDirection = "down";
    }

    return {
      ...report,
      volume,
      open_interest: openInterest,
      volume_change: volumeChange,
      volume_change_percent: volumeChangePercent,
      open_interest_change: openInterestChange,
      open_interest_change_percent: openInterestChangePercent,
      volume_ma: calculateMovingAverage(
        sortedReports,
        index,
        "volume",
        movingAveragePeriod
      ),
      open_interest_ma: calculateMovingAverage(
        sortedReports,
        index,
        "open_interest",
        movingAveragePeriod
      ),
      volume_direction: volumeDirection,
    };
  });
}

export default function VolumeOITracker() {
  const [selectedSymbol, setSelectedSymbol] = useState("EUR");
  const [reports, setReports] = useState<VolumeOIReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showVolume, setShowVolume] = useState(true);
  const [showOpenInterest, setShowOpenInterest] = useState(true);
  const [showMovingAverage, setShowMovingAverage] = useState(true);
  const [movingAveragePeriod, setMovingAveragePeriod] = useState(10);

  async function fetchReports(symbol: string) {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/volume-oi?symbol=" + symbol, {
        cache: "no-store",
      });

      const result = (await response.json()) as VolumeOIApiResponse;

      if (!response.ok || result.error) {
        throw new Error(result.message || "Failed to fetch Volume/OI reports.");
      }

      setReports(result.reports || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to fetch Volume/OI reports."
      );
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchReports(selectedSymbol);
  }, [selectedSymbol]);

  const processedReports = useMemo(() => {
    return enrichReports(reports, movingAveragePeriod);
  }, [reports, movingAveragePeriod]);

  const latestReport = processedReports[processedReports.length - 1] || null;
  const tableReports = processedReports.slice(-30).reverse();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
                EdgeVault Fundamentals
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Volume & Open Interest
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Daily CME FX futures volume and open interest. Green volume bars
                mean volume increased versus the previous trading day. Red bars
                mean volume decreased versus the previous trading day.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchReports(selectedSymbol)}
              className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
            >
              Refresh Data
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Market
            </label>
            <select
              value={selectedSymbol}
              onChange={(event) => setSelectedSymbol(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400/40 focus:ring-2"
            >
              {SYMBOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label + " (" + option.value + ")"}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Moving Average
            </label>
            <input
              type="number"
              min={2}
              max={50}
              value={movingAveragePeriod}
              onChange={(event) =>
                setMovingAveragePeriod(Number(event.target.value || 10))
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400/40 focus:ring-2"
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Chart Toggles
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowVolume((current) => !current)}
                className={
                  showVolume
                    ? "rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300"
                    : "rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400"
                }
              >
                Volume
              </button>

              <button
                type="button"
                onClick={() => setShowOpenInterest((current) => !current)}
                className={
                  showOpenInterest
                    ? "rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300"
                    : "rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400"
                }
              >
                Open Interest
              </button>

              <button
                type="button"
                onClick={() => setShowMovingAverage((current) => !current)}
                className={
                  showMovingAverage
                    ? "rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300"
                    : "rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400"
                }
              >
                MA
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Latest
            </p>
            {latestReport ? (
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-slate-300">
                  Date:{" "}
                  <span className="font-semibold text-white">
                    {latestReport.trade_date}
                  </span>
                </p>
                <p className="text-slate-300">
                  Volume:{" "}
                  <span className="font-semibold text-white">
                    {formatNumber(latestReport.volume)}
                  </span>
                </p>
                <p className="text-slate-300">
                  OI:{" "}
                  <span className="font-semibold text-white">
                    {formatNumber(latestReport.open_interest)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No report loaded.</p>
            )}
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">
                Combined Volume / Open Interest Chart
              </h2>
              <p className="text-sm text-slate-400">
                Volume bars use day-over-day volume direction. Open interest is
                plotted as a line on the right axis.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm bg-emerald-400" />
                Volume up
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm bg-red-400" />
                Volume down
              </span>
            </div>
          </div>

          <div className="h-[420px] w-full">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading Volume/OI reports...
              </div>
            ) : processedReports.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={processedReports}
                  margin={{ top: 20, right: 24, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="trade_date"
                    tickFormatter={formatDate}
                    stroke="#94a3b8"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatNumber(Number(value))}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#94a3b8"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatNumber(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                    labelStyle={{ color: "#67e8f9" }}
                    formatter={(value, name) => [
                      formatNumber(Number(value)),
                      getMetricName(String(name)),
                    ]}
                  />
                  <Legend />

                  {showVolume ? (
                    <Bar
                      yAxisId="left"
                      dataKey="volume"
                      name="Volume"
                      radius={[4, 4, 0, 0]}
                    >
                      {processedReports.map((row) => (
                        <Cell
                          key={"volume-cell-" + row.trade_date}
                          fill={
                            row.volume_direction === "up"
                              ? "#34d399"
                              : row.volume_direction === "down"
                                ? "#f87171"
                                : "#64748b"
                          }
                        />
                      ))}
                    </Bar>
                  ) : null}

                  {showOpenInterest ? (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="open_interest"
                      name="Open Interest"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                    />
                  ) : null}

                  {showMovingAverage && showVolume ? (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="volume_ma"
                      name="Volume MA"
                      stroke="#facc15"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  ) : null}

                  {showMovingAverage && showOpenInterest ? (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="open_interest_ma"
                      name="OI MA"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No Volume/OI data found for this market.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">
              Daily Volume & Open Interest Table
            </h2>
            <p className="text-sm text-slate-400">
              Latest 30 stored trading-day records with numerical change,
              percentage change, and moving averages.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="whitespace-nowrap px-3 py-3">Date</th>
                  <th className="whitespace-nowrap px-3 py-3">Volume</th>
                  <th className="whitespace-nowrap px-3 py-3">Vol Change</th>
                  <th className="whitespace-nowrap px-3 py-3">Vol %</th>
                  <th className="whitespace-nowrap px-3 py-3">Vol MA</th>
                  <th className="whitespace-nowrap px-3 py-3">
                    Open Interest
                  </th>
                  <th className="whitespace-nowrap px-3 py-3">OI Change</th>
                  <th className="whitespace-nowrap px-3 py-3">OI %</th>
                  <th className="whitespace-nowrap px-3 py-3">OI MA</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {tableReports.map((row) => (
                  <tr
                    key={row.id}
                    className="text-slate-300 transition hover:bg-slate-800/50"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-white">
                      {row.trade_date}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatNumber(row.volume)}
                    </td>
                    <td
                      className={
                        "whitespace-nowrap px-3 py-3 " +
                        getChangeClass(row.volume_change)
                      }
                    >
                      {formatSignedNumber(row.volume_change)}
                    </td>
                    <td
                      className={
                        "whitespace-nowrap px-3 py-3 " +
                        getChangeClass(row.volume_change_percent)
                      }
                    >
                      {formatPercent(row.volume_change_percent)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-yellow-300">
                      {formatNumber(row.volume_ma)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatNumber(row.open_interest)}
                    </td>
                    <td
                      className={
                        "whitespace-nowrap px-3 py-3 " +
                        getChangeClass(row.open_interest_change)
                      }
                    >
                      {formatSignedNumber(row.open_interest_change)}
                    </td>
                    <td
                      className={
                        "whitespace-nowrap px-3 py-3 " +
                        getChangeClass(row.open_interest_change_percent)
                      }
                    >
                      {formatPercent(row.open_interest_change_percent)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-purple-300">
                      {formatNumber(row.open_interest_ma)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!tableReports.length ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No table data available.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
