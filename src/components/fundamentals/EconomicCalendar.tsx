"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EconomicEventRow, EconomicImpact } from "@/types/economic";

type EconomicCalendarProps = { compact?: boolean };

type EventsResponse = {
  events?: EconomicEventRow[];
  lastUpdated?: string;
  message?: string;
};

type EconomicSeriesDetails = {
  id: string;
  series_key: string;
  name: string;
  category: string;
  currency: string;
  unit: string | null;
  frequency: string | null;
  official_source_name: string;
  official_source_url: string;
};

type EconomicObservation = {
  id: string;
  series_id: string;
  reference_period: string;
  period_start: string;
  period_end: string;
  value: number | string;
  initial_value: number | string | null;
  unit: string | null;
  is_preliminary: boolean;
  is_revised: boolean;
  revision_count: number;
  source_url: string;
  last_observed_at: string;
};

type HistoryResponse = {
  series?: EconomicSeriesDetails;
  observations?: EconomicObservation[];
  message?: string;
};

type HistoryState = {
  loading: boolean;
  error: string | null;
  series: EconomicSeriesDetails | null;
  observations: EconomicObservation[];
};

type SpeechReportState = {
  loading: boolean;
  error: string | null;
  summary: string | null;
  available: boolean;
};

const IMPACTS: Array<"All" | EconomicImpact> = ["All", "High", "Medium", "Low"];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  return startOfDay(addDays(date, day === 0 ? -6 : 1 - day));
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatRange(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromLabel = from.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const toLabel = to.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fromLabel} – ${toLabel}`;
}

function formatDay(date: Date): string {
  const today = dateKey(date) === dateKey(new Date());
  return `${date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })}${today ? " · Today" : ""}`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(value: number | string | null, unit: string | null): string {
  if (value == null || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  if (unit === "jobs") {
    const absolute = Math.abs(numeric);
    if (absolute >= 1_000_000) {
      return `${(numeric / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
    }
    if (absolute >= 1_000) {
      return `${(numeric / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    }
    return numeric.toLocaleString();
  }

  const formatted = numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit === "%" ? `${formatted}%` : `${formatted}${unit || ""}`;
}

function impactStyles(impact: EconomicImpact | null): string {
  if (impact === "High") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (impact === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-600 bg-slate-700/30 text-slate-300";
}

function statusStyles(status: string): string {
  if (status === "released") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "revised") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-300";
  }
  if (status === "delayed" || status === "cancelled") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
}

function HistoryPanel({ state }: { state: HistoryState }) {
  if (state.loading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading official history…
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex min-h-24 items-center justify-center text-sm text-red-300">
        <AlertCircle className="mr-2 h-4 w-4" /> {state.error}
      </div>
    );
  }

  if (!state.series || state.observations.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No official historical observations are available yet.
      </div>
    );
  }

  const chartData = [...state.observations].reverse().map((observation) => ({
    period: new Date(`${observation.period_start}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
    value: Number(observation.value),
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-bold text-white">{state.series.name} trend</p>
            <p className="mt-1 text-[10px] text-gray-500">
              Latest {state.observations.length} official observations
            </p>
          </div>
          <TrendingUp className="h-4 w-4 text-cyan-400" />
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                stroke="#6b7280"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                minTickGap={28}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "#05070d",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  color: "#e5e7eb",
                  fontSize: 12,
                }}
                formatter={(value) => [
                  formatValue(Number(value), state.series?.unit || null),
                  "Actual",
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#22d3ee" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-black/30">
        <div className="grid grid-cols-[1fr_90px_70px] border-b border-gray-800 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-gray-500">
          <span>Period</span>
          <span className="text-right">Actual</span>
          <span className="text-right">Revision</span>
        </div>
        {state.observations.slice(0, 6).map((observation) => (
          <div
            key={observation.id}
            className="grid grid-cols-[1fr_90px_70px] items-center border-b border-gray-800/70 px-3 py-2.5 text-xs last:border-0"
          >
            <span className="truncate text-gray-300">{observation.reference_period}</span>
            <span className="text-right font-mono font-bold text-white">
              {formatValue(observation.value, observation.unit)}
            </span>
            <span className="text-right text-[10px]">
              {observation.is_revised || observation.revision_count > 0 ? (
                <span className="text-violet-300">Revised</span>
              ) : (
                <span className="text-gray-600">—</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EconomicCalendar({ compact = false }: EconomicCalendarProps) {
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [events, setEvents] = useState<EconomicEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [impactFilter, setImpactFilter] = useState<"All" | EconomicImpact>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, HistoryState>>({});
  const [speechReports, setSpeechReports] = useState<Record<string, SpeechReportState>>({});

  const range = useMemo(() => {
    const from = compact ? startOfDay(new Date()) : startOfWeek(anchorDate);
    const to = compact ? endOfDay(addDays(from, 7)) : endOfDay(addDays(from, 6));
    return { from, to };
  }, [anchorDate, compact]);

  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const loadEvents = useCallback(
    async (background = false) => {
      if (background) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          currency: "USD",
          from: fromIso,
          to: toIso,
          limit: "500",
        });
        const response = await fetch(`/api/economic-events?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as EventsResponse;
        if (!response.ok) {
          throw new Error(payload.message || "Failed to load the economic calendar.");
        }

        setEvents(Array.isArray(payload.events) ? payload.events : []);
        setLastUpdated(payload.lastUpdated || new Date().toISOString());
        setError(null);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Failed to load the economic calendar."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fromIso, toIso]
  );

  useEffect(() => {
    void loadEvents(false);
    const interval = window.setInterval(() => void loadEvents(true), 30_000);
    return () => window.clearInterval(interval);
  }, [loadEvents]);

  const categories = useMemo(
    () =>
      [...new Set(events.map((event) => event.category).filter(Boolean) as string[])].sort(),
    [events]
  );

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          (impactFilter === "All" || event.impact === impactFilter) &&
          (categoryFilter === "All" || event.category === categoryFilter)
      ),
    [events, impactFilter, categoryFilter]
  );

  const displayedEvents = compact ? filteredEvents.slice(0, 8) : filteredEvents;

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, EconomicEventRow[]>();
    for (const event of displayedEvents) {
      const key = dateKey(new Date(event.event_time));
      const group = groups.get(key) || [];
      group.push(event);
      groups.set(key, group);
    }
    return [...groups.entries()];
  }, [displayedEvents]);

  const loadHistory = useCallback(
    async (event: EconomicEventRow) => {
      if (!event.series_id || histories[event.series_id]) return;

      setHistories((current) => ({
        ...current,
        [event.series_id!]: {
          loading: true,
          error: null,
          series: null,
          observations: [],
        },
      }));

      try {
        const response = await fetch(
          `/api/economic-events/history?seriesId=${encodeURIComponent(event.series_id)}&limit=24`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as HistoryResponse;
        if (!response.ok) {
          throw new Error(payload.message || "Failed to load official history.");
        }

        setHistories((current) => ({
          ...current,
          [event.series_id!]: {
            loading: false,
            error: null,
            series: payload.series || null,
            observations: payload.observations || [],
          },
        }));
      } catch (caught) {
        setHistories((current) => ({
          ...current,
          [event.series_id!]: {
            loading: false,
            error:
              caught instanceof Error ? caught.message : "Failed to load official history.",
            series: null,
            observations: [],
          },
        }));
      }
    },
    [histories]
  );

  const loadSpeechReport = useCallback(
    async (event: EconomicEventRow) => {
      if (event.event_kind !== "speech" || speechReports[event.id]) return;

      setSpeechReports((current) => ({
        ...current,
        [event.id]: { loading: true, error: null, summary: null, available: false },
      }));

      try {
        const response = await fetch(
          `/api/economic-speeches?currency=${encodeURIComponent(
            event.currency || "USD",
          )}&eventId=${encodeURIComponent(event.id)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          speeches?: Array<{
            reportSummary?: string | null;
            transcript?: {
              transcript_status?: string;
              transcript_text?: string | null;
            } | null;
          }>;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "EdgeVault speech report could not be loaded.");
        }

        const report = payload.speeches?.[0];
        const available =
          report?.transcript?.transcript_status === "published" &&
          Boolean(report.transcript.transcript_text);
        setSpeechReports((current) => ({
          ...current,
          [event.id]: {
            loading: false,
            error: null,
            summary: report?.reportSummary || null,
            available,
          },
        }));
      } catch (caught) {
        setSpeechReports((current) => ({
          ...current,
          [event.id]: {
            loading: false,
            error:
              caught instanceof Error
                ? caught.message
                : "EdgeVault speech report could not be loaded.",
            summary: null,
            available: false,
          },
        }));
      }
    },
    [speechReports],
  );

  const toggleEvent = (event: EconomicEventRow) => {
    const nextId = expandedEventId === event.id ? null : event.id;
    setExpandedEventId(nextId);
    if (nextId) {
      void loadHistory(event);
      void loadSpeechReport(event);
    }
  };

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact ? (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-800 bg-[#111111] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-white">
                EdgeVault Official USD Calendar
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400">
                Official-source release schedules, actual values, revisions and historical
                trends. Consensus is intentionally excluded.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-mono">Official BLS feed active</span>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#080b13]">
        <div className="flex flex-col gap-3 border-b border-gray-800 bg-[#0d111c] p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            {!compact ? (
              <>
                <button
                  type="button"
                  onClick={() => setAnchorDate(addDays(anchorDate, -7))}
                  className="rounded-md border border-gray-700 p-2 text-gray-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnchorDate(new Date())}
                  className="rounded-md border border-gray-700 px-3 py-2 font-mono text-xs text-gray-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setAnchorDate(addDays(anchorDate, 7))}
                  className="rounded-md border border-gray-700 p-2 text-gray-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : null}
            <span className="ml-1 font-mono text-xs font-bold text-white">
              {compact ? "Next 7 days" : formatRange(range.from, range.to)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!compact ? (
              <>
                <select
                  value={impactFilter}
                  onChange={(event) =>
                    setImpactFilter(event.target.value as "All" | EconomicImpact)
                  }
                  className="rounded-md border border-gray-700 bg-black px-3 py-2 font-mono text-xs text-gray-300 outline-none focus:border-cyan-500/60"
                >
                  {IMPACTS.map((impact) => (
                    <option key={impact} value={impact}>
                      {impact === "All" ? "All impacts" : `${impact} impact`}
                    </option>
                  ))}
                </select>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="rounded-md border border-gray-700 bg-black px-3 py-2 font-mono text-xs text-gray-300 outline-none focus:border-cyan-500/60"
                >
                  <option value="All">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void loadEvents(true)}
              disabled={refreshing}
              className="rounded-md border border-gray-700 p-2 text-gray-400 transition hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-50"
              aria-label="Refresh calendar"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="border-b border-gray-800 bg-black/30 px-3 py-2 text-[10px] text-gray-500">
          Times shown in {timeZone}. Auto-refreshes every 30 seconds.
          {lastUpdated ? (
            <span className="ml-2">Last checked {new Date(lastUpdated).toLocaleTimeString()}</span>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-400" />
            Loading official economic events…
          </div>
        ) : error ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadEvents(false)}
              className="rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-cyan-500/50"
            >
              Try again
            </button>
          </div>
        ) : groupedEvents.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
            <CalendarDays className="mb-3 h-6 w-6 text-gray-600" />
            <p className="text-sm text-gray-300">No matching USD events in this period.</p>
            <p className="mt-1 text-xs text-gray-500">
              Change the filters or move to another week.
            </p>
          </div>
        ) : (
          <div>
            {groupedEvents.map(([key, dayEvents]) => (
              <div key={key}>
                <div className="border-b border-gray-800 bg-cyan-400/[0.035] px-4 py-2 font-mono text-xs font-bold text-cyan-100">
                  {formatDay(new Date(`${key}T12:00:00`))}
                </div>

                {!compact ? (
                  <div className="hidden grid-cols-[72px_62px_minmax(230px,1fr)_86px_100px_100px_100px] border-b border-gray-800 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-gray-600 lg:grid">
                    <span>Time</span>
                    <span>CCY</span>
                    <span>Event</span>
                    <span>Impact</span>
                    <span className="text-right">Previous</span>
                    <span className="text-right">Actual</span>
                    <span className="text-right">Status</span>
                  </div>
                ) : null}

                {dayEvents.map((event) => {
                  const expanded = expandedEventId === event.id;
                  const history = event.series_id ? histories[event.series_id] : undefined;
                  const speechReport = speechReports[event.id];
                  const edgeVaultReportUrl =
                    `/dashboard?section=reports&reportsView=speech-archive&speechId=${encodeURIComponent(event.id)}`;

                  return (
                    <div key={event.id} className="border-b border-gray-800/80 last:border-0">
                      <button
                        type="button"
                        onClick={() => toggleEvent(event)}
                        className={`grid w-full items-center gap-3 overflow-x-auto px-4 py-3 text-left transition hover:bg-white/[0.025] ${
                          compact
                            ? "grid-cols-[64px_minmax(150px,1fr)_78px_84px]"
                            : "grid-cols-[72px_62px_minmax(230px,1fr)_86px_100px_100px_100px]"
                        }`}
                      >
                        <span className="font-mono text-xs text-gray-300">
                          {formatTime(event.event_time)}
                        </span>
                        {!compact ? (
                          <span className="font-mono text-xs font-bold text-white">
                            {event.currency || "USD"}
                          </span>
                        ) : null}
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-gray-100 sm:text-sm">
                              {event.title}
                            </span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 shrink-0 text-gray-600 transition ${
                                expanded ? "rotate-180 text-cyan-400" : ""
                              }`}
                            />
                          </span>
                          <span className="mt-1 block truncate text-[10px] text-gray-500">
                            {event.reference_period || event.category || "Official release"}
                          </span>
                        </span>
                        <span
                          className={`w-fit rounded border px-2 py-1 font-mono text-[10px] ${impactStyles(
                            event.impact
                          )}`}
                        >
                          {event.impact || "Low"}
                        </span>
                        {!compact ? (
                          <span className="text-right font-mono text-xs text-gray-400">
                            {formatValue(event.previous, event.unit)}
                          </span>
                        ) : null}
                        <span className="text-right font-mono text-xs font-bold text-cyan-300">
                          {formatValue(event.actual, event.unit)}
                        </span>
                        {!compact ? (
                          <span className="text-right">
                            <span
                              className={`inline-block rounded border px-2 py-1 font-mono text-[9px] uppercase ${statusStyles(
                                event.release_status
                              )}`}
                            >
                              {event.release_status}
                            </span>
                          </span>
                        ) : null}
                      </button>

                      {expanded ? (
                        <div className="border-t border-gray-800 bg-[#05070d] p-4">
                          <div className="mb-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                                Reference period
                              </p>
                              <p className="mt-1 text-gray-200">
                                {event.reference_period || "Not published"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                                Category
                              </p>
                              <p className="mt-1 text-gray-200">{event.category || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                                Impact score
                              </p>
                              <p className="mt-1 text-gray-200">
                                {event.expected_impact_score ?? event.base_impact_score ?? "—"}/100
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                                Official source
                              </p>
                              {event.source_url ? (
                                <a
                                  href={event.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                                >
                                  {event.source_agency || event.source || "Open source"}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <p className="mt-1 text-gray-200">{event.source || "—"}</p>
                              )}
                            </div>
                          </div>

                          {event.event_kind === "speech" ? (
                            <div className="mb-4 border-t border-gray-800 pt-4">
                              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                                EdgeVault report
                              </p>
                              {speechReport?.loading ? (
                                <p className="mt-1 text-xs text-gray-500">
                                  Checking whether the official speech report is available...
                                </p>
                              ) : speechReport?.error ? (
                                <p className="mt-1 text-xs text-red-300">{speechReport.error}</p>
                              ) : speechReport?.available ? (
                                <>
                                  <p className="mt-1 max-w-4xl text-xs leading-relaxed text-gray-300">
                                    {speechReport.summary ||
                                      "The official transcript is archived in EdgeVault."}
                                  </p>
                                  <a
                                    href={edgeVaultReportUrl}
                                    className="mt-2 inline-flex items-center gap-1 font-mono text-xs font-bold text-yellow-300 transition hover:text-yellow-200"
                                  >
                                    Open full EdgeVault report
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </>
                              ) : (
                                <p className="mt-1 text-xs text-gray-500">
                                  The EdgeVault report will appear after the official transcript is published.
                                </p>
                              )}
                            </div>
                          ) : null}

                          {event.ranking_reason ? (
                            <p className="mb-4 rounded-md border border-gray-800 bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-gray-400">
                              <span className="font-semibold text-gray-300">Why it matters: </span>
                              {event.ranking_reason}
                            </p>
                          ) : null}

                          {event.series_id && history ? <HistoryPanel state={history} /> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-gray-800 bg-black px-4 py-2 text-center text-[10px] text-gray-600 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span>Source: U.S. Bureau of Labor Statistics</span>
          <span>No paid consensus data · Actual and previous are official values</span>
        </div>
      </div>
    </div>
  );
}
