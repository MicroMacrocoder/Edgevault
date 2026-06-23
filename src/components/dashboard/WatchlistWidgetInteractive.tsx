"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, TrendingUp, TrendingDown } from "lucide-react";

interface WatchlistPair {
  pair: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: number;
  newsCount: number;
}

export default function WatchlistWidget() {
  const router = useRouter();
  const [pairs, setPairs] = useState<WatchlistPair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder data - would be fetched from Supabase
    setPairs([
      { pair: "EUR/USD", direction: "bearish", strength: -45, newsCount: 3 },
      { pair: "GBP/USD", direction: "bearish", strength: -38, newsCount: 2 },
      { pair: "USD/JPY", direction: "bullish", strength: 52, newsCount: 1 },
      { pair: "AUD/USD", direction: "neutral", strength: -8, newsCount: 0 },
    ]);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Watched Pairs</p>
        <button
          onClick={() => router.push('/dashboard?section=fundamentals&tab=watchlist')}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:text-yellow-400 hover:bg-gray-900 transition"
        >
          <ExternalLink className="h-3 w-3" />
          View All
        </button>
      </div>

      <div className="space-y-2">
        {pairs.map((p) => (
          <div
            key={p.pair}
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/50 px-3 py-2 cursor-pointer hover:border-gray-700 transition"
            onClick={() => router.push(`/dashboard?section=fundamentals&pair=${p.pair}`)}
          >
            <div className="flex-1">
              <p className="font-mono text-sm font-semibold text-white">{p.pair}</p>
              <p className="text-xs text-gray-500">{p.newsCount} high-impact news</p>
            </div>
            <div className="flex items-center gap-2">
              {p.direction === "bullish" ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : p.direction === "bearish" ? (
                <TrendingDown className="h-4 w-4 text-red-400" />
              ) : (
                <div className="h-4 w-4 text-gray-500">—</div>
              )}
              <span
                className={`font-mono text-xs font-bold ${
                  p.direction === "bullish"
                    ? "text-green-400"
                    : p.direction === "bearish"
                    ? "text-red-400"
                    : "text-gray-500"
                }`}
              >
                {p.strength > 0 ? "+" : ""}{p.strength}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
