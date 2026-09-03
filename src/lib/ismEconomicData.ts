import type { EconomicSourceEvent } from "@/types/economic";

export const ISM_RELEASE_CALENDAR_URL =
  "https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/";
const ISM_SOURCE_NAME = "Institute for Supply Management";
const ISM_BASE_URL = "https://www.ismworld.org";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function easternTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desired);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(candidate)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    const observed = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const correction = desired - observed;
    if (correction === 0) break;
    candidate = new Date(candidate.getTime() + correction);
  }

  return candidate.toISOString();
}

function businessDayOfMonth(year: number, month: number, occurrence: number): number {
  let count = 0;
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1) break;
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      count += 1;
      if (count === occurrence) return day;
    }
  }
  throw new Error(`Could not calculate ISM business-day release for ${year}-${month}.`);
}

function reportUrl(
  kind: "manufacturing" | "services",
  releaseYear: number,
  releaseMonth: number
): string {
  // ISM releases the prior month's survey on the first/third business day.
  const reportMonth = releaseMonth === 1 ? 12 : releaseMonth - 1;
  return `${ISM_BASE_URL}/supply-management-news-and-reports/reports/ism-pmi-reports/${kind === "manufacturing" ? "pmi" : "services"}/${MONTHS[reportMonth - 1].toLowerCase()}/`;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`ISM request failed with HTTP ${response.status}.`);
  }
  return response.text();
}

function parseSchedule(html: string, year: number): Map<number, { manufacturing: number; services: number }> {
  const text = decodeHtml(html);
  const schedule = new Map<number, { manufacturing: number; services: number }>();
  const pattern = new RegExp(
    `(January|February|March|April|May|June|July|August|September|October|November|December)\\s+${year}\\s+(\\d{1,2})\\s+(\\d{1,2})`,
    "gi"
  );
  for (const match of text.matchAll(pattern)) {
    const month = MONTHS.findIndex(
      (name) => name.toLowerCase() === match[1].toLowerCase()
    );
    if (month < 0) continue;
    schedule.set(month + 1, {
      manufacturing: Number(match[2]),
      services: Number(match[3]),
    });
  }
  return schedule;
}

function buildEvent(
  year: number,
  month: number,
  day: number,
  kind: "manufacturing" | "services"
): EconomicSourceEvent {
  const label = kind === "manufacturing" ? "Manufacturing" : "Services";
  const externalId = `ism:${kind}:${year}-${String(month).padStart(2, "0")}`;
  const eventTime = easternTimeToUtc(year, month, day, 10, 0);
  const released = new Date(eventTime).getTime() <= Date.now();
  const reportMonth = month === 1 ? 12 : month - 1;
  const reportYear = month === 1 ? year - 1 : year;
  const directReportUrl = reportUrl(kind, year, month);

  return {
    externalId,
    seriesKey:
      kind === "manufacturing" ? "us-ism-manufacturing-pmi" : "us-ism-services-pmi",
    title: `ISM ${label} PMI`,
    country: "United States",
    currency: "USD",
    eventTime,
    eventKind: "data",
    category: "Business Survey",
    referencePeriod: `${MONTHS[reportMonth - 1]} ${reportYear}`,
    sourceAgency: ISM_SOURCE_NAME,
    sourceUrl: released ? directReportUrl : ISM_RELEASE_CALENDAR_URL,
    sourceEventId: externalId,
    sourcePublishedAt: released ? eventTime : null,
    releaseStatus: released ? "released" : "scheduled",
    rawPayload: {
      release_schedule_url: ISM_RELEASE_CALENDAR_URL,
      report_url: directReportUrl,
      report_url_available: released,
      report_url_note: released
        ? "Official ISM report page."
        : "The official report page is linked automatically after its scheduled release.",
      release_time: "10:00 AM America/New_York",
      report_period: `${MONTHS[reportMonth - 1]} ${reportYear}`,
      release_period: `${MONTHS[month - 1]} ${year}`,
      values_not_synced: true,
      values_note:
        "This connector stores the official release schedule and report link only; ISM values require authorized data access.",
    },
  };
}

export async function fetchIsmCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const year = new Date().getUTCFullYear();
  const schedule = parseSchedule(await fetchText(ISM_RELEASE_CALENDAR_URL), year);
  const events: EconomicSourceEvent[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const dates = schedule.get(month) || {
      manufacturing: businessDayOfMonth(year, month, 1),
      services: businessDayOfMonth(year, month, 3),
    };
    events.push(
      buildEvent(year, month, dates.manufacturing, "manufacturing"),
      buildEvent(year, month, dates.services, "services")
    );
  }

  if (events.length === 0) {
    throw new Error("The ISM release schedule returned no events.");
  }
  return events;
}
