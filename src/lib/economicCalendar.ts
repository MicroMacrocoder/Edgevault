import type { EconomicSourceEvent } from "@/types/economic";

export const BLS_CALENDAR_ICS_URL =
  "https://www.bls.gov/schedule/news_release/bls.ics";

type IcsEvent = Record<string, string>;

type BlsSeriesMapping = {
  seriesKey: string;
  title: string;
  category: string;
};

const BLS_REPORT_MAPPINGS: Array<{
  matches: (summary: string) => boolean;
  series: BlsSeriesMapping[];
}> = [
  {
    matches: (summary) => summary.includes("employment situation"),
    series: [
      {
        seriesKey: "us-nonfarm-payrolls",
        title: "Nonfarm Payrolls",
        category: "Labour",
      },
      {
        seriesKey: "us-unemployment-rate",
        title: "Unemployment Rate",
        category: "Labour",
      },
      {
        seriesKey: "us-average-hourly-earnings-mom",
        title: "Average Hourly Earnings MoM",
        category: "Labour",
      },
      {
        seriesKey: "us-average-hourly-earnings-yoy",
        title: "Average Hourly Earnings YoY",
        category: "Labour",
      },
      {
        seriesKey: "us-labour-force-participation",
        title: "Labour Force Participation Rate",
        category: "Labour",
      },
    ],
  },
  {
    matches: (summary) => summary.includes("consumer price index"),
    series: [
      { seriesKey: "us-cpi-mom", title: "CPI MoM", category: "Inflation" },
      { seriesKey: "us-cpi-yoy", title: "CPI YoY", category: "Inflation" },
      {
        seriesKey: "us-core-cpi-mom",
        title: "Core CPI MoM",
        category: "Inflation",
      },
      {
        seriesKey: "us-core-cpi-yoy",
        title: "Core CPI YoY",
        category: "Inflation",
      },
    ],
  },
  {
    matches: (summary) => summary.includes("producer price index"),
    series: [
      {
        seriesKey: "us-ppi-mom",
        title: "PPI Final Demand MoM",
        category: "Inflation",
      },
      {
        seriesKey: "us-ppi-yoy",
        title: "PPI Final Demand YoY",
        category: "Inflation",
      },
      {
        seriesKey: "us-core-ppi-mom",
        title: "Core PPI MoM",
        category: "Inflation",
      },
    ],
  },
  {
    matches: (summary) =>
      summary.includes("job openings and labor turnover") ||
      summary.includes("jolts"),
    series: [
      {
        seriesKey: "us-jolts-job-openings",
        title: "JOLTS Job Openings",
        category: "Labour",
      },
    ],
  },
  {
    matches: (summary) => summary.includes("employment cost index"),
    series: [
      {
        seriesKey: "us-employment-cost-index",
        title: "Employment Cost Index QoQ",
        category: "Labour",
      },
    ],
  },
  {
    matches: (summary) =>
      summary.includes("productivity and costs") ||
      summary.includes("productivity and cost"),
    series: [
      {
        seriesKey: "us-nonfarm-productivity",
        title: "Nonfarm Productivity QoQ",
        category: "Productivity",
      },
      {
        seriesKey: "us-unit-labour-costs",
        title: "Unit Labour Costs QoQ",
        category: "Productivity",
      },
    ],
  },
];

function unfoldIcsLines(icsText: string): string[] {
  return icsText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function decodeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcsEvents(icsText: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;

  for (const line of unfoldIcsLines(icsText)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }

    if (!current) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;

    const property = line.slice(0, separatorIndex);
    const value = decodeIcsText(line.slice(separatorIndex + 1));
    const propertyName = property.split(";", 1)[0].toUpperCase();
    current[propertyName] = value;

    const timezoneMatch = property.match(/;TZID=([^;:]+)/i);
    if (timezoneMatch) current[`${propertyName}_TZID`] = timezoneMatch[1];
  }

  return events;
}

function dateTimePartsInZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function normalizeIcsTimeZone(timeZone?: string): string {
  const normalized = timeZone?.trim().toLowerCase();

  if (
    normalized === "us-eastern" ||
    normalized === "eastern standard time" ||
    normalized === "est5edt"
  ) {
    return "America/New_York";
  }

  return timeZone?.trim() || "America/New_York";
}

function zonedDateTimeToUtc(
  components: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string
): Date {
  const desiredAsUtc = Date.UTC(
    components.year,
    components.month - 1,
    components.day,
    components.hour,
    components.minute,
    components.second
  );
  let candidate = new Date(desiredAsUtc);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = dateTimePartsInZone(candidate, timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    const correction = desiredAsUtc - observedAsUtc;
    if (correction === 0) break;
    candidate = new Date(candidate.getTime() + correction);
  }

  return candidate;
}

function parseIcsDateTime(value: string, timeZone?: string): Date | null {
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/
  );
  if (!match) return null;

  const components = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };

  if (match[7] === "Z") {
    return new Date(
      Date.UTC(
        components.year,
        components.month - 1,
        components.day,
        components.hour,
        components.minute,
        components.second
      )
    );
  }

  return zonedDateTimeToUtc(
    components,
    normalizeIcsTimeZone(timeZone)
  );
}

function extractReferencePeriod(summary: string): string | null {
  const match = summary.match(/\bfor\s+(.+?)(?:\s*\(|$)/i);
  return match?.[1]?.trim() || null;
}

function findBlsMappings(summary: string): BlsSeriesMapping[] {
  const normalized = summary.toLowerCase();
  return (
    BLS_REPORT_MAPPINGS.find((mapping) => mapping.matches(normalized))?.series ||
    []
  );
}

export function parseBlsCalendarIcs(icsText: string): EconomicSourceEvent[] {
  const sourceEvents: EconomicSourceEvent[] = [];

  for (const event of parseIcsEvents(icsText)) {
    const uid = event.UID?.trim();
    const summary = event.SUMMARY?.trim();
    const startsAt = event.DTSTART
      ? parseIcsDateTime(event.DTSTART, event.DTSTART_TZID)
      : null;

    if (!uid || !summary || !startsAt) continue;

    const mappings = findBlsMappings(summary);
    if (mappings.length === 0) continue;

    const sourceUrl = event.URL || BLS_CALENDAR_ICS_URL;
    const sourcePublishedAt = event.DTSTAMP
      ? parseIcsDateTime(event.DTSTAMP, event.DTSTAMP_TZID)?.toISOString() || null
      : null;

    for (const mapping of mappings) {
      sourceEvents.push({
        externalId: `bls:${uid}:${mapping.seriesKey}`,
        seriesKey: mapping.seriesKey,
        title: mapping.title,
        country: "United States",
        currency: "USD",
        eventTime: startsAt.toISOString(),
        eventKind: "data",
        category: mapping.category,
        referencePeriod: extractReferencePeriod(summary),
        sourceAgency: "U.S. Bureau of Labor Statistics",
        sourceUrl,
        sourceEventId: `${uid}:${mapping.seriesKey}`,
        sourcePublishedAt,
        rawPayload: {
          calendar_uid: uid,
          calendar_summary: summary,
          calendar_description: event.DESCRIPTION || null,
          calendar_location: event.LOCATION || null,
          calendar_dtstart: event.DTSTART,
          calendar_timezone: event.DTSTART_TZID || "America/New_York",
        },
      });
    }
  }

  return sourceEvents;
}

export async function fetchBlsCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const response = await fetch(BLS_CALENDAR_ICS_URL, {
    cache: "no-store",
    headers: {
      Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1",
      "User-Agent":
        "EdgeVault-Economic-Calendar/1.0 (+https://edgevault-six.vercel.app)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `BLS calendar request failed with HTTP ${response.status}.`
    );
  }

  const icsText = await response.text();
  const events = parseBlsCalendarIcs(icsText);

  if (events.length === 0) {
    throw new Error("The BLS calendar returned no supported USD events.");
  }

  return events;
}
