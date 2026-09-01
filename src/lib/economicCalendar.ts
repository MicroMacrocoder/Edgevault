import type { EconomicSourceEvent } from "@/types/economic";

export const BLS_CALENDAR_ICS_URL =
  "https://www.bls.gov/schedule/news_release/bls.ics";

type IcsEvent = Record<string, string>;

type BlsSeriesMapping = {
  seriesKey: string;
  title: string;
  category: string;
};

type BlsReportMapping = {
  reportKey: string;
  scheduleUrl: string;
  matches: (summary: string) => boolean;
  series: BlsSeriesMapping[];
};

type BlsReferencePeriod = {
  eventTime: string;
  referencePeriod: string;
};

const BLS_REQUEST_HEADERS = {
  Accept: "text/calendar, text/html, text/plain;q=0.9, */*;q=0.1",
  "User-Agent":
    "EdgeVault-Economic-Calendar/1.0 (+https://edgevault-six.vercel.app)",
};

const BLS_REPORT_MAPPINGS: BlsReportMapping[] = [
  {
    reportKey: "employment-situation",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
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
    reportKey: "consumer-price-index",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
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
    reportKey: "producer-price-index",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/ppi.htm",
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
      {
        seriesKey: "us-core-ppi-yoy",
        title: "Core PPI YoY",
        category: "Inflation",
      },
    ],
  },
  {
    reportKey: "import-export-price-indexes",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/ximpim.htm",
    matches: (summary) =>
      summary.includes("import and export price indexes") ||
      summary.includes("import/export price indexes"),
    series: [
      {
        seriesKey: "us-import-price-index-mom",
        title: "Import Price Index MoM",
        category: "Inflation",
      },
      {
        seriesKey: "us-import-price-index-yoy",
        title: "Import Price Index YoY",
        category: "Inflation",
      },
      {
        seriesKey: "us-export-price-index-mom",
        title: "Export Price Index MoM",
        category: "Inflation",
      },
      {
        seriesKey: "us-export-price-index-yoy",
        title: "Export Price Index YoY",
        category: "Inflation",
      },
    ],
  },
  {
    reportKey: "real-earnings",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/realer.htm",
    matches: (summary) => summary.includes("real earnings"),
    series: [
      {
        seriesKey: "us-real-average-hourly-earnings-mom",
        title: "Real Average Hourly Earnings MoM",
        category: "Labour",
      },
      {
        seriesKey: "us-real-average-hourly-earnings-yoy",
        title: "Real Average Hourly Earnings YoY",
        category: "Labour",
      },
    ],
  },
  {
    reportKey: "employer-costs-for-employee-compensation",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/ecec.htm",
    matches: (summary) =>
      summary.includes("employer costs for employee compensation"),
    series: [
      {
        seriesKey: "us-employer-compensation-cost-per-hour",
        title: "Employer Compensation Cost per Hour",
        category: "Labour",
      },
    ],
  },
  {
    reportKey: "job-openings-and-labor-turnover",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/jolts.htm",
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
    reportKey: "employment-cost-index",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/eci.htm",
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
    reportKey: "productivity-and-costs",
    scheduleUrl: "https://www.bls.gov/schedule/news_release/prod2.htm",
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

function findBlsReport(summary: string): BlsReportMapping | null {
  const normalized = summary.toLowerCase();
  return BLS_REPORT_MAPPINGS.find((mapping) => mapping.matches(normalized)) || null;
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseBlsReleaseDateTime(dateText: string, timeText: string): Date | null {
  const dateMatch = dateText.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),\s+(\d{4})$/);
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})\s*([AP])\.?M\.?$/i);
  if (!dateMatch || !timeMatch) return null;

  const month = MONTH_NUMBERS[dateMatch[1].toLowerCase()];
  if (!month) return null;

  let hour = Number(timeMatch[1]);
  if (hour === 12) hour = 0;
  if (timeMatch[3].toUpperCase() === "P") hour += 12;

  return zonedDateTimeToUtc(
    {
      year: Number(dateMatch[3]),
      month,
      day: Number(dateMatch[2]),
      hour,
      minute: Number(timeMatch[2]),
      second: 0,
    },
    "America/New_York"
  );
}

