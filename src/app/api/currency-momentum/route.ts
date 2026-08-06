import { NextRequest, NextResponse } from "next/server";
import {
  MOMENTUM_COMPARISON_CANDLES,
  MOMENTUM_HISTORY_CANDLES,
  MOMENTUM_NORMALIZATION_WINDOWS,
  MOMENTUM_TIMEFRAMES,
  USD_MOMENTUM_PAIRS,
  calculateUsdMomentum,
  type MomentumCandle,
  type MomentumInstrumentSeries,
  type MomentumTimeframe,
} from "@/lib/currencyMomentum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BIQUOTE_BASE_URL = "https://biquote.io";
const REQUEST_TIMEOUT_MS = 30_000;
const NATIVE_HISTORY_LIMIT = MOMENTUM_HISTORY_CANDLES + 30;
const WEEKLY_FIRST_PAGE_LIMIT = 1000;
const WEEKLY_SECOND_PAGE_LIMIT = 350;
const MINIMUM_SERIES_CANDLES = MOMENTUM_HISTORY_CANDLES + 1;

type InstrumentDefinition = {
  streamSymbol: string;
  sourceSymbol: string;
  label: string;
};

type BiQuoteBar = {
  openTime?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  isOpen?: unknown;
};

type ParsedBar = {
  candle: MomentumCandle;
  isOpen: boolean;
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

type InstrumentSeriesPayload = MomentumInstrumentSeries & {
  streamSymbol: string;
};

const PAIR_INSTRUMENTS: InstrumentDefinition[] = [
  { streamSymbol: "EURUSD", sourceSymbol: "EUR/USD", label: "EURUSD" },
  { streamSymbol: "GBPUSD", sourceSymbol: "GBP/USD", label: "GBPUSD" },
  { streamSymbol: "AUDUSD", sourceSymbol: "AUD/USD", label: "AUDUSD" },
  { streamSymbol: "NZDUSD", sourceSymbol: "NZD/USD", label: "NZDUSD" },
  { streamSymbol: "USDCAD", sourceSymbol: "USD/CAD", label: "USDCAD" },
  { streamSymbol: "USDCHF", sourceSymbol: "USD/CHF", label: "USDCHF" },
  { streamSymbol: "USDJPY", sourceSymbol: "USD/JPY", label: "USDJPY" },
];

const EXTRA_INSTRUMENTS: InstrumentDefinition[] = [
  { streamSymbol: "DXY", sourceSymbol: "DXY", label: "DXY" },
  { streamSymbol: "USDSEK", sourceSymbol: "USD/SEK", label: "USDSEK" },
];

const REQUEST_INSTRUMENTS = [
  ...EXTRA_INSTRUMENTS,
  ...PAIR_INSTRUMENTS,
];

const DXY_COMPONENT_STREAM_SYMBOLS = [
  "EURUSD",
  "USDJPY",
  "GBPUSD",
  "USDCAD",
  "USDSEK",
  "USDCHF",
] as const;

const INTERVALS: Record<
  Exclude<MomentumTimeframe, "W1">,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizeIsoDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseDateTime(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function parseBar(value: unknown): ParsedBar | null {
  if (!isRecord(value)) {
    return null;
  }

  const typed = value as BiQuoteBar;
  const openTimeValue = readString(typed.openTime);
  const datetime = openTimeValue
    ? normalizeIsoDateTime(openTimeValue)
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

function getBucketStart(timeframe: MomentumTimeframe, value: Date) {
  const result = new Date(value);
  result.setUTCSeconds(0, 0);

  if (timeframe === "M1") return result;

  if (timeframe === "M5") {
    result.setUTCMinutes(Math.floor(result.getUTCMinutes() / 5) * 5);
    return result;
  }

  if (timeframe === "M15") {
    result.setUTCMinutes(Math.floor(result.getUTCMinutes() / 15) * 15);
    return result;
  }

  if (timeframe === "M30") {
    result.setUTCMinutes(Math.floor(result.getUTCMinutes() / 30) * 30);
    return result;
  }

  result.setUTCMinutes(0, 0, 0);

  if (timeframe === "H1") return result;

  if (timeframe === "H4") {
    result.setUTCHours(Math.floor(result.getUTCHours() / 4) * 4);
    return result;
  }

  if (timeframe === "D1") {
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  return getUtcWeekStart(result);
}

async function fetchJson(url: URL, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    const payload: unknown = await response.json();

    if (!response.ok) {
      const message =
        isRecord(payload) && readString(payload.message)
          ? readString(payload.message)
          : `BiQuote returned HTTP ${response.status}.`;

      throw new Error(message ?? "BiQuote request failed.");
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
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
  to,
}: {
  symbol: string;
  interval: string;
  limit: number;
  to?: string;
}) {
  const url = new URL(
    `${BIQUOTE_BASE_URL}/api/${encodeURIComponent(symbol)}/ohlc`,
  );

  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));

  if (to) {
    url.searchParams.set("to", to);
  }

  const payload = await fetchJson(url);

  if (!isRecord(payload) || !Array.isArray(payload.bars)) {
    throw new Error(`${symbol} returned invalid BiQuote OHLC data.`);
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
    const existing = byDatetime.get(bar.candle.datetime);

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

function aggregateDailyBarsToWeekly(dailyBars: ParsedBar[]) {
  const sortedOldestFirst = [...dailyBars].sort(
    (first, second) =>
      parseDateTime(first.candle.datetime) -
      parseDateTime(second.candle.datetime),
  );

  const weekly = new Map<string, ParsedBar>();

  for (const bar of sortedOldestFirst) {
    const parsedDate = new Date(bar.candle.datetime);

    if (Number.isNaN(parsedDate.getTime())) {
      continue;
    }

    const weekStart = getUtcWeekStart(parsedDate).toISOString();
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

    existing.candle.high = Math.max(existing.candle.high, bar.candle.high);
    existing.candle.low = Math.min(existing.candle.low, bar.candle.low);
    existing.candle.close = bar.candle.close;
    existing.isOpen = existing.isOpen || bar.isOpen;
  }

  return Array.from(weekly.values()).sort(
    (first, second) =>
      parseDateTime(second.candle.datetime) -
      parseDateTime(first.candle.datetime),
  );
}

function validateCurrentAndHistory(
  definition: InstrumentDefinition,
  bars: ParsedBar[],
) {
  if (bars.length < MINIMUM_SERIES_CANDLES) {
    throw new Error(
      `${definition.label} returned only ${bars.length} usable candles. ` +
        `${MINIMUM_SERIES_CANDLES} are required.`,
    );
  }

  return bars.slice(
    0,
    Math.max(NATIVE_HISTORY_LIMIT, MINIMUM_SERIES_CANDLES),
  );
}

async function fetchInstrumentSeries(
  definition: InstrumentDefinition,
  timeframe: MomentumTimeframe,
): Promise<InstrumentSeriesPayload> {
  let parsedBars: ParsedBar[];

  if (timeframe === "W1") {
    const firstPage = await fetchOhlcPage({
      symbol: definition.streamSymbol,
      interval: "1d",
      limit: WEEKLY_FIRST_PAGE_LIMIT,
    });

    const oldestTimestamp = firstPage.reduce(
      (oldest, bar) =>
        Math.min(oldest, parseDateTime(bar.candle.datetime)),
      Number.POSITIVE_INFINITY,
    );

    const secondPage = Number.isFinite(oldestTimestamp)
      ? await fetchOhlcPage({
          symbol: definition.streamSymbol,
          interval: "1d",
          limit: WEEKLY_SECOND_PAGE_LIMIT,
          to: new Date(oldestTimestamp - 1).toISOString(),
        })
      : [];

    parsedBars = aggregateDailyBarsToWeekly(
      deduplicateParsedBars([...firstPage, ...secondPage]),
    );
  } else {
    parsedBars = await fetchOhlcPage({
      symbol: definition.streamSymbol,
      interval: INTERVALS[timeframe],
      limit: NATIVE_HISTORY_LIMIT,
    });
  }

  const validated = validateCurrentAndHistory(definition, parsedBars);

  return {
    streamSymbol: definition.streamSymbol,
    sourceSymbol: definition.sourceSymbol,
    label: definition.label,
    candles: validated.map((bar) => bar.candle),
  };
}

function getTickMid(tick: BiQuoteTick) {
  const mid = readNumber(tick.mid);

  if (mid !== null && mid > 0) return mid;

  const bid = readNumber(tick.bid);
  const ask = readNumber(tick.ask);

  if (bid !== null && ask !== null && bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }

  const last = readNumber(tick.last);
  return last !== null && last > 0 ? last : null;
}

function getTickTimestamp(tick: BiQuoteTick) {
  const raw = readString(tick.timestamp) ?? readString(tick.time);

  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchLatestTicks(symbols: string[]) {
  const url = new URL(`${BIQUOTE_BASE_URL}/api/latest`);

  for (const symbol of symbols) {
    url.searchParams.append("symbols", symbol);
  }

  const payload = await fetchJson(url);

  if (!isRecord(payload)) {
    throw new Error("BiQuote returned invalid latest-tick data.");
  }

  return payload;
}

function patchCurrentCandlesWithLatestTicks({
  series,
  latestTicks,
  timeframe,
}: {
  series: InstrumentSeriesPayload[];
  latestTicks: Record<string, unknown>;
  timeframe: MomentumTimeframe;
}) {
  const maximumCandles = Math.max(
    NATIVE_HISTORY_LIMIT,
    MINIMUM_SERIES_CANDLES,
  );

  for (const instrument of series) {
    const tickValue = latestTicks[instrument.streamSymbol];

    if (!isRecord(tickValue)) continue;

    const tick = tickValue as BiQuoteTick;
    const price = getTickMid(tick);
    const timestamp = getTickTimestamp(tick);
    const current = instrument.candles[0];

    if (price === null || !timestamp || !current) continue;

    const bucketStart = getBucketStart(timeframe, timestamp).toISOString();
    const bucketTimestamp = parseDateTime(bucketStart);
    const currentTimestamp = parseDateTime(current.datetime);

    if (bucketTimestamp > currentTimestamp) {
      instrument.candles.unshift({
        datetime: bucketStart,
        open: price,
        high: price,
        low: price,
        close: price,
      });

      if (instrument.candles.length > maximumCandles) {
        instrument.candles.length = maximumCandles;
      }

      continue;
    }

    if (bucketTimestamp !== currentTimestamp) continue;

    current.close = price;
    current.high = Math.max(current.high, price);
    current.low = Math.min(current.low, price);
  }
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

function buildCalculatedDxySeries(
  seriesByStreamSymbol: Map<string, InstrumentSeriesPayload>,
): MomentumInstrumentSeries {
  for (const symbol of DXY_COMPONENT_STREAM_SYMBOLS) {
    if (!seriesByStreamSymbol.has(symbol)) {
      throw new Error(`DXY fallback component ${symbol} is missing.`);
    }
  }

  const candleMaps = new Map<string, Map<string, MomentumCandle>>();

  for (const symbol of DXY_COMPONENT_STREAM_SYMBOLS) {
    const series = seriesByStreamSymbol.get(symbol);

    if (!series) {
      throw new Error(`DXY fallback component ${symbol} is missing.`);
    }

    candleMaps.set(
      symbol,
      new Map(series.candles.map((candle) => [candle.datetime, candle])),
    );
  }

  const reference = seriesByStreamSymbol.get("EURUSD");

  if (!reference) {
    throw new Error("EURUSD is required for the DXY fallback.");
  }

  const candles: MomentumCandle[] = [];

  for (const referenceCandle of reference.candles) {
    const datetime = referenceCandle.datetime;
    const eurusd = candleMaps.get("EURUSD")?.get(datetime);
    const usdjpy = candleMaps.get("USDJPY")?.get(datetime);
    const gbpusd = candleMaps.get("GBPUSD")?.get(datetime);
    const usdcad = candleMaps.get("USDCAD")?.get(datetime);
    const usdsek = candleMaps.get("USDSEK")?.get(datetime);
    const usdchf = candleMaps.get("USDCHF")?.get(datetime);

    if (!eurusd || !usdjpy || !gbpusd || !usdcad || !usdsek || !usdchf) {
      continue;
    }

    const open = calculateDxyValue({
      eurusd: eurusd.open,
      usdjpy: usdjpy.open,
      gbpusd: gbpusd.open,
      usdcad: usdcad.open,
      usdsek: usdsek.open,
      usdchf: usdchf.open,
    });

    const close = calculateDxyValue({
      eurusd: eurusd.close,
      usdjpy: usdjpy.close,
      gbpusd: gbpusd.close,
      usdcad: usdcad.close,
      usdsek: usdsek.close,
      usdchf: usdchf.close,
    });

    const high = calculateDxyValue({
      eurusd: eurusd.low,
      usdjpy: usdjpy.high,
      gbpusd: gbpusd.low,
      usdcad: usdcad.high,
      usdsek: usdsek.high,
      usdchf: usdchf.high,
    });

    const low = calculateDxyValue({
      eurusd: eurusd.high,
      usdjpy: usdjpy.low,
      gbpusd: gbpusd.high,
      usdcad: usdcad.low,
      usdsek: usdsek.low,
      usdchf: usdchf.low,
    });

    if (
      !Number.isFinite(open) ||
      !Number.isFinite(close) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      open <= 0 ||
      close <= 0 ||
      high <= 0 ||
      low <= 0
    ) {
      continue;
    }

    candles.push({
      datetime,
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
    });
  }

  candles.sort(
    (first, second) =>
      parseDateTime(second.datetime) - parseDateTime(first.datetime),
  );

  if (candles.length < MINIMUM_SERIES_CANDLES) {
    throw new Error(
      `The calculated DXY fallback returned only ${candles.length} aligned candles. ` +
        `${MINIMUM_SERIES_CANDLES} are required.`,
    );
  }

  return {
    sourceSymbol:
      "Calculated from EURUSD, USDJPY, GBPUSD, USDCAD, USDSEK and USDCHF",
    label: "DXY",
    candles,
  };
}

function isTimeframe(value: string): value is MomentumTimeframe {
  return (MOMENTUM_TIMEFRAMES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const timeframeValue = (
      request.nextUrl.searchParams.get("timeframe") ?? "H1"
    ).toUpperCase();

    if (!isTimeframe(timeframeValue)) {
      return NextResponse.json(
        {
          ok: false,
          error: "timeframe must be M1, M5, M15, M30, H1, H4, D1 or W1.",
        },
        { status: 400 },
      );
    }

    const fetchedAt = new Date().toISOString();
    const settled = await Promise.allSettled(
      REQUEST_INSTRUMENTS.map((definition) =>
        fetchInstrumentSeries(definition, timeframeValue),
      ),
    );

    const instrumentSeries: InstrumentSeriesPayload[] = [];
    const failures = new Map<string, string>();

    settled.forEach((result, index) => {
      const definition = REQUEST_INSTRUMENTS[index];

      if (result.status === "fulfilled") {
        instrumentSeries.push(result.value);
      } else {
        failures.set(
          definition.streamSymbol,
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown BiQuote OHLC error.",
        );
      }
    });

    try {
      const latestTicks = await fetchLatestTicks(
        REQUEST_INSTRUMENTS.map((instrument) => instrument.streamSymbol),
      );

      patchCurrentCandlesWithLatestTicks({
        series: instrumentSeries,
        latestTicks,
        timeframe: timeframeValue,
      });
    } catch (error) {
      console.warn("BIQUOTE MOMENTUM LATEST-TICK PATCH WARNING:", error);
    }

    const seriesByStreamSymbol = new Map(
      instrumentSeries.map((series) => [series.streamSymbol, series]),
    );

    const pairSeries = PAIR_INSTRUMENTS.map((definition) => {
      const series = seriesByStreamSymbol.get(definition.streamSymbol);

      if (!series) {
        throw new Error(
          `${definition.label} is unavailable: ${
            failures.get(definition.streamSymbol) ??
            "No OHLC series was returned."
          }`,
        );
      }

      return {
        sourceSymbol: series.sourceSymbol,
        label: series.label,
        candles: series.candles,
      };
    });

    const directDxy = seriesByStreamSymbol.get("DXY") ?? null;

    let dxySeries: MomentumInstrumentSeries;
    let directDxyFeed = false;
    let benchmarkSource: string;
    let fallbackDxySeries: MomentumInstrumentSeries | null = null;

    if (directDxy) {
      dxySeries = {
        sourceSymbol: "DXY",
        label: "DXY",
        candles: directDxy.candles,
      };
      directDxyFeed = true;
      benchmarkSource = "Direct BiQuote DXY index";
    } else {
      fallbackDxySeries = buildCalculatedDxySeries(seriesByStreamSymbol);
      dxySeries = fallbackDxySeries;
      benchmarkSource = "Calculated six-component DXY fallback";
    }

    const calculation = calculateUsdMomentum({
      dxySeries,
      pairSeries,
      updatedAt: fetchedAt,
    });

    return NextResponse.json(
      {
        ok: true,
        provider: "BiQuote MT5",
        tracker: "DXY",
        benchmarkSource,
        directDxyFeed,
        timeframe: timeframeValue,
        interval:
          timeframeValue === "W1"
            ? "1d aggregated to W1"
            : INTERVALS[timeframeValue],
        method:
          `Live net movement across five ${timeframeValue} candles: ` +
          `the current unfinished candle plus the previous four completed candles. ` +
          `Movement is measured from the oldest candle open to the latest midpoint. ` +
          `The previous ${MOMENTUM_HISTORY_CANDLES} completed candles provide ` +
          `rolling five-candle normalization. The direct BiQuote DXY index is ` +
          `preferred; its six-component FX basket is retained only as a fallback.`,
        requestedInstrumentCount: REQUEST_INSTRUMENTS.length,
        parallelRequests: true,
        comparisonCandlesUsed: MOMENTUM_COMPARISON_CANDLES,
        historyCandlesUsed: MOMENTUM_HISTORY_CANDLES,
        normalizationWindowsUsed: MOMENTUM_NORMALIZATION_WINDOWS,
        cacheSeconds: 0,
        fetchedAt,
        streamSymbols: REQUEST_INSTRUMENTS.map(
          (instrument) => instrument.streamSymbol,
        ),
        instrumentSeries,
        fallbackDxySeries,
        benchmark: calculation.benchmark,
        rankings: calculation.rankings,
        warnings: Array.from(failures.entries()).map(
          ([symbol, message]) => ({ symbol, message }),
        ),
      },
      {
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
        : "Unknown Currency Momentum error.";

    console.error("BIQUOTE CURRENCY MOMENTUM ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "BiQuote MT5",
        error: message,
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}