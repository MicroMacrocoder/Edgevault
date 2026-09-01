import { createClient } from "@supabase/supabase-js";
import type { EconomicSeriesObservationInput } from "@/lib/blsHistoricalData";

type EconomicSeriesRow = {
  id: string;
  series_key: string;
};

type ExistingObservationRow = {
  series_id: string;
  reference_period: string;
  value: number | string;
  initial_value: number | string | null;
  is_revised: boolean;
  revision_count: number;
  first_observed_at: string;
};

type StoredObservationRow = ExistingObservationRow & {
  id: string;
  period_start: string;
  source_series_id: string;
};

type StoredEconomicEventRow = {
  id: string;
  series_id: string | null;
  reference_period: string | null;
  actual: number | string | null;
  previous: number | string | null;
  release_status: string;
  raw_payload: Record<string, unknown> | null;
  [key: string]: unknown;
};

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

function observationKey(seriesId: string, referencePeriod: string): string {
  return `${seriesId}:${referencePeriod}`;
}

export async function upsertEconomicSeriesObservations(
  observations: EconomicSeriesObservationInput[]
) {
  if (observations.length === 0) {
    return { error: null, synced: 0, inserted: 0, revised: 0 };
  }

  const supabase = getSupabaseServer();
  const seriesKeys = [...new Set(observations.map((row) => row.seriesKey))];
  const { data: seriesData, error: seriesError } = await supabase
    .from("economic_event_series")
    .select("id,series_key")
    .in("series_key", seriesKeys)
    .eq("is_active", true);

  if (seriesError) {
    return { error: seriesError, synced: 0, inserted: 0, revised: 0 };
  }

  const seriesByKey = new Map(
    ((seriesData || []) as EconomicSeriesRow[]).map((series) => [
      series.series_key,
      series.id,
    ])
  );
  const missingSeries = seriesKeys.filter((seriesKey) => !seriesByKey.has(seriesKey));
  if (missingSeries.length > 0) {
    return {
      error: new Error(`Missing economic event series: ${missingSeries.join(", ")}`),
      synced: 0,
      inserted: 0,
      revised: 0,
    };
  }

  const seriesIds = [...new Set(seriesByKey.values())];
  const existingRows: ExistingObservationRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("economic_series_observations")
      .select(
        "series_id,reference_period,value,initial_value,is_revised,revision_count,first_observed_at"
      )
      .in("series_id", seriesIds)
      .range(offset, offset + pageSize - 1);

    if (error) return { error, synced: 0, inserted: 0, revised: 0 };
    const page = (data || []) as ExistingObservationRow[];
    existingRows.push(...page);
    if (page.length < pageSize) break;
  }

  const existingByKey = new Map(
    existingRows.map((row) => [
      observationKey(row.series_id, row.reference_period),
      row,
    ])
  );
  const observedAt = new Date().toISOString();
  let inserted = 0;
  let revised = 0;

  const rows = observations.map((observation) => {
    const seriesId = seriesByKey.get(observation.seriesKey)!;
    const existing = existingByKey.get(
      observationKey(seriesId, observation.referencePeriod)
    );
    const valueChanged =
      Boolean(existing) && Number(existing!.value) !== observation.value;
    if (!existing) inserted += 1;
    if (valueChanged) revised += 1;

    return {
      series_id: seriesId,
      reference_period: observation.referencePeriod,
      period_start: observation.periodStart,
      period_end: observation.periodEnd,
      period_frequency: observation.periodFrequency,
      value: observation.value,
      initial_value:
        existing?.initial_value == null
          ? existing?.value ?? observation.value
          : existing.initial_value,
      raw_value: observation.rawValue,
      unit: observation.unit,
      measurement: observation.measurement,
      source_series_id: observation.sourceSeriesId,
      source_name: observation.sourceName,
      source_url: observation.sourceUrl,
      source_payload: observation.sourcePayload,
      footnotes: observation.footnotes,
      is_preliminary: observation.isPreliminary,
      is_revised:
        observation.isRevised || Boolean(existing?.is_revised) || valueChanged,
      revision_count: valueChanged
        ? (existing?.revision_count || 0) + 1
        : existing?.revision_count || 0,
      first_observed_at: existing?.first_observed_at || observedAt,
      last_observed_at: observedAt,
    };
  });

  let synced = 0;
  for (const rowBatch of chunkValues(rows, 100)) {
    const { error } = await supabase
      .from("economic_series_observations")
      .upsert(rowBatch, { onConflict: "series_id,reference_period" });

    if (error) return { error, synced, inserted, revised };
    synced += rowBatch.length;
  }

  return { error: null, synced, inserted, revised };
}

