"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { supabase, getUserTradeLogsWithRows } from "@/lib/supabase";

interface TradeDay {
  date: string; // YYYY-MM-DD
  pnl: number;
  tradeCount: number;
  isWin: boolean;
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-based (Mon=0, Sun=6)
  return day === 0 ? 6 : day - 1;
}

function formatMoney(value: number): string {
  const prefix = value >= 0 ? "+$" : "-$";
  return prefix + Math.abs(value).toFixed(2);
}

export default function PerformanceCalendarWidget() {
  const [tradeDays, setTradeDays] = useState<TradeDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    async function loadTradeDays() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user ?? null;

        let allRows: any[] = [];

        if (user) {
          // Load from Supabase
          const { data: logs } = await supabase
            .from("trade_logs")
            .select("id")
            .eq("user_id", user.id);

          if (logs && logs.length > 0) {
            const logIds = logs.map((l: any) => l.id);
            const { data: rows } = await supabase
              .from("trade_log_rows")
              .select("*")
              .in("trade_log_id", logIds);
            allRows = rows || [];
          }
        }

        // Parse rows into trade days
        const dayMap: Record<string, { pnl: number; count: number }> = {};

        for (const row of allRows) {
          // Try to extract date and P&L from the row
          const closeDate = row.closeDate || row.close_date || row.date || row.entryDate || "";
          const pnl = parseFloat(row.profit || row.pnl || row.netProfit || "0") || 0;

          if (!closeDate || pnl === 0) continue;

          // Normalize date to YYYY-MM-DD
          let dateKey = "";
          try {
            const parsed = new Date(closeDate);
            if (!isNaN(parsed.getTime())) {
              dateKey = parsed.toISOString().split("T")[0];
            }
          } catch {
            continue;
          }

          if (!dateKey) continue;

          if (!dayMap[dateKey]) dayMap[dateKey] = { pnl: 0, count: 0 };
          dayMap[dateKey].pnl += pnl;
          dayMap[dateKey].count += 1;
        }

        const days: TradeDay[] = Object.entries(dayMap).map(([date, data]) => ({
          date,
          pnl: data.pnl,
          tradeCount: data.count,
          isWin: data.pnl > 0,
        }));

        setTradeDays(days);
      } catch (err) {
        console.error("Failed to load trade days:", err);
      } finally {
        setLoading(false);
      }
    }

    loadTradeDays();
  }, []);

  const monthTradeDays = useMemo(() => {
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    return tradeDays.filter((d) => d.date.startsWith(monthStr));
  }, [tradeDays, currentMonth, currentYear]);

  const monthStats = useMemo(() => {
    const wins = monthTradeDays.filter((d) => d.isWin).length;
    const losses = monthTradeDays.filter((d) => !d.isWin).length;
    const totalPnl = monthTradeDays.reduce((sum, d) => sum + d.pnl, 0);
    return { wins, losses, totalPnl, tradingDays: monthTradeDays.length };
  }, [monthTradeDays]);

  const tradeDayMap = useMemo(() => {
    const map: Record<string, TradeDay> = {};
    for (const day of monthTradeDays) {
      map[day.date] = day;
    }
    return map;
  }, [monthTradeDays]);

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const monthName = new Date(currentYear, currentMonth).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-800 text-gray-400 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="font-mono text-sm font-bold text-white">{monthName}</h3>
        <button
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-800 text-gray-400 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Month Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded border border-gray-800 bg-black p-2 text-center">
          <p className="font-mono text-lg font-bold text-white">{monthStats.tradingDays}</p>
          <p className="text-[9px] uppercase text-gray-500">Days</p>
        </div>
        <div className="rounded border border-gray-800 bg-black p-2 text-center">
          <p className="font-mono text-lg font-bold text-green-400">{monthStats.wins}</p>
          <p className="text-[9px] uppercase text-gray-500">Wins</p>
        </div>
        <div className="rounded border border-gray-800 bg-black p-2 text-center">
          <p className="font-mono text-lg font-bold text-red-400">{monthStats.losses}</p>
          <p className="text-[9px] uppercase text-gray-500">Losses</p>
        </div>
        <div className="rounded border border-gray-800 bg-black p-2 text-center">
          <p className={`font-mono text-lg font-bold ${monthStats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {monthStats.totalPnl >= 0 ? "+" : ""}{monthStats.totalPnl.toFixed(0)}
          </p>
          <p className="text-[9px] uppercase text-gray-500">P&L</p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border border-gray-800 bg-black p-3">
        {/* Day headers */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="text-center font-mono text-[9px] uppercase text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const tradeDay = tradeDayMap[dateKey];
            const isToday =
              dayNum === new Date().getDate() &&
              currentMonth === new Date().getMonth() &&
              currentYear === new Date().getFullYear();

            return (
              <div
                key={dayNum}
                className={`relative flex aspect-square flex-col items-center justify-center rounded text-center transition ${
                  tradeDay
                    ? tradeDay.isWin
                      ? "bg-green-500/20 border border-green-500/30"
                      : "bg-red-500/20 border border-red-500/30"
                    : isToday
                    ? "border border-yellow-400/40 bg-yellow-400/5"
                    : "border border-transparent"
                }`}
                title={
                  tradeDay
                    ? `${tradeDay.tradeCount} trade(s), ${formatMoney(tradeDay.pnl)}`
                    : undefined
                }
              >
                <span
                  className={`font-mono text-[11px] ${
                    tradeDay
                      ? tradeDay.isWin
                        ? "font-bold text-green-400"
                        : "font-bold text-red-400"
                      : isToday
                      ? "font-bold text-yellow-400"
                      : "text-gray-500"
                  }`}
                >
                  {dayNum}
                </span>
                {tradeDay && (
                  <span
                    className={`font-mono text-[7px] ${
                      tradeDay.isWin ? "text-green-400/80" : "text-red-400/80"
                    }`}
                  >
                    {tradeDay.pnl >= 0 ? "+" : ""}{tradeDay.pnl.toFixed(0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded bg-green-500/40" />
          <span className="text-gray-500">Winning Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded bg-red-500/40" />
          <span className="text-gray-500">Losing Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded border border-yellow-400/40" />
          <span className="text-gray-500">Today</span>
        </div>
      </div>
    </div>
  );
}
