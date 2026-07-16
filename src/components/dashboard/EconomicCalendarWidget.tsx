"use client";

import { useEffect, useState } from "react";
import EconomicCalendarFilters from "./EconomicCalendarFilters";
import EconomicCalendarListView from "./EconomicCalendarListView";
import EconomicCalendarCalendarView from "./EconomicCalendarCalendarView";
import type {
  EconomicEventEnhanced,
  EconomicCalendarFilters as EconomicCalendarFiltersType,
} from "@/lib/economicCalendarEnhanced";
import {
  getEconomicEventsEnhanced,
  getEconomicEventsCalendarView,
  filterEconomicEvents,
  groupEventsByDate,
} from "@/lib/economicCalendarEnhanced";

export default function EconomicCalendarWidget() {
  const [allEvents, setAllEvents] = useState<EconomicEventEnhanced[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EconomicEventEnhanced[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<
    Record<string, EconomicEventEnhanced[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<"list" | "calendar">("list");
  const [activeFilters, setActiveFilters] =
    useState<Partial<EconomicCalendarFiltersType>>({});

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, []);

  // Apply filters when they change
  useEffect(() => {
    if (allEvents.length > 0) {
      const filtered = filterEconomicEvents(allEvents, activeFilters);
      setFilteredEvents(filtered);
      setCalendarEvents(groupEventsByDate(filtered));
    }
  }, [activeFilters, allEvents]);

  async function loadEvents() {
    setIsLoading(true);
    setError(null);

    try {
      const events = await getEconomicEventsEnhanced();

      if (!events || events.length === 0) {
        setError("No economic events available");
        setAllEvents([]);
        setFilteredEvents([]);
        setCalendarEvents({});
      } else {
        setAllEvents(events);
        setFilteredEvents(events);
        setCalendarEvents(groupEventsByDate(events));
      }
    } catch (err) {
      console.error("Failed to load economic events:", err);
      setError("Failed to load economic calendar");
      setAllEvents([]);
      setFilteredEvents([]);
      setCalendarEvents({});
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-yellow-400">
          Fundamentals
        </p>
        <h2 className="mt-1 font-mono text-lg font-bold text-white">
          Economic Calendar
        </h2>
      </div>

      {/* Error Message */}
      {error && !isLoading && (
        <div className="border border-red-700 bg-red-700 bg-opacity-10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      {allEvents.length > 0 && (
        <EconomicCalendarFilters
          events={allEvents}
          onFiltersChange={setActiveFilters}
          selectedView={selectedView}
          onViewChange={setSelectedView}
        />
      )}

      {/* Content */}
      <div>
        {selectedView === "list" ? (
          <EconomicCalendarListView
            events={filteredEvents}
            isLoading={isLoading}
          />
        ) : (
          <EconomicCalendarCalendarView
            events={calendarEvents}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Refresh Button */}
      {!isLoading && (
        <button
          onClick={loadEvents}
          className="w-full border border-gray-700 bg-gray-900 px-4 py-2 font-mono text-xs font-bold text-gray-300 transition hover:border-gray-500 hover:text-white"
        >
          Refresh Calendar
        </button>
      )}

      {/* Event Count */}
      {allEvents.length > 0 && (
        <div className="border-t border-gray-800 pt-3 text-center">
          <p className="text-xs text-gray-500">
            Showing {filteredEvents.length} of {allEvents.length} events
          </p>
        </div>
      )}
    </div>
  );
}
