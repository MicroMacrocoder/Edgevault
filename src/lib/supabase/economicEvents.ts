// src/lib/economicEvents.ts
import type { EconomicEvent, ExternalEconomicEvent } from "../types/economic";

const EXTERNAL_ECONOMIC_API_KEY = process.env.EXTERNAL_ECONOMIC_API_KEY || "";

/**
 * TEMPORARY MOCK DATA
 * This simulates an external economic calendar API.
 * Later, this function will be replaced with a real API request.
 */
async function fetchExternalEconomicEvents(): Promise<ExternalEconomicEvent[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  return [
    {
      id: "usd-interest-rate-decision-2026-05-15",
      title: "Interest Rate Decision",
      country: "United States",
      date: "2026-05-15",
      time: "14:00",
      impact: "High",
      actual: null,
      forecast: 0.25,
      previous: 0.25,
      unit: "%",
      currency: "USD",
    },
    {
      id: "usd-non-farm-payrolls-2026-05-15",
      title: "Non-Farm Payrolls",
      country: "United States",
      date: "2026-05-15",
      time: "12:30",
      impact: "High",
      actual: null,
      forecast: 190000,
      previous: 175000,
      unit: "jobs",
      currency: "USD",
    },
    {
      id: "eur-unemployment-rate-2026-05-16",
      title: "Unemployment Rate",
      country: "Eurozone",
      date: "2026-05-16",
      time: "09:00",
      impact: "Medium",
      actual: null,
      forecast: 6.3,
      previous: 6.5,
      unit: "%",
      currency: "EUR",
    },
    {
      id: "eur-cpi-2026-05-16",
      title: "Consumer Price Index",
      country: "Eurozone",
      date: "2026-05-16",
      time: "10:00",
      impact: "High",
      actual: null,
      forecast: 2.4,
      previous: 2.2,
      unit: "%",
      currency: "EUR",
    },
    {
      id: "jpy-manufacturing-pmi-2026-05-17",
      title: "Manufacturing PMI",
      country: "Japan",
      date: "2026-05-17",
      time: "01:30",
      impact: "Low",
      actual: null,
      forecast: 51.5,
      previous: 50.9,
      unit: "index",
      currency: "JPY",
    },
    {
      id: "jpy-boj-policy-rate-2026-05-17",
      title: "BoJ Policy Rate",
      country: "Japan",
      date: "2026-05-17",
      time: "03:00",
      impact: "High",
      actual: null,
      forecast: 0.1,
      previous: 0.1,
      unit: "%",
      currency: "JPY",
    },
    {
      id: "gbp-gdp-growth-2026-05-18",
      title: "GDP Growth Rate",
      country: "United Kingdom",
      date: "2026-05-18",
      time: "06:00",
      impact: "High",
      actual: null,
      forecast: 0.3,
      previous: 0.2,
      unit: "%",
      currency: "GBP",
    },
    {
      id: "gbp-boe-interest-rate-2026-05-18",
      title: "BoE Interest Rate Decision",
      country: "United Kingdom",
      date: "2026-05-18",
      time: "11:00",
      impact: "High",
      actual: null,
      forecast: 4.75,
      previous: 5.0,
      unit: "%",
      currency: "GBP",
    },
    {
      id: "aud-employment-change-2026-05-19",
      title: "Employment Change",
      country: "Australia",
      date: "2026-05-19",
      time: "01:30",
      impact: "High",
      actual: null,
      forecast: 25000,
      previous: 18000,
      unit: "jobs",
      currency: "AUD",
    },
    {
      id: "aud-rba-rate-statement-2026-05-19",
      title: "RBA Rate Statement",
      country: "Australia",
      date: "2026-05-19",
      time: "04:30",
      impact: "High",
      actual: null,
      forecast: 4.35,
      previous: 4.35,
      unit: "%",
      currency: "AUD",
    },
  ];
}

function normalizeEconomicEvent(
  event: ExternalEconomicEvent,
  source: string
): EconomicEvent {
  // Combine date and time into ISO format
  const combinedTimestamp = `${event.date}T${event.time}:00Z`;

  return {
    id: event.id,
    indicator: event.title,         // matches EconomicEvent type
    currency: event.currency ?? null,
    actual: event.actual ?? null,
    forecast: event.forecast ?? null,
    previous: event.previous ?? null,
    impact: event.impact,
    unit: event.unit ?? null,
    releaseDate: combinedTimestamp,
    source,
  };
}

export async function getEconomicEvents(): Promise<EconomicEvent[]> {
  if (!EXTERNAL_ECONOMIC_API_KEY) {
    console.warn("EXTERNAL_ECONOMIC_API_KEY is not set. Using mock data.");
  }

  const externalEvents = await fetchExternalEconomicEvents();

  return externalEvents.map((event) =>
    normalizeEconomicEvent(event, "MockExternalAPI")
  );
}
