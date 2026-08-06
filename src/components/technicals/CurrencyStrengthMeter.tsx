"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  BarChart3,
  Clock3,
  Database,
  Gauge,
  Grid3X3,
  LoaderCircle,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  CURRENCY_STRENGTH_TIMEFRAMES,
  type CurrencyStrengthReading,
  type CurrencyStrengthTimeframe,
} from "@/lib/currencyStrength";
import {
  useLiveCurrencyStrength,
  type LiveStrengthConnectionStatus,
} from "@/components/technicals/useLiveCurrencyStrength";

type ViewMode = "analog" | "digital" | "ranking";
type OutputMode = "percentage" | "raw";
type SortOrder = "strongest" | "weakest";

const timeframes = [
  ...CURRENCY_STRENGTH_TIMEFRAMES,
] as CurrencyStrengthTimeframe[];

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
) => Math.min(Math.max(value, minimum), maximum);

function pointOnCircle(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
) {
  const angleRadians =
    (angleDegrees * Math.PI) / 180;

  return {
    x:
      centerX +
      radius * Math.cos(angleRadians),
    y:
      centerY +
      radius * Math.sin(angleRadians),
  };
}

function describeArcSegment(index: number) {
  const centerX = 90;
  const centerY = 84;
  const radius = 62;
  const segmentSize = 18;
  const gap = 1.7;
  const startAngle =
    180 + index * segmentSize + gap;
  const endAngle =
    180 + (index + 1) * segmentSize - gap;
  const start = pointOnCircle(
    centerX,
    centerY,
    radius,
    startAngle,
  );
  const end = pointOnCircle(
    centerX,
    centerY,
    radius,
    endAngle,
  );

  return [
    "M",
    start.x.toFixed(2),
    start.y.toFixed(2),
    "A",
    radius,
    radius,
    0,
    0,
    1,
    end.x.toFixed(2),
    end.y.toFixed(2),
  ].join(" ");
}

function formatValue(
  reading: CurrencyStrengthReading,
  outputMode: OutputMode,
) {
  if (outputMode === "percentage") {
    return `${reading.percentage.toFixed(2)}%`;
  }

  return `${
    reading.rawScore >= 0 ? "+" : ""
  }${reading.rawScore.toFixed(2)}`;
}

function formatDateTime(
  value: string | null,
) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function connectionLabel(
  status: LiveStrengthConnectionStatus,
) {
  if (status === "live") {
    return "Live";
  }

  if (status === "reconnecting") {
    return "Reconnecting";
  }

  if (status === "connecting") {
    return "Connecting";
  }

  return "Offline";
}

function connectionClasses(
  status: LiveStrengthConnectionStatus,
) {
  if (status === "live") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  }

  if (
    status === "connecting" ||
    status === "reconnecting"
  ) {
    return "border-amber-400/30 bg-amber-500/10 text-amber-300";
  }

  return "border-rose-400/30 bg-rose-500/10 text-rose-300";
}

function OutputSwitch({
  outputMode,
  onChange,
}: {
  outputMode: OutputMode;
  onChange: (mode: OutputMode) => void;
}) {
  const isRaw = outputMode === "raw";

  return (
    <div className="group relative inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2">
      <span
        className={[
          "text-xs font-semibold transition",
          !isRaw
            ? "text-violet-300"
            : "text-slate-500",
        ].join(" ")}
      >
        %
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={isRaw}
        aria-label={
          isRaw
            ? "Raw score is active. Switch to percentage."
            : "Percentage is active. Switch to raw score."
        }
        title="Switch between percentage and raw score"
        onClick={() =>
          onChange(
            isRaw ? "percentage" : "raw",
          )
        }
        className="relative h-6 w-11 shrink-0 rounded-full border border-violet-400/60 bg-violet-500/20 transition"
      >
        <span
          className={[
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-violet-300 shadow-sm transition-transform duration-200",
            isRaw
              ? "translate-x-5"
              : "translate-x-0",
          ].join(" ")}
        />
      </button>

      <span
        className={[
          "text-xs font-semibold transition",
          isRaw
            ? "text-violet-300"
            : "text-slate-500",
        ].join(" ")}
      >
        Raw
      </span>
    </div>
  );
}

