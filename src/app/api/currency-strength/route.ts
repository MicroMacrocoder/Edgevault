import { NextResponse } from "next/server";

// Currency futures symbols on Yahoo Finance
const CURRENCY_FUTURES: Record<string, string> = {
  USD: "DX-Y.NYB",  // Dollar Index
  EUR: "6E=F",      // Euro FX Futures
  GBP: "6B=F",      // British Pound Futures
  JPY: "6J=F",      // Japanese Yen Futures
  AUD: "6A=F",      // Australian Dollar Futures
  CAD: "6C=F",      // Canadian Dollar Futures
  CHF: "6S=F",      // Swiss Franc Futures
  NZD: "6N=F",      // New Zealand Dollar Futures
};

interface StrengthData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

async function fetchFuturesData(symbol: string): Promise<StrengthData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const currentPrice = meta?.regularMarketPrice || closes[closes.length - 1] || 0;
    const previousClose = meta?.chartPreviousClose || closes[closes.length - 2] || currentPrice;

    const change = currentPrice - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol,
      price: currentPrice,
      change,
      changePercent,
    };
  } catch {
    return null;
  }
}

// Normalize strength to a -100 to 100 scale based on recent % change
function calculateStrength(changePercent: number, isInverse: boolean = false): number {
  // Scale: 1% change = ~50 strength points
  let strength = changePercent * 50;
  if (isInverse) strength = -strength;
  return Math.max(-100, Math.min(100, Math.round(strength)));
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      Object.entries(CURRENCY_FUTURES).map(async ([currency, symbol]) => {
        const data = await fetchFuturesData(symbol);
        return { currency, data };
      })
    );

    const strength: Record<string, number> = {};
    const details: Record<string, { price: number; change: number; changePercent: number }> = {};

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.data) {
        const { currency, data } = result.value;
        // USD is special - DXY going up means USD is strong
        // Other futures going up means that currency is strong vs USD
        const isUSD = currency === "USD";
        strength[currency] = calculateStrength(data.changePercent, false);
        details[currency] = {
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
        };
      }
    }

    return NextResponse.json({
      strength,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch currency strength data" },
      { status: 500 }
    );
  }
}
