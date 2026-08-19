"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Info,
  Landmark,
  RefreshCw,
  ScrollText,
  UserRound,
} from "lucide-react";

const MARKET_INTELLIGENCE_SYMBOLS = [
  "DXY",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "CHF",
  "AUD",
  "NZD",
] as const;

export type ReportsMarketIntelligenceSymbol =
  (typeof MARKET_INTELLIGENCE_SYMBOLS)[number];

export type ReportsWorkspaceView =
  | "hub"
  | "market-intelligence";

type MarketTrend =
  | "rising"
  | "sideways"
  | "falling"
  | null;

type MarketIntelligenceReport = {
  id: string;
  symbol: string;
  analysis_date: string;
  report_type: "weekly_baseline" | "daily_update";
  previous_report_id: string | null;

  cot_as_of: string | null;
  price_as_of: string | null;
  oi_as_of: string | null;
  volume_as_of: string | null;

  price_trend: MarketTrend;
  oi_trend: MarketTrend;
  volume_trend: MarketTrend;

  market_condition_id: number | null;
  market_condition_key: string | null;
  market_condition_label: string | null;

  leveraged_funds_state: string | null;
  asset_managers_state: string | null;
  cot_relationship: string | null;

  story_development: string | null;
  change_from_previous: string | null;

  technical_meaning: string | null;
  dashboard_summary: string | null;
  detailed_analysis: string | null;
  continuation_outlook: string | null;
  reversal_outlook: string | null;

  cot_window: unknown;
  market_window: unknown;
  analysis_state: Record<string, unknown>;
  source_snapshot: Record<string, unknown>;

  generated_at: string;
  created_at: string;
  updated_at: string;
};

type LatestResponse = {
  error: boolean;
  found?: boolean;
  mode?: string;
  symbol?: string;
  report?: MarketIntelligenceReport | null;
  message?: string;
};

type HistoryResponse = {
  error: boolean;
  mode?: string;
  symbol?: string;
  count?: number;
  reports?: MarketIntelligenceReport[];
  message?: string;
};

type ReportsWorkspaceProps = {
  initialView?: ReportsWorkspaceView;
  initialMarketIntelligenceSymbol?: ReportsMarketIntelligenceSymbol;
};

type ReportModuleCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: "live" | "coming-soon";
  icon: ReactNode;
  onOpen?: () => void;
};

function ReportModuleCard({
  eyebrow,
  title,
  description,
  status,
  icon,
  onOpen,
}: ReportModuleCardProps) {
  const isLive = status === "live";

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-gray-800 bg-black text-cyan-300">
          {icon}
        </div>

        <span
          className={
            isLive
              ? "border border-green-500/30 bg-green-500/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-green-300"
              : "border border-gray-800 bg-black px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500"
          }
        >
          {isLive ? "Live" : "Coming Soon"}
        </span>
      </div>

      <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
        {eyebrow}
      </p>

      <h2 className="mt-2 font-mono text-lg font-black text-white">
        {title}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        {description}
      </p>

      <div className="mt-5 border-t border-gray-800 pt-4">
        <span
          className={
            isLive
              ? "font-mono text-xs font-bold text-cyan-300"
              : "font-mono text-xs font-bold text-gray-600"
          }
        >
          {isLive ? "Open report →" : "Planned module"}
        </span>
      </div>
    </>
  );

  if (!onOpen) {
    return (
      <div className="border border-gray-800 bg-[#111111] p-5">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="border border-gray-800 bg-[#111111] p-5 text-left transition hover:border-cyan-400/60 hover:bg-[#0d0d0d]"
    >
      {content}
    </button>
  );
}

function formatDate(
  value: string | null | undefined,
  includeYear = true,
) {
  if (!value) return "Unavailable";

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
  });
}

function formatTrend(value: MarketTrend) {
  if (value === "rising") {
    return {
      arrow: "↑",
      label: "Rising",
      className: "text-green-400",
    };
  }

  if (value === "falling") {
    return {
      arrow: "↓",
      label: "Falling",
      className: "text-red-400",
    };
  }

  return {
    arrow: "→",
    label: "Sideways",
    className: "text-gray-300",
  };
}

