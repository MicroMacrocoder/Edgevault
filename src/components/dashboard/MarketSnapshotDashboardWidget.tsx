"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  delayed?: boolean;
  delayMinutes?: number | null;
  stale?: boolean;
  quoteAgeMinutes?: number | null;
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

const SNAPSHOT_STORAGE_KEY =
  "edgevault_market_snapshot_biquote_v1";
const DEFAULT_REFRESH_MS = 60_000;

function formatPrice(symbol: string, value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  if (symbol === "DXY" || symbol.endsWith("JPY")) {
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

function formatTime(value?: string | null) {
  if (!value) {
    return "Waiting for current quote";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Latest available quote";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAge(minutes?: number | null) {
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes < 0
  ) {
    return "unknown";
  }

  if (minutes < 60) {
    return `${Math.floor(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.floor(minutes % 60);

  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
}

function getStatusTooltip(item: MarketSnapshotItem) {
  const quoteAge = formatAge(item.quoteAgeMinutes);

  if (item.stale) {
    return `BiQuote returned a stale ${item.label} quote. Current quote age: ${quoteAge}.`;
  }

  if (item.estimated) {
    return `Calculated from live EURUSD, USDJPY, GBPUSD, USDCAD, USDSEK and USDCHF midpoint prices. Oldest component age: ${quoteAge}.`;
  }

  return `BiQuote MT5 midpoint. Current quote age: ${quoteAge}.`;
}

function readStoredSnapshot(): MarketSnapshotResponse | null {
  try {
    const stored = window.localStorage.getItem(
      SNAPSHOT_STORAGE_KEY,
    );

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(
      stored,
    ) as MarketSnapshotResponse;

    if (parsed.ok === false || !Array.isArray(parsed.items)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("READ BIQUOTE SNAPSHOT ERROR:", error);
    return null;
  }
}

function saveStoredSnapshot(payload: MarketSnapshotResponse) {
  try {
    window.localStorage.setItem(
      SNAPSHOT_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch (error) {
    console.error("SAVE BIQUOTE SNAPSHOT ERROR:", error);
  }
}

export default function MarketSnapshotDashboardWidget() {
  const [items, setItems] = useState<MarketSnapshotItem[]>([]);
  const [provider, setProvider] = useState("BiQuote MT5");
  const [quoteTimestamp, setQuoteTimestamp] =
    useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [hasLoadedStoredSnapshot, setHasLoadedStoredSnapshot] =
    useState(false);

  const requestInFlightRef = useRef(false);

  const loadSnapshot = useCallback(async () => {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    setIsRefreshing(true);

    try {
      const response = await fetch(
        `/api/market-snapshot?t=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        },
      );

      const result =
        (await response.json()) as MarketSnapshotResponse;

      if (!response.ok || result.ok === false) {
        throw new Error(
          result.error ||
            "Could not load BiQuote market prices.",
        );
      }

      const nextItems = Array.isArray(result.items)
        ? result.items
        : [];

      saveStoredSnapshot(result);
      setItems(nextItems);
      setProvider(result.provider ?? "BiQuote MT5");
      setQuoteTimestamp(
        result.quoteTimestamp ?? result.updatedAt ?? null,
      );
      setMessage("");
    } catch (error) {
      console.error("LOAD BIQUOTE SNAPSHOT ERROR:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load BiQuote market prices.",
      );
    } finally {
      requestInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredSnapshot();

    if (stored) {
      setItems(
        Array.isArray(stored.items) ? stored.items : [],
      );
      setProvider(stored.provider ?? "BiQuote MT5");
      setQuoteTimestamp(
        stored.quoteTimestamp ?? stored.updatedAt ?? null,
      );
    }

    setHasLoadedStoredSnapshot(true);
    void loadSnapshot();

    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, DEFAULT_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadSnapshot();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [loadSnapshot]);

  const availableCount = useMemo(
    () => items.filter((item) => item.value !== null).length,
    [items],
  );

  const staleCount = useMemo(
    () => items.filter((item) => item.stale).length,
    [items],
  );

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
          disabled={isRefreshing}
          title={
            isRefreshing
              ? "Refreshing BiQuote prices…"
              : "Refresh BiQuote prices now"
          }
          aria-label={
            isRefreshing
              ? "Refreshing BiQuote prices"
              : "Refresh BiQuote prices now"
          }
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-gray-800 text-gray-400 transition hover:border-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:text-gray-700"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              isRefreshing ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex min-h-8 items-center justify-between gap-3 border-y border-gray-800 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-gray-500">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          Quote: {formatTime(quoteTimestamp)}
        </span>

        <span
          className={`shrink-0 font-mono text-[10px] font-bold ${
            staleCount > 0
              ? "text-red-300"
              : "text-cyan-300"
          }`}
        >
          {availableCount}/5
        </span>
      </div>

      <div className="mt-2 flex min-h-[170px] flex-1 flex-col">
        {!hasLoadedStoredSnapshot ? (
          <div className="flex flex-1 items-center justify-center border border-gray-800 bg-black">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-700" />
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
              Connecting to BiQuote MT5
            </p>

            <p className="mt-1 text-[10px] text-gray-600">
              Current prices load automatically.
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

                      {item.stale ? (
                        <span
                          title={getStatusTooltip(item)}
                          aria-label={getStatusTooltip(item)}
                          className="cursor-help border border-red-400/30 bg-red-400/10 px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-red-300"
                        >
                          Stale
                        </span>
                      ) : null}

                      {item.estimated ? (
                        <span
                          title={getStatusTooltip(item)}
                          aria-label={getStatusTooltip(item)}
                          className="cursor-help border border-yellow-400/30 bg-yellow-400/10 px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-yellow-300"
                        >
                          Est.
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p
                    title={getStatusTooltip(item)}
                    className="font-mono text-[11px] font-bold text-gray-100"
                  >
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
          <span>
            {message} Last successful prices remain visible.
          </span>
        </div>
      ) : null}

      {staleCount > 0 ? (
        <div className="mt-2 flex items-start gap-2 border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

          <span>
            BiQuote returned {staleCount} stale{" "}
            {staleCount === 1 ? "quote" : "quotes"}. Hover the
            badge to see the actual quote age.
          </span>
        </div>
      ) : null}

      <p
        className="mt-2 truncate text-[9px] text-gray-600"
        title={`${provider}. Automatically checked every 60 seconds with browser and server caching disabled.`}
      >
        {provider} · automatic 60s refresh · cache disabled
      </p>
    </section>
  );
}