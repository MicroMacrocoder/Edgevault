"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Database,
  RefreshCw,
} from "lucide-react";

type MarketSnapshotItem = {
  symbol: string;
  label: string;
  side: string;
  value: number | null;
  previousClose: number | null;
  change: number | null;
  percentChange: number | null;
  timestamp: number | null;
  datetime: string | null;
  marketOpen: boolean | null;
  estimated: boolean;
  source: string;
  error: string | null;
};

type MarketSnapshotResponse = {
  ok?: boolean;
  provider?: string;
  updatedAt?: string | null;
  quoteTimestamp?: string | null;
  refreshAfterSeconds?: number;
  availableCount?: number;
  requestedCount?: number;
  items?: MarketSnapshotItem[];
  error?: string;
};

const snapshotStorageKey = "edgevault_market_snapshot_v2";
const sharedRequestCooldownKey = "edgevault_twelve_data_last_request_v1";
const REQUEST_COOLDOWN_MS = 60_000;

function formatPrice(symbol: string, value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  if (symbol === "DXY") {
    return value.toFixed(3);
  }

  if (symbol.endsWith("JPY")) {
    return value.toFixed(3);
  }

  return value.toFixed(5);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatUpdatedTime(value?: string | null) {
  if (!value) {
    return "No saved snapshot";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Latest saved quote";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function readStoredSnapshot(): MarketSnapshotResponse | null {
  try {
    const stored = window.localStorage.getItem(snapshotStorageKey);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as MarketSnapshotResponse;

    if (parsed.ok === false || !Array.isArray(parsed.items)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("READ MARKET SNAPSHOT ERROR:", error);
    return null;
  }
}

function saveStoredSnapshot(payload: MarketSnapshotResponse) {
  try {
    window.localStorage.setItem(snapshotStorageKey, JSON.stringify(payload));
  } catch (error) {
    console.error("SAVE MARKET SNAPSHOT ERROR:", error);
  }
}

function getCooldownSeconds() {
  try {
    const stored = Number(
      window.localStorage.getItem(sharedRequestCooldownKey),
    );

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

export default function MarketSnapshotDashboardWidget() {
  const [items, setItems] = useState<MarketSnapshotItem[]>([]);
  const [quoteTimestamp, setQuoteTimestamp] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [hasLoadedStoredSnapshot, setHasLoadedStoredSnapshot] = useState(false);

  useEffect(() => {
    const stored = readStoredSnapshot();

    if (stored) {
      setItems(Array.isArray(stored.items) ? stored.items : []);
      setQuoteTimestamp(stored.quoteTimestamp ?? stored.updatedAt ?? null);
    }

    setHasLoadedStoredSnapshot(true);
  }, []);

  useEffect(() => {
    const updateCooldown = () => setCooldownSeconds(getCooldownSeconds());

    updateCooldown();
    const timer = window.setInterval(updateCooldown, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  const loadSnapshot = useCallback(async () => {
    if (isRefreshing || getCooldownSeconds() > 0) {
      return;
    }

    window.localStorage.setItem(
      sharedRequestCooldownKey,
      String(Date.now()),
    );
    setCooldownSeconds(60);
    setIsRefreshing(true);
    setMessage("");

    try {
      const response = await fetch("/api/market-snapshot", {
        cache: "no-store",
      });
      const result = (await response.json()) as MarketSnapshotResponse;

      if (!response.ok || result.ok === false) {
        throw new Error(
          result.error || "Could not load the current market snapshot.",
        );
      }

      saveStoredSnapshot(result);
      setItems(Array.isArray(result.items) ? result.items : []);
      setQuoteTimestamp(result.quoteTimestamp ?? result.updatedAt ?? null);
    } catch (error) {
      console.error("LOAD MARKET SNAPSHOT ERROR:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the current market snapshot.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const availableCount = useMemo(
    () => items.filter((item) => item.value !== null).length,
    [items],
  );

  const requestButtonLabel = isRefreshing
    ? "Loading…"
    : cooldownSeconds > 0
      ? `${cooldownSeconds}s`
      : items.length > 0
        ? "Refresh · 7 credits"
        : "Load snapshot · 7 credits";

  return (
    <section className="flex h-full min-w-0 flex-col border border-gray-800 bg-[#111111] p-4 shadow-[0_0_35px_rgba(34,211,238,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Live Market
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 text-cyan-300" />
            <h2 className="truncate font-mono text-base font-bold text-white">
              Market Snapshot
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadSnapshot()}
          disabled={isRefreshing || cooldownSeconds > 0}
          title={requestButtonLabel}
          aria-label={requestButtonLabel}
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-gray-800 text-gray-400 transition hover:border-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:text-gray-700"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <div className="mt-3 flex min-h-8 items-center justify-between gap-3 border-y border-gray-800 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-gray-500">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          {formatUpdatedTime(quoteTimestamp)}
        </span>
        <span className="shrink-0 font-mono text-[10px] font-bold text-cyan-300">
          {availableCount}/5
        </span>
      </div>

      <div className="mt-2 flex min-h-[170px] flex-1 flex-col">
        {!hasLoadedStoredSnapshot ? (
          <div className="flex flex-1 items-center justify-center border border-gray-800 bg-black">
            <Database className="h-5 w-5 text-gray-700" />
          </div>
        ) : message && items.length === 0 ? (
          <div className="flex flex-1 items-start gap-2 border border-red-500/30 bg-red-500/5 p-3 text-[10px] text-red-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{message}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center border border-gray-800 bg-black p-4 text-center">
            <Database className="h-5 w-5 text-gray-700" />
            <p className="mt-2 font-mono text-xs font-bold text-gray-300">
              No snapshot loaded
            </p>
            <p className="mt-1 text-[10px] text-gray-600">
              Use the refresh icon when you need current prices.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800 border border-gray-800 bg-black">
            {items.map((item) => {
              const percent = item.percentChange;
              const changeClass =
                percent === null
                  ? "text-gray-500"
                  : percent > 0
                    ? "text-green-400"
                    : percent < 0
                      ? "text-red-400"
                      : "text-gray-300";

              return (
                <div
                  key={item.symbol}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-mono text-[11px] font-black text-white">
                        {item.label}
                      </p>
                      {item.estimated ? (
                        <span
                          title="Calculated estimate"
                          className="border border-yellow-400/30 bg-yellow-400/10 px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-yellow-300"
                        >
                          Est.
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="font-mono text-[11px] font-bold text-gray-100">
                    {formatPrice(item.label, item.value)}
                  </p>

                  <p
                    className={`min-w-[54px] text-right font-mono text-[10px] font-bold ${changeClass}`}
                  >
                    {formatPercent(percent)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {message && items.length > 0 ? (
        <div className="mt-2 flex items-start gap-2 border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{message} Saved prices remain visible.</span>
        </div>
      ) : null}

      <p className="mt-2 truncate text-[9px] text-gray-600" title="Manual request only. Market Snapshot and Momentum share one 60-second Twelve Data cooldown.">
        Manual request · shared 60s cooldown
      </p>
    </section>
  );
}