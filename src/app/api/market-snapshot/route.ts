import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BIQUOTE_LATEST_URL = "https://biquote.io/api/latest";
const REFRESH_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 12_000;
const STALE_AFTER_MINUTES = 5;

type BiQuoteTick = {
  symbol?: unknown;
  bid?: unknown;
  ask?: unknown;
  mid?: unknown;
  last?: unknown;
  timestamp?: unknown;
  time?: unknown;
  source?: unknown;
  dayDiffPercent?: unknown;
};

type SnapshotItem = {
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
  delayed: boolean;
  delayMinutes: number | null;
  stale: boolean;
  quoteAgeMinutes: number | null;
  source: string;
  error: string | null;
};

const DISPLAY_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDCAD",
  "USDJPY",
] as const;

const DXY_COMPONENT_SYMBOLS = [
  "EURUSD",
  "USDJPY",
  "GBPUSD",
  "USDCAD",
  "USDSEK",
  "USDCHF",
] as const;

const REQUEST_SYMBOLS = Array.from(
  new Set([...DISPLAY_SYMBOLS, ...DXY_COMPONENT_SYMBOLS]),
);

const DISPLAY_METADATA: Record<
  (typeof DISPLAY_SYMBOLS)[number],
  { symbol: string; label: string; side: string }
