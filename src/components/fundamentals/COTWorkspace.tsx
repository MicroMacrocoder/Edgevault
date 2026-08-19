"use client";

import { useEffect, useMemo, useState } from "react";
import COTAnalysis from "@/components/fundamentals/COTAnalysis";

type WorkspaceTab = "overview" | "breakdown";
type BreakdownSection = "commercials" | "noncommercials" | "other";
type BreakdownView = "cards" | "table" | "chart";

type ParticipantName =
  | "dealer"
  | "asset_manager"
  | "leveraged_funds"
  | "other_reportables";

type TFFReport = {
  id: string;
  symbol: string;
  currency: string;
  market_name: string;
  cftc_code: string;
  report_date: string;
  participant: ParticipantName;
  open_interest: number;
  change_open_interest: number;
  long_position: number;
  short_position: number;
  spreading_position: number;
  change_long: number;
  change_short: number;
  change_spreading: number;
  pct_oi_long: number;
  pct_oi_short: number;
  pct_oi_spreading: number;
  net_position: number;
  net_change: number;
  net_pct_oi: number;
  source: string;
  created_at: string;
  updated_at: string;
};

type TFFResponse = {
  error: boolean;
  message?: string;
  latestReportDate?: string | null;
  lastUpdatedAt?: string | null;
  reportCount?: number;
  reports?: TFFReport[];
};

const MARKETS = [
  { value: "DXY", label: "U.S. Dollar Index" },
  { value: "EUR", label: "Euro" },
  { value: "GBP", label: "British Pound" },
  { value: "JPY", label: "Japanese Yen" },
  { value: "CAD", label: "Canadian Dollar" },
  { value: "CHF", label: "Swiss Franc" },
  { value: "AUD", label: "Australian Dollar" },
  { value: "NZD", label: "New Zealand Dollar" },
] as const;

