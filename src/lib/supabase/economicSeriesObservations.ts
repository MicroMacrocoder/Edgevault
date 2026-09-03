import { createClient } from "@supabase/supabase-js";
import type { EconomicSeriesObservationInput } from "@/lib/blsHistoricalData";

type EconomicSeriesRow = {
  id: string;
  series_key: string;
};

export type EconomicSeriesDetailsRow = EconomicSeriesRow & {
  name: string;
  category: string;
  currency: string;
  unit: string | null;
  frequency: string | null;
  official_source_name: string;
  official_source_url: string;
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
  period_end: string;
  period_frequency: string;
  raw_value: number | string | null;
  unit: string | null;
  measurement: string | null;
  source_series_id: string;
  source_name: string;
  source_url: string;
  last_observed_at: string;
};

type StoredEconomicEventRow = {
  id: string;
  series_id: string | null;
  event_time: string;
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

  const missingSeries = seriesKeys.filter(
    (seriesKey) => !seriesByKey.has(seriesKey)
  );

  if (missingSeries.length > 0) {
    return {
      error: new Error(
        `Missing economic event series: ${missingSeries.join(", ")}`
      ),
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

    if (error) {
      return { error, synced: 0, inserted: 0, revised: 0 };
    }

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

    if (error) {
      return { error, synced, inserted, revised };
    }

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

function latestEligibleObservation(
  observations: StoredObservationRow[],
  eventTime: string,
  seriesKey: string
): StoredObservationRow | null {
  const eventTimestamp = new Date(eventTime).getTime();

  if (!Number.isFinite(eventTimestamp)) {
    return null;
  }

  const eligible = observations.filter((observation) => {
    const periodEnd = new Date(
      `${observation.period_end}T23:59:59.999Z`
    ).getTime();

    return Number.isFinite(periodEnd) && periodEnd < eventTimestamp;
  });

  // JOLTS is normally released with a two-month reporting lag.
  // Other supported monthly BLS reports use the latest completed month.
  // Quarterly series use the latest completed quarter.
  const offsetFromLatest =
    seriesKey === "us-jolts-job-openings" ? 2 : 1;

  return eligible[eligible.length - offsetFromLatest] || null;
}

export async function getEconomicSeriesHistory(options: {
  seriesId: string;
  limit?: number;
}) {
  const supabase = getSupabaseServer();
  const limit = Math.min(Math.max(options.limit || 24, 1), 240);

  const { data: seriesData, error: seriesError } = await supabase
    .from("economic_event_series")
    .select(
      "id,series_key,name,category,currency,unit,frequency,official_source_name,official_source_url"
    )
    .eq("id", options.seriesId)
    .maybeSingle();

  if (seriesError) {
    return {
      error: seriesError,
      series: null,
      observations: [],
    };
  }

  if (!seriesData) {
    return {
      error: new Error("Economic series not found."),
      series: null,
      observations: [],
    };
  }

  const { data, error } = await supabase
    .from("economic_series_observations")
    .select(
      "id,series_id,reference_period,period_start,period_end,period_frequency,value,initial_value,raw_value,unit,measurement,source_series_id,source_name,source_url,is_preliminary,is_revised,revision_count,first_observed_at,last_observed_at"
    )
    .eq("series_id", options.seriesId)
    .order("period_start", { ascending: false })
    .limit(limit);

  return {
    error,
    series: seriesData as EconomicSeriesDetailsRow,
    observations: data || [],
  };
}

export async function applyObservationsToEconomicEvents(options?: {
  sourceConnector?: string;
  historicalValueSource?: string;
}) {
  const supabase = getSupabaseServer();
  const sourceConnector = options?.sourceConnector || "bls";
  const historicalValueSource =
    options?.historicalValueSource || "BLS Public Data API 2.0";

  const { data: seriesData, error: seriesError } = await supabase
    .from("economic_event_series")
    .select("id,series_key")
    .eq("source_connector", sourceConnector)
    .eq("is_active", true);

  if (seriesError) {
    return { error: seriesError, updated: 0 };
  }

  const seriesIds = ((seriesData || []) as EconomicSeriesRow[]).map(
    (series) => series.id
  );

  const seriesKeyById = new Map(
    ((seriesData || []) as EconomicSeriesRow[]).map((series) => [
      series.id,
      series.series_key,
    ])
  );

  const observations: StoredObservationRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("economic_series_observations")
      .select(
        "id,series_id,reference_period,period_start,period_end,period_frequency,value,initial_value,raw_value,unit,measurement,is_revised,revision_count,first_observed_at,last_observed_at,source_series_id,source_name,source_url"
      )
      .in("series_id", seriesIds)
      .order("series_id", { ascending: true })
      .order("period_start", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return { error, updated: 0 };
    }

    const page = (data || []) as StoredObservationRow[];
    observations.push(...page);

    if (page.length < pageSize) break;
  }

  const observationByPeriod = new Map<string, StoredObservationRow>();
  const observationsBySeries = new Map<
    string,
    StoredObservationRow[]
  >();
  const previousByObservationId = new Map<
    string,
    StoredObservationRow
  >();
  const previousBySeries = new Map<string, StoredObservationRow>();

  for (const observation of observations.sort((left, right) =>
    left.series_id === right.series_id
      ? left.period_start.localeCompare(right.period_start)
      : left.series_id.localeCompare(right.series_id)
  )) {
    const seriesObservations =
      observationsBySeries.get(observation.series_id) || [];

    seriesObservations.push(observation);
    observationsBySeries.set(
      observation.series_id,
      seriesObservations
    );

    const previous = previousBySeries.get(observation.series_id);

    if (previous) {
      previousByObservationId.set(observation.id, previous);
    }

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
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return { error, updated: 0 };
    }

    const page = (data || []) as StoredEconomicEventRow[];
    events.push(...page);

    if (page.length < pageSize) break;
  }

  const updatedRows: StoredEconomicEventRow[] = [];

  for (const event of events) {
    if (!event.series_id) continue;

    const seriesKey = seriesKeyById.get(event.series_id) || "";
    const seriesObservations =
      observationsBySeries.get(event.series_id) || [];

    const eventTimestamp = new Date(event.event_time).getTime();

    const isReleased =
      Number.isFinite(eventTimestamp) &&
      eventTimestamp <= Date.now();

    const matchingObservation = event.reference_period
      ? observationByPeriod.get(
          observationKey(
            event.series_id,
            normalizedReferencePeriod(event.reference_period)
          )
        )
      : undefined;

    const actualObservation = isReleased
      ? matchingObservation ||
        latestEligibleObservation(
          seriesObservations,
          event.event_time,
          seriesKey
        )
      : null;

    const previousObservation = latestEligibleObservation(
      seriesObservations,
      event.event_time,
      seriesKey
    );

    if (!actualObservation && !previousObservation) {
      continue;
    }

    if (actualObservation) {
      const previous = previousByObservationId.get(
        actualObservation.id
      );

      const referencePeriod =
        event.reference_period ||
        actualObservation.reference_period;

      updatedRows.push({
        ...event,
        reference_period: referencePeriod,
        actual: Number(actualObservation.value),
        initial_actual:
          actualObservation.initial_value == null
            ? Number(actualObservation.value)
            : Number(actualObservation.initial_value),
        previous: previous
          ? Number(previous.value)
          : event.previous,
        release_status: /\(R\)\s*$/i.test(referencePeriod)
          ? "revised"
          : "released",
        raw_payload: {
          ...(event.raw_payload || {}),
          historical_value_source: historicalValueSource,
          historical_value_source_series_id:
            actualObservation.source_series_id,
          historical_value_is_current_official: true,
        },
      });
    } else {
      updatedRows.push({
        ...event,
        previous: previousObservation
          ? Number(previousObservation.value)
          : event.previous,
        actual: event.actual,
        release_status: event.release_status || "scheduled",
      });
    }
  }

  let updated = 0;

  for (const rowBatch of chunkValues(updatedRows, 100)) {
    const { error } = await supabase
      .from("economic_events")
      .upsert(rowBatch, { onConflict: "id" });

    if (error) {
      return { error, updated };
    }

    updated += rowBatch.length;
  }

  return { error: null, updated };
}
