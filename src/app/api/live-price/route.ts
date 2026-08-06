import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YAHOO_SYMBOLS: Record<string, string> = {
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  AUDUSD: "AUDUSD=X",
  NZDUSD: "NZDUSD=X",
  USDJPY: "JPY=X",
  USDCAD: "CAD=X",
  USDCHF: "CHF=X",
  EURGBP: "EURGBP=X",
  EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X",
  DXY: "DX-Y.NYB",
  US30: "YM=F",
  NAS100: "NQ=F",
  SPX500: "ES=F",
  XAUUSD: "GC=F",
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

export async function GET(request: NextRequest) {
  const pair = new URL(request.url).searchParams.get("pair")?.toUpperCase();

  if (!pair || !YAHOO_SYMBOLS[pair]) {
    return NextResponse.json(
      { error: "Invalid pair", price: null },
      { status: 400 },
    );
  }

  const yahooSymbol = YAHOO_SYMBOLS[pair];

  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 5 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Yahoo Finance request failed with status ${response.status}.`,
          price: null,
        },
        { status: 502 },
      );
    }

    const payload: unknown = await response.json();
    const chart = isRecord(payload) && isRecord(payload.chart)
      ? payload.chart
      : null;
    const results = chart && Array.isArray(chart.result)
      ? chart.result
      : [];
    const result = results.length > 0 && isRecord(results[0])
      ? results[0]
      : null;
    const meta = result && isRecord(result.meta) ? result.meta : null;
    const price = meta ? readNumber(meta.regularMarketPrice) : null;
    const quoteTimestamp = meta
      ? readNumber(meta.regularMarketTime)
      : null;

    if (price === null) {
      return NextResponse.json(
        { error: "No Yahoo price data", price: null },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        price,
        pair,
        symbol: yahooSymbol,
        provider: "Yahoo Finance",
        timestamp: Date.now(),
        quoteTimestamp:
          quoteTimestamp === null
            ? null
            : new Date(quoteTimestamp * 1000).toISOString(),
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=5, stale-while-revalidate=10",
        },
      },
    );
  } catch (error) {
    console.error("YAHOO LIVE PRICE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Yahoo price fetch failed",
        price: null,
      },
      { status: 500 },
    );
  }
}