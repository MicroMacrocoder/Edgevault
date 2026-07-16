"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  Clock,
  Globe,
  List,
  Grid3X3,
} from "lucide-react";

interface EconomicEvent {
  id?: string;
  title?: string;
  currency?: string | null;
  impact?: string | null;
  event_time?: string | null;
  forecast?: number | null;
  previous?: number | null;
  actual?: number | null;
  unit?: string | null;
  source?: string | null;
}

const SUPPORTED_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "USD"];

const TIMEZONE_OPTIONS = [
  { label: "UTC", value: "UTC" },
  { label: "New York (EST/EDT)", value: "America/New_York" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
  { label: "Frankfurt (CET/CEST)", value: "Europe/Berlin" },
  { label: "Hong Kong (HKT)", value: "Asia/Hong_Kong" },
  { label: "Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "Lagos (WAT)", value: "Africa/Lagos" },
  { label: "Johannesburg (SAST)", value: "Africa/Johannesburg" },
  { label: "Chicago (CST/CDT)", value: "America/Chicago" },
  { label: "Los Angeles (PST/PDT)", value: "America/Los_Angeles" },
];

function formatEventValue(value?: number | null, unit?: string | null) {
  if (value === null || value === undefined) return "-";
  var unitSuffix = unit ? " " + unit : "";
  return String(value) + unitSuffix;
}

function getImpactStyles(impact?: string | null) {
  var cleanImpact = impact?.toLowerCase();
  if (cleanImpact === "high") return "bg-red-500/20 text-red-400 border-red-500/40";
  if (cleanImpact === "medium") return "bg-orange-500/20 text-orange-400 border-orange-500/40";
  return "bg-green-500/20 text-green-400 border-green-500/40";
}

function getImpactDot(impact?: string | null) {
  var cleanImpact = impact?.toLowerCase();
  if (cleanImpact === "high") return "bg-red-500";
  if (cleanImpact === "medium") return "bg-orange-500";
  return "bg-green-500";
}

function getEventDateOnly(eventTime?: string | null) {
  if (!eventTime) return "";
  return eventTime.split("T")[0] || "";
}

function formatEventTimeInTZ(eventTime?: string | null, timezone?: string) {
  if (!eventTime) return "Time unavailable";
  var date = new Date(eventTime);
  if (Number.isNaN(date.getTime())) return "Invalid time";
  try {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || "UTC",
    });
  } catch {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

function formatEventDateInTZ(eventTime?: string | null, timezone?: string) {
  if (!eventTime) return "";
  var date = new Date(eventTime);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timezone || "UTC",
    });
  } catch {
    return date.toLocaleDateString();
  }
}

function getDayOfWeek(eventTime: string, timezone: string): number {
  const date = new Date(eventTime);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: timezone,
    }).formatToParts(date);
    const weekday = parts.find((p) => p.type === "weekday")?.value || "";
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days.indexOf(weekday);
  } catch {
    return date.getDay();
  }
}

function getCalendarDateKey(eventTime: string, timezone: string): string {
  const date = new Date(eventTime);
  try {
    return date.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
  } catch {
    return eventTime.split("T")[0] || "";
  }
}

