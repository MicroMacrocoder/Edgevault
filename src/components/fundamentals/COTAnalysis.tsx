"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { COTReport } from "@/types/cot";

const COT_SYMBOL_OPTIONS = [
  { label: "Euro FX", symbol: "EUR" },
  { label: "British Pound", symbol: "GBP" },
  { label: "Japanese Yen", symbol: "JPY" },
  { label: "Canadian Dollar", symbol: "CAD" },
  { label: "Swiss Franc", symbol: "CHF" },
  { label: "Australian Dollar", symbol: "AUD" },
];

type PositionGroup = "noncommercial" | "commercial" | "nonreportable";

type ChartRow = COTReport & {
  formattedDate: string;
  selectedNetPosition: number;
  selectedChange: number;
  selectedPercentageChange: number;
  movingAverage: number | null;
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }

  return value.toFixed(2) + "%";
}

function getSelectedNetPosition(report: COTReport, group: PositionGroup) {
  if (group === "commercial") {
    return report.commercial_net;
  }

  if (group === "nonreportable") {
    return report.nonreportable_net;
  }

  return report.noncommercial_net;
}

function getPositionGroupLabel(group: PositionGroup) {
  if (group === "commercial") {
    return "Commercials";
  }

  if (group === "nonreportable") {
    return "Non-Reportable";
  }

  return "Non-Commercials";
}

