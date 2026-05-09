"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart2, Calendar, Clock, Globe } from "lucide-react";

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

function formatEventValue(value?: number | null, unit?: string | null) {
  if (value === null || value === undefined) return "-";
  var unitSuffix = unit ? " " + unit : "";
  return String(value) + unitSuffix;
}

function getImpactStyles(impact?: string | null) {
  var cleanImpact = impact?.toLowerCase();
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
  var date = new Date(eventTime);
  if (Number.isNaN(date.getTime())) return "Invalid time";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatEventDate(eventTime?: string | null) {
  if (!eventTime) return "";
  var date = new Date(eventTime);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export default function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currencyFilter, setCurrencyFilter] = useState("All");
  const [impactFilter, setImpactFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

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
    intervalId = setInterval(fetchEvents, 60000); // 1-minute refresh
    return function () { clearInterval(intervalId); };
  }, []);

  const currencies = useMemo(function () {
    var list = events.map(function (e) { return e.currency; }).filter(Boolean);
    return ["All"].concat(Array.from(new Set(list)).sort() as string[]);
  }, [events]);

  const filteredEvents = useMemo(function () {
    return events.filter(function (event) {
      var matchesCurrency = currencyFilter === "All" || event.currency === currencyFilter;
      var matchesImpact = impactFilter === "All" || (event.impact || "").toLowerCase() === impactFilter.toLowerCase();
      var matchesDate = !dateFilter || getEventDateOnly(event.event_time) === dateFilter;
      return matchesCurrency && matchesImpact && matchesDate;
    });
  }, [currencyFilter, dateFilter, events, impactFilter]);

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
      <div className="grid gap-4 rounded-lg border border-gray-800 bg-[#111111] p-4 md:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase text-gray-500"><Globe className="h-3 w-3" /> Currency</label>
          <select value={currencyFilter} onChange={function (e) { setCurrencyFilter(e.target.value); }} className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white outline-none focus:border-yellow-400">
            {currencies.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase text-gray-500"><AlertTriangle className="h-3 w-3" /> Impact</label>
          <select value={impactFilter} onChange={function (e) { setImpactFilter(e.target.value); }} className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white outline-none focus:border-yellow-400">
            <option value="All">All Impact</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 font-mono text-xs uppercase text-gray-500"><Calendar className="h-3 w-3" /> Date</label>
          <input type="date" value={dateFilter} onChange={function (e) { setDateFilter(e.target.value); }} className="rounded border border-gray-700 bg-black p-2 font-mono text-sm text-white outline-none focus:border-yellow-400 [color-scheme:dark]" />
        </div>

        <div className="flex items-end">
          <button onClick={function () { setCurrencyFilter("All"); setImpactFilter("All"); setDateFilter(""); }} className="w-full rounded border border-gray-700 bg-gray-800 py-2 font-mono text-sm text-gray-300 hover:bg-gray-700 transition">Reset Filters</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0a0a0a]">
        <div className="divide-y divide-gray-800">
          {filteredEvents.length > 0 ? (
            filteredEvents.map(function (event, index) {
              return (
                <div key={event.id || index} className="group p-4 transition hover:bg-yellow-400/5 md:grid md:grid-cols-12 md:items-center md:gap-4">
                  <div className="mb-2 flex items-center gap-2 md:col-span-2 md:mb-0">
                    <Clock className="h-3 w-3 text-cyan-400 md:hidden" />
                    <div>
                      <span className="block font-mono text-sm text-cyan-400">{formatEventTime(event.event_time)}</span>
                      <span className="block font-mono text-[10px] text-gray-600">{formatEventDate(event.event_time)}</span>
                    </div>
                  </div>

                  <div className="mb-2 md:col-span-1 md:mb-0">
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">{event.currency || "N/A"}</span>
                  </div>

                  <div className="mb-3 md:col-span-3 md:mb-0">
                    <h4 className="font-mono text-sm font-medium text-white group-hover:text-yellow-400">{event.title || "Untitled event"}</h4>
                  </div>

                  <div className="mb-4 flex md:col-span-1 md:mb-0 md:justify-center">
                    <span className={"rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-tight " + getImpactStyles(event.impact)}>{event.impact || "low"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-gray-800 pt-3 md:col-span-3 md:border-0 md:pt-0 text-center">
                    <div className="flex flex-col"><span className="text-[9px] uppercase text-gray-600">Forecast</span><span className="font-mono text-sm text-gray-400">{formatEventValue(event.forecast, event.unit)}</span></div>
                    <div className="flex flex-col"><span className="text-[9px] uppercase text-gray-600">Prev</span><span className="font-mono text-sm text-gray-400">{formatEventValue(event.previous, event.unit)}</span></div>
                    <div className="flex flex-col"><span className="text-[9px] uppercase text-gray-600">Actual</span><span className="font-mono text-sm font-bold text-white">{event.actual === null ? "Pending" : formatEventValue(event.actual, event.unit)}</span></div>
                  </div>

                  <div className="mt-3 text-right md:col-span-2 md:mt-0">
                    <span className="font-mono text-[10px] italic text-gray-600">{event.source || "Unknown"}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center"><p className="font-mono text-gray-500">No events found matching your filters.</p></div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
        <BarChart2 className="h-4 w-4 text-yellow-400" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/80">Live data provided by Finnhub API // Auto-refresh active</p>
      </div>
    </div>
  );
}
