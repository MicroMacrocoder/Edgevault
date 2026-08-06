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

const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";
const OUTPUT_SIZE = MOMENTUM_HISTORY_CANDLES + 2;
const CACHE_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 25_000;

const DXY_COMPONENTS = [
  "EUR/USD",
  "USD/JPY",
  "GBP/USD",
  "USD/CAD",
  "USD/SEK",
  "USD/CHF",
] as const;

const REQUEST_SYMBOLS = Array.from(
  new Set([
    ...USD_MOMENTUM_PAIRS.map((pair) => pair.sourceSymbol),
    "USD/SEK",
  ]),
);

const INTERVALS: Record<MomentumTimeframe, string> = {
  M1: "1min",
  M5: "5min",
  M15: "15min",
  M30: "30min",
  H1: "1h",
  H4: "4h",
  D1: "1day",
  W1: "1week",
};

type TwelveDataValue = {
  datetime?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
};

type TwelveDataSeries = {
  values?: unknown;
  status?: unknown;
  code?: unknown;
  message?: unknown;
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

function normalizeSymbol(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parseHeaderNumber(value: string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCandle(value: unknown): MomentumCandle | null {
  if (!isRecord(value)) {
    return null;
  }

  const typed = value as TwelveDataValue;
  const datetime = readString(typed.datetime);
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

  return { datetime, open, high, low, close };
}

function parseDateTime(value: string) {
  const normalized = value.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const timestamp = Date.parse(hasTimezone ? normalized : `${normalized}Z`);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getSeries(
  payload: Record<string, unknown>,
  symbol: string,
): TwelveDataSeries | null {
  const direct = payload[symbol];

  if (isRecord(direct)) {
    return direct as TwelveDataSeries;
  }

  const wanted = normalizeSymbol(symbol);

  for (const [key, value] of Object.entries(payload)) {
    if (normalizeSymbol(key) === wanted && isRecord(value)) {
      return value as TwelveDataSeries;
    }
  }

  return null;
}

function parseSeries(
  payload: Record<string, unknown>,
  sourceSymbol: string,
  label: string,
): MomentumInstrumentSeries {
  const series = getSeries(payload, sourceSymbol);

  if (!series) {
    throw new Error(
      `${label} was not returned by Twelve Data. Confirm that ${sourceSymbol} is available on your plan.`,
    );
  }

  const status = readString(series.status);
  const message = readString(series.message);

  if (status === "error" || !Array.isArray(series.values)) {
    throw new Error(
      `${label}: ${message ?? "No time-series candles were returned."}`,
    );
  }

  const candles = series.values
    .map(parseCandle)
    .filter((candle): candle is MomentumCandle => candle !== null)
    .sort(
      (first, second) =>
        parseDateTime(second.datetime) - parseDateTime(first.datetime),
    );

  const minimumCandles = MOMENTUM_HISTORY_CANDLES + 1;

  if (candles.length < minimumCandles) {
    throw new Error(
      `${label} returned only ${candles.length} usable candles. At least ${minimumCandles} are required.`,
    );
  }

  return {
    sourceSymbol,
    label,
    candles,
  };
}

function calculateDxyValue(values: {
  eurusd: number;
  usdjpy: number;
  gbpusd: number;
  usdcad: number;
  usdsek: number;
  usdchf: number;
}) {
  const { eurusd, usdjpy, gbpusd, usdcad, usdsek, usdchf } = values;

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

function buildCalculatedDxySeries(
  componentSeries: MomentumInstrumentSeries[],
): MomentumInstrumentSeries {
  const seriesBySymbol = new Map(
    componentSeries.map((series) => [series.sourceSymbol, series]),
  );

  for (const symbol of DXY_COMPONENTS) {
    if (!seriesBySymbol.has(symbol)) {
      throw new Error(`DXY component ${symbol} is missing.`);
    }
  }

  const candleMaps = new Map<string, Map<string, MomentumCandle>>();

  for (const symbol of DXY_COMPONENTS) {
    const series = seriesBySymbol.get(symbol);

    if (!series) {
      throw new Error(`DXY component ${symbol} is missing.`);
    }

    candleMaps.set(
      symbol,
      new Map(series.candles.map((candle) => [candle.datetime, candle])),
    );
  }

  const referenceSeries = seriesBySymbol.get("EUR/USD");

  if (!referenceSeries) {
    throw new Error("EUR/USD is required to calculate the DXY benchmark.");
  }

  const candles: MomentumCandle[] = [];

  for (const referenceCandle of referenceSeries.candles) {
    const datetime = referenceCandle.datetime;
    const eurusd = candleMaps.get("EUR/USD")?.get(datetime);
    const usdjpy = candleMaps.get("USD/JPY")?.get(datetime);
    const gbpusd = candleMaps.get("GBP/USD")?.get(datetime);
    const usdcad = candleMaps.get("USD/CAD")?.get(datetime);
    const usdsek = candleMaps.get("USD/SEK")?.get(datetime);
    const usdchf = candleMaps.get("USD/CHF")?.get(datetime);

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

  const minimumCandles = MOMENTUM_HISTORY_CANDLES + 1;

  if (candles.length < minimumCandles) {
    throw new Error(
      `Only ${candles.length} aligned DXY component candles were available. At least ${minimumCandles} are required.`,
    );
  }

  return {
    sourceSymbol: "Calculated from EURUSD, USDJPY, GBPUSD, USDCAD, USDSEK and USDCHF",
    label: "DXY",
    candles,
  };
}

function isTimeframe(value: string): value is MomentumTimeframe {
  return (MOMENTUM_TIMEFRAMES as readonly string[]).includes(value);
}

async function fetchMomentumPayload(timeframe: MomentumTimeframe) {
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "TWELVE_DATA_API_KEY is missing. Add it to .env.local and restart the server.",
    );
  }

  const requestUrl = new URL(`${TWELVE_DATA_BASE_URL}/time_series`);

  requestUrl.searchParams.set("symbol", REQUEST_SYMBOLS.join(","));
  requestUrl.searchParams.set("interval", INTERVALS[timeframe]);
  requestUrl.searchParams.set("outputsize", String(OUTPUT_SIZE));
  requestUrl.searchParams.set("timezone", "UTC");
  requestUrl.searchParams.set("format", "JSON");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `apikey ${apiKey}`,
      },
      next: { revalidate: CACHE_SECONDS },
      signal: controller.signal,
    });

    const payload: unknown = await response.json();

    if (!isRecord(payload)) {
      throw new Error("Twelve Data returned an invalid momentum response.");
    }

    const globalStatus = readString(payload.status);
    const globalMessage = readString(payload.message);

    if (!response.ok || globalStatus === "error") {
      throw new Error(
        globalMessage ??
          `Twelve Data returned HTTP status ${response.status}.`,
      );
    }

    return {
      payload,
      apiCreditsUsed: parseHeaderNumber(
        response.headers.get("api-credits-used"),
      ),
      apiCreditsLeft: parseHeaderNumber(
        response.headers.get("api-credits-left"),
      ),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The Twelve Data momentum request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
          error:
            "timeframe must be M1, M5, M15, M30, H1, H4, D1 or W1.",
        },
        { status: 400 },
      );
    }

    const fetchedAt = new Date().toISOString();
    const providerResult = await fetchMomentumPayload(timeframeValue);
    const requestedSeries = REQUEST_SYMBOLS.map((symbol) =>
      parseSeries(
        providerResult.payload,
        symbol,
        symbol.replace("/", ""),
      ),
    );
    const seriesBySymbol = new Map(
      requestedSeries.map((series) => [series.sourceSymbol, series]),
    );
    const dxyComponentSeries = DXY_COMPONENTS.map((symbol) => {
      const series = seriesBySymbol.get(symbol);

      if (!series) {
        throw new Error(`DXY component ${symbol} is missing.`);
      }

      return series;
    });
    const dxySeries = buildCalculatedDxySeries(dxyComponentSeries);
    const pairSeries = USD_MOMENTUM_PAIRS.map((pair) => {
      const series = seriesBySymbol.get(pair.sourceSymbol);

      if (!series) {
        throw new Error(`${pair.label} is missing from the batch response.`);
      }

      return {
        ...series,
        label: pair.label,
      };
    });
    const calculation = calculateUsdMomentum({
      dxySeries,
      pairSeries,
      updatedAt: fetchedAt,
    });

    return NextResponse.json({
      ok: true,
      provider: "Twelve Data",
      tracker: "DXY",
      benchmarkSource: "Calculated FX basket",
      directDxyFeed: false,
      timeframe: timeframeValue,
      interval: INTERVALS[timeframeValue],
      method:
        `Net movement across five ${timeframeValue} candles: the current unfinished candle plus the previous four completed candles. Movement is measured from the oldest candle open to the latest live price. The DXY benchmark is calculated locally from EURUSD, USDJPY, GBPUSD, USDCAD, USDSEK and USDCHF. Scores are normalized against rolling five-candle movements from the previous ${MOMENTUM_HISTORY_CANDLES} completed candles.`,
      requestedInstrumentCount: REQUEST_SYMBOLS.length,
      batchRequest: true,
      comparisonCandlesUsed: MOMENTUM_COMPARISON_CANDLES,
      historyCandlesUsed: MOMENTUM_HISTORY_CANDLES,
      normalizationWindowsUsed: MOMENTUM_NORMALIZATION_WINDOWS,
      cacheSeconds: CACHE_SECONDS,
      fetchedAt,
      apiCreditsUsed: providerResult.apiCreditsUsed,
      apiCreditsLeft: providerResult.apiCreditsLeft,
      benchmark: calculation.benchmark,
      rankings: calculation.rankings,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Currency Momentum error.";

    console.error("CURRENCY MOMENTUM ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "Twelve Data",
        error: message,
      },
      { status: 502 },
    );
  }
}