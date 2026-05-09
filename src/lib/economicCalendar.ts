import type { EconomicEvent, ExternalEconomicEvent } from "../types/economic";

const EXTERNAL_ECONOMIC_API_KEY = process.env.EXTERNAL_ECONOMIC_API_KEY || "";

/**
 * TEMPORARY MOCK DATA
 * Simulates an external economic API
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
    // … add the rest of your mock events here
  ];
}

/**
 * Normalize external event into EconomicEvent
 */
function normalizeEconomicEvent(
  event: ExternalEconomicEvent,
  source: string
): EconomicEvent {
  const combinedTimestamp = `${event.date}T${event.time}:00Z`;

  return {
    id: event.id,
    indicator: event.title,
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

/**
 * Fetch all economic events
 */
export async function getEconomicEvents(): Promise<EconomicEvent[]> {
  if (!EXTERNAL_ECONOMIC_API_KEY) {
    console.warn("EXTERNAL_ECONOMIC_API_KEY not set. Using mock data.");
  }

  const externalEvents = await fetchExternalEconomicEvents();

  return externalEvents.map((event) =>
    normalizeEconomicEvent(event, "MockExternalAPI")
  );
}
