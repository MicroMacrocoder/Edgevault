"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import * as signalR from "@microsoft/signalr";
import {
  USD_MOMENTUM_PAIRS,
  calculateUsdMomentum,
  type MomentumBenchmarkRow,
  type MomentumCalculation,
  type MomentumInstrumentSeries,
  type MomentumRankingRow,
  type MomentumTimeframe,
} from "@/lib/currencyMomentum";

export type LiveMomentumConnectionStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline";

export type MomentumInstrumentSeriesPayload =
  MomentumInstrumentSeries & {
    streamSymbol: string;
  };

export type MomentumApiResponse = {
  ok: boolean;
  provider?: string;
  tracker?: string;
  benchmarkSource?: string;
  directDxyFeed?: boolean;
  timeframe?: MomentumTimeframe;
  interval?: string;
  method?: string;
  requestedInstrumentCount?: number;
  parallelRequests?: boolean;
  historyCandlesUsed?: number;
  comparisonCandlesUsed?: number;
  normalizationWindowsUsed?: number;
  cacheSeconds?: number;
  fetchedAt?: string;
  streamSymbols?: string[];
  instrumentSeries?: MomentumInstrumentSeriesPayload[];
  fallbackDxySeries?: MomentumInstrumentSeries | null;
  benchmark?: MomentumBenchmarkRow;
  rankings?: MomentumRankingRow[];
  error?: string;
};

export type LiveCurrencyMomentumState = {
  benchmark: MomentumBenchmarkRow | null;
  rankings: MomentumRankingRow[];
  fetchedAt: string | null;
  method: string;
  provider: string;
  benchmarkSource: string;
  directDxyFeed: boolean;
  connectionStatus: LiveMomentumConnectionStatus;
  isLoading: boolean;
  errorMessage: string;
};

type LiveTick = {
  symbol?: unknown;
  bid?: unknown;
  ask?: unknown;
  last?: unknown;
  mid?: unknown;
  timestamp?: unknown;
  time?: unknown;
};

type MomentumDataset = {
  timeframe: MomentumTimeframe;
  directDxyFeed: boolean;
  fallbackDxySeries: MomentumInstrumentSeries | null;
  instrumentSeriesBySymbol: Map<
    string,
    MomentumInstrumentSeriesPayload
  >;
  streamSymbols: string[];
};

type DatasetEntry = {
  state: LiveCurrencyMomentumState;
  dataset: MomentumDataset | null;
  listeners: Set<
    (state: LiveCurrencyMomentumState) => void
  >;
  loadingPromise: Promise<void> | null;
  reloadTimer: ReturnType<typeof setTimeout> | null;
  storageTimer: ReturnType<typeof setTimeout> | null;
  recalcScheduled: boolean;
};

const HUB_URL = "https://biquote.io/hubs/tick";
const SNAPSHOT_KEY_PREFIX =
  "edgevault_currency_momentum_snapshot_v4";

const STREAM_TO_PAIR_SOURCE: Record<
  string,
  string
> = {
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  AUDUSD: "AUD/USD",
  NZDUSD: "NZD/USD",
  USDCAD: "USD/CAD",
  USDCHF: "USD/CHF",
  USDJPY: "USD/JPY",
};

const DXY_COMPONENT_STREAMS = [
  "EURUSD",
  "USDJPY",
  "GBPUSD",
  "USDCAD",
  "USDSEK",
  "USDCHF",
] as const;

const entries = new Map<
  MomentumTimeframe,
  DatasetEntry
>();

let connection: signalR.HubConnection | null = null;
let connectionStartPromise: Promise<void> | null = null;
let connectionRetryTimer:
  | ReturnType<typeof setTimeout>
  | null = null;
let globalConnectionStatus:
  LiveMomentumConnectionStatus = "offline";
const desiredSymbols = new Set<string>();

function createEmptyState(): LiveCurrencyMomentumState {
  return {
    benchmark: null,
    rankings: [],
    fetchedAt: null,
    method: "",
    provider: "BiQuote MT5",
    benchmarkSource: "",
    directDxyFeed: false,
    connectionStatus: globalConnectionStatus,
    isLoading: false,
    errorMessage: "",
  };
}

function getEntry(
  timeframe: MomentumTimeframe,
) {
  const existing = entries.get(timeframe);

  if (existing) {
    return existing;
  }

  const created: DatasetEntry = {
    state: createEmptyState(),
    dataset: null,
    listeners: new Set(),
    loadingPromise: null,
    reloadTimer: null,
    storageTimer: null,
    recalcScheduled: false,
  };

  entries.set(timeframe, created);
  return created;
}

