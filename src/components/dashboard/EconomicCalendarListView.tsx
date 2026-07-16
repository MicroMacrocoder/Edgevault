"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { EconomicEventEnhanced } from "@/lib/economicCalendarEnhanced";

interface EconomicCalendarListViewProps {
  events: EconomicEventEnhanced[];
  isLoading: boolean;
}

function getImpactColor(impact: string): string {
  switch (impact.toLowerCase()) {
    case "high":
      return "text-red-400 bg-red-400 bg-opacity-10 border-red-400";
    case "medium":
      return "text-yellow-400 bg-yellow-400 bg-opacity-10 border-yellow-400";
    case "low":
      return "text-green-400 bg-green-400 bg-opacity-10 border-green-400";
    default:
      return "text-gray-400 bg-gray-400 bg-opacity-10 border-gray-400";
  }
}

function getStatusColor(status: string): string {
  return status === "Released"
    ? "text-green-400"
    : "text-yellow-400";
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "—";
  return `${value}${unit}`;
}

export default function EconomicCalendarListView({
  events,
  isLoading,
}: EconomicCalendarListViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse border border-gray-800 bg-gray-900"
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="border border-gray-800 bg-gray-950 p-8 text-center">
        <p className="text-sm text-gray-500">No events match your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const isReleased = event.status === "Released";
        const actualVsForecast =
          event.actual !== null && event.forecast !== null
            ? event.actual > event.forecast
              ? "positive"
              : event.actual < event.forecast
                ? "negative"
                : "neutral"
            : null;

        return (
          <div
            key={event.id}
            className="border border-gray-800 bg-gray-950 p-3 transition hover:border-gray-700"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Left: Time and Event */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white">
                    {event.formattedTime}
                  </span>
                  <span className="text-xs font-semibold text-gray-400">
                    {event.formattedDate}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-sm font-bold text-white">
                  {event.indicator}
                </p>
              </div>

              {/* Middle: Currency and Impact */}
              <div className="flex items-center gap-2">
                <span className="inline-block rounded bg-gray-800 px-2 py-1 font-mono text-xs font-bold text-gray-300">
                  {event.currency}
                </span>
                <span
                  className={`inline-block border rounded px-2 py-1 font-mono text-xs font-bold ${getImpactColor(event.impact)}`}
                >
                  {event.impact}
                </span>
              </div>

              {/* Right: Values */}
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs text-gray-500">Forecast</p>
                  <p className="font-mono text-sm font-bold text-cyan-400">
                    {formatValue(event.forecast, event.unit)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Actual</p>
                  <p
                    className={`font-mono text-sm font-bold ${
                      isReleased
                        ? actualVsForecast === "positive"
                          ? "text-green-400"
                          : actualVsForecast === "negative"
                            ? "text-red-400"
                            : "text-gray-400"
                        : "text-gray-500"
                    }`}
                  >
                    {isReleased ? formatValue(event.actual, event.unit) : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Previous</p>
                  <p className="font-mono text-sm font-bold text-gray-400">
                    {formatValue(event.previous, event.unit)}
                  </p>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center">
                  {actualVsForecast === "positive" && (
                    <TrendingUp size={16} className="text-green-400" />
                  )}
                  {actualVsForecast === "negative" && (
                    <TrendingDown size={16} className="text-red-400" />
                  )}
                  <span className={`ml-2 text-xs font-bold ${getStatusColor(event.status)}`}>
                    {event.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
