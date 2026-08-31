"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
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

type MarketIntelligenceSymbol =
  (typeof MARKET_INTELLIGENCE_SYMBOLS)[number];

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
  cot_as_of: string | null;
  price_as_of: string | null;
  oi_as_of: string | null;
  volume_as_of: string | null;
  price_trend: MarketTrend;
  oi_trend: MarketTrend;
  volume_trend: MarketTrend;
  market_condition_label: string | null;
  cot_relationship: string | null;
  story_development: string | null;
  technical_meaning: string | null;
  dashboard_summary: string | null;
};

type MarketIntelligenceApiResponse = {
  error: boolean;
  found?: boolean;
  mode?: string;
  symbol?: string;
  report?: MarketIntelligenceReport | null;
  message?: string;
};

type MarketIntelligenceDashboardWidgetProps = {
  onOpen: (symbol: MarketIntelligenceSymbol) => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

function formatRelationship(value: string | null | undefined) {
  if (!value) return "Unavailable";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatMarketIntelligenceCopy(value: string) {
  return value
    .replaceAll("15-observation", "15-day")
    .replaceAll("15 observation", "15-day")
    .replaceAll("five-report", "5-week")
    .replaceAll("5-report", "5-week");
}

export default function MarketIntelligenceDashboardWidget({
  onOpen,
}: MarketIntelligenceDashboardWidgetProps) {
  const [selectedSymbol, setSelectedSymbol] =
    useState<MarketIntelligenceSymbol>("EUR");

  const [report, setReport] =
    useState<MarketIntelligenceReport | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const touchStartXRef = useRef<number | null>(null);

  const loadReport = useCallback(
    async (
      symbol: MarketIntelligenceSymbol,
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
          (await response.json()) as MarketIntelligenceApiResponse;

        if (response.status === 404 && payload.found === false) {
          setReport(null);
          setMessage(
            `No saved Market Intelligence report is available for ${symbol} yet.`,
          );
          return;
        }

        if (!response.ok || payload.error || !payload.report) {
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

  useEffect(() => {
    const controller = new AbortController();

    void loadReport(
      selectedSymbol,
      controller.signal,
    );

    return () => controller.abort();
  }, [loadReport, selectedSymbol]);

  const currentIndex =
    MARKET_INTELLIGENCE_SYMBOLS.indexOf(selectedSymbol);

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

  function handleTouchStart(
    event: TouchEvent<HTMLDivElement>,
  ) {
    touchStartXRef.current =
      event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(
    event: TouchEvent<HTMLDivElement>,
  ) {
    const startX = touchStartXRef.current;
    const endX =
      event.changedTouches[0]?.clientX ?? null;

    touchStartXRef.current = null;

    if (startX === null || endX === null) {
      return;
    }

    const distance = endX - startX;

    if (Math.abs(distance) < 50) {
      return;
    }

    cycleSymbol(distance < 0 ? 1 : -1);
  }

  const summaryLines = useMemo(
    () =>
      (report?.dashboard_summary ?? "")
        .split("\n")
        .map((line) => formatMarketIntelligenceCopy(line.trim()))
        .filter(Boolean)
        .slice(0, 4),
    [report],
  );

  const priceTrend =
    formatTrend(report?.price_trend ?? null);

  const oiTrend =
    formatTrend(report?.oi_trend ?? null);

  const volumeTrend =
    formatTrend(report?.volume_trend ?? null);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full self-start border border-gray-800 bg-[#111111] p-4 shadow-[0_0_28px_rgba(34,211,238,0.035)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs">
            Market Intelligence
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-xl font-black text-white sm:text-2xl">
              {selectedSymbol}
            </h2>

            {report ? (
              <span className="border border-gray-800 bg-black px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-gray-500">
                {formatDate(report.analysis_date)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => cycleSymbol(-1)}
            aria-label="Previous Market Intelligence currency"
            className="flex h-8 w-8 items-center justify-center border border-gray-800 bg-black text-gray-300 transition hover:border-cyan-400 hover:text-cyan-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="hidden min-w-[34px] text-center font-mono text-[10px] font-bold text-gray-500 sm:block">
            {currentIndex + 1}/
            {MARKET_INTELLIGENCE_SYMBOLS.length}
          </span>

          <button
            type="button"
            onClick={() => cycleSymbol(1)}
            aria-label="Next Market Intelligence currency"
            className="flex h-8 w-8 items-center justify-center border border-gray-800 bg-black text-gray-300 transition hover:border-cyan-400 hover:text-cyan-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              void loadReport(selectedSymbol)
            }
            aria-label="Reload Market Intelligence"
            className="flex h-8 w-8 items-center justify-center border border-gray-800 bg-black text-gray-300 transition hover:border-yellow-400 hover:text-yellow-300"
          >
            <RefreshCw
              className={
                isLoading
                  ? "h-3.5 w-3.5 animate-spin"
                  : "h-3.5 w-3.5"
              }
            />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-3 flex min-h-[170px] items-center justify-center border border-gray-800 bg-black p-4">
          <p className="font-mono text-xs text-gray-500">
            Loading Market Intelligence...
          </p>
        </div>
      ) : message || !report ? (
        <div className="mt-3 flex min-h-[170px] items-center justify-center border border-gray-800 bg-black p-4 text-center">
          <p className="max-w-md text-xs leading-relaxed text-gray-400 sm:text-sm">
            {message ||
              "No saved Market Intelligence report is available yet."}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(selectedSymbol)}
          className="mt-3 block w-full border border-gray-800 bg-black p-3 text-left transition hover:border-cyan-400/60 hover:bg-[#0b0b0b] sm:p-4"
        >
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-500">
            Technical condition
          </p>

          <h3 className="mt-1 font-mono text-base font-black text-yellow-400 sm:text-lg">
            {report.market_condition_label ||
              "Market condition unavailable"}
          </h3>

          <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:gap-2">
            {[
              ["Price", "15 Days Overview", priceTrend],
              ["Open Interest", "15 Days Overview", oiTrend],
              ["Volume", "15 Days Overview", volumeTrend],
            ].map(([label, periodLabel, trend]) => {
              const trendValue =
                trend as ReturnType<
                  typeof formatTrend
                >;

              return (
                <div
                  key={String(label)}
                  className="min-w-0 border border-gray-800 bg-[#0b0b0b] px-1.5 py-2 sm:px-2"
                >
                  <p className="truncate font-mono text-[7px] uppercase tracking-[0.08em] text-gray-600 sm:text-[8px] sm:tracking-[0.1em]">
                    {String(label)}
                  </p>

                  <p className="mt-0.5 truncate font-mono text-[6px] uppercase tracking-[0.06em] text-cyan-500/70 sm:text-[7px]">
                    {String(periodLabel)}
                  </p>

                  <p
                    className={`mt-1 truncate font-mono text-[10px] font-bold sm:text-xs ${trendValue.className}`}
                  >
                    {trendValue.arrow}{" "}
                    {trendValue.label}
                  </p>
                </div>
              );
            })}

            <div className="min-w-0 border border-gray-800 bg-[#0b0b0b] px-1.5 py-2 sm:px-2">
              <p className="truncate font-mono text-[7px] uppercase tracking-[0.08em] text-gray-600 sm:text-[8px] sm:tracking-[0.1em]">
                COT Position
              </p>

              <p className="mt-0.5 truncate font-mono text-[6px] uppercase tracking-[0.06em] text-cyan-500/70 sm:text-[7px]">
                5 Weeks Overview
              </p>

              <p className="mt-1 truncate font-mono text-[10px] font-bold text-cyan-300 sm:text-xs">
                {formatRelationship(
                  report.cot_relationship,
                )}
              </p>
            </div>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-gray-300 sm:text-[13px]">
            {report.technical_meaning
              ? formatMarketIntelligenceCopy(report.technical_meaning)
              : "The current technical meaning is unavailable."}
          </p>

          {summaryLines.length > 0 ? (
            <div className="mt-2.5 space-y-1 border-t border-gray-800 pt-2.5">
              {summaryLines.map((line, index) => (
                <p
                  key={`${report.id}-summary-${index}`}
                  className="text-[11px] leading-relaxed text-gray-500 sm:text-xs"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-col gap-2 border-t border-gray-800 pt-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[8px] uppercase tracking-[0.1em] text-gray-600 sm:text-[9px]">
              <span>
                Market{" "}
                <span className="text-gray-400">
                  {formatDate(
                    report.price_as_of ||
                      report.oi_as_of ||
                      report.volume_as_of,
                  )}
                </span>
              </span>

              <span>
                COT{" "}
                <span className="text-gray-400">
                  {formatDate(report.cot_as_of)}
                </span>
              </span>
            </div>

            <span className="font-mono text-[10px] font-bold text-cyan-300 sm:text-xs">
              View Analysis →
            </span>
          </div>
        </button>
      )}

      <div className="mt-3 flex items-start gap-2 border-t border-gray-800 pt-3">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400/70" />

        <p className="text-[9px] leading-relaxed text-gray-600 sm:text-[10px]">
          <span className="font-mono font-bold uppercase tracking-[0.1em] text-gray-500">
            Context note ·{" "}
          </span>
          Latest completed market and reported positioning data for context, not a live trading bias or real-time signal.
        </p>
      </div>

      <p className="mt-2 text-center font-mono text-[8px] uppercase tracking-[0.12em] text-gray-700 sm:hidden">
        Swipe left or right to change market
      </p>
    </div>
  );
}