function publish(
  entry: DatasetEntry,
  patch: Partial<LiveCurrencyMomentumState>,
) {
  entry.state = {
    ...entry.state,
    ...patch,
  };

  for (const listener of entry.listeners) {
    listener(entry.state);
  }
}

function updateGlobalConnectionStatus(
  status: LiveMomentumConnectionStatus,
) {
  globalConnectionStatus = status;

  for (const entry of entries.values()) {
    publish(entry, {
      connectionStatus: status,
    });
  }
}

function snapshotKey(
  timeframe: MomentumTimeframe,
) {
  return `${SNAPSHOT_KEY_PREFIX}_${timeframe}`;
}

function readStoredSnapshot(
  timeframe: MomentumTimeframe,
): LiveCurrencyMomentumState | null {
  try {
    const stored = window.localStorage.getItem(
      snapshotKey(timeframe),
    );

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(
      stored,
    ) as Partial<LiveCurrencyMomentumState>;

    if (
      !parsed.benchmark ||
      !Array.isArray(parsed.rankings)
    ) {
      return null;
    }

    return {
      ...createEmptyState(),
      ...parsed,
      connectionStatus:
        globalConnectionStatus,
      isLoading: false,
      errorMessage: "",
    };
  } catch (error) {
    console.error(
      "READ LIVE MOMENTUM SNAPSHOT ERROR:",
      error,
    );
    return null;
  }
}

function scheduleStoredSnapshot(
  timeframe: MomentumTimeframe,
  entry: DatasetEntry,
) {
  if (entry.storageTimer) {
    return;
  }

  entry.storageTimer = setTimeout(() => {
    entry.storageTimer = null;

    try {
      const {
        benchmark,
        rankings,
        fetchedAt,
        method,
        provider,
        benchmarkSource,
        directDxyFeed,
      } = entry.state;

      if (!benchmark) {
        return;
      }

      window.localStorage.setItem(
        snapshotKey(timeframe),
        JSON.stringify({
          benchmark,
          rankings,
          fetchedAt,
          method,
          provider,
          benchmarkSource,
          directDxyFeed,
        }),
      );
    } catch (error) {
      console.error(
        "SAVE LIVE MOMENTUM SNAPSHOT ERROR:",
        error,
      );
    }
  }, 1000);
}

function readNumber(value: unknown) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function readString(value: unknown) {
  return typeof value === "string" &&
    value.trim() !== ""
    ? value.trim()
    : null;
}

