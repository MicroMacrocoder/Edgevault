import { NextRequest, NextResponse } from "next/server";
import {
  CURRENCY_STRENGTH_TIMEFRAMES,
  FOREX_PAIRS,
  calculateCurrencyStrength,
  type CurrencyStrengthTimeframe,
  type ForexCandle,
  type ForexPair,
} from "@/lib/currencyStrength";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BIQUOTE_BASE_URL = "https://biquote.io";
const REQUEST_TIMEOUT_MS = 30_000;
const HISTORY_LIMIT = 70;
const WEEKLY_DAILY_LIMIT = 700;
const LOOKBACK_CANDLES = 5;
const VOLATILITY_WINDOW = 50;
const MINIMUM_VOLATILITY_SAMPLES = 20;
const MINIMUM_SERIES_CANDLES = VOLATILITY_WINDOW + 1;

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type BiQuoteBar = {
  openTime?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  isOpen?: unknown;
};

type BiQuoteTick = {
  symbol?: unknown;
  bid?: unknown;
  ask?: unknown;
  last?: unknown;
  mid?: unknown;
  timestamp?: unknown;
  time?: unknown;
};

type ParsedBar = {
  candle: ForexCandle;
  isOpen: boolean;
};

export type CurrencyStrengthSeriesPayload = {
  pair: ForexPair;
  streamSymbol: string;
  sourceSymbol: string;
  candles: ForexCandle[];
};

const INTERVALS: Record<
  Exclude<CurrencyStrengthTimeframe, "W1">,
  string
> = {
  M1: "1m",
  M5: "5m",
  M15: "15m",
  M30: "30m",
  H1: "1h",
  H4: "4h",
  D1: "1d",
};

const PAIR_DEFINITIONS = FOREX_PAIRS.map((pair) => ({
  pair,
  streamSymbol: pair.replace("/", ""),
  sourceSymbol: pair,
}));

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
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

function parseDateTime(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeIsoDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString();
}

function parseBar(value: unknown): ParsedBar | null {
  if (!isRecord(value)) {
    return null;
  }

  const typed = value as BiQuoteBar;
  const openTime = readString(typed.openTime);
  const datetime = openTime
    ? normalizeIsoDateTime(openTime)
    : null;
  const open = readNumber(typed.open);
  const high = readNumber(typed.high);
  const low = readNumber(typed.low);
  const close = readNumber(typed.close);

  if (
    !datetime ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0
  ) {
    return null;
  }

  return {
    candle: {
      datetime,
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
    },
    isOpen: typed.isOpen === true,
  };
}

function getUtcWeekStart(value: Date) {
  const result = new Date(value);
  result.setUTCHours(0, 0, 0, 0);

  const mondayOffset = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - mondayOffset);

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

async function fetchJson(
  url: URL,
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const payload: unknown = await response.json();

    if (!response.ok) {
      const message =
        isRecord(payload) && readString(payload.message)
          ? readString(payload.message)
          : `BiQuote returned HTTP ${response.status}.`;

      throw new Error(
        message ?? "BiQuote request failed.",
      );
    }

    return payload;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error("The BiQuote request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOhlcPage({
  symbol,
  interval,
  limit,
}: {
  symbol: string;
  interval: string;
  limit: number;
}) {
  const url = new URL(
    `${BIQUOTE_BASE_URL}/api/${encodeURIComponent(
      symbol,
    )}/ohlc`,
  );

  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));

  const payload = await fetchJson(url);

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.bars)
  ) {
    throw new Error(
      `${symbol} returned invalid BiQuote OHLC data.`,
    );
  }

  return payload.bars
    .map(parseBar)
    .filter((bar): bar is ParsedBar => bar !== null)
    .sort(
      (first, second) =>
        parseDateTime(second.candle.datetime) -
        parseDateTime(first.candle.datetime),
    );
}

function deduplicateParsedBars(bars: ParsedBar[]) {
  const byDatetime = new Map<string, ParsedBar>();

  for (const bar of bars) {
    const existing = byDatetime.get(
      bar.candle.datetime,
    );

    if (!existing || bar.isOpen) {
      byDatetime.set(bar.candle.datetime, bar);
    }
  }

  return Array.from(byDatetime.values()).sort(
    (first, second) =>
      parseDateTime(second.candle.datetime) -
      parseDateTime(first.candle.datetime),
  );
}

