"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart2, Calendar, Clock, Globe } from "lucide-react";

interface EconomicEvent {
  id?: string;
  external_id?: string;
  title?: string;
  country?: string | null;
  currency?: string | null;
  impact?: string | null;
  event_time?: string | null;
  forecast?: number | null;
  previous?: number | null;
  actual?: number | null;
  unit?: string | null;
  source?: string | null;
}

interface EconomicEventsResponse {
  events?: EconomicEvent[];
  lastUpdated?: string;
}

function formatEventValue(value?: number | null, unit?: string | null) {
  if (value === null || value === undefined) return "-";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function getImpactStyles(impact?: string | null) {
  const cleanImpact = impact?.toLowerCase();

  if (cleanImpact === "high") return "bg-red-500/20 text-red-400";
  if (cleanImpact === "medium") return "bg-orange-500/20 text-orange-400";

  return "bg-green-500/20 text-green-400";
}

function getEventDateOnly(eventTime?: string | null) {
  if (!eventTime) return "";
  return eventTime.split("T")[0] || "";
}

function formatEventTime(eventTime?: string | null) {
  if (!eventTime) return "Time unavailable";

  const date = new Date(eventTime);

  if (Number.isNaN(date.getTime())) {
    return "Invalid time";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventDate(eventTime?: string | null) {
  if (!eventTime) return "";

  const date = new Date(eventTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString();
}

export default function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currencyFilter, setCurrencyFilter] = useState("All");
  const [impactFilter, setImpactFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/economic-events", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch economic events.");
        }

        const data = (await response.json()) as EconomicEventsResponse;

        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong while loading economic events.";

        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const currencies = useMemo(() => {
    const uniqueCurrencies = events
      .map((event) => event.currency)
      .filter((currency): currency is string => Boolean(currency));

    return ["All", ...Array.from(new Set(uniqueCurrencies)).sort()];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const eventCurrency = event.currency || "";
      const eventImpact = event.impact || "";
      const eventDate = getEventDateOnly(event.event_time);

      const matchesCurrency =
        currencyFilter === "All" || eventCurrency === currencyFilter;

      const matchesImpact =
        impactFilter === "All" ||
        eventImpact.toLowerCase() === impactFilter.toLowerCase();

      const matchesDate = !dateFilter || eventDate === dateFilter;

      return matchesCurrency && matchesImpact && matchesDate;
    });
  }, [currencyFilter, dateFilter, events, impactFilter]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-800 bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
        <span className="ml-3 font-mono text-sm text-gray-400">
          Loading market data...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-900/10 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="font-mono text-sm text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border border-gray-800 bg-[#111111] p-4 md:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-gray-500">
            <Globe className="h-3 w-3" />
            Currency
          </label>

          <select
            value={currencyFilter}
            onChange={(event) => setCurrencyFilter(event.target.value)}
            className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white focus:border-yellow-400 focus:outline-none"
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-gray-500">
            <AlertTriangle className="h-3 w-3" />
            Impact
          </label>

          <select
            value={impactFilter}
            onChange={(event) => setImpactFilter(event.target.value)}
            className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white focus:border-yellow-400 focus:outline-none"
          >
            <option value="All">All Impact</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-gray-500">
            <Calendar className="h-3 w-3" />
            Date
          </label>

          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white focus:border-yellow-400 focus:outline-none [color-scheme:dark]"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setCurrencyFilter("All");
              setImpactFilter("All");
              setDateFilter("");
            }}
            className="w-full rounded border border-gray-700 bg-gray-800 py-2 font-mono text-sm text-gray-300 transition hover:bg-gray-700"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0a0a0a]">
        <div className="divide-y divide-gray-800">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event, index) => (
              <div
                key={event.id || event.external_id || index}
                className="group p-4 transition hover:bg-yellow-400/5 md:grid md:grid-cols-12 md:items-center md:gap-4"
              >
                <div className="mb-2 flex items-center gap-2 md:col-span-2 md:mb-0">
                  <Clock className="h-3 w-3 text-cyan-400 md:hidden" />
                  <div>
                    <span className="block font-mono text-sm text-cyan-400">
                      {formatEventTime(event.event_time)}
                    </span>
                    <span className="block font-mono text-[10px] text-gray-600">
                      {formatEventDate(event.event_time)}
                    </span>
                  </div>
                </div>

                <div className="mb-2 md:col-span-1 md:mb-0">
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                    {event.currency || "N/A"}
                  </span>
                </div>

                <div className="mb-3 md:col-span-3 md:mb-0">
                  <h4 className="font-mono text-sm font-medium text-white group-hover:text-yellow-400">
                    {event.title || "Untitled event"}
                  </h4>
                  <p className="mt-1 font-mono text-[10px] text-gray-500">
                    {event.country || "Global"}
                  </p>
                </div>

                <div className="mb-4 flex md:col-span-1 md:mb-0 md:justify-center">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-tight ${getImpactStyles(
                      event.impact
                    )}`}
                  >
                    {event.impact || "low"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-gray-800 pt-3 md:col-span-3 md:border-0 md:pt-0">
                  <span className="font-mono text-sm text-gray-400">
                    {formatEventValue(event.forecast, event.unit)}
                  </span>

                  <span className="font-mono text-sm text-gray-400">
                    {formatEventValue(event.previous, event.unit)}
                  </span>

                  <span className="font-mono text-sm font-bold text-gray-500">
                    {event.actual === null || event.actual === undefined
                      ? "Pending"
                      : formatEventValue(event.actual, event.unit)}
                  </span>
                </div>

                <div className="mt-3 text-right md:col-span-2 md:mt-0">
                  <span className="font-mono text-[10px] italic text-gray-600">
                    {event.source || "Unknown"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="font-mono text-gray-500">
                No economic events found matching your filters.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
        <BarChart2 className="h-4 w-4 text-yellow-400" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/80">
          Temporary mock data is currently being synced into Supabase. Real
          provider data will replace this later.
        </p>
      </div>
    </div>
  );
}
