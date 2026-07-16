"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EconomicEventEnhanced } from "@/lib/economicCalendarEnhanced";

interface EconomicCalendarCalendarViewProps {
  events: Record<string, EconomicEventEnhanced[]>;
  isLoading: boolean;
}

function getImpactColor(impact: string): string {
  switch (impact.toLowerCase()) {
    case "high":
      return "bg-red-500 bg-opacity-20 border-red-500";
    case "medium":
      return "bg-yellow-500 bg-opacity-20 border-yellow-500";
    case "low":
      return "bg-green-500 bg-opacity-20 border-green-500";
    default:
      return "bg-gray-500 bg-opacity-20 border-gray-500";
  }
}

export default function EconomicCalendarCalendarView({
  events,
  isLoading,
}: EconomicCalendarCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const year = currentDate.getFullYear();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 animate-pulse border border-gray-800 bg-gray-900" />
        <div className="grid grid-cols-7 gap-2">
          {[...Array(35)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse border border-gray-800 bg-gray-900"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <button
          onClick={previousMonth}
          className="border border-gray-700 p-2 text-gray-300 transition hover:border-gray-500"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="font-mono text-lg font-bold text-white">
          {monthName} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="border border-gray-700 p-2 text-gray-300 transition hover:border-gray-500"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="border border-gray-800 bg-gray-900 p-2 text-center font-mono text-xs font-bold text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                className="h-24 border border-gray-900 bg-gray-950"
              />
            );
          }

          const dateKey = formatDateKey(year, currentDate.getMonth(), day);
          const dayEvents = events[dateKey] || [];
          const isToday =
            new Date().toDateString() ===
            new Date(year, currentDate.getMonth(), day).toDateString();

          return (
            <div
              key={day}
              className={`min-h-24 border p-2 ${
                isToday
                  ? "border-cyan-500 bg-cyan-500 bg-opacity-5"
                  : "border-gray-800 bg-gray-950"
              }`}
            >
              <p
                className={`mb-1 font-mono text-xs font-bold ${
                  isToday ? "text-cyan-400" : "text-gray-400"
                }`}
              >
                {day}
              </p>

              {dayEvents.length > 0 ? (
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={`truncate border border-l-2 px-1 py-0.5 text-xs ${getImpactColor(event.impact)}`}
                    >
                      <p className="truncate font-mono font-bold text-white">
                        {event.indicator.substring(0, 15)}
                      </p>
                      <p className="text-xs text-gray-300">
                        {event.currency} {event.formattedTime}
                      </p>
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-xs text-gray-500">
                      +{dayEvents.length - 2} more
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600">—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
