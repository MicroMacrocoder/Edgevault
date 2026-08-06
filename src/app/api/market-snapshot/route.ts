import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";
const CACHE_SECONDS = 60;

const DISPLAY_PAIRS = [
  { symbol: "EUR/USD", label: "EURUSD", side: "USD quote" },
  { symbol: "GBP/USD", label: "GBPUSD", side: "USD quote" },
  { symbol: "USD/CAD", label: "USDCAD", side: "USD base" },
  { symbol: "USD/JPY", label: "USDJPY", side: "USD base" },
] as const;

const DXY_COMPONENTS = [
  "EUR/USD",
  "GBP/USD",
  "USD/CAD",
  "USD/JPY",
  "USD/CHF",
  "USD/SEK",
] as const;

type TwelveDataQuote = {
  symbol?: unknown;
  name?: unknown;
  exchange?: unknown;
  datetime?: unknown;
  timestamp?: unknown;
  close?: unknown;
  previous_close?: unknown;
  change?: unknown;
  percent_change?: unknown;
  is_market_open?: unknown;
  status?: unknown;
  code?: unknown;
  message?: unknown;
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
  source: string;
  error: string | null;
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

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeSymbol(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getQuote(
  payload: Record<string, unknown>,
  symbol: string,
  singleSymbolRequest = false,
): TwelveDataQuote | null {
  if (
    singleSymbolRequest &&
    ("close" in payload || "status" in payload || "message" in payload)
  ) {
    return payload as TwelveDataQuote;
  }

  const direct = payload[symbol];

  if (isRecord(direct)) {
    return direct as TwelveDataQuote;
  }

  const wanted = normalizeSymbol(symbol);

  for (const [key, value] of Object.entries(payload)) {
    if (normalizeSymbol(key) === wanted && isRecord(value)) {
      return value as TwelveDataQuote;
    }
  }

  return null;
}

function getQuoteError(quote: TwelveDataQuote | null) {
  if (!quote) {
    return "No quote was returned.";
  }

  const status = readString(quote.status);
  const message = readString(quote.message);

  if (status === "error" || message) {
    return message ?? "The provider returned an error.";
  }

  return null;
}

function calculatePercentChange(value: number | null, previous: number | null) {
  if (value === null || previous === null || previous === 0) {
    return null;
  }

  return ((value - previous) / previous) * 100;
}

function createSnapshotItem(
  symbol: string,
  label: string,
  side: string,
  quote: TwelveDataQuote | null,
): SnapshotItem {
  const quoteError = getQuoteError(quote);
  const value = quoteError ? null : readNumber(quote?.close);
  const previousClose = quoteError
    ? null
    : readNumber(quote?.previous_close);
  const providerChange = quoteError ? null : readNumber(quote?.change);
  const providerPercent = quoteError
    ? null
    : readNumber(quote?.percent_change);

  return {
    symbol,
    label,
    side,
    value,
    previousClose,
    change:
      providerChange ??
      (value !== null && previousClose !== null
        ? value - previousClose
        : null),
    percentChange:
      providerPercent ?? calculatePercentChange(value, previousClose),
    timestamp: quoteError ? null : readNumber(quote?.timestamp),
    datetime: quoteError ? null : readString(quote?.datetime),
    marketOpen: quoteError ? null : readBoolean(quote?.is_market_open),
    estimated: false,
    source: "Twelve Data",
    error:
      quoteError ??
      (value === null ? "The latest price is unavailable." : null),
  };
}

function calculateDxyFromQuotes(
  quotes: Record<string, TwelveDataQuote | null>,
  field: "close" | "previous_close",
) {
  const eurusd = readNumber(quotes["EUR/USD"]?.[field]);
  const usdjpy = readNumber(quotes["USD/JPY"]?.[field]);
  const gbpusd = readNumber(quotes["GBP/USD"]?.[field]);
  const usdcad = readNumber(quotes["USD/CAD"]?.[field]);
  const usdsek = readNumber(quotes["USD/SEK"]?.[field]);
  const usdchf = readNumber(quotes["USD/CHF"]?.[field]);

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

async function fetchQuotePayload(symbols: readonly string[]) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_API_KEY.");
  }

  const requestUrl = new URL(`${TWELVE_DATA_BASE_URL}/quote`);
  requestUrl.searchParams.set("symbol", symbols.join(","));

  const response = await fetch(requestUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `apikey ${apiKey}`,
    },
    next: { revalidate: CACHE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(
      `Twelve Data quote request failed with status ${response.status}.`,
    );
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new Error("Twelve Data returned an invalid quote response.");
  }

  const status = readString(payload.status);
  const message = readString(payload.message);

  if (status === "error" && message) {
    throw new Error(message);
  }

  return payload;
}

function latestTimestamp(items: SnapshotItem[]) {
  const timestamps = items
    .map((item) => item.timestamp)
    .filter((value): value is number => value !== null && value > 0);

  if (timestamps.length === 0) {
    return null;
  }

  return Math.max(...timestamps);
}

export async function GET() {
  try {
    const [forexPayload, dxyResult] = await Promise.all([
      fetchQuotePayload(DXY_COMPONENTS),
      fetchQuotePayload(["DXY"])
        .then((payload) => ({ payload, error: null as string | null }))
        .catch((error: unknown) => ({
          payload: null,
          error:
            error instanceof Error
              ? error.message
              : "DXY quote request failed.",
        })),
    ]);

    const componentQuotes: Record<string, TwelveDataQuote | null> = {};

    for (const symbol of DXY_COMPONENTS) {
      componentQuotes[symbol] = getQuote(forexPayload, symbol);
    }

    const pairItems = DISPLAY_PAIRS.map((pair) =>
      createSnapshotItem(
        pair.symbol,
        pair.label,
        pair.side,
        componentQuotes[pair.symbol],
      ),
    );

    const directDxyQuote = dxyResult.payload
      ? getQuote(dxyResult.payload, "DXY", true)
      : null;
    const directDxyItem = createSnapshotItem(
      "DXY",
      "DXY",
      "Dollar index",
      directDxyQuote,
    );

    let dxyItem = directDxyItem;

    if (directDxyItem.value === null) {
      const syntheticValue = calculateDxyFromQuotes(
        componentQuotes,
        "close",
      );
      const syntheticPreviousClose = calculateDxyFromQuotes(
        componentQuotes,
        "previous_close",
      );
      const componentItems = DXY_COMPONENTS.map((symbol) =>
        createSnapshotItem(
          symbol,
          normalizeSymbol(symbol),
          "DXY component",
          componentQuotes[symbol],
        ),
      );
      const componentTimestamp = latestTimestamp(componentItems);

      dxyItem = {
        symbol: "DXY",
        label: "DXY",
        side: "Dollar index estimate",
        value: syntheticValue,
        previousClose: syntheticPreviousClose,
        change:
          syntheticValue !== null && syntheticPreviousClose !== null
            ? syntheticValue - syntheticPreviousClose
            : null,
        percentChange: calculatePercentChange(
          syntheticValue,
          syntheticPreviousClose,
        ),
        timestamp: componentTimestamp,
        datetime: null,
        marketOpen: componentItems.some(
          (item) => item.marketOpen === true,
        ),
        estimated: true,
        source: "Twelve Data live FX basket estimate",
        error:
          syntheticValue === null
            ? dxyResult.error ??
              directDxyItem.error ??
              "DXY is unavailable."
            : null,
      };
    }

    const items = [dxyItem, ...pairItems];
    const availableCount = items.filter(
      (item) => item.value !== null,
    ).length;
    const timestamp = latestTimestamp(items);

    return NextResponse.json(
      {
        ok: availableCount > 0,
        provider: "Twelve Data",
        updatedAt: new Date().toISOString(),
        quoteTimestamp:
          timestamp === null
            ? null
            : new Date(timestamp * 1000).toISOString(),
        refreshAfterSeconds: CACHE_SECONDS,
        availableCount,
        requestedCount: items.length,
        items,
      },
      {
        status: availableCount > 0 ? 200 : 502,
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown market snapshot error.";

    console.error("MARKET SNAPSHOT ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "Twelve Data",
        error: message,
        items: [],
      },
      { status: 502 },
    );
  }
}