function aggregateDailyBarsToWeekly(
  dailyBars: ParsedBar[],
) {
  const sortedOldestFirst = [...dailyBars].sort(
    (first, second) =>
      parseDateTime(first.candle.datetime) -
      parseDateTime(second.candle.datetime),
  );
  const weekly = new Map<string, ParsedBar>();

  for (const bar of sortedOldestFirst) {
    const parsedDate = new Date(
      bar.candle.datetime,
    );

    if (Number.isNaN(parsedDate.getTime())) {
      continue;
    }

    const weekStart = getUtcWeekStart(
      parsedDate,
    ).toISOString();
    const existing = weekly.get(weekStart);

    if (!existing) {
      weekly.set(weekStart, {
        candle: {
          datetime: weekStart,
          open: bar.candle.open,
          high: bar.candle.high,
          low: bar.candle.low,
          close: bar.candle.close,
        },
        isOpen: bar.isOpen,
      });
      continue;
    }

    existing.candle.high = Math.max(
      existing.candle.high,
      bar.candle.high,
    );
    existing.candle.low = Math.min(
      existing.candle.low,
      bar.candle.low,
    );
    existing.candle.close = bar.candle.close;
    existing.isOpen = existing.isOpen || bar.isOpen;
  }

  return Array.from(weekly.values()).sort(
    (first, second) =>
      parseDateTime(second.candle.datetime) -
      parseDateTime(first.candle.datetime),
  );
}

async function fetchPairSeries(
  definition: (typeof PAIR_DEFINITIONS)[number],
  timeframe: CurrencyStrengthTimeframe,
): Promise<CurrencyStrengthSeriesPayload> {
  const parsedBars =
    timeframe === "W1"
      ? aggregateDailyBarsToWeekly(
          deduplicateParsedBars(
            await fetchOhlcPage({
              symbol: definition.streamSymbol,
              interval: "1d",
              limit: WEEKLY_DAILY_LIMIT,
            }),
          ),
        )
      : await fetchOhlcPage({
          symbol: definition.streamSymbol,
          interval: INTERVALS[timeframe],
          limit: HISTORY_LIMIT,
        });

  if (
    parsedBars.length < MINIMUM_SERIES_CANDLES
  ) {
    throw new Error(
      `${definition.streamSymbol} returned only ${parsedBars.length} usable candles. ` +
        `${MINIMUM_SERIES_CANDLES} are required for the 50-candle volatility window.`,
    );
  }

  return {
    pair: definition.pair,
    streamSymbol: definition.streamSymbol,
    sourceSymbol: definition.sourceSymbol,
    candles: parsedBars
      .slice(0, HISTORY_LIMIT)
      .map((bar) => bar.candle),
  };
}