function normalizeSymbol(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getTickPrice(tick: LiveTick) {
  const mid = readNumber(tick.mid);

  if (mid !== null && mid > 0) {
    return mid;
  }

  const bid = readNumber(tick.bid);
  const ask = readNumber(tick.ask);

  if (
    bid !== null &&
    ask !== null &&
    bid > 0 &&
    ask > 0
  ) {
    return (bid + ask) / 2;
  }

  const last = readNumber(tick.last);

  return last !== null && last > 0
    ? last
    : null;
}

function getTickDate(tick: LiveTick) {
  const raw =
    readString(tick.timestamp) ??
    readString(tick.time);

  if (!raw) {
    return new Date();
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime())
    ? new Date()
    : parsed;
}

function getUtcWeekStart(value: Date) {
  const result = new Date(value);
  result.setUTCHours(0, 0, 0, 0);

  const mondayOffset =
    (result.getUTCDay() + 6) % 7;
  result.setUTCDate(
    result.getUTCDate() - mondayOffset,
  );

  return result;
}

function getBucketStart(
  timeframe: MomentumTimeframe,
  value: Date,
) {
  const result = new Date(value);
  result.setUTCSeconds(0, 0);

  if (timeframe === "M1") {
    return result;
  }

  if (timeframe === "M5") {
    result.setUTCMinutes(
      Math.floor(result.getUTCMinutes() / 5) * 5,
    );
    return result;
  }

  if (timeframe === "M15") {
    result.setUTCMinutes(
      Math.floor(result.getUTCMinutes() / 15) *
        15,
    );
    return result;
  }

  if (timeframe === "M30") {
    result.setUTCMinutes(
      Math.floor(result.getUTCMinutes() / 30) *
        30,
    );
    return result;
  }

  result.setUTCMinutes(0, 0, 0);

  if (timeframe === "H1") {
    return result;
  }

  if (timeframe === "H4") {
    result.setUTCHours(
      Math.floor(result.getUTCHours() / 4) * 4,
    );
    return result;
  }

  if (timeframe === "D1") {
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  return getUtcWeekStart(result);
}

function updateCurrentCandle(
  series: MomentumInstrumentSeries,
  price: number,
  bucketStart: string,
) {
  const current = series.candles[0];

  if (!current) {
    return "reload" as const;
  }

  const currentTime = Date.parse(
    current.datetime,
  );
  const incomingTime = Date.parse(bucketStart);

  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(incomingTime)
  ) {
    return "ignore" as const;
  }

  if (incomingTime > currentTime) {
    return "reload" as const;
  }

  if (incomingTime < currentTime) {
    return "ignore" as const;
  }

  current.close = price;
  current.high = Math.max(
    current.high,
    price,
  );
  current.low = Math.min(
    current.low,
    price,
  );

  return "updated" as const;
}

function calculateDxyValue(values: {
  eurusd: number;
  usdjpy: number;
  gbpusd: number;
  usdcad: number;
  usdsek: number;
  usdchf: number;
}) {
  return (
    50.14348112 *
    Math.pow(values.eurusd, -0.576) *
    Math.pow(values.usdjpy, 0.136) *
    Math.pow(values.gbpusd, -0.119) *
    Math.pow(values.usdcad, 0.091) *
    Math.pow(values.usdsek, 0.042) *
    Math.pow(values.usdchf, 0.036)
  );
}

function updateFallbackDxy(
  dataset: MomentumDataset,
) {
  const fallback =
    dataset.fallbackDxySeries;

  if (!fallback) {
    return;
  }

  const values = DXY_COMPONENT_STREAMS.map(
    (symbol) =>
      dataset.instrumentSeriesBySymbol.get(
        symbol,
      )?.candles[0]?.close ?? null,
  );

  if (
    values.some(
      (value) =>
        value === null ||
        !Number.isFinite(value) ||
        value <= 0,
    )
  ) {
    return;
  }

  const [
    eurusd,
    usdjpy,
    gbpusd,
    usdcad,
    usdsek,
    usdchf,
  ] = values as number[];

  const currentPrice = calculateDxyValue({
    eurusd,
    usdjpy,
    gbpusd,
    usdcad,
    usdsek,
    usdchf,
  });

  const current = fallback.candles[0];

  if (!current) {
    return;
  }

  current.close = currentPrice;
  current.high = Math.max(
    current.high,
    currentPrice,
  );
  current.low = Math.min(
    current.low,
    currentPrice,
  );
}

function buildCalculation(
  entry: DatasetEntry,
  updatedAt: string,
): MomentumCalculation {
  const dataset = entry.dataset;

  if (!dataset) {
    throw new Error(
      "Live Momentum has no loaded dataset.",
    );
  }

  const directDxy =
    dataset.instrumentSeriesBySymbol.get("DXY");

  const dxySeries =
    dataset.directDxyFeed && directDxy
      ? directDxy
      : dataset.fallbackDxySeries;

  if (!dxySeries) {
    throw new Error(
      "Neither direct DXY nor its fallback is available.",
    );
  }

  const pairSeries =
    USD_MOMENTUM_PAIRS.map((pair) => {
      const streamSymbol = Object.entries(
        STREAM_TO_PAIR_SOURCE,
      ).find(
        ([, sourceSymbol]) =>
          sourceSymbol === pair.sourceSymbol,
      )?.[0];

      const series = streamSymbol
        ? dataset.instrumentSeriesBySymbol.get(
            streamSymbol,
          )
        : null;

      if (!series) {
        throw new Error(
          `${pair.label} is missing from the live dataset.`,
        );
      }

      return series;
    });

  return calculateUsdMomentum({
    dxySeries,
    pairSeries,
    updatedAt,
  });
}

function recalculateEntry(
  timeframe: MomentumTimeframe,
  entry: DatasetEntry,
  updatedAt: string,
) {
  try {
    const calculation = buildCalculation(
      entry,
      updatedAt,
    );

    publish(entry, {
      benchmark: calculation.benchmark,
      rankings: calculation.rankings,
      fetchedAt: updatedAt,
      errorMessage: "",
    });

    scheduleStoredSnapshot(
      timeframe,
      entry,
    );
  } catch (error) {
    console.error(
      "LIVE MOMENTUM RECALCULATION ERROR:",
      error,
    );
  }
}

function scheduleRecalculation(
  timeframe: MomentumTimeframe,
  entry: DatasetEntry,
  updatedAt: string,
) {
  if (entry.recalcScheduled) {
    return;
  }

  entry.recalcScheduled = true;

  window.requestAnimationFrame(() => {
    entry.recalcScheduled = false;
    recalculateEntry(
      timeframe,
      entry,
      updatedAt,
    );
  });
}

function scheduleHistoryReload(
  timeframe: MomentumTimeframe,
  entry: DatasetEntry,
) {
  if (entry.reloadTimer) {
    return;
  }

  entry.reloadTimer = setTimeout(() => {
    entry.reloadTimer = null;
    void loadDataset(timeframe, true);
  }, 1500);
}

function handleTick(rawTick: unknown) {
  if (
    typeof rawTick !== "object" ||
    rawTick === null ||
    Array.isArray(rawTick)
  ) {
    return;
  }

  const tick = rawTick as LiveTick;
  const rawSymbol = readString(tick.symbol);
  const price = getTickPrice(tick);

  if (!rawSymbol || price === null) {
    return;
  }

  const symbol = normalizeSymbol(rawSymbol);
  const tickDate = getTickDate(tick);
  const updatedAt = tickDate.toISOString();

  for (
    const [timeframe, entry]
    of entries.entries()
  ) {
    const dataset = entry.dataset;

    if (!dataset) {
      continue;
    }

    const series =
      dataset.instrumentSeriesBySymbol.get(
        symbol,
      );

    if (!series) {
      continue;
    }

    const bucketStart = getBucketStart(
      timeframe,
      tickDate,
    ).toISOString();

    const result = updateCurrentCandle(
      series,
      price,
      bucketStart,
    );

    if (result === "reload") {
      scheduleHistoryReload(
        timeframe,
        entry,
      );
      continue;
    }

    if (result !== "updated") {
      continue;
    }

    if (!dataset.directDxyFeed) {
      updateFallbackDxy(dataset);
    }

    scheduleRecalculation(
      timeframe,
      entry,
      updatedAt,
    );
  }
}

async function subscribeDesiredSymbols() {
  if (
    !connection ||
    connection.state !==
      signalR.HubConnectionState.Connected ||
    desiredSymbols.size === 0
  ) {
    return;
  }

  await connection.invoke(
    "Subscribe",
    Array.from(desiredSymbols),
  );
}

function createConnection() {
  const created =
    new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        withCredentials: false,
      })
      .withAutomaticReconnect([
        0,
        2000,
        5000,
        10000,
        30000,
      ])
      .configureLogging(
        signalR.LogLevel.Warning,
      )
      .build();

  created.on("ReceiveTick", handleTick);

  created.onreconnecting(() => {
    updateGlobalConnectionStatus(
      "reconnecting",
    );
  });

  created.onreconnected(() => {
    void subscribeDesiredSymbols()
      .then(() => {
        updateGlobalConnectionStatus("live");
      })
      .catch((error) => {
        console.error(
          "BIQUOTE RESUBSCRIBE ERROR:",
          error,
        );
        updateGlobalConnectionStatus(
          "reconnecting",
        );
      });
  });

  created.onclose(() => {
    updateGlobalConnectionStatus("offline");

    if (connectionRetryTimer) {
      clearTimeout(connectionRetryTimer);
    }

    connectionRetryTimer = setTimeout(() => {
      connectionRetryTimer = null;
      void startConnection();
    }, 5000);
  });

  return created;
}