function AnalogGauge({
  reading,
  outputMode,
}: {
  reading: CurrencyStrengthReading;
  outputMode: OutputMode;
}) {
  const needleAngle =
    180 + reading.percentage * 1.8;
  const needleEnd = pointOnCircle(
    90,
    84,
    47,
    needleAngle,
  );
  const activeSegments = Math.ceil(
    reading.percentage / 10,
  );

  return (
    <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">
            {reading.rank}
          </span>
          <span className="truncate text-base font-bold text-white">
            {reading.currency}
          </span>
        </div>

        <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300">
          {formatValue(reading, outputMode)}
        </span>
      </div>

      <svg
        viewBox="0 0 180 102"
        className="mt-1 h-auto w-full"
        role="img"
        aria-label={`${reading.currency} strength ${formatValue(
          reading,
          outputMode,
        )}`}
      >
        {Array.from(
          { length: 10 },
          (_, index) => (
            <path
              key={index}
              d={describeArcSegment(index)}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              className={
                index < activeSegments
                  ? "text-violet-400"
                  : "text-slate-800"
              }
            />
          ),
        )}

        <line
          x1="90"
          y1="84"
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="text-white"
        />

        <circle
          cx="90"
          cy="84"
          r="6"
          fill="currentColor"
          className="text-violet-400"
        />

        <text
          x="15"
          y="100"
          className="fill-slate-500 text-[8px]"
        >
          {outputMode === "percentage"
            ? "0%"
            : "-"}
        </text>

        <text
          x="90"
          y="100"
          textAnchor="middle"
          className="fill-slate-500 text-[8px]"
        >
          {outputMode === "percentage"
            ? "50%"
            : "0.00"}
        </text>

        <text
          x="165"
          y="100"
          textAnchor="end"
          className="fill-slate-500 text-[8px]"
        >
          {outputMode === "percentage"
            ? "100%"
            : "+"}
        </text>
      </svg>

      <div
        className="grid grid-cols-10 gap-1"
        aria-hidden="true"
      >
        {Array.from(
          { length: 10 },
          (_, index) => (
            <span
              key={index}
              className={[
                "h-1 rounded-full",
                index < activeSegments
                  ? "bg-violet-400"
                  : "bg-slate-800",
              ].join(" ")}
            />
          ),
        )}
      </div>
    </article>
  );
}

function DigitalMeter({
  reading,
  outputMode,
}: {
  reading: CurrencyStrengthReading;
  outputMode: OutputMode;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">
            {reading.rank}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-400">
              {reading.currency}
            </p>
            <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-white">
              {formatValue(
                reading,
                outputMode,
              )}
            </p>
          </div>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
          <BarChart3 className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-10 gap-1">
        {Array.from(
          { length: 10 },
          (_, index) => {
            const segmentStart = index * 10;
            const fillPercentage = clamp(
              (reading.percentage -
                segmentStart) *
                10,
              0,
              100,
            );

            return (
              <div
                key={index}
                className="h-2.5 overflow-hidden rounded-full bg-slate-800"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-violet-400"
                  style={{
                    width: `${fillPercentage}%`,
                  }}
                />
              </div>
            );
          },
        )}
      </div>
    </article>
  );
}