function getTickPrice(tick: BiQuoteTick) {
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

function getTickDate(tick: BiQuoteTick) {
  const raw =
    readString(tick.timestamp) ??
    readString(tick.time);

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

async function fetchLatestTicks(
  symbols: string[],
) {
  const url = new URL(
    `${BIQUOTE_BASE_URL}/api/latest`,
  );

  for (const symbol of symbols) {
    url.searchParams.append("symbols", symbol);
  }

  const payload = await fetchJson(url);

  if (!isRecord(payload)) {
    throw new Error(
      "BiQuote returned invalid latest-tick data.",
    );
  }

  return payload;
}

function patchCurrentCandlesWithLatestTicks({
  series,
  latestTicks,
  timeframe,
}: {
  series: CurrencyStrengthSeriesPayload[];
  latestTicks: Record<string, unknown>;
  timeframe: CurrencyStrengthTimeframe;
}) {
  for (const instrument of series) {
    const tickValue =
      latestTicks[instrument.streamSymbol];

    if (!isRecord(tickValue)) {
      continue;
    }

    const tick = tickValue as BiQuoteTick;
    const price = getTickPrice(tick);
    const timestamp = getTickDate(tick);
    const current = instrument.candles[0];

    if (
      price === null ||
      !timestamp ||
      !current
    ) {
      continue;
    }

    const bucketStart = getBucketStart(
      timeframe,
      timestamp,
    ).toISOString();
    const bucketTimestamp =
      parseDateTime(bucketStart);
    const currentTimestamp = parseDateTime(
      current.datetime,
    );

    if (bucketTimestamp > currentTimestamp) {
      instrument.candles.unshift({
        datetime: bucketStart,
        open: price,
        high: price,
        low: price,
        close: price,
      });

      if (
        instrument.candles.length > HISTORY_LIMIT
      ) {
        instrument.candles.length = HISTORY_LIMIT;
      }

      continue;
    }

    if (bucketTimestamp !== currentTimestamp) {
      continue;
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
  }
}

function isCurrencyStrengthTimeframe(
  value: string,
): value is CurrencyStrengthTimeframe {
  return (
    CURRENCY_STRENGTH_TIMEFRAMES as readonly string[]
  ).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const timeframeValue = (
      request.nextUrl.searchParams.get(
        "timeframe",
      ) ?? "H1"
    ).toUpperCase();

    if (
      !isCurrencyStrengthTimeframe(
        timeframeValue,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "timeframe must be M1, M5, M15, M30, H1, H4, D1 or W1.",
        },
        {
          status: 400,
          headers: NO_STORE_HEADERS,
        },
      );
    }

    const fetchedAt = new Date().toISOString();
    const settled = await Promise.allSettled(
      PAIR_DEFINITIONS.map((definition) =>
        fetchPairSeries(
          definition,
          timeframeValue,
        ),
      ),
    );

    const pairSeries: CurrencyStrengthSeriesPayload[] = [];
    const failures: Array<{
      pair: ForexPair;
      symbol: string;
      message: string;
    }> = [];

    settled.forEach((result, index) => {
      const definition = PAIR_DEFINITIONS[index];

      if (result.status === "fulfilled") {
        pairSeries.push(result.value);
        return;
      }

      failures.push({
        pair: definition.pair,
        symbol: definition.streamSymbol,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown BiQuote OHLC error.",
      });
    });

    if (failures.length > 0) {
      throw new Error(
        `BiQuote returned ${pairSeries.length}/${FOREX_PAIRS.length} Currency Strength pairs. ` +
          failures
            .map(
              (failure) =>
                `${failure.symbol}: ${failure.message}`,
            )
            .join(" | "),
      );
    }

    try {
      const latestTicks = await fetchLatestTicks(
        PAIR_DEFINITIONS.map(
          (definition) =>
            definition.streamSymbol,
        ),
      );

      patchCurrentCandlesWithLatestTicks({
        series: pairSeries,
        latestTicks,
        timeframe: timeframeValue,
      });
    } catch (error) {
      console.warn(
        "BIQUOTE CURRENCY STRENGTH LATEST-TICK PATCH WARNING:",
        error,
      );
    }

    const pairCandles: Record<
      string,
      readonly ForexCandle[]
    > = {};

    for (const series of pairSeries) {
      pairCandles[series.pair] =
        series.candles;
    }

    const calculation =
      calculateCurrencyStrength(
        pairCandles,
        {
          lookbackCandles:
            LOOKBACK_CANDLES,
          volatilityWindow:
            VOLATILITY_WINDOW,
          minimumVolatilitySamples:
            MINIMUM_VOLATILITY_SAMPLES,
        },
      );

    if (!calculation.isComplete) {
      throw new Error(
        `The live Currency Strength calculation used ${calculation.usedPairCount}/${calculation.requestedPairCount} pairs. All 28 direct pairs are required.`,
      );
    }

    const latestCandleAt = pairSeries
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
          parseDateTime(second) -
          parseDateTime(first),
      )[0] ?? fetchedAt;

    return NextResponse.json(
      {
        ok: true,
        provider: "BiQuote MT5",
        timeframe: timeframeValue,
        interval:
          timeframeValue === "W1"
            ? "1d aggregated to W1"
            : INTERVALS[timeframeValue],
        method:
          `Live five-candle relative strength across all 28 major FX pairs. ` +
          `Each pair move is volatility-normalized with the latest ${VOLATILITY_WINDOW} single-candle returns, ` +
          `then contributed equally to its base and quote currencies.`,
        lookbackCandles: LOOKBACK_CANDLES,
        volatilityWindow:
          VOLATILITY_WINDOW,
        minimumVolatilitySamples:
          MINIMUM_VOLATILITY_SAMPLES,
        requestedPairCount:
          FOREX_PAIRS.length,
        usedPairCount:
          calculation.usedPairCount,
        isComplete:
          calculation.isComplete,
        fetchedAt,
        latestCandleAt,
        streamSymbols:
          PAIR_DEFINITIONS.map(
            (definition) =>
              definition.streamSymbol,
          ),
        pairSeries,
        readings: calculation.readings,
        pairResults:
          calculation.pairResults,
        skippedPairs:
          calculation.skippedPairs,
        options: calculation.options,
      },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Currency Strength error.";

    console.error(
      "BIQUOTE CURRENCY STRENGTH ERROR:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        provider: "BiQuote MT5",
        error: message,
      },
      {
        status: 502,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}