async function startConnection() {
  if (
    connection?.state ===
    signalR.HubConnectionState.Connected
  ) {
    await subscribeDesiredSymbols();
    updateGlobalConnectionStatus("live");
    return;
  }

  if (connectionStartPromise) {
    return connectionStartPromise;
  }

  if (!connection) {
    connection = createConnection();
  }

  updateGlobalConnectionStatus("connecting");

  connectionStartPromise = connection
    .start()
    .then(async () => {
      await subscribeDesiredSymbols();
      updateGlobalConnectionStatus("live");
    })
    .catch((error) => {
      console.error(
        "BIQUOTE SIGNALR START ERROR:",
        error,
      );
      updateGlobalConnectionStatus("offline");

      if (connectionRetryTimer) {
        clearTimeout(connectionRetryTimer);
      }

      connectionRetryTimer = setTimeout(() => {
        connectionRetryTimer = null;
        void startConnection();
      }, 5000);
    })
    .finally(() => {
      connectionStartPromise = null;
    });

  return connectionStartPromise;
}

function registerStreamSymbols(
  symbols: string[],
) {
  let added = false;

  for (const symbol of symbols) {
    const normalized = normalizeSymbol(symbol);

    if (
      normalized &&
      !desiredSymbols.has(normalized)
    ) {
      desiredSymbols.add(normalized);
      added = true;
    }
  }

  if (
    added &&
    connection?.state ===
      signalR.HubConnectionState.Connected
  ) {
    void subscribeDesiredSymbols().catch(
      (error) => {
        console.error(
          "BIQUOTE SUBSCRIBE ERROR:",
          error,
        );
      },
    );
  }

  void startConnection();
}