function normalizedReferencePeriod(referencePeriod: string): string {
  return referencePeriod
    .replace(/\s*\((?:P|R)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function applyObservationsToEconomicEvents() {
  const supabase = getSupabaseServer();
  const { data: seriesData, error: seriesError } = await supabase
    .from("economic_event_series")
    .select("id,series_key")
    .eq("source_connector", "bls")
    .eq("is_active", true);

  if (seriesError) return { error: seriesError, updated: 0 };
  const seriesIds = ((seriesData || []) as EconomicSeriesRow[]).map(
    (series) => series.id
  );

  const observations: StoredObservationRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("economic_series_observations")
      .select(
        "id,series_id,reference_period,period_start,value,initial_value,is_revised,revision_count,first_observed_at,source_series_id"
      )
      .in("series_id", seriesIds)
      .order("series_id", { ascending: true })
      .order("period_start", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) return { error, updated: 0 };
    const page = (data || []) as StoredObservationRow[];
    observations.push(...page);
    if (page.length < pageSize) break;
  }

  const observationByPeriod = new Map<string, StoredObservationRow>();
  const previousByObservationId = new Map<string, StoredObservationRow>();
  const previousBySeries = new Map<string, StoredObservationRow>();

  for (const observation of observations.sort((left, right) =>
    left.series_id === right.series_id
      ? left.period_start.localeCompare(right.period_start)
      : left.series_id.localeCompare(right.series_id)
  )) {
    const previous = previousBySeries.get(observation.series_id);
    if (previous) previousByObservationId.set(observation.id, previous);
    previousBySeries.set(observation.series_id, observation);
    observationByPeriod.set(
      observationKey(
        observation.series_id,
        normalizedReferencePeriod(observation.reference_period)
      ),
      observation
    );
  }

  const events: StoredEconomicEventRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("economic_events")
      .select("*")
      .in("series_id", seriesIds)
      .not("reference_period", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) return { error, updated: 0 };
    const page = (data || []) as StoredEconomicEventRow[];
    events.push(...page);
    if (page.length < pageSize) break;
  }

  const updatedRows: StoredEconomicEventRow[] = [];
  for (const event of events) {
    if (!event.series_id || !event.reference_period) continue;
    const observation = observationByPeriod.get(
      observationKey(
        event.series_id,
        normalizedReferencePeriod(event.reference_period)
      )
    );
    if (!observation) continue;

    const previous = previousByObservationId.get(observation.id);
    updatedRows.push({
      ...event,
      actual: Number(observation.value),
      previous: previous ? Number(previous.value) : null,
      release_status: /\(R\)\s*$/i.test(event.reference_period)
        ? "revised"
        : "released",
      raw_payload: {
        ...(event.raw_payload || {}),
        historical_value_source: "BLS Public Data API 2.0",
        historical_value_source_series_id: observation.source_series_id,
        historical_value_is_current_official: true,
      },
    });
  }

  let updated = 0;
  for (const rowBatch of chunkValues(updatedRows, 100)) {
    const { error } = await supabase
      .from("economic_events")
      .upsert(rowBatch, { onConflict: "id" });

    if (error) return { error, updated };
    updated += rowBatch.length;
  }

  return { error: null, updated };
}
