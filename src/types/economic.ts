// src/types/economic.ts

// Represents an internal economic event from your API
export interface EconomicEvent {
  id?: string;
  external_id?: string;
  title?: string;
  country?: string | null;
  currency?: string | null;
  impact?: string | null;
  event_time?: string | null; // ISO string
  forecast?: number | null;
  previous?: number | null;
  actual?: number | null;
  unit?: string | null;
  source?: string | null;
}

// Represents an external economic event from 3rd-party APIs
export interface ExternalEconomicEvent {
  id?: string;
  name?: string;
  country?: string;
  currency?: string;
  importance?: "High" | "Medium" | "Low";
  date?: string;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  unit?: string | null;
  source?: string;
}
