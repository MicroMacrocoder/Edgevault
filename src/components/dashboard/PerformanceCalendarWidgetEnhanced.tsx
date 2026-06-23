"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface TradeDay {
  date: string;
  pnlUSD: number;
  pnlPercent: number;
  tradeCount: number;
  isWinning: boolean;
}

export default function PerformanceCalendarWidget() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tradeDays, setTradeDays] = useState<Map<string, TradeDay>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder data - would be fetched from Supabase trade_logs
    const mockDays = new Map<string, TradeDay>();
    mockDays.set("2026-06-05", { date: "2026-06-05", pnlUSD: 250, pnlPercent: 1.2, tradeCount: 3, isWinning: true });
    mockDays.set("2026-06-08", { date: "2026-06-08", pnlUSD: -150, pnlPercent: -0.8, tradeCount: 2, isWinning: false });
    mockDays.set("2026-06-12", { date: "2026-06-12", pnlUSD: 500, pnlPercent: 2.5, tradeCount: 4, isWinning: true });
    mockDays.set("2026-06-15", { date: "2026-06-15", pnlUSD: 100, pnlPercent: 0.5, tradeCount: 1, isWinning: true });
    mockDays.set("2026-06-18", { date: "2026-06-18", pnlUSD: -300, pnlPercent: -1.5, tradeCount: 3, isWinning: false });
    mockDays.set("2026-06-22", { date: "2026-06-22", pnlUSD: 750, pnlPercent: 3.8, tradeCount: 5, isWinning: true });

    setTradeDays(mockDays);
    setLoading(false);
  }, []);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    days.push(dateStr);
  }

  const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-800 bg-black/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold uppercase text-white">Trade Calendar</h3>
        <button
          onClick={() => router.push('/dashboard?section=performance')}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:text-yellow-400 hover:bg-gray-900 transition"
        >
          <ExternalLink className="h-3 w-3" />
          Full View
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-1 hover:text-yellow-400 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="font-mono text-xs font-bold text-white">{monthName}</p>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-1 hover:text-yellow-400 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-gray-500 font-mono text-[10px] py-1">
              {day}
            </div>
          ))}

          {days.map((dateStr, idx) => {
            const tradeDay = dateStr ? tradeDays.get(dateStr) : null;
            const bgColor = tradeDay
              ? tradeDay.isWinning
                ? "bg-green-900/40 border-green-700"
                : "bg-red-900/40 border-red-700"
              : "bg-gray-900/20 border-gray-800";

            return (
              <div
                key={idx}
                className={`aspect-square rounded border ${bgColor} flex flex-col items-center justify-center cursor-pointer hover:border-yellow-400 transition ${
                  tradeDay ? "hover:bg-opacity-60" : ""
                }`}
                onClick={() => {
                  if (tradeDay) {
                    router.push(`/dashboard?section=journal&date=${tradeDay.date}`);
                  }
                }}
              >
                {dateStr && (
                  <>
                    <span className="text-[10px] font-mono text-gray-400">
                      {parseInt(dateStr.split("-")[2])}
                    </span>
                    {tradeDay && (
                      <span
                        className={`text-[9px] font-mono font-bold ${
                          tradeDay.isWinning ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {tradeDay.pnlPercent > 0 ? "+" : ""}{tradeDay.pnlPercent}%
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-800 pt-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-sm bg-green-600" />
            <span>Winning Day</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-sm bg-red-600" />
            <span>Losing Day</span>
          </div>
        </div>
      </div>
    </div>
  );
}
