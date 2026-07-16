"use client";

import { useState, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import type {
  EconomicCalendarFilters,
  EconomicEventEnhanced,
} from "@/lib/economicCalendarEnhanced";
import {
  getAvailableCurrencies,
  getAvailableImpacts,
  getAvailableDates,
} from "@/lib/economicCalendarEnhanced";

interface EconomicCalendarFiltersProps {
  events: EconomicEventEnhanced[];
  onFiltersChange: (filters: Partial<EconomicCalendarFilters>) => void;
  selectedView: "list" | "calendar";
  onViewChange: (view: "list" | "calendar") => void;
}

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "EST (US Eastern)", value: "America/New_York" },
  { label: "CST (US Central)", value: "America/Chicago" },
  { label: "MST (US Mountain)", value: "America/Denver" },
  { label: "PST (US Pacific)", value: "America/Los_Angeles" },
  { label: "GMT (London)", value: "Europe/London" },
  { label: "CET (Central Europe)", value: "Europe/Paris" },
  { label: "IST (India)", value: "Asia/Kolkata" },
  { label: "JST (Japan)", value: "Asia/Tokyo" },
  { label: "AEST (Sydney)", value: "Australia/Sydney" },
];

export default function EconomicCalendarFilters({
  events,
  onFiltersChange,
  selectedView,
  onViewChange,
}: EconomicCalendarFiltersProps) {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [impacts, setImpacts] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [timezone, setTimezone] = useState("UTC");

  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedImpacts, setSelectedImpacts] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showImpactDropdown, setShowImpactDropdown] = useState(false);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);

  // Load available filter options
  useEffect(() => {
    setCurrencies(getAvailableCurrencies(events));
    setImpacts(getAvailableImpacts(events));
    setDates(getAvailableDates(events));

    // Set default date range
    if (dates.length > 0) {
      setStartDate(dates[0]);
      setEndDate(dates[dates.length - 1]);
    }
  }, [events]);

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange({
      currencies: selectedCurrencies.length > 0 ? selectedCurrencies : undefined,
      impacts: selectedImpacts.length > 0 ? selectedImpacts : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      timezone,
    });
  }, [selectedCurrencies, selectedImpacts, startDate, endDate, timezone]);

  const toggleCurrency = (currency: string) => {
    setSelectedCurrencies((prev) =>
      prev.includes(currency)
        ? prev.filter((c) => c !== currency)
        : [...prev, currency]
    );
  };

  const toggleImpact = (impact: string) => {
    setSelectedImpacts((prev) =>
      prev.includes(impact)
        ? prev.filter((i) => i !== impact)
        : [...prev, impact]
    );
  };

  const clearAllFilters = () => {
    setSelectedCurrencies([]);
    setSelectedImpacts([]);
    setStartDate(dates[0] || "");
    setEndDate(dates[dates.length - 1] || "");
    setTimezone("UTC");
  };

  const hasActiveFilters =
    selectedCurrencies.length > 0 ||
    selectedImpacts.length > 0 ||
    timezone !== "UTC";

  return (
    <div className="space-y-4 border-b border-gray-800 pb-4">
      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase text-gray-400">View:</p>
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange("list")}
            className={`px-3 py-1 text-xs font-bold transition ${
              selectedView === "list"
                ? "border border-cyan-400 bg-cyan-400 bg-opacity-10 text-cyan-400"
                : "border border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            List
          </button>
          <button
            onClick={() => onViewChange("calendar")}
            className={`px-3 py-1 text-xs font-bold transition ${
              selectedView === "calendar"
                ? "border border-cyan-400 bg-cyan-400 bg-opacity-10 text-cyan-400"
                : "border border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {/* Currency Filter */}
        <div className="relative">
          <button
            onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
            className="w-full border border-gray-700 bg-gray-900 px-3 py-2 text-left text-xs font-semibold text-gray-300 transition hover:border-gray-500"
          >
            <div className="flex items-center justify-between">
              <span>
                Currency{" "}
                {selectedCurrencies.length > 0 &&
                  `(${selectedCurrencies.length})`}
              </span>
              <ChevronDown size={14} />
            </div>
          </button>
          {showCurrencyDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto border border-gray-700 bg-gray-900">
              {currencies.map((currency) => (
                <label
                  key={currency}
                  className="flex items-center gap-2 border-b border-gray-800 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedCurrencies.includes(currency)}
                    onChange={() => toggleCurrency(currency)}
                    className="h-3 w-3"
                  />
                  {currency}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Impact Filter */}
        <div className="relative">
          <button
            onClick={() => setShowImpactDropdown(!showImpactDropdown)}
            className="w-full border border-gray-700 bg-gray-900 px-3 py-2 text-left text-xs font-semibold text-gray-300 transition hover:border-gray-500"
          >
            <div className="flex items-center justify-between">
              <span>
                Impact {selectedImpacts.length > 0 && `(${selectedImpacts.length})`}
              </span>
              <ChevronDown size={14} />
            </div>
          </button>
          {showImpactDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-gray-700 bg-gray-900">
              {impacts.map((impact) => (
                <label
                  key={impact}
                  className="flex items-center gap-2 border-b border-gray-800 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedImpacts.includes(impact)}
                    onChange={() => toggleImpact(impact)}
                    className="h-3 w-3"
                  />
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      impact === "High"
                        ? "bg-red-500"
                        : impact === "Medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                  />
                  {impact}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Timezone Filter */}
        <div className="relative">
          <button
            onClick={() => setShowTimezoneDropdown(!showTimezoneDropdown)}
            className="w-full border border-gray-700 bg-gray-900 px-3 py-2 text-left text-xs font-semibold text-gray-300 transition hover:border-gray-500"
          >
            <div className="flex items-center justify-between">
              <span>Timezone</span>
              <ChevronDown size={14} />
            </div>
          </button>
          {showTimezoneDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto border border-gray-700 bg-gray-900">
              {TIMEZONES.map((tz) => (
                <button
                  key={tz.value}
                  onClick={() => {
                    setTimezone(tz.value);
                    setShowTimezoneDropdown(false);
                  }}
                  className={`w-full border-b border-gray-800 px-3 py-2 text-left text-xs transition ${
                    timezone === tz.value
                      ? "bg-cyan-400 bg-opacity-10 text-cyan-400"
                      : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  {tz.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center justify-center gap-2 border border-red-700 bg-red-700 bg-opacity-10 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-opacity-20"
          >
            <X size={14} />
            Clear Filters
          </button>
        )}
      </div>

      {/* Date Range */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-400">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-400">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300"
          />
        </div>
      </div>
    </div>
  );
}
