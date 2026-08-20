import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BIQUOTE_LATEST_URL = "https://biquote.io/api/latest";
const REQUEST_TIMEOUT_MS = 12_000;
const STALE_AFTER_MINUTES = 5;

const SUPPORTED_SYMBOLS = new Set([
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDJPY",
  "USDCAD",
  "USDCHF",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "DXY",
  "US30",
  "NAS100",
  "SPX500",
  "XAUUSD",
  "BTCUSD",
  "ETHUSD",
]);

type BiQuoteTick = {
  symbol?: unknown;
  bid?: unknown;
  ask?: unknown;
  mid?: unknown;
  last?: unknown;
  timestamp?: unknown;
  time?: unknown;
  source?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function readTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getMidPrice(tick: BiQuoteTick): number | null {
  const directMid = readNumber(tick.mid);
  if (directMid !== null && directMid > 0) return directMid;

  const bid = readNumber(tick.bid);
  const ask = readNumber(tick.ask);
  if (bid !== null && ask !== null && bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }

  const last = readNumber(tick.last);
  return last !== null && last > 0 ? last : null;
}

function isStaleQuote(quoteTimestamp: string | null): boolean {
  if (!quoteTimestamp) return false;

  const ageMs = Date.now() - new Date(quoteTimestamp).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return false;

  return ageMs > STALE_AFTER_MINUTES * 60_000;
}

export async function GET(request: NextRequest) {
  const pair = new URL(request.url).searchParams.get("pair")?.toUpperCase();

  if (!pair || !SUPPORTED_SYMBOLS.has(pair)) {
    return NextResponse.json(
      {
        error: "Invalid or unsupported pair.",
        price: null,
        provider: "BiQuote MT5",
      },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const params = new URLSearchParams();
    params.append("symbols", pair);

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
      return NextResponse.json(
        {
          error: `BiQuote request failed with status ${response.status}.`,
          price: null,
          pair,
          provider: "BiQuote MT5",
        },
        { status: 502 },
      );
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      return NextResponse.json(
        {
          error: "BiQuote returned invalid latest-tick data.",
          price: null,
          pair,
          provider: "BiQuote MT5",
        },
        { status: 502 },
      );
    }

    const rawTick = payload[pair];
    if (!isRecord(rawTick)) {
      return NextResponse.json(
        {
          error: `BiQuote returned no quote for ${pair}.`,
          price: null,
          pair,
          provider: "BiQuote MT5",
        },
        { status: 404 },
      );
    }

    const tick = rawTick as BiQuoteTick;
    const price = getMidPrice(tick);
    if (price === null) {
      return NextResponse.json(
        {
          error: `BiQuote returned no valid price for ${pair}.`,
          price: null,
          pair,
          provider: "BiQuote MT5",
        },
        { status: 404 },
      );
    }

    const bid = readNumber(tick.bid);
    const ask = readNumber(tick.ask);
    const last = readNumber(tick.last);
    const quoteTimestamp =
      readTimestamp(tick.timestamp) ?? readTimestamp(tick.time);
    const stale = isStaleQuote(quoteTimestamp);
    const source = readString(tick.source);

    return NextResponse.json(
      {
        ok: true,
        pair,
        symbol: readString(tick.symbol) ?? pair,
        price,
        bid,
        ask,
        last,
        provider: source ? `BiQuote ${source}` : "BiQuote MT5",
        quoteTimestamp,
        stale,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "BiQuote price fetch failed.";

    console.error("BIQUOTE LIVE PRICE ERROR:", error);

    return NextResponse.json(
      {
        error: message,
        price: null,
        pair,
        provider: "BiQuote MT5",
      },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}