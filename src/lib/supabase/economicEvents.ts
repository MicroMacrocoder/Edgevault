import { createClient } from "@supabase/supabase-js";
import type {
  EconomicEventRow,
  EconomicEventSeriesRow,
  EconomicImpact,
  EconomicSourceEvent,
} from "@/types/economic";

function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function impactFromScore(score: number): EconomicImpact {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export async function upsertOfficialEconomicEvents(
  sourceEvents: EconomicSourceEvent[]
) {
  if (sourceEvents.length === 0) {
    return { error: null, events: [] as EconomicEventRow[], synced: 0 };
  }

  const supabase = getSupabaseServer();
  const seriesKeys = [...new Set(sourceEvents.map((event) => event.seriesKey))];
  const externalIds = sourceEvents.map((event) => event.externalId);

  const { data: seriesData, error: seriesError } = await supabase
    .from("economic_event_series")
    .select("*")
    .in("series_key", seriesKeys)
    .eq("is_active", true);

  if (seriesError) return { error: seriesError, events: [], synced: 0 };

  const seriesByKey = new Map(
    ((seriesData || []) as EconomicEventSeriesRow[]).map((series) => [
      series.series_key,
      series,
    ])
  );
  const missingSeries = seriesKeys.filter((key) => !seriesByKey.has(key));

  if (missingSeries.length > 0) {
    return {
      error: new Error(
        `Missing economic event series: ${missingSeries.join(", ")}`
      ),
      events: [],
      synced: 0,
    };
  }

  const existingData: EconomicEventRow[] = [];

  for (const externalIdBatch of chunkValues(externalIds, 50)) {
    const { data, error } = await supabase
      .from("economic_events")
      .select("*")
      .in("external_id", externalIdBatch);

    if (error) return { error, events: [], synced: 0 };
    existingData.push(...((data || []) as EconomicEventRow[]));
  }

  const existingByExternalId = new Map(
    existingData.map((event) => [
      event.external_id,
      event,
    ])
  );
  const checkedAt = new Date().toISOString();

  const rows = sourceEvents.map((sourceEvent) => {
    const series = seriesByKey.get(sourceEvent.seriesKey)!;
    const existing = existingByExternalId.get(sourceEvent.externalId);
    const expectedImpactScore =
      existing?.expected_impact_score ?? series.base_impact_score;
    const eventTimestamp = new Date(sourceEvent.eventTime).getTime();
    const isReleased =
      Number.isFinite(eventTimestamp) && eventTimestamp <= Date.now();

    return {
      external_id: sourceEvent.externalId,
      series_id: series.id,
      title: sourceEvent.title,
      country: sourceEvent.country,
      currency: sourceEvent.currency,
      impact: impactFromScore(expectedImpactScore),
      event_time: sourceEvent.eventTime,
      forecast: sourceEvent.forecast ?? existing?.forecast ?? null,
      previous: sourceEvent.previous ?? existing?.previous ?? null,
      actual: isReleased
        ? sourceEvent.actual ?? existing?.actual ?? null
        : null,
      unit: sourceEvent.unit ?? series.unit,
      source: series.official_source_name,
      event_kind: sourceEvent.eventKind,
      category: sourceEvent.category,
      reference_period: sourceEvent.referencePeriod,
      source_agency: sourceEvent.sourceAgency,
      source_url: sourceEvent.sourceUrl,
      source_event_id: sourceEvent.sourceEventId,
      source_published_at:
        existing?.source_published_at ?? sourceEvent.sourcePublishedAt,
      release_status: isReleased
        ? sourceEvent.releaseStatus ??
          (existing?.release_status === "revised" ? "revised" : "released")
        : "scheduled",
      initial_actual: isReleased ? existing?.initial_actual ?? null : null,
      revised_previous: isReleased ? existing?.revised_previous ?? null : null,
      base_impact_score: series.base_impact_score,
      expected_impact_score: expectedImpactScore,
      realized_impact_score: existing?.realized_impact_score ?? null,
      impact_breakdown: existing?.impact_breakdown ?? {
        predefined_score: series.base_impact_score,
      },
      ranking_reason:
        existing?.ranking_reason ?? series.ranking_notes ?? "Predefined impact.",
      raw_payload: sourceEvent.rawPayload,
      last_checked_at: checkedAt,
    };
  });

  const savedEvents: EconomicEventRow[] = [];

  for (const rowBatch of chunkValues(rows, 100)) {
    const { data, error } = await supabase
      .from("economic_events")
      .upsert(rowBatch, { onConflict: "external_id" })
      .select("*");

    if (error) {
      return { error, events: savedEvents, synced: savedEvents.length };
    }
    savedEvents.push(...((data || []) as EconomicEventRow[]));
  }

  return {
    error: null,
    events: savedEvents,
    synced: rows.length,
  };
}

export async function getStoredEconomicEvents(options?: {
  currency?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const supabase = getSupabaseServer();
  const currency = (options?.currency || "USD").toUpperCase();
  const limit = Math.min(Math.max(options?.limit || 500, 1), 2000);

  let query = supabase
    .from("economic_events")
    .select("*")
    .order("event_time", { ascending: true })
    .limit(limit);

  if (currency !== "ALL") query = query.eq("currency", currency);

  if (options?.from) query = query.gte("event_time", options.from);
  if (options?.to) query = query.lte("event_time", options.to);

  const { data, error } = await query;
  return { error, events: (data || []) as EconomicEventRow[] };
}