function parseDataset(
  payload: MomentumApiResponse,
  timeframe: MomentumTimeframe,
): MomentumDataset {
  if (
    !Array.isArray(payload.instrumentSeries) ||
    !Array.isArray(payload.streamSymbols)
  ) {
    throw new Error(
      "BiQuote Momentum returned no live series.",
    );
  }

  const instrumentSeriesBySymbol =
    new Map<
      string,
      MomentumInstrumentSeriesPayload
    >();

  for (const series of payload.instrumentSeries) {
    if (
      !series ||
      !series.streamSymbol ||
      !Array.isArray(series.candles)
    ) {
      continue;
    }

    instrumentSeriesBySymbol.set(
      normalizeSymbol(series.streamSymbol),
      series,
    );
  }

  return {
    timeframe,
    directDxyFeed:
      payload.directDxyFeed === true,
    fallbackDxySeries:
      payload.fallbackDxySeries ?? null,
    instrumentSeriesBySymbol,
    streamSymbols:
      payload.streamSymbols.map(
        normalizeSymbol,
      ),
  };
}

async function loadDataset(
  timeframe: MomentumTimeframe,
  force = false,
) {
  const entry = getEntry(timeframe);

  if (entry.loadingPromise && !force) {
    return entry.loadingPromise;
  }

  publish(entry, {
    isLoading: true,
    errorMessage: "",
  });

  let activePromise: Promise<void>;

  activePromise = fetch(
    `/api/currency-momentum?timeframe=${encodeURIComponent(
      timeframe,
    )}&t=${Date.now()}`,
    {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    },
  )
    .then(async (response) => {
      const payload =
        (await response.json()) as MomentumApiResponse;

      if (
        !response.ok ||
        !payload.ok ||
        !payload.benchmark ||
        !Array.isArray(payload.rankings)
      ) {
        throw new Error(
          payload.error ??
            "BiQuote Momentum could not be calculated.",
        );
      }

      entry.dataset = parseDataset(
        payload,
        timeframe,
      );

      publish(entry, {
        benchmark: payload.benchmark,
        rankings: payload.rankings,
        fetchedAt:
          payload.fetchedAt ??
          new Date().toISOString(),
        method: payload.method ?? "",
        provider:
          payload.provider ?? "BiQuote MT5",
        benchmarkSource:
          payload.benchmarkSource ?? "",
        directDxyFeed:
          payload.directDxyFeed === true,
        isLoading: false,
        errorMessage: "",
      });

      scheduleStoredSnapshot(
        timeframe,
        entry,
      );

      registerStreamSymbols(
        entry.dataset.streamSymbols,
      );
    })
    .catch((error) => {
      console.error(
        "LOAD BIQUOTE MOMENTUM ERROR:",
        error,
      );

      publish(entry, {
        isLoading: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "BiQuote Momentum could not be loaded.",
      });
    })
    .finally(() => {
      if (entry.loadingPromise === activePromise) {
        entry.loadingPromise = null;
      }
    });

  entry.loadingPromise = activePromise;
  return activePromise;
}

function subscribeToEntry(
  timeframe: MomentumTimeframe,
  listener: (
    state: LiveCurrencyMomentumState,
  ) => void,
) {
  const entry = getEntry(timeframe);

  if (
    !entry.state.benchmark &&
    entry.listeners.size === 0
  ) {
    const stored = readStoredSnapshot(
      timeframe,
    );

    if (stored) {
      entry.state = stored;
    }
  }

  entry.listeners.add(listener);
  listener(entry.state);

  return () => {
    entry.listeners.delete(listener);
  };
}

export function useLiveCurrencyMomentum(
  timeframe: MomentumTimeframe,
  enabled = true,
) {
  const [state, setState] =
    useState<LiveCurrencyMomentumState>(
      createEmptyState,
    );

  useEffect(() => {
    if (!enabled) {
      setState(createEmptyState());
      return;
    }

    const unsubscribe = subscribeToEntry(
      timeframe,
      setState,
    );

    void loadDataset(timeframe);

    return unsubscribe;
  }, [enabled, timeframe]);

  const refresh = useCallback(() => {
    if (!enabled) {
      return Promise.resolve();
    }

    return loadDataset(timeframe, true);
  }, [enabled, timeframe]);

  return {
    ...state,
    refresh,
  };
}