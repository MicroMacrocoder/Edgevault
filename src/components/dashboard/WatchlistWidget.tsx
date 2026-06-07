"use client";

import { useState, useEffect, useMemo } from "react";
import { Eye, TrendingUp, TrendingDown, Globe, AlertTriangle } from "lucide-react";

interface WatchlistPair {
  symbol: string;
  name: string;
  strength: number; // -100 to 100
  direction: "bullish" | "bearish" | "neutral";
  newsCount: number;
  highImpactNews: number;
}

const WATCHLIST_PAIRS: WatchlistPair[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", strength: 0, direction: "neutral", newsCount: 0, highImpactNews: 0 },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", strength: 0, direction: "neutral", newsCount: 0, highImpactNews: 0 },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", strength: 0, direction: "neutral", newsCount: 0, highImpactNews: 0 },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", strength: 0, direction: "neutral", newsCount: 0, highImpactNews: 0 },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", strength: 0, direction: "neutral", newsCount: 0, highImpactNews: 0 },
  { symbol: "XAU/USD", name: "Gold / US Dollar", strength: 0, direction: "neutral", newsCount: 0, highImpactNews: 0 },
];

function getDirectionFromStrength(base: number, quote: number): "bullish" | "bearish" | "neutral" {
  const diff = base - quote;
  if (diff > 15) return "bullish";
  if (diff < -15) return "bearish";
  return "neutral";
}

export default function WatchlistWidget() {
  const [pairs, setPairs] = useState<WatchlistPair[]>(WATCHLIST_PAIRS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch currency strength data
        const strengthRes = await fetch("/api/currency-strength");
        let strengthData: Record<string, number> = {};
        if (strengthRes.ok) {
          const result = await strengthRes.json();
          if (result.strength) strengthData = result.strength;
        }

        // Fetch news for counting
        const newsRes = await fetch("/api/fundamentals");
        let newsEvents: any[] = [];
        if (newsRes.ok) {
          const result = await newsRes.json();
          if (Array.isArray(result)) newsEvents = result;
        }

        // Update pairs with real data
        const updated = WATCHLIST_PAIRS.map((pair) => {
          const [base, quote] = pair.symbol.split("/");
          const baseStrength = strengthData[base] || 0;
          const quoteStrength = strengthData[quote] || 0;
          const netStrength = baseStrength - quoteStrength;

          // Count news for this pair's currencies
          const relevantNews = newsEvents.filter(
            (e) => e.currency === base || e.currency === quote
          );
          const highImpact = relevantNews.filter(
            (e) => (e.impact || "").toLowerCase() === "high"
          );

          return {
            ...pair,
            strength: Math.round(netStrength),
            direction: getDirectionFromStrength(baseStrength, quoteStrength),
            newsCount: relevantNews.length,
            highImpactNews: highImpact.length,
          };
        });

        setPairs(updated);
      } catch {
        // Keep defaults
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
        </div>
      ) : (
        pairs.map((pair) => (
          <div
            key={pair.symbol}
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-black px-4 py-3 transition hover:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded ${
                  pair.direction === "bullish"
                    ? "bg-green-500/20"
                    : pair.direction === "bearish"
                    ? "bg-red-500/20"
                    : "bg-gray-800"
                }`}
              >
                {pair.direction === "bullish" ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : pair.direction === "bearish" ? (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </div>
              <div>
                <p className="font-mono text-sm font-bold text-white">
                  {pair.symbol}
                </p>
                <p className="text-[10px] text-gray-500">{pair.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Strength meter */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pair.strength > 0
                        ? "bg-green-400"
                        : pair.strength < 0
                        ? "bg-red-400"
                        : "bg-gray-600"
                    }`}
                    style={{
                      width: `${Math.min(Math.abs(pair.strength), 100)}%`,
                      marginLeft: pair.strength < 0 ? "auto" : undefined,
                    }}
                  />
                </div>
                <span
                  className={`font-mono text-xs font-bold ${
                    pair.strength > 0
                      ? "text-green-400"
                      : pair.strength < 0
                      ? "text-red-400"
                      : "text-gray-500"
                  }`}
                >
                  {pair.strength > 0 ? "+" : ""}
                  {pair.strength}
                </span>
              </div>

              {/* News indicator */}
              <div className="flex items-center gap-1.5">
                {pair.highImpactNews > 0 && (
                  <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {pair.highImpactNews}
                  </span>
                )}
                <span className="flex items-center gap-1 rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                  <Globe className="h-2.5 w-2.5" />
                  {pair.newsCount}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
