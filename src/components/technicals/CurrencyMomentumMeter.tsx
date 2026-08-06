"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  LoaderCircle,
  Radio,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import CompactCycleSelect from "@/components/dashboard/CompactCycleSelect";
import { useLiveCurrencyMomentum } from "@/components/technicals/useLiveCurrencyMomentum";
import type {
  MomentumBenchmarkRow,
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

const currencies: {
  value: MomentumCurrency;
  label: string;
}[] = [
  { value: "DXY", label: "DXY / USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "JPY", label: "JPY" },
  { value: "CHF", label: "CHF" },
  { value: "CAD", label: "CAD" },
  { value: "AUD", label: "AUD" },
  { value: "NZD", label: "NZD" },
];

const timeframes: {
  value: MomentumTimeframe;
  label: string;
}[] = [
  { value: "M1", label: "M1" },
  { value: "M5", label: "M5" },
  { value: "M15", label: "M15" },
  { value: "M30", label: "M30" },
  { value: "H1", label: "H1" },
  { value: "H4", label: "H4" },
  { value: "D1", label: "D1" },
  { value: "W1", label: "W1" },
];

const preferenceKey =
  "edgevault_currency_momentum_preferences_v3";

function formatSigned(
  value: number,
  decimalPlaces = 1,
) {
  const rounded = Number(
    value.toFixed(decimalPlaces),
  );
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(4)}%`;
}

function formatDateTime(value: string) {
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function formatPrice(
  pair: string,
  value: number,
) {
  if (
    pair === "DXY" ||
    pair.endsWith("JPY")
  ) {
    return value.toFixed(3);
  }

  return value.toFixed(5);
}

function statusClasses(status: string) {
  if (status === "Aligned") {
    return "border-green-400/30 bg-green-400/10 text-green-300";
  }

  if (status === "Opposing") {
    return "border-red-400/30 bg-red-400/10 text-red-300";
  }

  if (status === "Reference") {
    return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  }

  return "border-gray-700 bg-gray-900 text-gray-400";
}

function moveClasses(value: number) {
  if (value > 0) {
    return "text-green-300";
  }

  if (value < 0) {
    return "text-red-300";
  }

  return "text-gray-400";
}

function movementClasses(
  movement: MovementDirection,
) {
  if (movement === "Up") {
    return "text-green-300";
  }

  if (movement === "Down") {
    return "text-red-300";
  }

  return "text-gray-400";
}

function connectionClasses(status: string) {
  if (status === "live") {
    return "border-green-400/30 bg-green-400/10 text-green-300";
  }

  if (
    status === "connecting" ||
    status === "reconnecting"
  ) {
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  }

  return "border-red-400/30 bg-red-400/10 text-red-300";
}

function connectionLabel(status: string) {
  if (status === "live") {
    return "Live ticks";
  }

  if (status === "reconnecting") {
    return "Reconnecting";
  }

  if (status === "connecting") {
    return "Connecting";
  }

  return "Offline";
}

function BenchmarkMobileCard({
  row,
}: {
  row: MomentumBenchmarkRow;
}) {
  return (
    <article className="border border-cyan-400/25 bg-cyan-400/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">
            Reference
          </p>

          <p className="mt-1 font-mono text-lg font-black text-white">
            DXY
          </p>

          <p
            className={`mt-1 text-xs font-semibold ${movementClasses(
              row.movement,
            )}`}
          >
            Five-candle movement{" "}
            {row.movement.toLowerCase()}
          </p>
        </div>

        <span
          className={`border px-2 py-1 font-mono text-[10px] font-bold uppercase ${statusClasses(
            "Reference",
          )}`}
        >
          Benchmark
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="border border-gray-800 bg-black p-3">
          <p className="text-xs text-gray-500">
            Point movement
          </p>
          <p
            className={`mt-1 font-mono font-bold ${moveClasses(
              row.pointMovement,
            )}`}
          >
            {formatSigned(row.pointMovement)} pts
          </p>
        </div>

        <div className="border border-gray-800 bg-black p-3">
          <p className="text-xs text-gray-500">
            Move
          </p>
          <p
            className={`mt-1 font-mono font-bold ${moveClasses(
              row.movePercent,
            )}`}
          >
            {formatPercent(row.movePercent)}
          </p>
        </div>

        <div className="border border-gray-800 bg-black p-3">
          <p className="text-xs text-gray-500">
            Start
          </p>
          <p className="mt-1 font-mono font-bold text-white">
            {formatPrice("DXY", row.startPrice)}
          </p>
        </div>

        <div className="border border-gray-800 bg-black p-3">
          <p className="text-xs text-gray-500">
            Current
          </p>
          <p className="mt-1 font-mono font-bold text-white">
            {formatPrice("DXY", row.currentPrice)}
          </p>
        </div>
      </div>
    </article>
  );
}

function RankingMobileCard({
  row,
}: {
  row: MomentumRankingRow;
}) {
  return (
    <article className="border border-gray-800 bg-black p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-cyan-400 font-mono text-sm font-black text-black">
            {row.rank}
          </span>

          <div className="min-w-0">
            <p className="truncate font-mono text-lg font-black text-white">
              {row.pair}
            </p>
            <p
              className={`mt-1 text-xs font-semibold ${movementClasses(
                row.movement,
              )}`}
            >
              Price moving{" "}
              {row.movement.toLowerCase()}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 border px-2 py-1 font-mono text-[10px] font-bold uppercase ${statusClasses(
            row.status,
          )}`}
        >
          {row.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="border border-gray-800 bg-[#0a0a0a] p-3">
          <p className="text-xs text-gray-500">
            Raw point movement
          </p>
          <p
            className={`mt-1 font-mono font-bold ${moveClasses(
              row.pointMovement,
            )}`}
          >
            {formatSigned(row.pointMovement)} pts
          </p>
        </div>

        <div className="border border-gray-800 bg-[#0a0a0a] p-3">
          <p className="text-xs text-gray-500">
            Momentum score
          </p>
          <p
            className={`mt-1 font-mono font-bold ${moveClasses(
              row.score,
            )}`}
          >
            {formatSigned(row.score, 0)} pts
          </p>
        </div>

        <div className="border border-gray-800 bg-[#0a0a0a] p-3">
          <p className="text-xs text-gray-500">
            Raw move
          </p>
          <p
            className={`mt-1 font-mono font-bold ${moveClasses(
              row.movePercent,
            )}`}
          >
            {formatPercent(row.movePercent)}
          </p>
        </div>

        <div className="border border-gray-800 bg-[#0a0a0a] p-3">
          <p className="text-xs text-gray-500">
            Current price
          </p>
          <p className="mt-1 font-mono font-bold text-white">
            {formatPrice(
              row.pair,
              row.currentPrice,
            )}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function CurrencyMomentumMeter() {
  const [currency, setCurrency] =
    useState<MomentumCurrency>("DXY");
  const [timeframe, setTimeframe] =
    useState<MomentumTimeframe>("H1");
  const [hasLoadedPreferences, setHasLoadedPreferences] =
    useState(false);

  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem(
          preferenceKey,
        );

      if (stored) {
        const parsed = JSON.parse(stored) as {
          currency?: MomentumCurrency;
          timeframe?: MomentumTimeframe;
        };

        if (
          currencies.some(
            (item) =>
              item.value === parsed.currency,
          )
        ) {
          setCurrency(
            parsed.currency as MomentumCurrency,
          );
        }

        if (
          timeframes.some(
            (item) =>
              item.value === parsed.timeframe,
          )
        ) {
          setTimeframe(
            parsed.timeframe as MomentumTimeframe,
          );
        }
      }
    } catch (error) {
      console.error(
        "LOAD CURRENCY MOMENTUM PREFERENCES ERROR:",
        error,
      );
    } finally {
      setHasLoadedPreferences(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedPreferences) {
      return;
    }

    window.localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        currency,
        timeframe,
      }),
    );
  }, [
    currency,
    timeframe,
    hasLoadedPreferences,
  ]);

  const isDxy = currency === "DXY";

  const {
    benchmark,
    rankings,
    fetchedAt,
    method,
    provider,
    benchmarkSource,
    directDxyFeed,
    connectionStatus,
    isLoading,
    errorMessage,
    refresh,
  } = useLiveCurrencyMomentum(
    timeframe,
    isDxy && hasLoadedPreferences,
  );

  const alignedCount = useMemo(
    () =>
      rankings.filter(
        (row) => row.status === "Aligned",
      ).length,
    [rankings],
  );

  if (!isDxy) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <CompactCycleSelect<MomentumCurrency>
            label="Currency tracker"
            value={currency}
            options={currencies}
            onChange={setCurrency}
            accent="cyan"
          />

          <CompactCycleSelect<MomentumTimeframe>
            label="Timeframe"
            value={timeframe}
            options={timeframes}
            onChange={setTimeframe}
            accent="yellow"
            disabled
          />
        </div>

        <div className="border border-dashed border-gray-700 bg-black p-8 text-center">
          <Activity className="mx-auto h-10 w-10 text-gray-600" />
          <p className="mt-4 font-mono text-lg font-bold text-white">
            {currency} Momentum is coming later
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
            The DXY / USD tracker is the
            active tracker. This template is
            reserved so other currency trackers
            can be activated later without
            redesigning the workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <CompactCycleSelect<MomentumCurrency>
          label="Currency tracker"
          value={currency}
          options={currencies}
          onChange={setCurrency}
          accent="cyan"
        />

        <CompactCycleSelect<MomentumTimeframe>
          label="Timeframe"
          value={timeframe}
          options={timeframes}
          onChange={setTimeframe}
          accent="yellow"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="border border-cyan-400/20 bg-cyan-400/5 p-4">
          <div className="flex items-start gap-3">
            <Radio className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-cyan-200">
                  BiQuote live Momentum
                </p>

                <span
                  className={`border px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${connectionClasses(
                    connectionStatus,
                  )}`}
                >
                  {connectionLabel(
                    connectionStatus,
                  )}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                EdgeVault automatically loads
                direct DXY and the seven ranked
                USD pairs. The current unfinished{" "}
                {timeframe} candle updates from
                live BiQuote ticks, while the
                previous four candles form the
                comparison window and 200
                completed candles provide
                normalization.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          title="Reload BiQuote OHLC history"
          className="inline-flex min-h-12 items-center justify-center gap-2 border border-cyan-400/40 bg-cyan-400/10 px-5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh history
        </button>
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              Momentum data could not fully load
            </p>
            <p className="mt-1 leading-relaxed text-red-200/80">
              {errorMessage}
            </p>
            {benchmark ? (
              <p className="mt-1 text-xs text-red-200/60">
                The last successful ranking remains
                visible.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isLoading && !benchmark ? (
        <div className="flex min-h-72 items-center justify-center border border-gray-800 bg-black">
          <div className="text-center">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
            <p className="mt-3 font-mono text-sm text-gray-400">
              Loading direct DXY and eight
              supporting FX series…
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading &&
      !errorMessage &&
      !benchmark ? (
        <div className="flex min-h-72 items-center justify-center border border-dashed border-gray-700 bg-black p-8 text-center">
          <div className="max-w-xl">
            <Database className="mx-auto h-9 w-9 text-gray-600" />
            <p className="mt-4 font-mono text-lg font-bold text-white">
              Connecting to BiQuote
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              OHLC history loads automatically,
              followed by live tick streaming.
            </p>
          </div>
        </div>
      ) : null}

      {benchmark ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border border-gray-800 bg-black p-4">
              <p className="text-xs text-gray-500">
                DXY five-candle movement
              </p>
              <p
                className={`mt-2 font-mono text-xl font-black ${movementClasses(
                  benchmark.movement,
                )}`}
              >
                {benchmark.movement}
              </p>
            </div>

            <div className="border border-gray-800 bg-black p-4">
              <p className="text-xs text-gray-500">
                Aligned pairs
              </p>
              <p className="mt-2 font-mono text-xl font-black text-white">
                {alignedCount} / 7
              </p>
            </div>

            <div className="border border-gray-800 bg-black p-4">
              <p className="text-xs text-gray-500">
                History used
              </p>
              <p className="mt-2 font-mono text-xl font-black text-white">
                {benchmark.historyCandlesUsed} candles
              </p>
            </div>

            <div className="border border-gray-800 bg-black p-4">
              <p className="text-xs text-gray-500">
                Live feed
              </p>
              <p
                className={`mt-2 flex items-center gap-2 font-mono text-sm font-black ${
                  connectionStatus === "live"
                    ? "text-green-300"
                    : "text-yellow-300"
                }`}
              >
                {connectionStatus === "live" ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <WifiOff className="h-4 w-4" />
                )}
                {connectionLabel(
                  connectionStatus,
                )}
              </p>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            <BenchmarkMobileCard row={benchmark} />
            {rankings.map((row) => (
              <RankingMobileCard
                key={row.pair}
                row={row}
              />
            ))}
          </div>

          <div className="hidden overflow-x-auto border border-gray-800 md:block">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead className="bg-[#0a0a0a] font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
                <tr>
                  <th className="border-b border-gray-800 px-4 py-3">#</th>
                  <th className="border-b border-gray-800 px-4 py-3">Pair</th>
                  <th className="border-b border-gray-800 px-4 py-3">Price move</th>
                  <th className="border-b border-gray-800 px-4 py-3">Point move</th>
                  <th className="border-b border-gray-800 px-4 py-3">Move %</th>
                  <th className="border-b border-gray-800 px-4 py-3">Momentum score</th>
                  <th className="border-b border-gray-800 px-4 py-3">Alignment</th>
                  <th className="border-b border-gray-800 px-4 py-3">Start price</th>
                  <th className="border-b border-gray-800 px-4 py-3">Current price</th>
                  <th className="border-b border-gray-800 px-4 py-3">Window started</th>
                </tr>
              </thead>

              <tbody className="font-mono text-sm">
                <tr className="border-b border-cyan-400/20 bg-cyan-400/5">
                  <td className="px-4 py-4 font-bold text-cyan-300">Ref</td>
                  <td className="px-4 py-4 font-black text-white">DXY</td>
                  <td className={`px-4 py-4 font-bold ${movementClasses(benchmark.movement)}`}>
                    {benchmark.movement}
                  </td>
                  <td className={`px-4 py-4 font-bold ${moveClasses(benchmark.pointMovement)}`}>
                    {formatSigned(benchmark.pointMovement)} pts
                  </td>
                  <td className={`px-4 py-4 font-bold ${moveClasses(benchmark.movePercent)}`}>
                    {formatPercent(benchmark.movePercent)}
                  </td>
                  <td className="px-4 py-4 font-bold text-cyan-200">
                    Benchmark
                    <span className="ml-2 text-[10px] text-gray-500">
                      ({formatSigned(benchmark.benchmarkPoints, 0)})
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`border px-2 py-1 text-[10px] font-bold uppercase ${statusClasses("Reference")}`}>
                      Reference
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-300">
                    {formatPrice("DXY", benchmark.startPrice)}
                  </td>
                  <td className="px-4 py-4 text-white">
                    {formatPrice("DXY", benchmark.currentPrice)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">
                    {formatDateTime(benchmark.candleStartedAt)}
                  </td>
                </tr>

                {rankings.map((row) => (
                  <tr key={row.pair} className="border-b border-gray-800 bg-black last:border-b-0">
                    <td className="px-4 py-4 font-black text-cyan-300">
                      {row.rank}
                    </td>
                    <td className="px-4 py-4 font-black text-white">
                      {row.pair}
                    </td>
                    <td className={`px-4 py-4 font-bold ${movementClasses(row.movement)}`}>
                      {row.movement}
                    </td>
                    <td className={`px-4 py-4 font-bold ${moveClasses(row.pointMovement)}`}>
                      {formatSigned(row.pointMovement)} pts
                    </td>
                    <td className={`px-4 py-4 font-bold ${moveClasses(row.movePercent)}`}>
                      {formatPercent(row.movePercent)}
                    </td>
                    <td className={`px-4 py-4 font-black ${moveClasses(row.score)}`}>
                      {formatSigned(row.score, 0)} pts
                    </td>
                    <td className="px-4 py-4">
                      <span className={`border px-2 py-1 text-[10px] font-bold uppercase ${statusClasses(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-300">
                      {formatPrice(row.pair, row.startPrice)}
                    </td>
                    <td className="px-4 py-4 text-white">
                      {formatPrice(row.pair, row.currentPrice)}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-500">
                      {formatDateTime(row.candleStartedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex items-start gap-3 border border-green-400/20 bg-green-400/5 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-300" />
              <p className="text-sm leading-relaxed text-gray-400">
                Point movement and Move % are the
                instrument&apos;s actual chart
                movement. Positive means price
                moved up and negative means it
                moved down.
              </p>
            </div>

            <div className="flex items-start gap-3 border border-yellow-400/20 bg-yellow-400/5 p-4">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" />
              <p className="text-sm leading-relaxed text-gray-400">
                Momentum Score is the DXY-alignment
                value used for ranking.{" "}
                {directDxyFeed
                  ? "The benchmark is the direct BiQuote DXY index."
                  : "Direct DXY was unavailable, so the six-component DXY fallback is active."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-800 pt-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5" />
              Last tick:{" "}
              {fetchedAt
                ? formatDateTime(fetchedAt)
                : "—"}
            </span>

            <span>
              {provider} ·{" "}
              {benchmarkSource ||
                "Loading benchmark source"}
            </span>
          </div>

          {method ? (
            <p className="text-xs leading-relaxed text-gray-600">
              {method}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}