export default function CurrencyStrengthMeter() {
  const [timeframe, setTimeframe] =
    useState<CurrencyStrengthTimeframe>("H1");
  const [viewMode, setViewMode] =
    useState<ViewMode>("analog");
  const [outputMode, setOutputMode] =
    useState<OutputMode>("percentage");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("strongest");

  const {
    readings: liveReadings,
    fetchedAt,
    latestCandleAt,
    provider,
    lookbackCandles,
    volatilityWindow,
    requestedPairCount,
    usedPairCount,
    isComplete,
    connectionStatus,
    isLoading,
    errorMessage,
    refresh,
  } = useLiveCurrencyStrength(timeframe);

  const readings = useMemo(() => {
    return [...liveReadings].sort(
      (first, second) =>
        sortOrder === "strongest"
          ? second.rawScore - first.rawScore
          : first.rawScore - second.rawScore,
    );
  }, [liveReadings, sortOrder]);

  const hasData = readings.length > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">
                Currency Strength Controls
              </p>

              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold",
                  connectionClasses(
                    connectionStatus,
                  ),
                ].join(" ")}
              >
                {connectionStatus === "live" ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                {connectionLabel(connectionStatus)}
              </span>

              <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300">
                {usedPairCount}/{requestedPairCount} pairs
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setSortOrder((current) =>
                    current === "strongest"
                      ? "weakest"
                      : "strongest",
                  )
                }
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600"
              >
                <ArrowDownUp className="h-4 w-4" />
                {sortOrder === "strongest"
                  ? "Strongest first"
                  : "Weakest first"}
              </button>

              <button
                type="button"
                onClick={() => void refresh()}
                disabled={isLoading}
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600"
              >
                {isLoading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Reload history
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {timeframes.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTimeframe(item)}
                className={[
                  "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                  timeframe === item
                    ? "border-violet-400/70 bg-violet-500/15 text-violet-200"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {
                value: "analog" as ViewMode,
                label: "Analog",
                icon: Gauge,
              },
              {
                value: "digital" as ViewMode,
                label: "Digital",
                icon: Grid3X3,
              },
              {
                value: "ranking" as ViewMode,
                label: "Ranking",
                icon: BarChart3,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setViewMode(item.value)
                  }
                  className={[
                    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition",
                    viewMode === item.value
                      ? "border-violet-400/70 bg-violet-500/15 text-violet-200"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800/90 bg-slate-950/65 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Provider
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {provider}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Strength window
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {lookbackCandles} candles
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Normalization
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {volatilityWindow}-candle volatility
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Latest tick
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatDateTime(fetchedAt)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5">
            <Database className="h-3.5 w-3.5 text-emerald-300" />
            All 28 direct FX pairs
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5">
            <Clock3 className="h-3.5 w-3.5 text-violet-300" />
            Current {timeframe} candle: {formatDateTime(
              latestCandleAt,
            )}
          </span>

          <span
            className={[
              "rounded-full border px-2.5 py-1.5",
              isComplete
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-400/30 bg-amber-500/10 text-amber-300",
            ].join(" ")}
          >
            {isComplete
              ? "Complete live calculation"
              : "Waiting for all pairs"}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {timeframe} live comparison
            </p>
            <p className="text-xs text-slate-500">
              All eight currencies are recalculated as BiQuote ticks arrive.
            </p>
          </div>

          <OutputSwitch
            outputMode={outputMode}
            onChange={setOutputMode}
          />
        </div>

        {isLoading && !hasData ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 text-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-violet-300" />
            <p className="text-sm font-semibold text-slate-300">
              Loading BiQuote Currency Strength…
            </p>
          </div>
        ) : null}

        {!isLoading && errorMessage && !hasData ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-rose-400/20 bg-rose-500/5 px-4 text-center">
            <AlertCircle className="h-6 w-6 text-rose-300" />
            <div>
              <p className="text-sm font-semibold text-rose-200">
                Currency Strength could not be loaded.
              </p>
              <p className="mt-1 text-xs text-rose-300/80">
                {errorMessage}
              </p>
            </div>
          </div>
        ) : null}

        {!isLoading && !errorMessage && !hasData ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 text-center">
            <Radio className="h-6 w-6 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-300">
                Connecting to BiQuote
              </p>
              <p className="mt-1 text-xs text-slate-500">
                History and live ticks load automatically.
              </p>
            </div>
          </div>
        ) : null}

        {hasData && viewMode === "analog" ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {readings.map((reading) => (
              <AnalogGauge
                key={reading.currency}
                reading={reading}
                outputMode={outputMode}
              />
            ))}
          </div>
        ) : null}

        {hasData && viewMode === "digital" ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {readings.map((reading) => (
              <DigitalMeter
                key={reading.currency}
                reading={reading}
                outputMode={outputMode}
              />
            ))}
          </div>
        ) : null}

        {hasData && viewMode === "ranking" ? (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/70 text-left">
                    <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Rank
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Currency
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      {outputMode === "percentage"
                        ? "Percentage"
                        : "Raw score"}
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Meter
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {readings.map((reading) => (
                    <tr
                      key={reading.currency}
                      className="border-b border-slate-900 last:border-b-0"
                    >
                      <td className="px-3 py-2.5 text-sm font-semibold text-slate-400">
                        {reading.rank}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-bold text-white">
                        {reading.currency}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-semibold text-violet-300">
                        {formatValue(
                          reading,
                          outputMode,
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-violet-400"
                              style={{
                                width: `${reading.percentage}%`,
                              }}
                            />
                          </div>
                          <span className="w-12 text-right text-[11px] text-slate-500">
                            {reading.percentage.toFixed(
                              2,
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {hasData && errorMessage ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/5 px-3 py-2.5 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {errorMessage}. The last successful live calculation remains visible.
            </span>
          </div>
        ) : null}
      </section>
    </div>
  );
}