function formatTextValue(
  value: string | null | undefined,
) {
  if (!value) return "Unavailable";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function dateKey(
  year: number,
  monthIndex: number,
  day: number,
) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildCalendarDays(
  year: number,
  monthIndex: number,
) {
  const firstDay =
    new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();

  const daysInMonth =
    new Date(
      Date.UTC(year, monthIndex + 1, 0),
    ).getUTCDate();

  const cells: Array<number | null> = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function parseAnalysisSections(
  detailedAnalysis: string | null,
) {
  if (!detailedAnalysis) {
    return [];
  }

  const knownHeadings = new Set([
    "CURRENT STORY",
    "WHAT CHANGED",
    "15-OBSERVATION MARKET BEHAVIOUR",
    "5-REPORT COT POSITIONING",
    "POSITIONING VS MARKET",
    "WHAT TO WATCH",
  ]);

  const sections: Array<{
    heading: string;
    body: string[];
  }> = [];

  let activeHeading = "ANALYSIS";
  let activeBody: string[] = [];

  function flush() {
    if (activeBody.length === 0) {
      return;
    }

    sections.push({
      heading: activeHeading,
      body: activeBody,
    });

    activeBody = [];
  }

  for (const rawLine of detailedAnalysis.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (knownHeadings.has(line)) {
      flush();
      activeHeading = line;
      continue;
    }

    activeBody.push(line);
  }

  flush();

  return sections;
}

export default function ReportsWorkspace({
  initialView = "hub",
  initialMarketIntelligenceSymbol = "EUR",
}: ReportsWorkspaceProps) {
  const [view, setView] =
    useState<ReportsWorkspaceView>(initialView);

  const [selectedSymbol, setSelectedSymbol] =
    useState<ReportsMarketIntelligenceSymbol>(
      initialMarketIntelligenceSymbol,
    );

  const [report, setReport] =
    useState<MarketIntelligenceReport | null>(null);

  const [history, setHistory] =
    useState<MarketIntelligenceReport[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [isHistoryLoading, setIsHistoryLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [historyMessage, setHistoryMessage] =
    useState("");

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    setSelectedSymbol(
      initialMarketIntelligenceSymbol,
    );
  }, [initialMarketIntelligenceSymbol]);

  const loadLatest = useCallback(
    async (
      symbol: ReportsMarketIntelligenceSymbol,
      signal?: AbortSignal,
    ) => {
      setIsLoading(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/market-intelligence?symbol=${symbol}`,
          {
            cache: "no-store",
            signal,
          },
        );

        const payload =
          (await response.json()) as LatestResponse;

        if (
          response.status === 404 &&
          payload.found === false
        ) {
          setReport(null);
          setMessage(
            `No saved Market Intelligence report is available for ${symbol} yet.`,
          );
          return;
        }

        if (
          !response.ok ||
          payload.error ||
          !payload.report
        ) {
          throw new Error(
            payload.message ||
              "Market Intelligence could not be loaded.",
          );
        }

        setReport(payload.report);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        setReport(null);
        setMessage(
          error instanceof Error
            ? error.message
            : "Market Intelligence could not be loaded.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const loadHistory = useCallback(
    async (
      symbol: ReportsMarketIntelligenceSymbol,
      signal?: AbortSignal,
    ) => {
      setIsHistoryLoading(true);
      setHistoryMessage("");

      try {
        const response = await fetch(
          `/api/market-intelligence?symbol=${symbol}&history=true&limit=366`,
          {
            cache: "no-store",
            signal,
          },
        );

        const payload =
          (await response.json()) as HistoryResponse;

        if (!response.ok || payload.error) {
          throw new Error(
            payload.message ||
              "Market Intelligence history could not be loaded.",
          );
        }

        setHistory(
          Array.isArray(payload.reports)
            ? payload.reports
            : [],
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        setHistory([]);
        setHistoryMessage(
          error instanceof Error
            ? error.message
            : "Market Intelligence history could not be loaded.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsHistoryLoading(false);
        }
      }
    },
    [],
  );

  const loadSavedDate = useCallback(
    async (
      symbol: ReportsMarketIntelligenceSymbol,
      analysisDate: string,
    ) => {
      setIsLoading(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/market-intelligence?symbol=${symbol}&date=${analysisDate}`,
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as LatestResponse;

        if (
          !response.ok ||
          payload.error ||
          !payload.report
        ) {
          throw new Error(
            payload.message ||
              "Saved Market Intelligence report could not be loaded.",
          );
        }

        setReport(payload.report);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Saved Market Intelligence report could not be loaded.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (view !== "market-intelligence") {
      return;
    }

    const controller =
      new AbortController();

    void Promise.all([
      loadLatest(
        selectedSymbol,
        controller.signal,
      ),
      loadHistory(
        selectedSymbol,
        controller.signal,
      ),
    ]);

    return () => controller.abort();
  }, [
    loadHistory,
    loadLatest,
    selectedSymbol,
    view,
  ]);

  const currentIndex =
    MARKET_INTELLIGENCE_SYMBOLS.indexOf(
      selectedSymbol,
    );

  function cycleSymbol(direction: -1 | 1) {
    const nextIndex =
      (
        currentIndex +
        direction +
        MARKET_INTELLIGENCE_SYMBOLS.length
      ) % MARKET_INTELLIGENCE_SYMBOLS.length;

    setSelectedSymbol(
      MARKET_INTELLIGENCE_SYMBOLS[nextIndex],
    );
  }

  const analysisSections = useMemo(
    () =>
      parseAnalysisSections(
        report?.detailed_analysis ?? null,
      ),
    [report],
  );

  const selectedMonth =
    report?.analysis_date
      ? monthKey(report.analysis_date)
      : history[0]?.analysis_date
        ? monthKey(history[0].analysis_date)
        : null;

  const calendarMeta = useMemo(() => {
    if (!selectedMonth) {
      return null;
    }

    const [yearString, monthString] =
      selectedMonth.split("-");

    const year = Number(yearString);
    const monthIndex =
      Number(monthString) - 1;

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(monthIndex)
    ) {
      return null;
    }

    return {
      year,
      monthIndex,
      label: new Date(
        Date.UTC(year, monthIndex, 1),
      ).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      cells: buildCalendarDays(
        year,
        monthIndex,
      ),
    };
  }, [selectedMonth]);

  const historyByDate = useMemo(() => {
    const map =
      new Map<
        string,
        MarketIntelligenceReport
      >();

    for (const item of history) {
      map.set(item.analysis_date, item);
    }

    return map;
  }, [history]);

  if (view === "hub") {
    return (
      <div className="space-y-5">
        <div className="border border-gray-800 bg-[#111111] p-5">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
            Reports Hub
          </p>

          <h1 className="mt-2 font-mono text-2xl font-black text-white">
            Research, data and trader reporting
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400">
            Market Intelligence is live now. The remaining report modules are reserved for future economic transcripts, downloadable fundamental datasets and personal trade reports.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportModuleCard
            eyebrow="Fundamental research"
            title="Fundamental Market Intelligence"
            description="A saved market narrative built from aligned Price, Open Interest, Volume and COT positioning, with continuity, freshness and historical reports."
            status="live"
            icon={<Landmark className="h-5 w-5" />}
            onOpen={() =>
              setView("market-intelligence")
            }
          />

          <ReportModuleCard
            eyebrow="Economic drivers"
            title="Speeches & Economic Transcripts"
            description="Central-bank speeches, FOMC communication and other medium- to high-impact policy transcripts, with future EdgeVault summaries."
            status="coming-soon"
            icon={<ScrollText className="h-5 w-5" />}
          />

          <ReportModuleCard
            eyebrow="Fundamental datasets"
            title="Data Downloads"
            description="A central place for downloadable COT, Open Interest, Volume and other fundamental datasets made available inside EdgeVault."
            status="coming-soon"
            icon={<Download className="h-5 w-5" />}
          />

          <ReportModuleCard
            eyebrow="Trader reporting"
            title="Personal Trade Reports"
            description="Future personal performance, journal and trade-report output for monthly, quarterly and custom review periods."
            status="coming-soon"
            icon={<UserRound className="h-5 w-5" />}
          />
        </div>
      </div>
    );
  }

  const priceTrend =
    formatTrend(report?.price_trend ?? null);

  const oiTrend =
    formatTrend(report?.oi_trend ?? null);

  const volumeTrend =
    formatTrend(report?.volume_trend ?? null);

  return (
    <div className="space-y-5">
      <div className="border border-gray-800 bg-[#111111] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setView("hub")}
              className="inline-flex items-center gap-2 font-mono text-xs font-bold text-gray-400 transition hover:text-cyan-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Reports Hub
            </button>

            <p className="mt-5 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
              Fundamental Market Intelligence
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-3xl font-black text-white">
                {selectedSymbol}
              </h1>

              {report ? (
                <span className="border border-gray-800 bg-black px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
                  {report.report_type ===
                  "weekly_baseline"
                    ? "Weekly Baseline"
                    : "Daily Update"}{" "}
                  · {formatDate(report.analysis_date)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => cycleSymbol(-1)}
              className="flex h-9 w-9 items-center justify-center border border-gray-800 bg-black text-gray-300 transition hover:border-cyan-400 hover:text-cyan-300"
              aria-label="Previous currency"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <select
              value={selectedSymbol}
              onChange={(event) =>
                setSelectedSymbol(
                  event.target
                    .value as ReportsMarketIntelligenceSymbol,
                )
              }
              className="h-9 border border-gray-800 bg-black px-3 font-mono text-xs font-bold text-white outline-none transition focus:border-cyan-400"
            >
              {MARKET_INTELLIGENCE_SYMBOLS.map(
                (symbol) => (
                  <option
                    key={symbol}
                    value={symbol}
                  >
                    {symbol}
                  </option>
                ),
              )}
            </select>

            <button
              type="button"
              onClick={() => cycleSymbol(1)}
              className="flex h-9 w-9 items-center justify-center border border-gray-800 bg-black text-gray-300 transition hover:border-cyan-400 hover:text-cyan-300"
              aria-label="Next currency"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                void Promise.all([
                  loadLatest(selectedSymbol),
                  loadHistory(selectedSymbol),
                ])
              }
              className="inline-flex h-9 items-center gap-2 border border-gray-800 bg-black px-3 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-300"
            >
              <RefreshCw
                className={
                  isLoading || isHistoryLoading
                    ? "h-4 w-4 animate-spin"
                    : "h-4 w-4"
                }
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 border-t border-gray-800 pt-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />

          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-gray-300">
              Context, not a live signal
            </p>

            <p className="mt-1 max-w-5xl text-xs leading-relaxed text-gray-500">
              Market Intelligence combines completed Price, Open Interest, Volume and reported institutional positioning to build market context over time. Some inputs, particularly COT positioning, describe an earlier reporting period. Use this report to understand participation, positioning and how the market story is developing — not as a live directional signal or current trading bias.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center border border-gray-800 bg-[#111111] p-8">
          <p className="font-mono text-sm text-gray-500">
            Loading Market Intelligence...
          </p>
        </div>
      ) : message || !report ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center border border-gray-800 bg-[#111111] p-8 text-center">
          <FileText className="h-8 w-8 text-gray-700" />

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-400">
            {message ||
              `No saved Market Intelligence report is available for ${selectedSymbol} yet.`}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Price / OI / Volume", report.price_as_of],
              ["COT Positioning", report.cot_as_of],
              ["Report", report.analysis_date],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border border-gray-800 bg-[#111111] p-4"
              >
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {label}
                </p>

                <p className="mt-2 font-mono text-lg font-black text-white">
                  {formatDate(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="border border-gray-800 bg-[#111111] p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Current technical condition
            </p>

            <h2 className="mt-2 font-mono text-2xl font-black text-yellow-400">
              {report.market_condition_label ||
                "Condition unavailable"}
            </h2>

            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-gray-300">
              {report.technical_meaning ||
                "Technical meaning unavailable."}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Price", priceTrend],
                ["Open Interest", oiTrend],
                ["Volume", volumeTrend],
              ].map(([label, trend]) => {
                const trendValue =
                  trend as ReturnType<
                    typeof formatTrend
                  >;

                return (
                  <div
                    key={String(label)}
                    className="border border-gray-800 bg-black p-3"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
                      {String(label)}
                    </p>

                    <p
                      className={`mt-2 font-mono text-sm font-bold ${trendValue.className}`}
                    >
                      {trendValue.arrow}{" "}
                      {trendValue.label}
                    </p>
                  </div>
                );
              })}

              <div className="border border-gray-800 bg-black p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
                  Leveraged Funds
                </p>

                <p className="mt-2 font-mono text-sm font-bold text-cyan-300">
                  {formatTextValue(
                    report.leveraged_funds_state,
                  )}
                </p>
              </div>

              <div className="border border-gray-800 bg-black p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
                  Asset Managers
                </p>

                <p className="mt-2 font-mono text-sm font-bold text-cyan-300">
                  {formatTextValue(
                    report.asset_managers_state,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-3 border border-gray-800 bg-black p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
                Positioning vs Market
              </p>

              <p className="mt-2 font-mono text-sm font-bold text-white">
                {formatTextValue(
                  report.cot_relationship,
                )}
              </p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              {analysisSections.length > 0 ? (
                analysisSections.map(
                  (section) => (
                    <div
                      key={section.heading}
                      className="border border-gray-800 bg-[#111111] p-5"
                    >
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">
                        {section.heading}
                      </p>

                      <div className="mt-4 space-y-3">
                        {section.body.map(
                          (paragraph, index) => (
                            <p
                              key={`${section.heading}-${index}`}
                              className="text-sm leading-relaxed text-gray-300"
                            >
                              {paragraph}
                            </p>
                          ),
                        )}
                      </div>
                    </div>
                  ),
                )
              ) : (
                <div className="border border-gray-800 bg-[#111111] p-5">
                  <p className="text-sm leading-relaxed text-gray-400">
                    Detailed analysis is unavailable for this saved report.
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="border border-gray-800 bg-[#111111] p-5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-yellow-400" />

                  <h2 className="font-mono text-sm font-bold uppercase tracking-[0.16em] text-white">
                    Report History
                  </h2>
                </div>

                {isHistoryLoading ? (
                  <p className="mt-4 text-sm text-gray-500">
                    Loading saved reports...
                  </p>
                ) : historyMessage ? (
                  <p className="mt-4 text-sm text-red-400">
                    {historyMessage}
                  </p>
                ) : calendarMeta ? (
                  <>
                    <p className="mt-4 font-mono text-xs font-bold text-gray-300">
                      {calendarMeta.label}
                    </p>

                    <div className="mt-3 grid grid-cols-7 gap-1">
                      {[
                        "S",
                        "M",
                        "T",
                        "W",
                        "T",
                        "F",
                        "S",
                      ].map(
                        (label, index) => (
                          <div
                            key={`${label}-${index}`}
                            className="py-1 text-center font-mono text-[9px] font-bold text-gray-600"
                          >
                            {label}
                          </div>
                        ),
                      )}

                      {calendarMeta.cells.map(
                        (day, index) => {
                          if (!day) {
                            return (
                              <div
                                key={`blank-${index}`}
                                className="h-9"
                              />
                            );
                          }

                          const key = dateKey(
                            calendarMeta.year,
                            calendarMeta.monthIndex,
                            day,
                          );

                          const saved =
                            historyByDate.get(key);

                          const isSelected =
                            report.analysis_date === key;

                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={!saved}
                              onClick={() => {
                                if (saved) {
                                  void loadSavedDate(
                                    selectedSymbol,
                                    key,
                                  );
                                }
                              }}
                              className={
                                isSelected
                                  ? "relative flex h-9 items-center justify-center border border-yellow-400 bg-yellow-400 font-mono text-[11px] font-black text-black"
                                  : saved
                                    ? "relative flex h-9 items-center justify-center border border-gray-700 bg-black font-mono text-[11px] font-bold text-white transition hover:border-cyan-400"
                                    : "relative flex h-9 items-center justify-center border border-transparent font-mono text-[11px] text-gray-700"
                              }
                            >
                              {day}

                              {saved ? (
                                <span
                                  className={
                                    saved.report_type ===
                                    "weekly_baseline"
                                      ? "absolute bottom-0.5 text-[8px] text-cyan-300"
                                      : "absolute bottom-1 h-1 w-1 rounded-full bg-cyan-400"
                                  }
                                >
                                  {saved.report_type ===
                                  "weekly_baseline"
                                    ? "★"
                                    : ""}
                                </span>
                              ) : null}
                            </button>
                          );
                        },
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-gray-600">
                      <span>• Saved report</span>
                      <span>★ Weekly baseline</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-gray-500">
                    No saved report history yet.
                  </p>
                )}
              </div>

              <div className="border border-gray-800 bg-[#111111] p-5">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-white">
                  Latest Saved Reports
                </p>

                <div className="mt-4 space-y-2">
                  {history.slice(0, 8).map(
                    (item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          void loadSavedDate(
                            selectedSymbol,
                            item.analysis_date,
                          )
                        }
                        className={
                          report.id === item.id
                            ? "w-full border border-yellow-400 bg-yellow-400/10 p-3 text-left"
                            : "w-full border border-gray-800 bg-black p-3 text-left transition hover:border-cyan-400"
                        }
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs font-bold text-white">
                            {formatDate(
                              item.analysis_date,
                            )}
                          </span>

                          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500">
                            {item.report_type ===
                            "weekly_baseline"
                              ? "Weekly"
                              : "Daily"}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-xs text-gray-500">
                          {item.market_condition_label ||
                            "Saved Market Intelligence"}
                        </p>
                      </button>
                    ),
                  )}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}