export default function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currencyFilter, setCurrencyFilter] = useState("All");
  const [impactFilter, setImpactFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  useEffect(function () {
    var intervalId: any;

    async function fetchEvents() {
      try {
        setError(null);
        const response = await fetch("/api/fundamentals", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch data.");
        const data = await response.json();

        if (Array.isArray(data)) {
          const mapped = data.map(function (item: any, index: number) {
            return {
              id: item.currency + "-" + item.indicator + "-" + String(index),
              currency: item.currency ?? "N/A",
              title: item.indicator ?? "N/A",
              actual: item.actual ?? null,
              forecast: item.forecast ?? null,
              previous: item.previous ?? null,
              impact: item.impact ?? "Low",
              unit: item.unit ?? "",
              event_time: item.releaseDate ?? "",
              source: "Finnhub",
            };
          });
          setEvents(mapped);
        }
      } catch (err) {
        setError("Could not load live data.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
    intervalId = setInterval(fetchEvents, 60000);
    return function () {
      clearInterval(intervalId);
    };
  }, []);

  const currencies = useMemo(function () {
    var list = events.map(function (e) { return e.currency; }).filter(Boolean);
    var filtered = Array.from(new Set(list)).filter(function (c) { return SUPPORTED_CURRENCIES.includes(c); }).sort();
    return ["All"].concat(filtered as string[]);
  }, [events]);

  const filteredEvents = useMemo(function () {
    return events.filter(function (event) {
      var matchesCurrency = currencyFilter === "All" || event.currency === currencyFilter;
      var matchesImpact = impactFilter === "All" || (event.impact || "").toLowerCase() === impactFilter.toLowerCase();
      var matchesDate = !dateFilter || getEventDateOnly(event.event_time) === dateFilter;
      return matchesCurrency && matchesImpact && matchesDate;
    });
  }, [currencyFilter, dateFilter, events, impactFilter]);

  // Group events by date for calendar view
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EconomicEvent[]> = {};
    for (const event of filteredEvents) {
      if (!event.event_time) continue;
      const dateKey = getCalendarDateKey(event.event_time, timezone);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    }
    return grouped;
  }, [filteredEvents, timezone]);

  const sortedDates = useMemo(() => {
    return Object.keys(eventsByDate).sort();
  }, [eventsByDate]);

  if (loading && events.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-800 bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
        <span className="ml-3 font-mono text-sm text-gray-400">Loading live data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="grid gap-4 rounded-lg border border-gray-800 bg-[#111111] p-4 md:grid-cols-5">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase text-gray-500">
            <Globe className="h-3 w-3" /> Currency
          </label>
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white outline-none focus:border-yellow-400"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase text-gray-500">
            <AlertTriangle className="h-3 w-3" /> Impact
          </label>
          <select
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value)}
            className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white outline-none focus:border-yellow-400"
          >
            <option value="All">All Impact</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase text-gray-500">
            <Clock className="h-3 w-3" /> Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white outline-none focus:border-yellow-400"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase text-gray-500">
            <Calendar className="h-3 w-3" /> Date
          </label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white outline-none focus:border-yellow-400 [color-scheme:dark]"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={() => { setCurrencyFilter("All"); setImpactFilter("All"); setDateFilter(""); }}
            className="flex-1 rounded border border-gray-700 bg-gray-800 py-2 font-mono text-sm text-gray-300 hover:bg-gray-700 transition"
          >
            Reset
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-gray-500">
          {filteredEvents.length} events
        </p>
        <div className="flex rounded-lg border border-gray-800 overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase transition ${
              viewMode === "list"
                ? "bg-yellow-400/20 text-yellow-400"
                : "bg-black text-gray-500 hover:text-gray-300"
            }`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase transition ${
              viewMode === "calendar"
                ? "bg-yellow-400/20 text-yellow-400"
                : "bg-black text-gray-500 hover:text-gray-300"
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5" /> Calendar
          </button>
        </div>
      </div>

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0a0a0a]">
          {/* Table Header */}
          <div className="hidden border-b border-gray-800 bg-[#080808] p-3 md:grid md:grid-cols-12 md:items-center md:gap-4">
            <span className="col-span-2 font-mono text-[10px] uppercase tracking-widest text-gray-600">Time</span>
            <span className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-gray-600">Ccy</span>
            <span className="col-span-3 font-mono text-[10px] uppercase tracking-widest text-gray-600">Event</span>
            <span className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-gray-600">Impact</span>
            <span className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-gray-600 text-center">Forecast</span>
            <span className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-gray-600 text-center">Previous</span>
            <span className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-gray-600 text-center">Actual</span>
            <span className="col-span-2 font-mono text-[10px] uppercase tracking-widest text-gray-600 text-right">Status</span>
          </div>

          <div className="divide-y divide-gray-800/60">
            {filteredEvents.length > 0 ? (
              filteredEvents.map(function (event, index) {
                const isPast = event.event_time
                  ? new Date(event.event_time).getTime() <= Date.now()
                  : false;
                const hasActual = event.actual !== null && event.actual !== undefined;
                const beatForecast = hasActual && event.forecast !== null && event.forecast !== undefined
                  ? event.actual! > event.forecast
                  : null;

                return (
                  <div
                    key={event.id || index}
                    className={`group p-3 transition hover:bg-yellow-400/5 md:grid md:grid-cols-12 md:items-center md:gap-4 ${
                      isPast ? "opacity-70" : ""
                    }`}
                  >
                    {/* Time */}
                    <div className="mb-2 flex items-center gap-2 md:col-span-2 md:mb-0">
                      <div className={`h-2 w-2 rounded-full ${getImpactDot(event.impact)}`} />
                      <div>
                        <span className="block font-mono text-sm text-cyan-400">
                          {formatEventTimeInTZ(event.event_time, timezone)}
                        </span>
                        <span className="block font-mono text-[10px] text-gray-600">
                          {formatEventDateInTZ(event.event_time, timezone)}
                        </span>
                      </div>
                    </div>

                    {/* Currency */}
                    <div className="mb-2 md:col-span-1 md:mb-0">
                      <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {event.currency || "N/A"}
                      </span>
                    </div>

                    {/* Event Title */}
                    <div className="mb-3 md:col-span-3 md:mb-0">
                      <h4 className="font-mono text-sm font-medium text-white group-hover:text-yellow-400">
                        {event.title || "Untitled event"}
                      </h4>
                    </div>

                    {/* Impact */}
                    <div className="mb-4 flex md:col-span-1 md:mb-0">
                      <span className={"rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-tight " + getImpactStyles(event.impact)}>
                        {event.impact || "low"}
                      </span>
                    </div>

                    {/* Forecast */}
                    <div className="md:col-span-1 text-center">
                      <span className="font-mono text-sm text-gray-400">
                        {formatEventValue(event.forecast, event.unit)}
                      </span>
                    </div>

                    {/* Previous */}
                    <div className="md:col-span-1 text-center">
                      <span className="font-mono text-sm text-gray-400">
                        {formatEventValue(event.previous, event.unit)}
                      </span>
                    </div>

                    {/* Actual */}
                    <div className="md:col-span-1 text-center">
                      <span className={`font-mono text-sm font-bold ${
                        hasActual
                          ? beatForecast
                            ? "text-emerald-400"
                            : beatForecast === false
                            ? "text-red-400"
                            : "text-white"
                          : "text-gray-600"
                      }`}>
                        {hasActual ? formatEventValue(event.actual, event.unit) : "Pending"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="md:col-span-2 text-right">
                      <span className={`font-mono text-[10px] uppercase tracking-widest ${
                        isPast ? "text-gray-600" : "text-cyan-400"
                      }`}>
                        {isPast ? "Released" : "Upcoming"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center">
                <p className="font-mono text-gray-500">No events found matching your filters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          {sortedDates.length > 0 ? (
            sortedDates.map((dateKey) => {
              const dayEvents = eventsByDate[dateKey] || [];
              const displayDate = new Date(dateKey + "T12:00:00Z");
              const dayName = displayDate.toLocaleDateString("en-US", { weekday: "long" });
              const fullDate = displayDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              });

              const highImpactCount = dayEvents.filter(
                (e) => e.impact?.toLowerCase() === "high"
              ).length;

              return (
                <div key={dateKey} className="rounded-xl border border-gray-800 bg-[#0a0a0a] overflow-hidden">
                  {/* Day Header */}
                  <div className="flex items-center justify-between border-b border-gray-800 bg-[#080808] px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800">
                        <span className="font-mono text-lg font-bold text-white">
                          {displayDate.getUTCDate()}
                        </span>
                      </div>
                      <div>
                        <p className="font-mono text-sm font-bold text-white">{dayName}</p>
                        <p className="font-mono text-[10px] text-gray-500">{fullDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {highImpactCount > 0 && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-mono text-[10px] text-red-400">
                          {highImpactCount} High Impact
                        </span>
                      )}
                      <span className="font-mono text-xs text-gray-500">
                        {dayEvents.length} events
                      </span>
                    </div>
                  </div>

                  {/* Day Events */}
                  <div className="divide-y divide-gray-900">
                    {dayEvents
                      .sort((a, b) => {
                        const ta = a.event_time ? new Date(a.event_time).getTime() : 0;
                        const tb = b.event_time ? new Date(b.event_time).getTime() : 0;
                        return ta - tb;
                      })
                      .map((event, idx) => {
                        const isPast = event.event_time
                          ? new Date(event.event_time).getTime() <= Date.now()
                          : false;

                        return (
                          <div
                            key={event.id || idx}
                            className={`flex items-center gap-4 px-5 py-3 ${isPast ? "opacity-60" : ""}`}
                          >
                            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getImpactDot(event.impact)}`} />
                            <span className="w-16 shrink-0 font-mono text-xs text-cyan-400">
                              {formatEventTimeInTZ(event.event_time, timezone)}
                            </span>
                            <span className="w-10 shrink-0 rounded bg-gray-800 px-1 py-0.5 text-center font-mono text-[10px] font-bold text-white">
                              {event.currency}
                            </span>
                            <span className="flex-1 font-mono text-sm text-gray-300">
                              {event.title}
                            </span>
                            <div className="flex items-center gap-4 text-right">
                              <div className="hidden md:block">
                                <span className="font-mono text-[10px] text-gray-600">F: </span>
                                <span className="font-mono text-xs text-gray-400">
                                  {formatEventValue(event.forecast, event.unit)}
                                </span>
                              </div>
                              <div className="hidden md:block">
                                <span className="font-mono text-[10px] text-gray-600">P: </span>
                                <span className="font-mono text-xs text-gray-400">
                                  {formatEventValue(event.previous, event.unit)}
                                </span>
                              </div>
                              <div>
                                <span className="font-mono text-[10px] text-gray-600">A: </span>
                                <span className={`font-mono text-xs font-bold ${
                                  event.actual !== null ? "text-white" : "text-gray-600"
                                }`}>
                                  {event.actual !== null ? formatEventValue(event.actual, event.unit) : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-gray-800 bg-[#0a0a0a] p-12 text-center">
              <p className="font-mono text-gray-500">No events found matching your filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
        <BarChart2 className="h-4 w-4 text-yellow-400" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/80">
          Live data provided by Finnhub API // Auto-refresh active // Timezone: {timezone}
        </p>
      </div>
    </div>
  );
}
