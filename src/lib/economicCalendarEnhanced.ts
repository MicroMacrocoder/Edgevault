import type { EconomicEvent } from "@/types/economic";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "";

export type EconomicEventEnhanced = EconomicEvent & {
  date: string;
  time: string;
  status: "Released" | "Upcoming";
  formattedTime: string;
  formattedDate: string;
};

export type EconomicCalendarFilters = {
  currencies: string[];
  impacts: string[];
  startDate: string;
  endDate: string;
  timezone: string;
};

/**
 * Fetch live economic events from Finnhub API
 */
async function fetchFinnhubEconomicEvents(): Promise<EconomicEventEnhanced[]> {
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

    if (!Array.isArray(data)) {
      console.warn("Unexpected Finnhub response format");
      return [];
    }

    const now = new Date();

    return data.map((event: any) => {
      const releaseDate = event.date || new Date().toISOString().split("T")[0];
      const releaseTime = event.time || "00:00";
      const combinedTimestamp = `${releaseDate}T${releaseTime}:00Z`;
      const eventDate = new Date(combinedTimestamp);
      const hasReleased = eventDate <= now;

      return {
        id: event.id || `${event.country}-${event.event}-${releaseDate}`,
        indicator: event.event || "Unknown Event",
        currency: event.country?.substring(0, 3).toUpperCase() || "USD",
        actual: event.actual !== undefined ? event.actual : null,
        forecast: event.forecast !== undefined ? event.forecast : null,
        previous: event.prev !== undefined ? event.prev : null,
        impact: event.impact || "Medium",
        unit: event.unit || "",
        releaseDate: combinedTimestamp,
        source: "Finnhub",
        date: releaseDate,
        time: releaseTime,
        status: hasReleased ? "Released" : "Upcoming",
        formattedTime: releaseTime,
        formattedDate: releaseDate,
      };
    });
  } catch (error) {
    console.error("Failed to fetch economic events from Finnhub:", error);
    return [];
  }
}

/**
 * Format time for display in user's timezone
 */
export function formatTimeInTimezone(
  dateTime: string,
  timezone: string
): { date: string; time: string } {
  try {
    const date = new Date(dateTime);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const day = parts.find((p) => p.type === "day")?.value || "";
    const hour = parts.find((p) => p.type === "hour")?.value || "";
    const minute = parts.find((p) => p.type === "minute")?.value || "";

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  } catch (error) {
    console.error("Error formatting time:", error);
    return { date: dateTime.split("T")[0], time: "00:00" };
  }
}

/**
 * Filter economic events based on criteria
 */
export function filterEconomicEvents(
  events: EconomicEventEnhanced[],
  filters: Partial<EconomicCalendarFilters>
): EconomicEventEnhanced[] {
  return events.filter((event) => {
    // Currency filter
    if (filters.currencies && filters.currencies.length > 0) {
      if (!filters.currencies.includes(event.currency)) {
        return false;
      }
    }

    // Impact filter
    if (filters.impacts && filters.impacts.length > 0) {
      if (!filters.impacts.includes(event.impact)) {
        return false;
      }
    }

    // Date range filter
    if (filters.startDate && filters.endDate) {
      const eventDate = event.date;
      if (eventDate < filters.startDate || eventDate > filters.endDate) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Group events by date for calendar view
 */
export function groupEventsByDate(
  events: EconomicEventEnhanced[]
): Record<string, EconomicEventEnhanced[]> {
  return events.reduce(
    (acc, event) => {
      const date = event.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, EconomicEventEnhanced[]>
  );
}

/**
 * Sort events by time
 */
export function sortEventsByTime(
  events: EconomicEventEnhanced[]
): EconomicEventEnhanced[] {
  return [...events].sort((a, b) => {
    const timeA = a.time.split(":").join("");
    const timeB = b.time.split(":").join("");
    return timeA.localeCompare(timeB);
  });
}

/**
 * Get all available currencies from events
 */
export function getAvailableCurrencies(
  events: EconomicEventEnhanced[]
): string[] {
  const currencies = new Set(events.map((e) => e.currency));
  return Array.from(currencies).sort();
}

/**
 * Get all available impact levels from events
 */
export function getAvailableImpacts(
  events: EconomicEventEnhanced[]
): string[] {
  const impacts = new Set(events.map((e) => e.impact));
  return Array.from(impacts).sort();
}

/**
 * Get all available dates from events
 */
export function getAvailableDates(
  events: EconomicEventEnhanced[]
): string[] {
  const dates = new Set(events.map((e) => e.date));
  return Array.from(dates).sort();
}

/**
 * Main function to get all economic events with optional filters
 */
export async function getEconomicEventsEnhanced(
  filters?: Partial<EconomicCalendarFilters>
): Promise<EconomicEventEnhanced[]> {
  const allEvents = await fetchFinnhubEconomicEvents();

  // Apply timezone formatting if specified
  if (filters?.timezone) {
    allEvents.forEach((event) => {
      const formatted = formatTimeInTimezone(event.releaseDate, filters.timezone);
      event.formattedDate = formatted.date;
      event.formattedTime = formatted.time;
    });
  }

  // Apply filters
  if (filters) {
    return filterEconomicEvents(allEvents, filters);
  }

  return allEvents;
}

/**
 * Get economic events grouped by date (for calendar view)
 */
export async function getEconomicEventsCalendarView(
  filters?: Partial<EconomicCalendarFilters>
): Promise<Record<string, EconomicEventEnhanced[]>> {
  const events = await getEconomicEventsEnhanced(filters);
  return groupEventsByDate(events);
}

/**
 * Get economic events as sorted list (for list view)
 */
export async function getEconomicEventsListView(
  filters?: Partial<EconomicCalendarFilters>
): Promise<EconomicEventEnhanced[]> {
  const events = await getEconomicEventsEnhanced(filters);
  return events.sort(
    (a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
  );
}
