// src/types/economic.ts

// Represents a standard economic event
export interface EconomicEvent {
  id?: string;
  external_id?: string;
  title?: string; // Added title to prevent build error
  country?: string | null;
  currency?: string | null;
  impact?: "High" | "Medium" | "Low" | null;
  event_time?: string | null;
  forecast?: number | null;
  previous?: number | null;
  actual?: number | null;
  unit?: string | null;
  source?: string | null;
}

// Represents events fetched from an external API
export interface ExternalEconomicEvent {
  id: string;
  title?: string; // ✅ Added this line to fix the Vercel build error
  country: string;
  date: string;
  time: string;
  currency?: string | null;
  impact?: "High" | "Medium" | "Low" | null;
  forecast?: number | null;
  previous?: number | null;
  actual?: number | null;
  unit?: string | null;
  source?: string | null;
}
