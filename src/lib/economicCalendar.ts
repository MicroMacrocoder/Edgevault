import type { EconomicEvent, ExternalEconomicEvent } from "@/types/economic";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "";

/**
 * Fetch live economic events from Finnhub API
 */
async function fetchExternalEconomicEvents(): Promise<ExternalEconomicEvent[]> {
  if (!FINNHUB_API_KEY) {
    console.warn("FINNHUB_API_KEY not set. Cannot fetch live economic data.");
    return [];
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/economic-calendar?token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      console.error(`Finnhub API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    // Map Finnhub response to our ExternalEconomicEvent format
    if (!Array.isArray(data)) {
      console.warn("Unexpected Finnhub response format");
      return [];
    }

    return data.map((event: any) => ({
      id: event.id || `${event.country}-${event.event}-${event.date}`,
      title: event.event || "Unknown Event",
      country: event.country || "Unknown",
      date: event.date || new Date().toISOString().split("T")[0],
      time: event.time || "00:00",
      impact: event.impact || "Medium",
      actual: event.actual !== undefined ? event.actual : null,
      forecast: event.forecast !== undefined ? event.forecast : null,
      previous: event.prev !== undefined ? event.prev : null,
      unit: event.unit || "",
      currency: event.country?.substring(0, 3).toUpperCase() || "USD",
    }));
  } catch (error) {
    console.error("Failed to fetch economic events from Finnhub:", error);
    return [];
  }
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
  const externalEvents = await fetchExternalEconomicEvents();

  return externalEvents.map((event) =>
    normalizeEconomicEvent(event, "Finnhub")
  );
}
