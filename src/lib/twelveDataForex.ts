export const FOREX_PAIRS = [
  "AUD/CAD",
  "AUD/CHF",
  "AUD/JPY",
  "AUD/NZD",
  "AUD/USD",
  "CAD/CHF",
  "CAD/JPY",
  "CHF/JPY",
  "EUR/AUD",
  "EUR/CAD",
  "EUR/CHF",
  "EUR/GBP",
  "EUR/JPY",
  "EUR/NZD",
  "EUR/USD",
  "GBP/AUD",
  "GBP/CAD",
  "GBP/CHF",
  "GBP/JPY",
  "GBP/NZD",
  "GBP/USD",
  "NZD/CAD",
  "NZD/CHF",
  "NZD/JPY",
  "NZD/USD",
  "USD/CAD",
  "USD/CHF",
  "USD/JPY",
] as const;

export type ForexPair = (typeof FOREX_PAIRS)[number];

export type ForexCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type CurrencyStrengthTimeframe =
  | "M1"
  | "M5"
  | "M15"
  | "M30"
  | "H1"
  | "H4"
  | "D1"
  | "W1";

const TWELVE_DATA_INTERVALS: Record<
  CurrencyStrengthTimeframe,
  string
> = {
  M1: "1min",
  M5: "5min",
  M15: "15min",
  M30: "30min",
  H1: "1h",
  H4: "4h",
  D1: "1day",
  W1: "1week",
};

function getTwelveDataInterval(
  timeframe: CurrencyStrengthTimeframe,
) {
  return TWELVE_DATA_INTERVALS[timeframe];
}

const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";
const MAX_BATCH_SIZE = 8;
const DEFAULT_OUTPUT_SIZE = 60;
const DEFAULT_TIMEOUT_MS = 20_000;

const TIMEFRAME_DURATION_MS: Record<CurrencyStrengthTimeframe, number> = {
  M1: 60 * 1_000,
  M5: 5 * 60 * 1_000,
  M15: 15 * 60 * 1_000,
  M30: 30 * 60 * 1_000,
  H1: 60 * 60 * 1_000,
  H4: 4 * 60 * 60 * 1_000,
  D1: 24 * 60 * 60 * 1_000,
  W1: 7 * 24 * 60 * 60 * 1_000,
};

type TwelveDataValue = {
  datetime?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
};

type TwelveDataSeries = {
  meta?: {
    symbol?: unknown;
    interval?: unknown;
    currency_base?: unknown;
    currency_quote?: unknown;
    type?: unknown;
  };
  values?: unknown;
  status?: unknown;
  code?: unknown;
  message?: unknown;
};

type TwelveDataGlobalError = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
};

export type TwelveDataPairError = {
  pair: ForexPair;
  code: number | null;
  message: string;
};

export type TwelveDataForexBatchResult = {
  provider: "Twelve Data";
  timeframe: CurrencyStrengthTimeframe;
  interval: string;
  requestedPairs: ForexPair[];
  candles: Partial<Record<ForexPair, ForexCandle[]>>;
  pairErrors: TwelveDataPairError[];
  fetchedAt: string;
  apiCreditsUsed: number | null;
  apiCreditsLeft: number | null;
};

