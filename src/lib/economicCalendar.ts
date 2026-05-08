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
    {
      id: "cad-retail-sales-2026-05-20",
      title: "Retail Sales",
      country: "Canada",
      date: "2026-05-20",
      time: "12:30",
      impact: "Medium",
      actual: null,
      forecast: 0.4,
      previous: 0.1,
      unit: "%",
      currency: "CAD",
    },
    {
      id: "cad-boc-rate-decision-2026-05-20",
      title: "BoC Rate Decision",
      country: "Canada",
      date: "2026-05-20",
      time: "14:00",
      impact: "High",
      actual: null,
      forecast: 4.5,
      previous: 4.75,
      unit: "%",
      currency: "CAD",
    },
    {
      id: "chf-snb-policy-rate-2026-05-21",
      title: "SNB Policy Rate",
      country: "Switzerland",
      date: "2026-05-21",
      time: "07:30",
      impact: "High",
      actual: null,
      forecast: 1.25,
      previous: 1.5,
      unit: "%",
      currency: "CHF",
    },
    {
      id: "chf-producer-import-prices-2026-05-21",
      title: "Producer and Import Prices",
      country: "Switzerland",
      date: "2026-05-21",
      time: "06:30",
      impact: "Medium",
      actual: null,
      forecast: 0.2,
      previous: 0.1,
      unit: "%",
      currency: "CHF",
    },
    {
      id: "nzd-gdp-growth-2026-05-22",
      title: "GDP Growth Rate",
      country: "New Zealand",
      date: "2026-05-22",
      time: "22:45",
      impact: "High",
      actual: null,
      forecast: 0.4,
      previous: 0.1,
      unit: "%",
      currency: "NZD",
    },
    {
      id: "nzd-rbnz-rate-decision-2026-05-22",
      title: "RBNZ Rate Decision",
      country: "New Zealand",
      date: "2026-05-22",
      time: "02:00",
      impact: "High",
      actual: null,
      forecast: 4.75,
      previous: 5.0,
      unit: "%",
      currency: "NZD",
    },
  ];
}

function normalizeEconomicEvent(
  event: ExternalEconomicEvent,
  source: string
): EconomicEvent {
  const combinedTimestamp = `${event.date}T${event.time}:00Z`;

  return {
    id: event.id,
    name: event.title,
    region: event.country,
    timestamp: combinedTimestamp,
    impactLevel: event.impact.toLowerCase() as EconomicEvent["impactLevel"],
    actualValue: event.actual ?? null,
    forecastValue: event.forecast ?? null,
    previousValue: event.previous ?? null,
    unit: event.unit ?? null,
    currency: event.currency ?? null,
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
