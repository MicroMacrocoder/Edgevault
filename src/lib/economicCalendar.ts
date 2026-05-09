import type { EconomicEvent, ExternalEconomicEvent } from "../types/economic";

const EXTERNAL_ECONOMIC_API_KEY = process.env.EXTERNAL_ECONOMIC_API_KEY || "";

// This is a placeholder; can be replaced with real API fetch later
async function fetchExternalEconomicEvents(): Promise<ExternalEconomicEvent[]> {
  return [];
}

function normalizeEconomicEvent(event: ExternalEconomicEvent, source: string): EconomicEvent {
  // Combine date and time to ISO string for frontend
  const event_time = `${event.date}T${event.time}:00Z`;

  return {
    id: event.id,
    title: event.title,           // matches EconomicEvent
    currency: event.currency ?? null,
    impact: event.impact ?? null,
    event_time,
    actual: event.actual ?? null,
    forecast: event.forecast ?? null,
    previous: event.previous ?? null,
    unit: event.unit ?? null,
    source,
  };
}

export async function getEconomicEvents(): Promise<EconomicEvent[]> {
  if (!EXTERNAL_ECONOMIC_API_KEY) {
    console.warn("EXTERNAL_ECONOMIC_API_KEY is not set. No external events will be fetched.");
  }

  const externalEvents = await fetchExternalEconomicEvents();

  return externalEvents.map((event) => normalizeEconomicEvent(event, "ExternalAPI"));
}
