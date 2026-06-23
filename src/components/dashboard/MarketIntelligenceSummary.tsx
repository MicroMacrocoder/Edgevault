"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";

interface MarketIntelligence {
  market: string;
  commercialBias: "bullish" | "bearish" | "neutral";
  commercialNetPosition: number;
  volumeTrend: "increasing" | "decreasing" | "stable";
  oiTrend: "increasing" | "decreasing" | "stable";
  narrative: string;
  confidence: number;
}

export default function MarketIntelligenceSummary() {
  const router = useRouter();
  const [intelligence, setIntelligence] = useState<MarketIntelligence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder data - would be fetched from API combining COT + Volume + OI
    setIntelligence({
      market: "US Dollar Index (DXY)",
      commercialBias: "bullish",
      commercialNetPosition: 45000,
      volumeTrend: "increasing",
      oiTrend: "increasing",
      narrative:
        "Commercials are aggressively long USD with increasing net positions. Rising volume and open interest confirm new money entering long positions. This hedging program suggests strong conviction for USD strength. Retail positioning is opposite (short), indicating potential for continued squeeze higher.",
      confidence: 78,
    });
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  if (!intelligence) return null;

  const biasColor = {
    bullish: "text-green-400",
    bearish: "text-red-400",
    neutral: "text-gray-400",
  }[intelligence.commercialBias];

  const biasIcon = {
    bullish: <TrendingUp className="h-4 w-4" />,
    bearish: <TrendingDown className="h-4 w-4" />,
    neutral: <div className="h-4 w-4">—</div>,
  }[intelligence.commercialBias];

  return (
    <div className="space-y-3 rounded-lg border border-gray-800 bg-black/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <h3 className="font-mono text-sm font-bold uppercase text-white">
            Market Intelligence
          </h3>
        </div>
        <button
          onClick={() => router.push('/dashboard?section=fundamentals&tab=cot')}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:text-yellow-400 hover:bg-gray-900 transition"
        >
          <ExternalLink className="h-3 w-3" />
          Details
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">{intelligence.market}</span>
          <div className={`flex items-center gap-1 font-mono font-bold ${biasColor}`}>
            {biasIcon}
            <span className="capitalize">{intelligence.commercialBias}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border border-gray-800 bg-black/50 px-2 py-1.5">
            <p className="text-gray-500">Commercial Position</p>
            <p className="font-mono font-bold text-yellow-400">
              +{(intelligence.commercialNetPosition / 1000).toFixed(0)}K
            </p>
          </div>
          <div className="rounded border border-gray-800 bg-black/50 px-2 py-1.5">
            <p className="text-gray-500">Volume</p>
            <p className={`font-mono font-bold ${intelligence.volumeTrend === "increasing" ? "text-green-400" : "text-red-400"}`}>
              {intelligence.volumeTrend === "increasing" ? "↑" : "↓"} {intelligence.volumeTrend}
            </p>
          </div>
          <div className="rounded border border-gray-800 bg-black/50 px-2 py-1.5">
            <p className="text-gray-500">Open Interest</p>
            <p className={`font-mono font-bold ${intelligence.oiTrend === "increasing" ? "text-green-400" : "text-red-400"}`}>
              {intelligence.oiTrend === "increasing" ? "↑" : "↓"} {intelligence.oiTrend}
            </p>
          </div>
        </div>

        <div className="rounded border border-gray-800 bg-black/50 px-3 py-2">
          <p className="text-gray-400 leading-relaxed">{intelligence.narrative}</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-500">Analysis Confidence</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all"
                style={{ width: `${intelligence.confidence}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-yellow-400">
              {intelligence.confidence}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