export function parseBlsReferencePeriodsHtml(
  html: string
): BlsReferencePeriod[] {
  const periods: BlsReferencePeriod[] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const cells = Array.from(
      rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
      (cellMatch) => decodeHtmlText(cellMatch[1])
    );
    if (cells.length < 3) continue;

    const referencePeriod = cells[0];
    const releaseDate = parseBlsReleaseDateTime(cells[1], cells[2]);
    if (!referencePeriod || !releaseDate) continue;

    periods.push({
      eventTime: releaseDate.toISOString(),
      referencePeriod,
    });
  }

  return periods;
}

function referencePeriodLookupKey(reportKey: string, eventTime: string): string {
  return `${reportKey}:${eventTime}`;
}

export function parseBlsCalendarIcs(
  icsText: string,
  referencePeriods: ReadonlyMap<string, string> = new Map()
): EconomicSourceEvent[] {
  const sourceEvents: EconomicSourceEvent[] = [];

  for (const event of parseIcsEvents(icsText)) {
    const uid = event.UID?.trim();
    const summary = event.SUMMARY?.trim();
    const startsAt = event.DTSTART
      ? parseIcsDateTime(event.DTSTART, event.DTSTART_TZID)
      : null;

    if (!uid || !summary || !startsAt) continue;

    const report = findBlsReport(summary);
    if (!report) continue;

    const sourceUrl = event.URL || BLS_CALENDAR_ICS_URL;
    const sourcePublishedAt = event.DTSTAMP
      ? parseIcsDateTime(event.DTSTAMP, event.DTSTAMP_TZID)?.toISOString() || null
      : null;

    const enrichedReferencePeriod =
      referencePeriods.get(
        referencePeriodLookupKey(report.reportKey, startsAt.toISOString())
      ) || extractReferencePeriod(summary);

    for (const mapping of report.series) {
      sourceEvents.push({
        externalId: `bls:${uid}:${mapping.seriesKey}`,
        seriesKey: mapping.seriesKey,
        title: mapping.title,
        country: "United States",
        currency: "USD",
        eventTime: startsAt.toISOString(),
        eventKind: "data",
        category: mapping.category,
        referencePeriod: enrichedReferencePeriod,
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
          calendar_report_key: report.reportKey,
          reference_period_schedule_url: report.scheduleUrl,
        },
      });
    }
  }

  return sourceEvents;
}

export async function fetchBlsCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const [calendarResponse, ...scheduleResults] = await Promise.all([
    fetch(BLS_CALENDAR_ICS_URL, {
      cache: "no-store",
      headers: BLS_REQUEST_HEADERS,
    }),
    ...BLS_REPORT_MAPPINGS.map(async (report) => {
      const response = await fetch(report.scheduleUrl, {
        cache: "no-store",
        headers: BLS_REQUEST_HEADERS,
      });
      if (!response.ok) return null;
      return {
        report,
        html: await response.text(),
      };
    }),
  ]);

  if (!calendarResponse.ok) {
    throw new Error(
      `BLS calendar request failed with HTTP ${calendarResponse.status}.`
    );
  }

  const referencePeriods = new Map<string, string>();
  for (const result of scheduleResults) {
    if (!result) continue;
    for (const period of parseBlsReferencePeriodsHtml(result.html)) {
      referencePeriods.set(
        referencePeriodLookupKey(result.report.reportKey, period.eventTime),
        period.referencePeriod
      );
    }
  }

  const icsText = await calendarResponse.text();
  const events = parseBlsCalendarIcs(icsText, referencePeriods);

  if (events.length === 0) {
    throw new Error("The BLS calendar returned no supported USD events.");
  }

  return events;
}