export default function COTAnalysis() {
  const [selectedSymbol, setSelectedSymbol] = useState("EUR");
  const [selectedGroup, setSelectedGroup] =
    useState<PositionGroup>("noncommercial");
  const [movingAveragePeriod, setMovingAveragePeriod] = useState(10);
  const [startDate, setStartDate] = useState("2025-01-01");
  const [reports, setReports] = useState<COTReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCOTReports() {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await fetch("/api/cot?symbol=" + selectedSymbol, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.message || "Failed to load COT reports.");
        }

        if (isMounted) {
          setReports(result.reports || []);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load COT reports."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCOTReports();

    return () => {
      isMounted = false;
    };
  }, [selectedSymbol]);

  const filteredReports = useMemo(() => {
    return reports
      .filter((report) => report.report_date >= startDate)
      .sort((a, b) => a.report_date.localeCompare(b.report_date));
  }, [reports, startDate]);

  const chartRows = useMemo<ChartRow[]>(() => {
    return filteredReports.map((report, index) => {
      const selectedNetPosition = getSelectedNetPosition(report, selectedGroup);
      const previousReport = filteredReports[index - 1];
      const previousNetPosition = previousReport
        ? getSelectedNetPosition(previousReport, selectedGroup)
        : selectedNetPosition;

      const selectedChange = selectedNetPosition - previousNetPosition;
      const selectedPercentageChange =
        previousNetPosition === 0
          ? 0
          : (selectedChange / Math.abs(previousNetPosition)) * 100;

      const movingAverageStartIndex = Math.max(
        0,
        index - movingAveragePeriod + 1
      );

      const movingAverageSlice = filteredReports.slice(
        movingAverageStartIndex,
        index + 1
      );

      const movingAverage =
        movingAverageSlice.length < movingAveragePeriod
          ? null
          : movingAverageSlice.reduce((total, item) => {
              return total + getSelectedNetPosition(item, selectedGroup);
            }, 0) / movingAverageSlice.length;

      return {
        ...report,
        formattedDate: new Date(report.report_date).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "2-digit",
          }
        ),
        selectedNetPosition,
        selectedChange,
        selectedPercentageChange,
        movingAverage,
      };
    });
  }, [filteredReports, selectedGroup, movingAveragePeriod]);

  const recentRows = useMemo(() => {
    return chartRows.slice(-8).reverse();
  }, [chartRows]);

  const latestReport = chartRows[chartRows.length - 1];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
              CFTC Commitment of Traders
            </p>

            <h2 className="font-mono text-3xl font-bold text-white">
              COT <span className="text-yellow-400">Positioning</span>
            </h2>

            <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-gray-400">
              Track how commercials, non-commercial speculators, and
              non-reportable traders are positioned across major currency
              futures.
            </p>
          </div>

          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 font-mono text-xs text-cyan-300">
            Source: CFTC Legacy Futures Only
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500">
              Market
            </span>
            <select
              value={selectedSymbol}
              onChange={(event) => setSelectedSymbol(event.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-black px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400"
            >
              {COT_SYMBOL_OPTIONS.map((option) => (
                <option key={option.symbol} value={option.symbol}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500">
              Table Position Group
            </span>
            <select
              value={selectedGroup}
              onChange={(event) =>
                setSelectedGroup(event.target.value as PositionGroup)
              }
              className="w-full rounded-xl border border-gray-800 bg-black px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="noncommercial">Non-Commercials</option>
              <option value="commercial">Commercials</option>
              <option value="nonreportable">Non-Reportable</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500">
              Start Date
            </span>
            <input
              type="date"
              min="2025-01-01"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-black px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest text-gray-500">
              Moving Average
            </span>
            <input
              type="number"
              min="2"
              max="52"
              value={movingAveragePeriod}
              onChange={(event) =>
                setMovingAveragePeriod(Number(event.target.value))
              }
              className="w-full rounded-xl border border-gray-800 bg-black px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400"
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-800 bg-[#050505] p-8 text-center font-mono text-sm text-gray-400">
          Loading COT reports...
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-8 font-mono text-sm text-red-300">
          {errorMessage}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-gray-800 bg-[#050505] p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-gray-500">
                Latest Report
              </p>
              <p className="mt-3 font-mono text-xl font-bold text-white">
                {latestReport ? latestReport.formattedDate : "N/A"}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#050505] p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-gray-500">
                Non-Commercial Net
              </p>
              <p className="mt-3 font-mono text-xl font-bold text-cyan-400">
                {latestReport
                  ? formatNumber(latestReport.noncommercial_net)
                  : "0"}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#050505] p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-gray-500">
                Commercial Net
              </p>
              <p className="mt-3 font-mono text-xl font-bold text-yellow-400">
                {latestReport ? formatNumber(latestReport.commercial_net) : "0"}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#050505] p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-gray-500">
                Open Interest
              </p>
              <p className="mt-3 font-mono text-xl font-bold text-white">
                {latestReport ? formatNumber(latestReport.open_interest) : "0"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
            <div className="mb-6">
              <h3 className="font-mono text-xl font-bold text-white">
                Net Positioning Chart
              </h3>
              <p className="mt-2 font-mono text-sm text-gray-500">
                Three-line view of speculators, hedgers, and small traders.
              </p>
            </div>

            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="formattedDate"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => formatNumber(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#050505",
                      border: "1px solid #374151",
                      borderRadius: "12px",
                      color: "#ffffff",
                    }}
                    formatter={(value) => formatNumber(Number(value))}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="noncommercial_net"
                    name="Non-Commercials"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="commercial_net"
                    name="Commercials"
                    stroke="#facc15"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="nonreportable_net"
                    name="Non-Reportable"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    name={
                      getPositionGroupLabel(selectedGroup) +
                      " " +
                      movingAveragePeriod +
                      "-Report MA"
                    }
                    stroke="#ffffff"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
            <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <h3 className="font-mono text-xl font-bold text-white">
                  Recent Reports
                </h3>
                <p className="mt-2 font-mono text-sm text-gray-500">
                  Showing last 8 reports for{" "}
                  {getPositionGroupLabel(selectedGroup)}.
                </p>
              </div>

              <p className="font-mono text-xs uppercase tracking-widest text-gray-500">
                Records: {chartRows.length}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-left font-mono text-xs uppercase tracking-widest text-gray-500">
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Net Position</th>
                    <th className="py-3 pr-4">Change</th>
                    <th className="py-3 pr-4">% Change</th>
                    <th className="py-3 pr-4">
                      {movingAveragePeriod}-Report MA
                    </th>
                    <th className="py-3 pr-4">Open Interest</th>
                  </tr>
                </thead>

                <tbody>
                  {recentRows.map((row) => {
                    const isPositiveChange = row.selectedChange >= 0;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-900 font-mono text-sm text-gray-300"
                      >
                        <td className="py-4 pr-4 text-white">
                          {row.formattedDate}
                        </td>
                        <td className="py-4 pr-4">
                          {formatNumber(row.selectedNetPosition)}
                        </td>
                        <td
                          className={
                            "py-4 pr-4 " +
                            (isPositiveChange
                              ? "text-green-400"
                              : "text-red-400")
                          }
                        >
                          {isPositiveChange ? "+" : ""}
                          {formatNumber(row.selectedChange)}
                        </td>
                        <td
                          className={
                            "py-4 pr-4 " +
                            (isPositiveChange
                              ? "text-green-400"
                              : "text-red-400")
                          }
                        >
                          {isPositiveChange ? "+" : ""}
                          {formatPercent(row.selectedPercentageChange)}
                        </td>
                        <td className="py-4 pr-4 text-yellow-400">
                          {row.movingAverage === null
                            ? "N/A"
                            : formatNumber(Math.round(row.movingAverage))}
                        </td>
                        <td className="py-4 pr-4">
                          {formatNumber(row.open_interest)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
