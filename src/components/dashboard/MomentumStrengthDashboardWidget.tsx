"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import CompactCycleSelect from "@/components/dashboard/CompactCycleSelect";
import { useDashboardPreferences } from "@/components/dashboard/DashboardPreferencesProvider";
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

type MomentumApiResponse = {
  ok: boolean;
  timeframe?: MomentumTimeframe;
  method?: string;
  fetchedAt?: string;
  apiCreditsLeft?: number | null;
  benchmark?: MomentumBenchmarkRow;
  rankings?: MomentumRankingRow[];
  error?: string;
};

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

const snapshotKeyPrefix = "edgevault_currency_momentum_snapshot_v3";
const requestCooldownKey = "edgevault_twelve_data_last_request_v1";
const REQUEST_COOLDOWN_MS = 60_000;

function formatSigned(value: number, decimalPlaces = 0) {
  const rounded = Number(value.toFixed(decimalPlaces));
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClasses(status: MomentumRankingRow["status"]) {
  if (status === "Aligned") {
    return "text-green-300";
  }

  if (status === "Opposing") {
    return "text-red-300";
  }

  return "text-gray-400";
}

function movementClasses(movement: MovementDirection) {
  if (movement === "Up") {
    return "text-green-300";
  }

  if (movement === "Down") {
    return "text-red-300";
  }

  return "text-gray-400";
}

function snapshotKey(timeframe: MomentumTimeframe) {
  return `${snapshotKeyPrefix}_${timeframe}`;
}

function readStoredSnapshot(timeframe: MomentumTimeframe) {
  try {
    const stored = window.localStorage.getItem(snapshotKey(timeframe));

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as MomentumApiResponse;

    if (!parsed.ok || !parsed.benchmark || !Array.isArray(parsed.rankings)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("READ MOMENTUM DASHBOARD SNAPSHOT ERROR:", error);
    return null;
  }
}

function saveStoredSnapshot(
  timeframe: MomentumTimeframe,
  payload: MomentumApiResponse,
) {
  try {
    window.localStorage.setItem(snapshotKey(timeframe), JSON.stringify(payload));
  } catch (error) {
    console.error("SAVE MOMENTUM DASHBOARD SNAPSHOT ERROR:", error);
  }
}

function getCooldownSeconds() {
  try {
    const stored = Number(window.localStorage.getItem(requestCooldownKey));

    if (!Number.isFinite(stored) || stored <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.ceil((stored + REQUEST_COOLDOWN_MS - Date.now()) / 1000),
    );
  } catch {
    return 0;
  }
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

  const [benchmark, setBenchmark] = useState<MomentumBenchmarkRow | null>(null);
  const [rankings, setRankings] = useState<MomentumRankingRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const applyPayload = useCallback((payload: MomentumApiResponse | null) => {
    setBenchmark(payload?.benchmark ?? null);
    setRankings(payload?.rankings ?? []);
    setFetchedAt(payload?.fetchedAt ?? null);
  }, []);

  useEffect(() => {
    const updateCooldown = () => setCooldownSeconds(getCooldownSeconds());

    updateCooldown();
    const timer = window.setInterval(updateCooldown, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setErrorMessage("");

    if (currency !== "DXY") {
      applyPayload(null);
      return;
    }

    applyPayload(readStoredSnapshot(timeframe));
  }, [applyPayload, currency, timeframe]);

  function updateMomentumPreferences(
    patch: Partial<typeof preferences.momentum>,
  ) {
    void updatePreferenceSection("momentum", {
      ...preferences.momentum,
      ...patch,
    });
  }

  const loadMomentum = useCallback(async () => {
    if (currency !== "DXY" || isLoading || getCooldownSeconds() > 0) {
      return;
    }

    window.localStorage.setItem(requestCooldownKey, String(Date.now()));
    setCooldownSeconds(60);
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/currency-momentum?timeframe=${encodeURIComponent(timeframe)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as MomentumApiResponse;

      if (!response.ok || !payload.ok || !payload.benchmark) {
        throw new Error(payload.error ?? "Momentum ranking could not be loaded.");
      }

      saveStoredSnapshot(timeframe, payload);
      applyPayload(payload);
    } catch (error) {
      console.error("LOAD MOMENTUM DASHBOARD ERROR:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Momentum ranking could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyPayload, currency, isLoading, timeframe]);

  const topThree = useMemo(() => rankings.slice(0, 3), [rankings]);
  const isDxy = currency === "DXY";
  const requestButtonLabel = isLoading
    ? "Loading…"
    : cooldownSeconds > 0
      ? `${cooldownSeconds}s`
      : benchmark
        ? "Refresh · 8 credits"
        : "Load ranking · 8 credits";

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
          {fetchedAt ? formatDateTime(fetchedAt) : "No ranking requested"}
        </p>

        <button
          type="button"
          onClick={loadMomentum}
          disabled={!isDxy || isLoading || cooldownSeconds > 0}
          title={requestButtonLabel}
          aria-label={requestButtonLabel}
          className="flex h-7 w-7 shrink-0 items-center justify-center bg-cyan-400 text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-600"
        >
          {isLoading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
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
        ) : errorMessage ? (
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
                <p className="truncate font-mono text-xs font-black text-white">
                  DXY · five candles
                </p>
                <p className={`mt-0.5 font-mono text-[10px] font-bold ${movementClasses(benchmark.movement)}`}>
                  {benchmark.movement} · {timeframe}
                </p>
              </div>
              <p className={`font-mono text-[10px] font-black ${movementClasses(benchmark.movement)}`}>
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
                    <p className={`truncate text-[9px] font-semibold ${statusClasses(row.status)}`}>
                      {row.status}
                    </p>
                  </div>
                  <p className={`font-mono text-[10px] font-black ${statusClasses(row.status)}`}>
                    {formatSigned(row.score)}
                  </p>
                  <p className={`font-mono text-[9px] ${movementClasses(row.movement)}`}>
                    {formatSigned(row.pointMovement, 1)} pts
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
            <Activity className="h-6 w-6 text-gray-700" />
            <p className="mt-2 font-mono text-xs font-bold text-white">
              No ranking loaded
            </p>
            <p className="mt-1 text-[10px] text-gray-600">
              Use the refresh icon above when you need live data.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}