export const MARKET_INTELLIGENCE_SYMBOLS = [
  "DXY",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "CHF",
  "AUD",
  "NZD",
] as const;

export type MarketIntelligenceSymbol =
  (typeof MARKET_INTELLIGENCE_SYMBOLS)[number];

export type MarketIntelligencePriceObservation = {
  tradeDate: string;
  close: number;

  /**
   * Exact BiQuote instrument and close before any orientation adjustment.
   */
  sourceSymbol: string;
  sourceClose: number;

  /**
   * true for USDJPY / USDCAD / USDCHF because those pairs are quoted
   * with USD as the base currency. EdgeVault inverts them so a rising
   * Market Intelligence Price series means the tracked currency itself
   * is rising.
   */
  inverted: boolean;
};

type PriceInstrumentDefinition = {
  symbol: MarketIntelligenceSymbol;
  streamSymbol: string;
  inverted: boolean;
};

type BiQuoteBar = {
  openTime?: unknown;
  close?: unknown;
  isOpen?: unknown;
};

const BIQUOTE_BASE_URL = "https://biquote.io";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * More than 15 daily candles are requested because the later alignment
 * step must keep only dates shared by Price + Open Interest + Volume.
 */
const DEFAULT_DAILY_HISTORY_LIMIT = 45;

const PRICE_INSTRUMENTS: Record<
  MarketIntelligenceSymbol,
  PriceInstrumentDefinition
> = {
  DXY: {
    symbol: "DXY",
    streamSymbol: "DXY",
    inverted: false,
  },
  EUR: {
    symbol: "EUR",
    streamSymbol: "EURUSD",
    inverted: false,
  },
  GBP: {
    symbol: "GBP",
    streamSymbol: "GBPUSD",
    inverted: false,
  },
  JPY: {
    symbol: "JPY",
    streamSymbol: "USDJPY",
    inverted: true,
  },
  CAD: {
    symbol: "CAD",
    streamSymbol: "USDCAD",
    inverted: true,
  },
  CHF: {
    symbol: "CHF",
    streamSymbol: "USDCHF",
    inverted: true,
  },
  AUD: {
    symbol: "AUD",
    streamSymbol: "AUDUSD",
    inverted: false,
  },
  NZD: {
    symbol: "NZD",
    streamSymbol: "NZDUSD",
    inverted: false,
  },
};

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim() !== ""
      ? value.trim()
      : null
  );
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

function normalizeIsoDateTime(
  value: string
) {
  const parsed = new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed.toISOString();
}

function getTradeDate(
  isoDateTime: string
) {
  return isoDateTime.slice(0, 10);
}

function orientClose(
  sourceClose: number,
  inverted: boolean
) {
  if (!inverted) {
    return sourceClose;
  }

  return 1 / sourceClose;
}

async function fetchJson(
  url: URL,
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    const response = await fetch(
      url,
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    const payload: unknown =
      await response.json();

    if (!response.ok) {
      const message =
        isRecord(payload) &&
        readString(payload.message)
          ? readString(
              payload.message
            )
          : `BiQuote returned HTTP ${response.status}.`;

      throw new Error(
        message ??
          "BiQuote request failed."
      );
    }

    return payload;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "The BiQuote Market Intelligence price request timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch completed D1 closes for one Market Intelligence market.
 *
 * Important:
 * - Current unfinished D1 candles are excluded.
 * - Results are returned oldest -> newest.
 * - JPY/CAD/CHF are inverted so their price direction represents the
 *   tracked currency rather than the USD-base source pair.
 * - This helper intentionally does not touch the existing Momentum route.
 */
export async function fetchMarketIntelligencePriceHistory(
  symbol: MarketIntelligenceSymbol,
  limit = DEFAULT_DAILY_HISTORY_LIMIT
): Promise<
  MarketIntelligencePriceObservation[]
> {
  const definition =
    PRICE_INSTRUMENTS[symbol];

  const url = new URL(
    `${BIQUOTE_BASE_URL}/api/${encodeURIComponent(
      definition.streamSymbol
    )}/ohlc`
  );

  url.searchParams.set(
    "interval",
    "1d"
  );

  url.searchParams.set(
    "limit",
    String(limit)
  );

  const payload =
    await fetchJson(url);

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.bars)
  ) {
    throw new Error(
      `${definition.streamSymbol} returned invalid BiQuote daily OHLC data.`
    );
  }

  const byTradeDate =
    new Map<
      string,
      MarketIntelligencePriceObservation
    >();

  for (
    const value of payload.bars
  ) {
    if (!isRecord(value)) {
      continue;
    }

    const typed =
      value as BiQuoteBar;

    /*
     * Market Intelligence uses completed daily observations.
     * The live/current D1 candle belongs to Momentum/real-time tools,
     * not to the frozen historical intelligence window.
     */
    if (typed.isOpen === true) {
      continue;
    }

    const openTime =
      readString(
        typed.openTime
      );

    const sourceClose =
      readNumber(
        typed.close
      );

    if (
      !openTime ||
      sourceClose === null ||
      sourceClose <= 0
    ) {
      continue;
    }

    const normalized =
      normalizeIsoDateTime(
        openTime
      );

    if (!normalized) {
      continue;
    }

    const tradeDate =
      getTradeDate(
        normalized
      );

    const close =
      orientClose(
        sourceClose,
        definition.inverted
      );

    if (
      !Number.isFinite(close) ||
      close <= 0
    ) {
      continue;
    }

    byTradeDate.set(
      tradeDate,
      {
        tradeDate,
        close,
        sourceSymbol:
          definition.streamSymbol,
        sourceClose,
        inverted:
          definition.inverted,
      }
    );
  }

  const observations =
    Array.from(
      byTradeDate.values()
    ).sort(
      (first, second) =>
        first.tradeDate.localeCompare(
          second.tradeDate
        )
    );

  if (!observations.length) {
    throw new Error(
      `${definition.streamSymbol} returned no completed daily Price observations for Market Intelligence.`
    );
  }

  return observations;
}

export function getMarketIntelligencePriceSource(
  symbol: MarketIntelligenceSymbol
) {
  return {
    ...PRICE_INSTRUMENTS[
      symbol
    ],
    provider: "BiQuote MT5",
    interval: "1d",
  };
}