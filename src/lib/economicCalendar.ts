import type { EconomicEvent } from "@/types/economic";

/**
 * Fetch economic events from the /api/fundamentals endpoint
 * This endpoint uses Finnhub API to get live economic calendar data
 */
export async function getEconomicEvents(): Promise<EconomicEvent[]> {
  try {
    const response = await fetch("/api/fundamentals", { cache: "no-store" });

    if (!response.ok) {
      console.error("Failed to fetch economic events:", response.status);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn("Unexpected response format from /api/fundamentals");
      return [];
    }

    // Map the API response to EconomicEvent format
    return data.map((item: any, index: number) => ({
      id: `${item.currency}-${item.indicator}-${index}`,
      indicator: item.indicator || "Unknown Event",
      currency: item.currency || null,
      actual: item.actual ?? null,
      forecast: item.forecast ?? null,
      previous: item.previous ?? null,
      impact: item.impact || "Low",
      unit: item.unit || "",
      releaseDate: item.releaseDate || new Date().toISOString(),
      source: "Finnhub",
    }));
  } catch (error) {
    console.error("Error fetching economic events:", error);
    return [];
  }
}

/**
 * Filter economic events by currency
 */
export function filterByCurrency(
  events: EconomicEvent[],
  currency: string
): EconomicEvent[] {
  if (currency === "All") return events;
  return events.filter((e) => e.currency === currency);
}

/**
 * Filter economic events by impact
 */
export function filterByImpact(
  events: EconomicEvent[],
  impact: string
): EconomicEvent[] {
  if (impact === "All") return events;
  return events.filter((e) => e.impact.toLowerCase() === impact.toLowerCase());
}

/**
 * Filter economic events by date
 */
export function filterByDate(
  events: EconomicEvent[],
  dateStr: string
): EconomicEvent[] {
  if (!dateStr) return events;
  return events.filter((e) => e.releaseDate.startsWith(dateStr));
}

/**
 * Get unique currencies from events
 */
export function getUniqueCurrencies(events: EconomicEvent[]): string[] {
  const currencies = new Set(events.map((e) => e.currency).filter(Boolean));
  return Array.from(currencies).sort();
}

/**
 * Get unique impact levels from events
 */
export function getUniqueImpacts(events: EconomicEvent[]): string[] {
  const impacts = new Set(events.map((e) => e.impact));
  return Array.from(impacts).sort();
}

/**
 * Format time for display
 */
export function formatEventTime(eventTime: string): string {
  try {
    const date = new Date(eventTime);
    if (Number.isNaN(date.getTime())) return "Invalid time";
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Invalid time";
  }
}

/**
 * Format date for display
 */
export function formatEventDate(eventTime: string): string {
  try {
    const date = new Date(eventTime);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

/**
 * Format event value with unit
 */
export function formatEventValue(
  value: number | null | undefined,
  unit: string
): string {
  if (value === null || value === undefined) return "-";
  return `${value}${unit ? " " + unit : ""}`;
}