> = {
  EURUSD: {
    symbol: "EUR/USD",
    label: "EURUSD",
    side: "USD quote",
  },
  GBPUSD: {
    symbol: "GBP/USD",
    label: "GBPUSD",
    side: "USD quote",
  },
  USDCAD: {
    symbol: "USD/CAD",
    label: "USDCAD",
    side: "USD base",
  },
  USDJPY: {
    symbol: "USD/JPY",
    label: "USDJPY",
    side: "USD base",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function readTimestampSeconds(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Math.floor(parsed.getTime() / 1000);
}

function calculateQuoteAgeMinutes(timestamp: number | null) {
  if (timestamp === null || timestamp <= 0) {
    return null;
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  return Math.max(0, Math.floor((currentTimestamp - timestamp) / 60));
}

function calculatePreviousClose(
  currentValue: number | null,
  dayDiffPercent: number | null,
) {
  if (
    currentValue === null ||
    dayDiffPercent === null ||
    dayDiffPercent <= -100
  ) {
    return null;
  }

  const divisor = 1 + dayDiffPercent / 100;

  if (divisor === 0) {
    return null;
  }

  return currentValue / divisor;
}

function getMidPrice(tick: BiQuoteTick) {
  const directMid = readNumber(tick.mid);

  if (directMid !== null && directMid > 0) {
    return directMid;
  }

  const bid = readNumber(tick.bid);
  const ask = readNumber(tick.ask);

  if (bid !== null && ask !== null && bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }

  const last = readNumber(tick.last);

  return last !== null && last > 0 ? last : null;
}

function unavailableItem(
  symbol: string,
  label: string,
  side: string,
  error: string,
): SnapshotItem {
  return {
    symbol,
    label,
    side,
    value: null,
    previousClose: null,
    change: null,
    percentChange: null,
    timestamp: null,
    datetime: null,
    marketOpen: null,
    estimated: false,
    delayed: false,
    delayMinutes: null,
    stale: false,
    quoteAgeMinutes: null,
    source: "BiQuote MT5",
    error,
  };
}

function parseTick(
  key: (typeof DISPLAY_SYMBOLS)[number],
  tick: BiQuoteTick,
): SnapshotItem {
  const metadata = DISPLAY_METADATA[key];
  const value = getMidPrice(tick);
  const percentChange = readNumber(tick.dayDiffPercent);
  const previousClose = calculatePreviousClose(value, percentChange);
  const timestamp =
    readTimestampSeconds(tick.timestamp) ??
    readTimestampSeconds(tick.time);
  const quoteAgeMinutes = calculateQuoteAgeMinutes(timestamp);
  const stale =
    quoteAgeMinutes !== null &&
    quoteAgeMinutes > STALE_AFTER_MINUTES;

  return {
    symbol: metadata.symbol,
    label: metadata.label,
    side: metadata.side,
    value,
    previousClose,
    change:
      value !== null && previousClose !== null
        ? value - previousClose
        : null,
    percentChange,
    timestamp,
    datetime:
      timestamp === null
        ? null
        : new Date(timestamp * 1000).toISOString(),
    marketOpen: null,
    estimated: false,
    delayed: false,
    delayMinutes: null,
    stale,
    quoteAgeMinutes,
    source: readString(tick.source) ?? "BiQuote MT5",
    error:
      value === null
        ? "BiQuote returned no current midpoint."
        : stale
          ? `BiQuote's quote is ${quoteAgeMinutes} minutes old.`
          : null,
  };
}

function calculateDxy(
  prices: Record<string, number | null>,
) {
  const eurusd = prices.EURUSD ?? null;
  const usdjpy = prices.USDJPY ?? null;
  const gbpusd = prices.GBPUSD ?? null;
  const usdcad = prices.USDCAD ?? null;
  const usdsek = prices.USDSEK ?? null;
  const usdchf = prices.USDCHF ?? null;

  if (
    eurusd === null ||
    usdjpy === null ||
    gbpusd === null ||
    usdcad === null ||
    usdsek === null ||
    usdchf === null ||
    eurusd <= 0 ||
    usdjpy <= 0 ||
    gbpusd <= 0 ||
    usdcad <= 0 ||
    usdsek <= 0 ||
    usdchf <= 0
  ) {
    return null;
  }

  return (
    50.14348112 *
    Math.pow(eurusd, -0.576) *
    Math.pow(usdjpy, 0.136) *
    Math.pow(gbpusd, -0.119) *
    Math.pow(usdcad, 0.091) *
    Math.pow(usdsek, 0.042) *
    Math.pow(usdchf, 0.036)
  );
}

function createDxyItem(
  ticks: Record<string, BiQuoteTick | undefined>,
): SnapshotItem {
  const currentPrices: Record<string, number | null> = {};
  const previousPrices: Record<string, number | null> = {};
  const timestamps: number[] = [];
  const sourceNames = new Set<string>();
  let stale = false;
  let oldestAgeMinutes: number | null = null;

  for (const symbol of DXY_COMPONENT_SYMBOLS) {
    const tick = ticks[symbol];

    if (!tick) {
      currentPrices[symbol] = null;
      previousPrices[symbol] = null;
      continue;
    }

    const currentValue = getMidPrice(tick);
    const percentChange = readNumber(tick.dayDiffPercent);
    const previousClose = calculatePreviousClose(
      currentValue,
      percentChange,
    );
    const timestamp =
      readTimestampSeconds(tick.timestamp) ??
      readTimestampSeconds(tick.time);
    const quoteAgeMinutes = calculateQuoteAgeMinutes(timestamp);

    currentPrices[symbol] = currentValue;
    previousPrices[symbol] = previousClose;

    if (timestamp !== null) {
      timestamps.push(timestamp);
    }

    if (quoteAgeMinutes !== null) {
      oldestAgeMinutes =
        oldestAgeMinutes === null
          ? quoteAgeMinutes
          : Math.max(oldestAgeMinutes, quoteAgeMinutes);

      if (quoteAgeMinutes > STALE_AFTER_MINUTES) {
        stale = true;
      }
    }

    const source = readString(tick.source);

    if (source) {
      sourceNames.add(source);
    }
  }

  const value = calculateDxy(currentPrices);
  const previousClose = calculateDxy(previousPrices);
  const timestamp =
    timestamps.length > 0 ? Math.min(...timestamps) : null;
  const percentChange =
    value !== null && previousClose !== null && previousClose !== 0
      ? ((value - previousClose) / previousClose) * 100
      : null;

  return {
    symbol: "DXY",
    label: "DXY",
    side: "Live FX basket estimate",
    value,
    previousClose,
    change:
      value !== null && previousClose !== null
        ? value - previousClose
        : null,
    percentChange,
    timestamp,
    datetime:
      timestamp === null
        ? null
        : new Date(timestamp * 1000).toISOString(),
    marketOpen: null,
    estimated: true,
    delayed: false,
    delayMinutes: null,
    stale,
    quoteAgeMinutes: oldestAgeMinutes,
    source:
      sourceNames.size > 0
        ? `BiQuote ${Array.from(sourceNames).join(" / ")}`
        : "BiQuote MT5",
    error:
      value === null
        ? "One or more DXY component prices are unavailable."
        : stale
          ? "One or more DXY component quotes are stale."
          : null,
  };
}

async function fetchBiQuoteTicks() {
  const params = new URLSearchParams();

  for (const symbol of REQUEST_SYMBOLS) {
    params.append("symbols", symbol);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${BIQUOTE_LATEST_URL}?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `BiQuote request failed with status ${response.status}.`,
      );
    }

    const payload: unknown = await response.json();

    if (!isRecord(payload)) {
      throw new Error("BiQuote returned invalid latest-tick data.");
    }

    const ticks: Record<string, BiQuoteTick | undefined> = {};

    for (const symbol of REQUEST_SYMBOLS) {
      const value = payload[symbol];

      ticks[symbol] = isRecord(value)
        ? (value as BiQuoteTick)
        : undefined;
    }

    return ticks;
  } finally {
    clearTimeout(timeout);
  }
}

function latestTimestamp(items: SnapshotItem[]) {
  const timestamps = items
    .map((item) => item.timestamp)
    .filter((value): value is number => value !== null);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

export async function GET() {
  try {
    const ticks = await fetchBiQuoteTicks();
    const dxyItem = createDxyItem(ticks);

    const pairItems = DISPLAY_SYMBOLS.map((symbol) => {
      const tick = ticks[symbol];
      const metadata = DISPLAY_METADATA[symbol];

      return tick
        ? parseTick(symbol, tick)
        : unavailableItem(
            metadata.symbol,
            metadata.label,
            metadata.side,
            `BiQuote returned no quote for ${symbol}.`,
          );
    });

    const items = [dxyItem, ...pairItems];
    const availableCount = items.filter(
      (item) => item.value !== null,
    ).length;
    const quoteTimestamp = latestTimestamp(items);

    return NextResponse.json(
      {
        ok: availableCount > 0,
        provider: "BiQuote MT5",
        updatedAt: new Date().toISOString(),
        quoteTimestamp:
          quoteTimestamp === null
            ? null
            : new Date(
                quoteTimestamp * 1000,
              ).toISOString(),
        refreshAfterSeconds: REFRESH_SECONDS,
        availableCount,
        requestedCount: items.length,
        items,
      },
      {
        status: availableCount > 0 ? 200 : 502,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown BiQuote Market Snapshot error.";

    console.error("BIQUOTE MARKET SNAPSHOT ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "BiQuote MT5",
        updatedAt: new Date().toISOString(),
        quoteTimestamp: null,
        refreshAfterSeconds: REFRESH_SECONDS,
        availableCount: 0,
        requestedCount: 5,
        error: message,
        items: [],
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}