const PARTICIPANTS: {
  value: ParticipantName;
  label: string;
}[] = [
  { value: "leveraged_funds", label: "Leveraged Funds" },
  { value: "asset_manager", label: "Asset Manager / Institutional" },
  { value: "dealer", label: "Dealer / Intermediary" },
  { value: "other_reportables", label: "Other Reportables" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSignedNumber(value: number) {
  if (value > 0) return `+${formatNumber(value)}`;
  return formatNumber(value);
}

function formatPercent(value: number) {
  if (value > 0) return `+${value.toFixed(1)}%`;
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function valueTone(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-slate-300";
}

export default function COTWorkspace() {
  const [workspaceTab, setWorkspaceTab] =
    useState<WorkspaceTab>("overview");

  const [breakdownSection, setBreakdownSection] =
    useState<BreakdownSection>("commercials");

  const [breakdownView, setBreakdownView] =
    useState<BreakdownView>("table");

  const [symbol, setSymbol] = useState("DXY");
  const [participant, setParticipant] =
    useState<ParticipantName>("leveraged_funds");

  const [reports, setReports] = useState<TFFReport[]>([]);
  const [latestReportDate, setLatestReportDate] =
    useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cardReports, setCardReports] = useState<TFFReport[]>([]);
  const [cardLatestReportDate, setCardLatestReportDate] =
    useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    if (
      workspaceTab !== "breakdown" ||
      breakdownSection !== "commercials" ||
      breakdownView !== "cards"
    ) {
      return;
    }

    const controller = new AbortController();

    async function loadCardReports() {
      setCardLoading(true);
      setCardError(null);

      try {
        const response = await fetch(
          `/api/cot/tff?symbol=${encodeURIComponent(symbol)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        const data = (await response.json()) as TFFResponse;

        if (!response.ok || data.error) {
          throw new Error(
            data.message || "Failed to load latest TFF participant data."
          );
        }

        const fetchedReports = Array.isArray(data.reports)
          ? data.reports
          : [];

        setCardReports(fetchedReports);
        setCardLatestReportDate(data.latestReportDate || null);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setCardReports([]);
        setCardLatestReportDate(null);
        setCardError(
          error instanceof Error
            ? error.message
            : "Failed to load latest TFF participant data."
        );
      } finally {
        if (!controller.signal.aborted) {
          setCardLoading(false);
        }
      }
    }

    loadCardReports();

    return () => controller.abort();
  }, [workspaceTab, breakdownSection, breakdownView, symbol]);

  useEffect(() => {
    if (
      workspaceTab !== "breakdown" ||
      breakdownSection !== "commercials" ||
      breakdownView !== "table"
    ) {
      return;
    }

    const controller = new AbortController();

    async function loadReports() {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          `/api/cot/tff?symbol=${encodeURIComponent(
            symbol
          )}&participant=${encodeURIComponent(participant)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        const data = (await response.json()) as TFFResponse;

        if (!response.ok || data.error) {
          throw new Error(
            data.message || "Failed to load TFF participant history."
          );
        }

        setReports(Array.isArray(data.reports) ? data.reports : []);
        setLatestReportDate(data.latestReportDate || null);
        setLastUpdatedAt(data.lastUpdatedAt || null);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setReports([]);
        setLatestReportDate(null);
        setLastUpdatedAt(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load TFF participant history."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => controller.abort();
  }, [
    workspaceTab,
    breakdownSection,
    breakdownView,
    symbol,
    participant,
  ]);

  const newestFirst = useMemo(
    () =>
      [...reports].sort((a, b) =>
        b.report_date.localeCompare(a.report_date)
      ),
    [reports]
  );

  const selectedParticipantLabel =
    PARTICIPANTS.find((item) => item.value === participant)?.label ||
    participant;

  const latestParticipantCards = useMemo(() => {
    if (cardReports.length === 0) return [];

    const latestDate =
      cardLatestReportDate ||
      [...cardReports]
        .sort((a, b) => b.report_date.localeCompare(a.report_date))[0]
        ?.report_date;

    if (!latestDate) return [];

    return PARTICIPANTS.map((participantItem) => {
      const report = cardReports.find(
        (item) =>
          item.report_date === latestDate &&
          item.participant === participantItem.value
      );

      return report
        ? {
            ...participantItem,
            report,
          }
        : null;
    }).filter(
      (
        item
      ): item is {
        value: ParticipantName;
        label: string;
        report: TFFReport;
      } => item !== null
    );
  }, [cardReports, cardLatestReportDate]);

  const cardOpenInterest =
    latestParticipantCards[0]?.report.open_interest ?? null;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-800 bg-[#050505] p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWorkspaceTab("overview")}
            className={[
              "min-h-11 rounded-xl px-4 py-3 font-mono text-sm font-semibold transition",
              workspaceTab === "overview"
                ? "border border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                : "border border-gray-800 bg-black text-gray-400 hover:border-gray-700 hover:text-white",
            ].join(" ")}
          >
            Overview
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceTab("breakdown")}
            className={[
              "min-h-11 rounded-xl px-4 py-3 font-mono text-sm font-semibold transition",
              workspaceTab === "breakdown"
                ? "border border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                : "border border-gray-800 bg-black text-gray-400 hover:border-gray-700 hover:text-white",
            ].join(" ")}
          >
            Breakdown
          </button>
        </div>
      </div>

      {workspaceTab === "overview" ? (
        <COTAnalysis />
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-800 bg-[#050505] p-4 sm:p-6">
            <div className="mb-5">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-yellow-400">
                COT Participant Breakdown
              </p>

              <h2 className="font-mono text-2xl font-bold text-white sm:text-3xl">
                Positioning Breakdown
              </h2>

              <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-gray-400">
                Explore participant positioning with historical detail while
                keeping the existing COT overview unchanged.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setBreakdownSection("commercials")}
                className={[
                  "min-h-12 rounded-xl border px-4 py-3 text-left font-mono text-sm transition",
                  breakdownSection === "commercials"
                    ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                    : "border-gray-800 bg-black text-gray-400 hover:border-gray-700 hover:text-white",
                ].join(" ")}
              >
                <span className="block font-semibold">Commercials</span>
                <span className="mt-1 block text-xs opacity-70">
                  Live participant data
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBreakdownSection("noncommercials")}
                className={[
                  "min-h-12 rounded-xl border px-4 py-3 text-left font-mono text-sm transition",
                  breakdownSection === "noncommercials"
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                    : "border-gray-800 bg-black text-gray-400 hover:border-gray-700 hover:text-white",
                ].join(" ")}
              >
                <span className="block font-semibold">Non-Commercials</span>
                <span className="mt-1 block text-xs opacity-70">
                  Placeholder
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBreakdownSection("other")}
                className={[
                  "min-h-12 rounded-xl border px-4 py-3 text-left font-mono text-sm transition",
                  breakdownSection === "other"
                    ? "border-purple-400/40 bg-purple-400/10 text-purple-300"
                    : "border-gray-800 bg-black text-gray-400 hover:border-gray-700 hover:text-white",
                ].join(" ")}
              >
                <span className="block font-semibold">Other</span>
                <span className="mt-1 block text-xs opacity-70">
                  Placeholder
                </span>
              </button>
            </div>
          </div>

          {breakdownSection === "commercials" ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-800 bg-[#050505] p-3 sm:p-4">
                <div className="grid grid-cols-3 gap-2">
                  {(["cards", "table", "chart"] as BreakdownView[]).map(
                    (view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setBreakdownView(view)}
                        className={[
                          "min-h-11 rounded-xl px-3 py-3 font-mono text-xs font-semibold capitalize transition sm:text-sm",
                          breakdownView === view
                            ? "border border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                            : "border border-gray-800 bg-black text-gray-400 hover:border-gray-700 hover:text-white",
                        ].join(" ")}
                      >
                        {view}
                      </button>
                    )
                  )}
                </div>
              </div>

              {breakdownView === "table" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-800 bg-[#050505] p-4 sm:p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-gray-500">
                          Market
                        </span>

                        <select
                          value={symbol}
                          onChange={(event) => setSymbol(event.target.value)}
                          className="min-h-12 w-full rounded-xl border border-gray-800 bg-black px-4 font-mono text-sm text-white outline-none transition focus:border-yellow-400/50"
                        >
                          {MARKETS.map((market) => (
                            <option key={market.value} value={market.value}>
                              {market.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-gray-500">
                          Participant
                        </span>

                        <select
                          value={participant}
                          onChange={(event) =>
                            setParticipant(
                              event.target.value as ParticipantName
                            )
                          }
                          className="min-h-12 w-full rounded-xl border border-gray-800 bg-black px-4 font-mono text-sm text-white outline-none transition focus:border-yellow-400/50"
                        >
                          {PARTICIPANTS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-800 bg-[#050505] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-yellow-400">
                          Commercial Breakdown
                        </p>

                        <h3 className="mt-2 font-mono text-xl font-bold text-white">
                          {selectedParticipantLabel} History
                        </h3>

                        <p className="mt-2 font-mono text-xs text-gray-500">
                          {MARKETS.find((market) => market.value === symbol)
                            ?.label || symbol}
                        </p>
                      </div>

                      <div className="font-mono text-xs text-gray-500 sm:text-right">
                        <div>
                          Latest report:{" "}
                          <span className="text-gray-300">
                            {latestReportDate
                              ? formatDate(latestReportDate)
                              : "—"}
                          </span>
                        </div>
                        <div className="mt-1">
                          Reports:{" "}
                          <span className="text-gray-300">
                            {newestFirst.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {loading ? (
                      <div className="mt-5 rounded-xl border border-gray-800 bg-black p-6 text-center font-mono text-sm text-gray-400">
                        Loading participant history...
                      </div>
                    ) : loadError ? (
                      <div className="mt-5 rounded-xl border border-rose-900/60 bg-rose-950/20 p-5 font-mono text-sm text-rose-300">
                        {loadError}
                      </div>
                    ) : newestFirst.length === 0 ? (
                      <div className="mt-5 rounded-xl border border-gray-800 bg-black p-6 text-center font-mono text-sm text-gray-400">
                        No participant history is available for this selection.
                      </div>
                    ) : (
                      <>
                        <div className="mt-5 space-y-3 md:hidden">
                          {newestFirst.map((report) => (
                            <article
                              key={report.id}
                              className="rounded-xl border border-gray-800 bg-black p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-gray-500">
                                    Report Date
                                  </p>
                                  <p className="mt-1 font-mono text-sm font-bold text-white">
                                    {formatDate(report.report_date)}
                                  </p>
                                </div>

                                <div className="text-right">
                                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-gray-500">
                                    Open Interest
                                  </p>
                                  <p className="mt-1 font-mono text-sm font-bold text-white">
                                    {formatNumber(report.open_interest)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 rounded-xl border border-gray-800 bg-[#050505] p-4">
                                <p className="font-mono text-xs uppercase tracking-[0.16em] text-gray-500">
                                  Net Position
                                </p>

                                <p
                                  className={`mt-2 font-mono text-2xl font-black ${valueTone(
                                    report.net_position
                                  )}`}
                                >
                                  {formatSignedNumber(report.net_position)}
                                </p>

                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <div>
                                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-gray-600">
                                      Weekly Net Change
                                    </p>
                                    <p
                                      className={`mt-1 font-mono text-sm font-semibold ${valueTone(
                                        report.net_change
                                      )}`}
                                    >
                                      {formatSignedNumber(report.net_change)}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-gray-600">
                                      Net %OI
                                    </p>
                                    <p
                                      className={`mt-1 font-mono text-sm font-semibold ${valueTone(
                                        report.net_pct_oi
                                      )}`}
                                    >
                                      {formatPercent(report.net_pct_oi)}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3">
                                <div className="rounded-xl border border-gray-800 p-3">
                                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
                                    Long
                                  </p>

                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        Position
                                      </p>
                                      <p className="mt-1 font-mono text-xs text-white">
                                        {formatNumber(report.long_position)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        Change
                                      </p>
                                      <p
                                        className={`mt-1 font-mono text-xs ${valueTone(
                                          report.change_long
                                        )}`}
                                      >
                                        {formatSignedNumber(report.change_long)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        %OI
                                      </p>
                                      <p className="mt-1 font-mono text-xs text-white">
                                        {report.pct_oi_long.toFixed(1)}%
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-gray-800 p-3">
                                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-rose-400">
                                    Short
                                  </p>

                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        Position
                                      </p>
                                      <p className="mt-1 font-mono text-xs text-white">
                                        {formatNumber(report.short_position)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        Change
                                      </p>
                                      <p
                                        className={`mt-1 font-mono text-xs ${valueTone(
                                          report.change_short
                                        )}`}
                                      >
                                        {formatSignedNumber(report.change_short)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        %OI
                                      </p>
                                      <p className="mt-1 font-mono text-xs text-white">
                                        {report.pct_oi_short.toFixed(1)}%
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-gray-800 p-3">
                                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
                                    Spreading
                                  </p>

                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        Position
                                      </p>
                                      <p className="mt-1 font-mono text-xs text-white">
                                        {formatNumber(
                                          report.spreading_position
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        Change
                                      </p>
                                      <p
                                        className={`mt-1 font-mono text-xs ${valueTone(
                                          report.change_spreading
                                        )}`}
                                      >
                                        {formatSignedNumber(
                                          report.change_spreading
                                        )}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-mono text-[10px] uppercase text-gray-600">
                                        %OI
                                      </p>
                                      <p className="mt-1 font-mono text-xs text-white">
                                        {report.pct_oi_spreading.toFixed(1)}%
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>

                        <div className="mt-5 hidden overflow-x-auto md:block">
                          <table className="min-w-[1180px] w-full border-collapse font-mono text-xs">
                            <thead>
                              <tr className="border-b border-gray-800 text-left text-gray-500">
                                <th className="px-3 py-3 font-medium">Date</th>
                                <th className="px-3 py-3 font-medium">
                                  Net Position
                                </th>
                                <th className="px-3 py-3 font-medium">
                                  Weekly Net
                                </th>
                                <th className="px-3 py-3 font-medium">
                                  Net %OI
                                </th>
                                <th className="px-3 py-3 font-medium">Long</th>
                                <th className="px-3 py-3 font-medium">
                                  Δ Long
                                </th>
                                <th className="px-3 py-3 font-medium">
                                  Long %OI
                                </th>
                                <th className="px-3 py-3 font-medium">Short</th>
                                <th className="px-3 py-3 font-medium">
                                  Δ Short
                                </th>
                                <th className="px-3 py-3 font-medium">
                                  Short %OI
                                </th>
                                <th className="px-3 py-3 font-medium">
                                  Spreading
                                </th>
                                <th className="px-3 py-3 font-medium">
                                  Open Interest
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {newestFirst.map((report) => (
                                <tr
                                  key={report.id}
                                  className="border-b border-gray-900 text-gray-300 transition hover:bg-white/[0.025]"
                                >
                                  <td className="whitespace-nowrap px-3 py-3 text-white">
                                    {formatDate(report.report_date)}
                                  </td>
                                  <td
                                    className={`px-3 py-3 font-semibold ${valueTone(
                                      report.net_position
                                    )}`}
                                  >
                                    {formatSignedNumber(report.net_position)}
                                  </td>
                                  <td
                                    className={`px-3 py-3 ${valueTone(
                                      report.net_change
                                    )}`}
                                  >
                                    {formatSignedNumber(report.net_change)}
                                  </td>
                                  <td
                                    className={`px-3 py-3 ${valueTone(
                                      report.net_pct_oi
                                    )}`}
                                  >
                                    {formatPercent(report.net_pct_oi)}
                                  </td>
                                  <td className="px-3 py-3">
                                    {formatNumber(report.long_position)}
                                  </td>
                                  <td
                                    className={`px-3 py-3 ${valueTone(
                                      report.change_long
                                    )}`}
                                  >
                                    {formatSignedNumber(report.change_long)}
                                  </td>
                                  <td className="px-3 py-3">
                                    {report.pct_oi_long.toFixed(1)}%
                                  </td>
                                  <td className="px-3 py-3">
                                    {formatNumber(report.short_position)}
                                  </td>
                                  <td
                                    className={`px-3 py-3 ${valueTone(
                                      report.change_short
                                    )}`}
                                  >
                                    {formatSignedNumber(report.change_short)}
                                  </td>
                                  <td className="px-3 py-3">
                                    {report.pct_oi_short.toFixed(1)}%
                                  </td>
                                  <td className="px-3 py-3">
                                    {formatNumber(
                                      report.spreading_position
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    {formatNumber(report.open_interest)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {lastUpdatedAt ? (
                      <p className="mt-4 font-mono text-[11px] text-gray-600">
                        EdgeVault data refresh:{" "}
                        {new Date(lastUpdatedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : breakdownView === "cards" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-800 bg-[#050505] p-4 sm:p-5">
                    <label className="block sm:max-w-sm">
                      <span className="mb-2 block font-mono text-xs uppercase tracking-[0.16em] text-gray-500">
                        Market
                      </span>

                      <select
                        value={symbol}
                        onChange={(event) => setSymbol(event.target.value)}
                        className="min-h-12 w-full rounded-xl border border-gray-800 bg-black px-4 font-mono text-sm text-white outline-none transition focus:border-yellow-400/50"
                      >
                        {MARKETS.map((market) => (
                          <option key={market.value} value={market.value}>
                            {market.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-2xl border border-gray-800 bg-[#050505] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-yellow-400">
                          Commercial Breakdown
                        </p>

                        <h3 className="mt-2 font-mono text-xl font-bold text-white">
                          Participant Cards
                        </h3>

                        <p className="mt-2 font-mono text-xs text-gray-500">
                          {MARKETS.find((market) => market.value === symbol)
                            ?.label || symbol}
                        </p>
                      </div>

                      <div className="font-mono text-xs text-gray-500 sm:text-right">
                        <div>
                          Report:{" "}
                          <span className="text-gray-300">
                            {cardLatestReportDate
                              ? formatDate(cardLatestReportDate)
                              : "—"}
                          </span>
                        </div>

                        <div className="mt-1">
                          Open Interest:{" "}
                          <span className="text-gray-300">
                            {cardOpenInterest !== null
                              ? formatNumber(cardOpenInterest)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {cardLoading ? (
                      <div className="mt-5 rounded-xl border border-gray-800 bg-black p-6 text-center font-mono text-sm text-gray-400">
                        Loading latest participant positioning...
                      </div>
                    ) : cardError ? (
                      <div className="mt-5 rounded-xl border border-rose-900/60 bg-rose-950/20 p-5 font-mono text-sm text-rose-300">
                        {cardError}
                      </div>
                    ) : latestParticipantCards.length === 0 ? (
                      <div className="mt-5 rounded-xl border border-gray-800 bg-black p-6 text-center font-mono text-sm text-gray-400">
                        No latest participant data is available for this market.
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {latestParticipantCards.map(({ value, label, report }) => (
                          <article
                            key={value}
                            className="rounded-2xl border border-gray-800 bg-black p-4 sm:p-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-mono text-xs uppercase tracking-[0.16em] text-gray-500">
                                  Participant
                                </p>
                                <h4 className="mt-1 font-mono text-base font-bold text-white sm:text-lg">
                                  {label}
                                </h4>
                              </div>

                              <span className="rounded-full border border-gray-800 bg-[#050505] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                TFF
                              </span>
                            </div>

                            <div className="mt-5 rounded-xl border border-gray-800 bg-[#050505] p-4">
                              <p className="font-mono text-xs uppercase tracking-[0.16em] text-gray-500">
                                Net Position
                              </p>

                              <p
                                className={`mt-2 font-mono text-3xl font-black ${valueTone(
                                  report.net_position
                                )}`}
                              >
                                {formatSignedNumber(report.net_position)}
                              </p>

                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <div>
                                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600">
                                    Weekly Net Change
                                  </p>
                                  <p
                                    className={`mt-1 font-mono text-sm font-semibold ${valueTone(
                                      report.net_change
                                    )}`}
                                  >
                                    {formatSignedNumber(report.net_change)}
                                  </p>
                                </div>

                                <div>
                                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600">
                                    Net %OI
                                  </p>
                                  <p
                                    className={`mt-1 font-mono text-sm font-semibold ${valueTone(
                                      report.net_pct_oi
                                    )}`}
                                  >
                                    {formatPercent(report.net_pct_oi)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl border border-gray-800 p-3">
                                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
                                  Long
                                </p>

                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-gray-600">
                                      Position
                                    </p>
                                    <p className="mt-1 font-mono text-xs text-white">
                                      {formatNumber(report.long_position)}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-gray-600">
                                      Change
                                    </p>
                                    <p
                                      className={`mt-1 font-mono text-xs ${valueTone(
                                        report.change_long
                                      )}`}
                                    >
                                      {formatSignedNumber(report.change_long)}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-gray-600">
                                      %OI
                                    </p>
                                    <p className="mt-1 font-mono text-xs text-white">
                                      {report.pct_oi_long.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-gray-800 p-3">
                                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-rose-400">
                                  Short
                                </p>

                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-gray-600">
                                      Position
                                    </p>
                                    <p className="mt-1 font-mono text-xs text-white">
                                      {formatNumber(report.short_position)}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-gray-600">
                                      Change
                                    </p>
                                    <p
                                      className={`mt-1 font-mono text-xs ${valueTone(
                                        report.change_short
                                      )}`}
                                    >
                                      {formatSignedNumber(report.change_short)}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-gray-600">
                                      %OI
                                    </p>
                                    <p className="mt-1 font-mono text-xs text-white">
                                      {report.pct_oi_short.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl border border-dashed border-gray-800 px-3 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                  Spreading
                                </p>

                                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-gray-500">
                                  <span>
                                    Position{" "}
                                    <strong className="font-semibold text-gray-300">
                                      {formatNumber(report.spreading_position)}
                                    </strong>
                                  </span>

                                  <span>
                                    Change{" "}
                                    <strong
                                      className={`font-semibold ${valueTone(
                                        report.change_spreading
                                      )}`}
                                    >
                                      {formatSignedNumber(
                                        report.change_spreading
                                      )}
                                    </strong>
                                  </span>

                                  <span>
                                    %OI{" "}
                                    <strong className="font-semibold text-gray-300">
                                      {report.pct_oi_spreading.toFixed(1)}%
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-800 bg-[#050505] p-5 sm:p-6">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-yellow-400">
                    Commercial Breakdown
                  </p>
                  <h3 className="mt-2 font-mono text-xl font-bold text-white">
                    Historical Chart
                  </h3>
                  <p className="mt-3 font-mono text-sm leading-relaxed text-gray-400">
                    Historical positioning charts will be added after the
                    historical table is confirmed.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-700 bg-[#050505] p-6 text-center sm:p-10">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-gray-500">
                Placeholder
              </p>

              <h3 className="mt-3 font-mono text-xl font-bold text-white">
                {breakdownSection === "noncommercials"
                  ? "Non-Commercial Breakdown"
                  : "Other Participant Breakdown"}
              </h3>

              <p className="mx-auto mt-3 max-w-xl font-mono text-sm leading-relaxed text-gray-500">
                The interface is reserved here so this section can be activated
                later without changing the current COT workflow.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}