"use client";

import { useMemo } from "react";
import {
  Activity,
  AlertCircle,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import CompactCycleSelect from "@/components/dashboard/CompactCycleSelect";
import { useDashboardPreferences } from "@/components/dashboard/DashboardPreferencesProvider";
import { useLiveCurrencyMomentum } from "@/components/technicals/useLiveCurrencyMomentum";
import type {
  MomentumRankingRow,
  MomentumTimeframe,
  MovementDirection,
} from "@/lib/currencyMomentum";

type MomentumCurrency =
  | "DXY"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CHF"
  | "CAD"
  | "AUD"
  | "NZD";

const currencies = [
  {
    value: "DXY" as const,
    label: "DXY / USD",
    shortLabel: "DXY",
    description: "Currency tracker: DXY / USD",
  },
  { value: "EUR" as const, label: "EUR", description: "Currency tracker: EUR" },
  { value: "GBP" as const, label: "GBP", description: "Currency tracker: GBP" },
  { value: "JPY" as const, label: "JPY", description: "Currency tracker: JPY" },
  { value: "CHF" as const, label: "CHF", description: "Currency tracker: CHF" },
  { value: "CAD" as const, label: "CAD", description: "Currency tracker: CAD" },
  { value: "AUD" as const, label: "AUD", description: "Currency tracker: AUD" },
  { value: "NZD" as const, label: "NZD", description: "Currency tracker: NZD" },
];

const timeframes = [
  { value: "M1" as const, label: "M1", description: "Timeframe: M1" },
  { value: "M5" as const, label: "M5", description: "Timeframe: M5" },
  { value: "M15" as const, label: "M15", description: "Timeframe: M15" },
  { value: "M30" as const, label: "M30", description: "Timeframe: M30" },
  { value: "H1" as const, label: "H1", description: "Timeframe: H1" },
  { value: "H4" as const, label: "H4", description: "Timeframe: H4" },
  { value: "D1" as const, label: "D1", description: "Timeframe: D1" },
  { value: "W1" as const, label: "W1", description: "Timeframe: W1" },
];

function formatSigned(value: number, decimalPlaces = 0) {
  const rounded = Number(value.toFixed(decimalPlaces));
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatDateTime(value: string) {
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

function statusClasses(status: MomentumRankingRow["status"]) {
  if (status === "Aligned") return "text-green-300";
  if (status === "Opposing") return "text-red-300";
  return "text-gray-400";
}

function movementClasses(movement: MovementDirection) {
  if (movement === "Up") return "text-green-300";
  if (movement === "Down") return "text-red-300";
  return "text-gray-400";
}

function connectionClasses(status: string) {
  if (status === "live") return "text-green-300";

  if (status === "connecting" || status === "reconnecting") {
    return "text-yellow-300";
  }

  return "text-red-300";
}

function connectionLabel(status: string) {
  if (status === "live") return "Live";
  if (status === "reconnecting") return "Reconnecting";
  if (status === "connecting") return "Connecting";
  return "Offline";
}

export default function MomentumStrengthDashboardWidget({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const { preferences, updateSection: updatePreferenceSection } =
    useDashboardPreferences();

  const currency = preferences.momentum.currency as MomentumCurrency;
  const timeframe = preferences.momentum.timeframe as MomentumTimeframe;
  const isDxy = currency === "DXY";

  const {
    benchmark,
    rankings,
    fetchedAt,
    directDxyFeed,
    connectionStatus,
    isLoading,
    errorMessage,
    refresh,
  } = useLiveCurrencyMomentum(timeframe, isDxy);

  function updateMomentumPreferences(
    patch: Partial<typeof preferences.momentum>,
  ) {
    void updatePreferenceSection("momentum", {
      ...preferences.momentum,
      ...patch,
    });
  }

  const topThree = useMemo(() => rankings.slice(0, 3), [rankings]);

  return (
    <section className="flex h-full flex-col border border-gray-800 bg-[#111111] p-4 shadow-[0_0_35px_rgba(34,211,238,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Technicals
          </p>

          <div className="mt-0.5 flex items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 text-cyan-300" />
            <h2 className="truncate font-mono text-base font-bold text-white">
              Momentum Strength
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          title="Open the full Momentum tracker"
          aria-label="Open the full Momentum tracker"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-gray-800 text-gray-400 transition hover:border-cyan-400 hover:text-cyan-300"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        <CompactCycleSelect<MomentumCurrency>
          label="Currency tracker"
          value={currency}
          options={currencies}
          onChange={(value) =>
            updateMomentumPreferences({ currency: value })}
          accent="cyan"
          compact
          hideLabel
          className="w-[106px] shrink-0"
        />

        <CompactCycleSelect<MomentumTimeframe>
          label="Timeframe"
          value={timeframe}
          options={timeframes}
          onChange={(value) =>
            updateMomentumPreferences({ timeframe: value })}
          accent="yellow"
          compact
          hideLabel
          disabled={!isDxy}
          className="w-[102px] shrink-0"
        />
      </div>

      <div className="mt-2 flex min-h-8 items-center justify-between gap-3 border-y border-gray-800 py-1.5">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-gray-500">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          {fetchedAt
            ? `Tick ${formatDateTime(fetchedAt)}`
            : "Loading live Momentum"}
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
            disabled={!isDxy || isLoading}
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
        {!isDxy ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
            <Activity className="h-6 w-6 text-gray-700" />
            <p className="mt-2 font-mono text-xs font-bold text-white">
              {currency} Momentum is coming later
            </p>
          </div>
        ) : isLoading && !benchmark ? (
          <div className="flex flex-1 items-center justify-center">
            <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" />
          </div>
        ) : errorMessage && !benchmark ? (
          <div className="m-2 flex items-start gap-2 border border-red-500/20 bg-red-500/5 p-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
            <p className="text-[10px] leading-relaxed text-red-200/80">
              {errorMessage}
            </p>
          </div>
        ) : benchmark ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-gray-800 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-mono text-xs font-black text-white">
                    DXY · five candles
                  </p>

                  <span
                    title={
                      directDxyFeed
                        ? "Direct BiQuote DXY index"
                        : "Calculated six-component fallback"
                    }
                    className="border border-cyan-400/25 bg-cyan-400/5 px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-cyan-300"
                  >
                    {directDxyFeed ? "Direct" : "Fallback"}
                  </span>
                </div>

                <p
                  className={`mt-0.5 font-mono text-[10px] font-bold ${movementClasses(
                    benchmark.movement,
                  )}`}
                >
                  {benchmark.movement} · {timeframe}
                </p>
              </div>

              <p
                className={`font-mono text-[10px] font-black ${movementClasses(
                  benchmark.movement,
                )}`}
              >
                {formatSigned(benchmark.pointMovement, 1)} pts
              </p>

              <p className="font-mono text-[10px] text-gray-500">
                {formatSigned(benchmark.benchmarkPoints)}
              </p>
            </div>

            <div className="divide-y divide-gray-800">
              {topThree.map((row) => (
                <div
                  key={row.pair}
                  className="grid grid-cols-[22px_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2"
                >
                  <span className="flex h-5 w-5 items-center justify-center bg-cyan-400 font-mono text-[9px] font-black text-black">
                    {row.rank}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] font-black text-white">
                      {row.pair} · {row.movement}
                    </p>
                    <p
                      className={`truncate text-[9px] font-semibold ${statusClasses(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </p>
                  </div>

                  <p
                    className={`font-mono text-[10px] font-black ${statusClasses(
                      row.status,
                    )}`}
                  >
                    {formatSigned(row.score)}
                  </p>

                  <p
                    className={`font-mono text-[9px] ${movementClasses(
                      row.movement,
                    )}`}
                  >
                    {formatSigned(row.pointMovement, 1)} pts
                  </p>
                </div>
              ))}
            </div>

            {errorMessage ? (
              <div className="flex items-start gap-2 border-t border-red-500/20 bg-red-500/5 p-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
                <p className="text-[9px] leading-relaxed text-red-200/70">
                  {errorMessage}. Last successful ranking remains visible.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
            <Radio className="h-6 w-6 text-gray-700" />
            <p className="mt-2 font-mono text-xs font-bold text-white">
              Connecting to BiQuote
            </p>
            <p className="mt-1 text-[10px] text-gray-600">
              History and live ticks load automatically.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}