export type FetchTwelveDataForexBatchOptions = {
  pairs: readonly ForexPair[];
  timeframe: CurrencyStrengthTimeframe;
  outputSize?: number;
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseHeaderNumber(value: string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSymbol(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "");
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
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

function readErrorCode(value: unknown) {
  const parsed = readNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function parseCandle(value: unknown): ForexCandle | null {
  if (!isRecord(value)) {
    return null;
  }

  const candle = value as TwelveDataValue;
  const datetime = readString(candle.datetime);
  const open = readNumber(candle.open);
  const high = readNumber(candle.high);
  const low = readNumber(candle.low);
  const close = readNumber(candle.close);

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
    datetime,
    open,
    high,
    low,
    close,
  };
}

function parseUtcTimestamp(datetime: string) {
  const value = datetime.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const normalized = value.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const timestamp = Date.parse(hasTimezone ? normalized : `${normalized}Z`);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function isCompletedCandle(
  candle: ForexCandle,
  timeframe: CurrencyStrengthTimeframe,
  currentTimeMs: number,
) {
  const candleStartMs = parseUtcTimestamp(candle.datetime);

  if (candleStartMs === null) {
    return false;
  }

  return (
    candleStartMs + TIMEFRAME_DURATION_MS[timeframe] <= currentTimeMs
  );
}

function parseSeriesCandles(
  series: TwelveDataSeries,
  timeframe: CurrencyStrengthTimeframe,
  currentTimeMs: number,
) {
  if (!Array.isArray(series.values)) {
    return [];
  }

  return series.values
    .map(parseCandle)
    .filter((candle): candle is ForexCandle => candle !== null)
    .filter((candle) =>
      isCompletedCandle(candle, timeframe, currentTimeMs),
    );
}

function getSeriesForPair(
  payload: Record<string, unknown>,
  pair: ForexPair,
  isSinglePairRequest: boolean,
): TwelveDataSeries | null {
  if (
    isSinglePairRequest &&
    ("values" in payload || "status" in payload || "meta" in payload)
  ) {
    return payload as TwelveDataSeries;
  }

  const directMatch = payload[pair];

  if (isRecord(directMatch)) {
    return directMatch as TwelveDataSeries;
  }

  const normalizedPair = normalizeSymbol(pair);

  for (const [key, value] of Object.entries(payload)) {
    if (normalizeSymbol(key) === normalizedPair && isRecord(value)) {
      return value as TwelveDataSeries;
    }
  }

  return null;
}

function validatePairs(pairs: readonly ForexPair[]) {
  if (pairs.length === 0) {
    throw new Error("At least one forex pair is required.");
  }

  if (pairs.length > MAX_BATCH_SIZE) {
    throw new Error(
      `A Twelve Data batch can contain at most ${MAX_BATCH_SIZE} pairs in this EdgeVault integration.`,
    );
  }

  const allowedPairs = new Set<string>(FOREX_PAIRS);
  const uniquePairs = new Set<string>();

  for (const pair of pairs) {
    if (!allowedPairs.has(pair)) {
      throw new Error(`${pair} is not part of the EdgeVault 28-pair universe.`);
    }

    if (uniquePairs.has(pair)) {
      throw new Error(`${pair} appears more than once in the batch.`);
    }

    uniquePairs.add(pair);
  }
}

function validateOutputSize(outputSize: number) {
  if (!Number.isInteger(outputSize) || outputSize < 2 || outputSize > 5000) {
    throw new Error("outputSize must be a whole number between 2 and 5000.");
  }
}

function getGlobalError(payload: Record<string, unknown>) {
  const errorPayload = payload as TwelveDataGlobalError;
  const status = readString(errorPayload.status);
  const message = readString(errorPayload.message);
  const code = readErrorCode(errorPayload.code);

  if (status === "error" || (message && !("values" in payload))) {
    return {
      code,
      message: message ?? "Twelve Data returned an unknown error.",
    };
  }

  return null;
}

export function createForexPairBatches(batchSize = 7): ForexPair[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(
      `batchSize must be a whole number between 1 and ${MAX_BATCH_SIZE}.`,
    );
  }

  const batches: ForexPair[][] = [];

  for (let index = 0; index < FOREX_PAIRS.length; index += batchSize) {
    batches.push([...FOREX_PAIRS.slice(index, index + batchSize)]);
  }

  return batches;
}

export async function fetchTwelveDataForexBatch({
  pairs,
  timeframe,
  outputSize = DEFAULT_OUTPUT_SIZE,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: FetchTwelveDataForexBatchOptions): Promise<TwelveDataForexBatchResult> {
  validatePairs(pairs);
  validateOutputSize(outputSize);

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
    throw new Error("timeoutMs must be at least 1000 milliseconds.");
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "TWELVE_DATA_API_KEY is missing. Add it to .env.local and restart the server.",
    );
  }

  const interval = getTwelveDataInterval(timeframe);
  const parameters = new URLSearchParams({
    symbol: pairs.join(","),
    interval,
    outputsize: String(outputSize),
    timezone: "UTC",
    format: "JSON",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${TWELVE_DATA_BASE_URL}/time_series?${parameters.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `apikey ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    const rawPayload = (await response.json()) as unknown;

    if (!isRecord(rawPayload)) {
      throw new Error("Twelve Data returned an invalid JSON response.");
    }

    const globalError = getGlobalError(rawPayload);

    if (!response.ok || globalError) {
      const message =
        globalError?.message ??
        `Twelve Data returned HTTP status ${response.status}.`;

      throw new Error(message);
    }

    const candles: Partial<Record<ForexPair, ForexCandle[]>> = {};
    const pairErrors: TwelveDataPairError[] = [];
    const isSinglePairRequest = pairs.length === 1;
    const currentTimeMs = Date.now();

    for (const pair of pairs) {
      const series = getSeriesForPair(
        rawPayload,
        pair,
        isSinglePairRequest,
      );

      if (!series) {
        pairErrors.push({
          pair,
          code: null,
          message: "No response was returned for this pair.",
        });
        continue;
      }

      const status = readString(series.status);
      const message = readString(series.message);
      const code = readErrorCode(series.code);

      if (status === "error" || !Array.isArray(series.values)) {
        pairErrors.push({
          pair,
          code,
          message: message ?? "No candle data was returned for this pair.",
        });
        continue;
      }

      const parsedCandles = parseSeriesCandles(
        series,
        timeframe,
        currentTimeMs,
      );

      if (parsedCandles.length === 0) {
        pairErrors.push({
          pair,
          code,
          message:
            "No completed candle data could be parsed for this pair.",
        });
        continue;
      }

      candles[pair] = parsedCandles;
    }

    return {
      provider: "Twelve Data",
      timeframe,
      interval,
      requestedPairs: [...pairs],
      candles,
      pairErrors,
      fetchedAt: new Date().toISOString(),
      apiCreditsUsed: parseHeaderNumber(
        response.headers.get("api-credits-used"),
      ),
      apiCreditsLeft: parseHeaderNumber(
        response.headers.get("api-credits-left"),
      ),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The Twelve Data forex request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}