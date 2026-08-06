"use client";

import { useMemo } from "react";
import {
  AlertCircle,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BarChart3,
  Clock3,
  ExternalLink,
  Gauge,
  Hash,
  List,
  LoaderCircle,
  Percent,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import CompactCycleSelect from "@/components/dashboard/CompactCycleSelect";
import { useDashboardPreferences } from "@/components/dashboard/DashboardPreferencesProvider";
import { useLiveCurrencyStrength } from "@/components/technicals/useLiveCurrencyStrength";
import type {
  CurrencyStrengthReading,
  CurrencyStrengthTimeframe,
} from "@/lib/currencyStrength";

type SortOrder = "strongest" | "weakest";
type OutputMode = "percentage" | "raw";
type ViewMode = "analog" | "digital";

const timeframes = [
  "M1",
  "M5",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
  "W1",
] as const satisfies readonly CurrencyStrengthTimeframe[];

const timeframeOptions = timeframes.map((timeframe) => ({
  value: timeframe,
  label: timeframe,
  shortLabel: timeframe,
  description: `Timeframe: ${timeframe}`,
}));

const viewOptions = [
  {
    value: "analog" as const,
    label: "Analog display",
    shortLabel: "",
    description: "Analog strength display",
    icon: <Gauge className="h-4 w-4" />,
  },
  {
    value: "digital" as const,
    label: "Digital display",
    shortLabel: "",
    description: "Digital strength display",
    icon: <List className="h-4 w-4" />,
  },
];

const sortOptions = [
  {
    value: "strongest" as const,
    label: "Strongest first",
    shortLabel: "",
    description: "Sort strongest to weakest",
    icon: <ArrowDownWideNarrow className="h-4 w-4" />,
  },
  {
    value: "weakest" as const,
    label: "Weakest first",
    shortLabel: "",
    description: "Sort weakest to strongest",
    icon: <ArrowUpNarrowWide className="h-4 w-4" />,
  },
];

const outputOptions = [
  {
    value: "percentage" as const,
    label: "Percentage values",
    shortLabel: "",
    description: "Show percentage values",
    icon: <Percent className="h-4 w-4" />,
  },
  {
    value: "raw" as const,
    label: "Raw values",
    shortLabel: "",
    description: "Show raw strength values",
    icon: <Hash className="h-4 w-4" />,
  },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Loading live data";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function connectionLabel(status: string) {
  if (status === "live") return "Live";
  if (status === "reconnecting") return "Reconnecting";
  if (status === "connecting") return "Connecting";
  return "Offline";
}

function connectionClasses(status: string) {
  if (status === "live") return "text-green-300";

  if (status === "connecting" || status === "reconnecting") {
    return "text-yellow-300";
  }

  return "text-red-300";
}

function formatReading(
  reading: CurrencyStrengthReading,
  outputMode: OutputMode,
) {
  if (outputMode === "percentage") {
    return `${reading.percentage.toFixed(2)}%`;
  }

  return `${reading.rawScore >= 0 ? "+" : ""}${reading.rawScore.toFixed(2)}`;
}

export default function CurrencyStrengthDashboardWidget({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const { preferences, updateSection: updatePreferenceSection } =
    useDashboardPreferences();

  const timeframe =
    preferences.currencyStrength.timeframe as CurrencyStrengthTimeframe;
  const sortOrder = preferences.currencyStrength.sort as SortOrder;
  const outputMode = preferences.currencyStrength.output as OutputMode;
  const viewMode = preferences.currencyStrength.view as ViewMode;

  const {
    readings,
    fetchedAt,
    latestCandleAt,
    provider,
    usedPairCount,
    requestedPairCount,
    connectionStatus,
    isLoading,
    errorMessage,
    refresh,
  } = useLiveCurrencyStrength(timeframe);

  function updateCurrencyStrengthPreferences(
    patch: Partial<typeof preferences.currencyStrength>,
  ) {
    void updatePreferenceSection("currencyStrength", {
      ...preferences.currencyStrength,
      ...patch,
    });
  }

  const sortedReadings = useMemo(() => {
    return [...readings].sort((first, second) =>
      sortOrder === "strongest"
        ? second.rawScore - first.rawScore
        : first.rawScore - second.rawScore,
    );
  }, [readings, sortOrder]);

  const rawRange = useMemo(() => {
    if (readings.length === 0) {
      return { minimum: -1, maximum: 1 };
    }

    const values = readings.map((reading) => reading.rawScore);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    if (minimum === maximum) {
      return {
        minimum: minimum - 1,
        maximum: maximum + 1,
      };
    }

    return { minimum, maximum };
  }, [readings]);

  function getReadingPosition(reading: CurrencyStrengthReading) {
    if (outputMode === "percentage") {
      return clamp(reading.percentage, 0, 100);
    }

    const range = rawRange.maximum - rawRange.minimum;

    if (range <= 0) {
      return 50;
    }

    return clamp(
      ((reading.rawScore - rawRange.minimum) / range) * 100,
      0,
      100,
    );
  }

  const hasReadings = sortedReadings.length > 0;

  return (
    <section className="flex h-full flex-col border border-gray-800 bg-[#111111] p-4 shadow-[0_0_35px_rgba(34,211,238,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Technicals
          </p>

          <div className="mt-0.5 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 shrink-0 text-yellow-400" />
            <h2 className="truncate font-mono text-base font-bold text-white">
              Currency Strength
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          title="Open the full Currency Strength meter"
          aria-label="Open the full Currency Strength meter"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-gray-800 text-gray-400 transition hover:border-yellow-400 hover:text-yellow-300"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        <CompactCycleSelect<CurrencyStrengthTimeframe>
          label="Timeframe"
          value={timeframe}
          options={timeframeOptions}
          onChange={(value) =>
            updateCurrencyStrengthPreferences({ timeframe: value })
          }
          accent="yellow"
          compact
          hideLabel
          className="w-[102px] shrink-0"
        />

        <CompactCycleSelect<ViewMode>
          label="Display"
          value={viewMode}
          options={viewOptions}
          onChange={(value) =>
            updateCurrencyStrengthPreferences({ view: value })
          }
          accent="cyan"
          compact
          hideLabel
          className="w-[82px] shrink-0"
        />

        <CompactCycleSelect<SortOrder>
          label="Order"
          value={sortOrder}
          options={sortOptions}
          onChange={(value) =>
            updateCurrencyStrengthPreferences({ sort: value })
          }
          accent="cyan"
          compact
          hideLabel
          className="w-[82px] shrink-0"
        />

        <CompactCycleSelect<OutputMode>
          label="Values"
          value={outputMode}
          options={outputOptions}
          onChange={(value) =>
            updateCurrencyStrengthPreferences({ output: value })
          }
          accent="yellow"
          compact
          hideLabel
          className="w-[82px] shrink-0"
        />
      </div>

      <div className="mt-2 flex min-h-8 items-center justify-between gap-3 border-y border-gray-800 py-1.5">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-gray-500">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          {fetchedAt
            ? `Tick ${formatDateTime(fetchedAt)}`
            : "Loading live Currency Strength"}
        </p>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 font-mono text-[9px] font-bold uppercase ${connectionClasses(
              connectionStatus,
            )}`}
          >
            {connectionStatus === "live" ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {connectionLabel(connectionStatus)}
          </span>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            title="Reload BiQuote OHLC history"
            aria-label="Reload BiQuote OHLC history"
            className="flex h-7 w-7 shrink-0 items-center justify-center bg-cyan-400 text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-600"
          >
            {isLoading ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-2 flex min-h-[170px] flex-1 flex-col border border-gray-800 bg-black">
        {isLoading && !hasReadings ? (
          <div className="flex flex-1 items-center justify-center">
            <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" />
          </div>
        ) : errorMessage && !hasReadings ? (
          <div className="m-2 flex items-start gap-2 border border-red-500/20 bg-red-500/5 p-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
            <p className="text-[10px] leading-relaxed text-red-200/80">
              {errorMessage}
            </p>
          </div>
        ) : hasReadings && viewMode === "analog" ? (
          <div className="grid flex-1 grid-cols-4 gap-1.5 p-2">
            {sortedReadings.map((reading, index) => {
              const position = getReadingPosition(reading);

              return (
                <div
                  key={reading.currency}
                  className="min-w-0 border border-gray-800 bg-[#080808] p-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-mono text-[10px] font-black text-white">
                      {index + 1}. {reading.currency}
                    </span>
                    <span className="truncate font-mono text-[9px] font-bold text-yellow-300">
                      {formatReading(reading, outputMode)}
                    </span>
                  </div>

                  <div className="relative mt-2 h-1.5 bg-gray-900">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-gray-700" />
                    <div
                      className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 bg-cyan-300"
                      style={{ left: `${position}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : hasReadings ? (
          <div className="grid flex-1 grid-cols-4 gap-1.5 p-2">
            {sortedReadings.map((reading, index) => (
              <div
                key={reading.currency}
                className="min-w-0 border border-gray-800 bg-[#080808] p-2"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[9px] text-gray-600">
                    {index + 1}
                  </span>
                  <span className="truncate font-mono text-[11px] font-black text-white">
                    {reading.currency}
                  </span>
                  <span className="truncate text-right font-mono text-[9px] font-bold text-yellow-300">
                    {formatReading(reading, outputMode)}
                  </span>
                </div>

                <div className="mt-1.5 h-1 overflow-hidden bg-gray-900">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${getReadingPosition(reading)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-4 text-center">
            <div>
              <BarChart3 className="mx-auto h-6 w-6 text-gray-700" />
              <p className="mt-2 font-mono text-xs font-bold text-white">
                No live Currency Strength result
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[9px] text-gray-600">
        <span className="truncate">
          {provider || "BiQuote MT5"} · {usedPairCount}/{requestedPairCount} pairs
        </span>
        <span className="shrink-0">
          Candle {formatDateTime(latestCandleAt)}
        </span>
      </div>

      {errorMessage && hasReadings ? (
        <div className="mt-2 flex items-start gap-2 border border-yellow-400/20 bg-yellow-400/5 px-2 py-1.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-300" />
          <p className="text-[10px] leading-relaxed text-yellow-200/80">
            {errorMessage}
          </p>
        </div>
      ) : null}
    </section>
  );
}