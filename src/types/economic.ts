export type EconomicImpact = "High" | "Medium" | "Low";

export type EconomicEventKind =
  | "data"
  | "speech"
  | "decision"
  | "minutes"
  | "document";

export type EconomicReleaseStatus =
  | "scheduled"
  | "released"
  | "revised"
  | "cancelled"
  | "delayed";

export type EconomicEventSeriesRow = {
  id: string;
  series_key: string;
  name: string;
  country: string;
  currency: string;
  category: string;
  event_kind: EconomicEventKind;
  frequency: string | null;
  unit: string | null;
  official_source_name: string;
  official_source_url: string;
  source_connector: string;
  base_impact_score: number;
  ranking_notes: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
};

export type EconomicEventRow = {
  id: string;
  external_id: string;
  series_id: string | null;
  title: string;
  country: string | null;
  currency: string | null;
  impact: EconomicImpact | null;
  event_time: string;
  forecast: number | null;
  previous: number | null;
  actual: number | null;
  unit: string | null;
  source: string | null;
  event_kind: EconomicEventKind;
  category: string | null;
  reference_period: string | null;
  source_agency: string | null;
  source_url: string | null;
  source_event_id: string | null;
  source_published_at: string | null;
  release_status: EconomicReleaseStatus;
  initial_actual: number | null;
  revised_previous: number | null;
  base_impact_score: number | null;
  expected_impact_score: number | null;
  realized_impact_score: number | null;
  impact_breakdown: Record<string, unknown>;
  ranking_reason: string | null;
  raw_payload: Record<string, unknown>;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EconomicSourceEvent = {
  externalId: string;
  seriesKey: string;
  title: string;
  country: string;
  currency: string;
  eventTime: string;
  eventKind: EconomicEventKind;
  category: string;
  referencePeriod: string | null;
  sourceAgency: string;
  sourceUrl: string;
  sourceEventId: string;
  sourcePublishedAt: string | null;
  releaseStatus?: EconomicReleaseStatus;
  rawPayload: Record<string, unknown>;
};
