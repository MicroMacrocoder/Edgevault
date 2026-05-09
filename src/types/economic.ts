// src/types/economic.ts
export type EconomicEvent = {
  id: string;
  indicator: string;       // Name of the event, e.g., "NFP"
  currency: string | null; // e.g., "USD"
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  impact: "High" | "Medium" | "Low";
  unit: string | null;     // e.g., "%", "jobs", etc.
  releaseDate: string;     // ISO datetime string
  source: string;          // e.g., "MockExternalAPI" or API name
};

export type ExternalEconomicEvent = {
  id: string;
  title: string;
  country: string;
  date: string;
  time: string;
  impact: "High" | "Medium" | "Low";
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  unit: string;
  currency: string;
};
