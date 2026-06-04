import { NextRequest, NextResponse } from 'next/server';

const YAHOO_SYMBOLS: Record<string, string> = {
  'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'AUDUSD': 'AUDUSD=X',
  'NZDUSD': 'NZDUSD=X', 'USDJPY': 'JPY=X', 'USDCAD': 'CAD=X',
  'USDCHF': 'CHF=X', 'EURGBP': 'EURGBP=X', 'EURJPY': 'EURJPY=X',
  'GBPJPY': 'GBPJPY=X', 'DXY': 'DX-Y.NYB', 'US30': 'YM=F',
  'NAS100': 'NQ=F', 'SPX500': 'ES=F', 'XAUUSD': 'GC=F',
  'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get('pair');

  if (!pair || !YAHOO_SYMBOLS[pair]) {
    return NextResponse.json({ error: 'Invalid pair' }, { status: 400 });
  }

  const yahooSymbol = YAHOO_SYMBOLS[pair];

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 5 },
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Upstream error', price: null }, { status: 502 });
    }

    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (meta && meta.regularMarketPrice) {
      return NextResponse.json({
        price: meta.regularMarketPrice,
        pair,
        symbol: yahooSymbol,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({ error: 'No price data', price: null }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Fetch failed', price: null }, { status: 500 });
  }
}
