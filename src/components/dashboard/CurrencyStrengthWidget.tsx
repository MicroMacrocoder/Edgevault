"use client";

import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { useCurrencyStrength } from "@/hooks/useCurrencyStrength";

interface CurrencyData {
  currency: string;
  strength: number;
}

const CURRENCY_COLORS: Record<string, string> = {
  USD: "#facc15", // yellow
  EUR: "#22d3ee", // cyan
  GBP: "#a78bfa", // purple
  JPY: "#f87171", // red
  AUD: "#4ade80", // green
  CAD: "#fb923c", // orange
  CHF: "#f472b6", // pink
  NZD: "#60a5fa", // blue
};

export default function CurrencyStrengthWidget() {
  const router = useRouter();
  const { data: currencyData, loading } = useCurrencyStrength();

  // Transform hook data to component format
  const currencies: CurrencyData[] = currencyData.map((item) => ({
    currency: item.currency,
    strength: item.strength,
  }));

  if (loading || currencies.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Click to view full analysis →</p>
        <button
          onClick={() => router.push('/dashboard?section=fundamentals&tab=currency-strength')}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:text-yellow-400 hover:bg-gray-900 transition"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </button>
      </div>
      {currencies.length > 0 ? currencies.map((item) => {
        const color = CURRENCY_COLORS[item.currency] || "#9ca3af";
        const barWidth = Math.abs(item.strength);
        const isPositive = item.strength > 0;
        const isNeutral = Math.abs(item.strength) < 5;

        return (
          <div key={item.currency} className="flex items-center gap-3">
            <span
              className="w-8 font-mono text-xs font-bold"
              style={{ color }}
            >
              {item.currency}
            </span>

            {/* Strength bar */}
            <div className="relative flex-1 h-5">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 h-full w-px bg-gray-700" />
              {/* Bar */}
              <div className="absolute top-1 h-3 flex items-center" style={{
                left: isPositive ? "50%" : `${50 - barWidth / 2}%`,
                width: `${barWidth / 2}%`,
              }}>
                <div
                  className="h-full w-full rounded-sm transition-all"
                  style={{
                    backgroundColor: isPositive ? "#4ade80" : "#f87171",
                    opacity: isNeutral ? 0.3 : 0.7,
                  }}
                />
              </div>
            </div>

            {/* Value */}
            <div className="flex w-16 items-center justify-end gap-1">
              {isNeutral ? (
                <Minus className="h-3 w-3 text-gray-500" />
              ) : isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-400" />
              )}
              <span
                className={`font-mono text-xs font-bold ${
                  isNeutral
                    ? "text-gray-500"
                    : isPositive
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {item.strength > 0 ? "+" : ""}{item.strength}
              </span>
            </div>
          </div>
        );
      }) : (
        <div className="text-center text-xs text-gray-500 py-4">
          No currency strength data available
        </div>
      )}
    </div>
  );
}
