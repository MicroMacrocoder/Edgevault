"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import * as signalR from "@microsoft/signalr";
import {
  calculateCurrencyStrength,
  type CurrencyStrengthReading,
  type CurrencyStrengthTimeframe,
  type ForexCandle,
  type ForexPair,
  type PairStrengthResult,
} from "@/lib/currencyStrength";

export type LiveStrengthConnectionStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline";

export type CurrencyStrengthSeriesPayload = {
  pair: ForexPair;
  streamSymbol: string;
  sourceSymbol: string;
  candles: ForexCandle[];
};

export type CurrencyStrengthApiResponse = {
  ok: boolean;
  provider?: string;
  timeframe?: CurrencyStrengthTimeframe;
  interval?: string;
  method?: string;
  lookbackCandles?: number;
  volatilityWindow?: number;
  minimumVolatilitySamples?: number;
  requestedPairCount?: number;
  usedPairCount?: number;
  isComplete?: boolean;
  fetchedAt?: string;
  latestCandleAt?: string;
  streamSymbols?: string[];
  pairSeries?: CurrencyStrengthSeriesPayload[];
  readings?: CurrencyStrengthReading[];
  pairResults?: PairStrengthResult[];
  error?: string;
};

export type LiveCurrencyStrengthState = {
  readings: CurrencyStrengthReading[];
  pairResults: PairStrengthResult[];
  fetchedAt: string | null;
  latestCandleAt: string | null;
  provider: string;
  method: string;
  interval: string;
  lookbackCandles: number;
  volatilityWindow: number;
  requestedPairCount: number;
  usedPairCount: number;
  isComplete: boolean;
  connectionStatus: LiveStrengthConnectionStatus;
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

type StrengthDataset = {
  timeframe: CurrencyStrengthTimeframe;
  pairSeriesBySymbol: Map<
    string,
    CurrencyStrengthSeriesPayload
  >;
  streamSymbols: string[];
};

type DatasetEntry = {
  state: LiveCurrencyStrengthState;
  dataset: StrengthDataset | null;
  listeners: Set<
    (state: LiveCurrencyStrengthState) => void
  >;
  loadingPromise: Promise<void> | null;
  reloadTimer: ReturnType<typeof setTimeout> | null;
  storageTimer: ReturnType<typeof setTimeout> | null;
  recalcScheduled: boolean;
};

const HUB_URL = "https://biquote.io/hubs/tick";
const SNAPSHOT_KEY_PREFIX =
  "edgevault_currency_strength_live_v1";
const MAXIMUM_CANDLES = 70;

const entries = new Map<
  CurrencyStrengthTimeframe,
  DatasetEntry
>();

let connection: signalR.HubConnection | null = null;
let connectionStartPromise: Promise<void> | null = null;
let connectionRetryTimer:
  | ReturnType<typeof setTimeout>
  | null = null;
let globalConnectionStatus:
  LiveStrengthConnectionStatus = "offline";
const desiredSymbols = new Set<string>();

function createEmptyState(): LiveCurrencyStrengthState {
  return {
    readings: [],
    pairResults: [],
    fetchedAt: null,
    latestCandleAt: null,
    provider: "BiQuote MT5",
    method: "",
    interval: "",
    lookbackCandles: 5,
    volatilityWindow: 50,
    requestedPairCount: 28,
    usedPairCount: 0,
    isComplete: false,
    connectionStatus: globalConnectionStatus,
    isLoading: false,
    errorMessage: "",
  };
}

function getEntry(
  timeframe: CurrencyStrengthTimeframe,
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
  patch: Partial<LiveCurrencyStrengthState>,
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
  status: LiveStrengthConnectionStatus,
) {
  globalConnectionStatus = status;

  for (const entry of entries.values()) {
    publish(entry, {
      connectionStatus: status,
    });
  }
}

function snapshotKey(
  timeframe: CurrencyStrengthTimeframe,
) {
  return `${SNAPSHOT_KEY_PREFIX}_${timeframe}`;
}

function readStoredSnapshot(
  timeframe: CurrencyStrengthTimeframe,
): LiveCurrencyStrengthState | null {
  try {
    const stored = window.localStorage.getItem(
      snapshotKey(timeframe),
    );

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(
      stored,
    ) as Partial<LiveCurrencyStrengthState>;

    if (!Array.isArray(parsed.readings)) {
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
      "READ LIVE CURRENCY STRENGTH SNAPSHOT ERROR:",
      error,
    );
    return null;
  }
}

function scheduleStoredSnapshot(
  timeframe: CurrencyStrengthTimeframe,
  entry: DatasetEntry,
) {
  if (entry.storageTimer) {
    return;
  }

  entry.storageTimer = setTimeout(() => {
    entry.storageTimer = null;

    try {
      if (entry.state.readings.length === 0) {
        return;
      }

      const {
        readings,
        pairResults,
        fetchedAt,
        latestCandleAt,
        provider,
        method,
        interval,
        lookbackCandles,
        volatilityWindow,
        requestedPairCount,
        usedPairCount,
        isComplete,
      } = entry.state;

      window.localStorage.setItem(
        snapshotKey(timeframe),
        JSON.stringify({
          readings,
          pairResults,
          fetchedAt,
          latestCandleAt,
          provider,
          method,
          interval,
          lookbackCandles,
          volatilityWindow,
          requestedPairCount,
          usedPairCount,
          isComplete,
        }),
      );
    } catch (error) {
      console.error(
        "SAVE LIVE CURRENCY STRENGTH SNAPSHOT ERROR:",
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
  timeframe: CurrencyStrengthTimeframe,
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
      Math.floor(result.getUTCMinutes() / 15) * 15,
    );
    return result;
  }

  if (timeframe === "M30") {
    result.setUTCMinutes(
      Math.floor(result.getUTCMinutes() / 30) * 30,
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
  series: CurrencyStrengthSeriesPayload,
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
    series.candles.unshift({
      datetime: bucketStart,
      open: price,
      high: price,
      low: price,
      close: price,
    });

    if (
      series.candles.length > MAXIMUM_CANDLES
    ) {
      series.candles.length = MAXIMUM_CANDLES;
    }

    return "created" as const;
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

function recalculateEntry(
  timeframe: CurrencyStrengthTimeframe,
  entry: DatasetEntry,
  updatedAt: string,
) {
  const dataset = entry.dataset;

  if (!dataset) {
    return;
  }

  try {
    const pairCandles: Record<
      string,
      readonly ForexCandle[]
    > = {};

    for (const series of
      dataset.pairSeriesBySymbol.values()) {
      pairCandles[series.pair] =
        series.candles;
    }

    const calculation =
      calculateCurrencyStrength(
        pairCandles,
        {
          lookbackCandles:
            entry.state.lookbackCandles,
          volatilityWindow:
            entry.state.volatilityWindow,
          minimumVolatilitySamples: 20,
        },
      );

    const latestCandleAt = Array.from(
      dataset.pairSeriesBySymbol.values(),
    )
      .map(
        (series) =>
          series.candles[0]?.datetime ?? null,
      )
      .filter(
        (value): value is string =>
          Boolean(value),
      )
      .sort(
        (first, second) =>
          Date.parse(second) -
          Date.parse(first),
      )[0] ?? updatedAt;

    publish(entry, {
      readings: calculation.readings,
      pairResults:
        calculation.pairResults,
      fetchedAt: updatedAt,
      latestCandleAt,
      requestedPairCount:
        calculation.requestedPairCount,
      usedPairCount:
        calculation.usedPairCount,
      isComplete: calculation.isComplete,
      errorMessage: calculation.isComplete
        ? ""
        : `Live calculation currently has ${calculation.usedPairCount}/${calculation.requestedPairCount} usable pairs.`,
    });

    scheduleStoredSnapshot(
      timeframe,
      entry,
    );
  } catch (error) {
    console.error(
      "LIVE CURRENCY STRENGTH RECALCULATION ERROR:",
      error,
    );
  }
}

function scheduleRecalculation(
  timeframe: CurrencyStrengthTimeframe,
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
  timeframe: CurrencyStrengthTimeframe,
  entry: DatasetEntry,
) {
  if (entry.reloadTimer) {
    return;
  }

  entry.reloadTimer = setTimeout(() => {
    entry.reloadTimer = null;
    void loadDataset(timeframe, true);
  }, 2500);
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

  for (const [timeframe, entry]
    of entries.entries()) {
    const dataset = entry.dataset;

    if (!dataset) {
      continue;
    }

    const series =
      dataset.pairSeriesBySymbol.get(symbol);

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

    if (
      result === "reload" ||
      result === "created"
    ) {
      scheduleHistoryReload(
        timeframe,
        entry,
      );
    }

    if (
      result !== "updated" &&
      result !== "created"
    ) {
      continue;
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
          "BIQUOTE CURRENCY STRENGTH RESUBSCRIBE ERROR:",
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
        "BIQUOTE CURRENCY STRENGTH SIGNALR START ERROR:",
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
          "BIQUOTE CURRENCY STRENGTH SUBSCRIBE ERROR:",
          error,
        );
      },
    );
  }

  void startConnection();
}

function parseDataset(
  payload: CurrencyStrengthApiResponse,
  timeframe: CurrencyStrengthTimeframe,
): StrengthDataset {
  if (
    !Array.isArray(payload.pairSeries) ||
    !Array.isArray(payload.streamSymbols)
  ) {
    throw new Error(
      "BiQuote Currency Strength returned no live pair series.",
    );
  }

  const pairSeriesBySymbol = new Map<
    string,
    CurrencyStrengthSeriesPayload
  >();

  for (const series of payload.pairSeries) {
    if (
      !series ||
      !series.streamSymbol ||
      !Array.isArray(series.candles)
    ) {
      continue;
    }

    pairSeriesBySymbol.set(
      normalizeSymbol(series.streamSymbol),
      series,
    );
  }

  if (pairSeriesBySymbol.size !== 28) {
    throw new Error(
      `BiQuote Currency Strength returned ${pairSeriesBySymbol.size}/28 live pair series.`,
    );
  }

  return {
    timeframe,
    pairSeriesBySymbol,
    streamSymbols:
      payload.streamSymbols.map(
        normalizeSymbol,
      ),
  };
}

async function loadDataset(
  timeframe: CurrencyStrengthTimeframe,
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
    `/api/currency-strength?timeframe=${encodeURIComponent(
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
        (await response.json()) as CurrencyStrengthApiResponse;

      if (
        !response.ok ||
        !payload.ok ||
        !Array.isArray(payload.readings) ||
        !Array.isArray(payload.pairResults)
      ) {
        throw new Error(
          payload.error ??
            "BiQuote Currency Strength could not be calculated.",
        );
      }

      entry.dataset = parseDataset(
        payload,
        timeframe,
      );

      publish(entry, {
        readings: payload.readings,
        pairResults: payload.pairResults,
        fetchedAt:
          payload.fetchedAt ??
          new Date().toISOString(),
        latestCandleAt:
          payload.latestCandleAt ??
          payload.fetchedAt ??
          new Date().toISOString(),
        provider:
          payload.provider ?? "BiQuote MT5",
        method: payload.method ?? "",
        interval: payload.interval ?? "",
        lookbackCandles:
          payload.lookbackCandles ?? 5,
        volatilityWindow:
          payload.volatilityWindow ?? 50,
        requestedPairCount:
          payload.requestedPairCount ?? 28,
        usedPairCount:
          payload.usedPairCount ??
          payload.pairResults.length,
        isComplete:
          payload.isComplete === true,
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
        "LOAD BIQUOTE CURRENCY STRENGTH ERROR:",
        error,
      );

      publish(entry, {
        isLoading: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "BiQuote Currency Strength could not be loaded.",
      });
    })
    .finally(() => {
      if (
        entry.loadingPromise === activePromise
      ) {
        entry.loadingPromise = null;
      }
    });

  entry.loadingPromise = activePromise;
  return activePromise;
}

function subscribeToEntry(
  timeframe: CurrencyStrengthTimeframe,
  listener: (
    state: LiveCurrencyStrengthState,
  ) => void,
) {
  const entry = getEntry(timeframe);

  if (
    entry.state.readings.length === 0 &&
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

export function useLiveCurrencyStrength(
  timeframe: CurrencyStrengthTimeframe,
  enabled = true,
) {
  const [state, setState] =
    useState<LiveCurrencyStrengthState>(
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