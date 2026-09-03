import type { EconomicSourceEvent } from "@/types/economic";

export const CONFERENCE_BOARD_CONSUMER_URL =
  "https://www.conference-board.org/topics/consumer-confidence/";
export const CONFERENCE_BOARD_LEI_URL =
  "https://www.conference-board.org/topics/us-leading-indicators/";
const CONFERENCE_BOARD_SOURCE_NAME = "The Conference Board";

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

function parseDate(value: string, fallbackYear: number): Date | null {
  const match = value.match(
    /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?/i
  );
  if (!match) return null;
  const month = MONTHS.findIndex(
    (name) => name.toLowerCase() === match[1].toLowerCase()
  );
  if (month < 0) return null;
  const year = Number(match[3] || fallbackYear);
  const day = Number(match[2]);
  const result = new Date(Date.UTC(year, month, day));
  return result.getUTCMonth() === month ? result : null;
}

function parseUpdatedDate(text: string, fallbackYear: number): Date | null {
  const match = text.match(/Updated:\s*\w+,\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/i);
  return match ? parseDate(match[1], fallbackYear) : null;
}

function parseNextRelease(text: string, fallbackYear: number): Date | null {
  const match = text.match(
    /next release is\s+(?:scheduled\s+for\s+)?(?:\w+,\s*)?([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?)[,\s]+at\s+\d{1,2}(?::\d{2})?\s*(?:A\.?\s*M\.?|P\.?\s*M\.?)\s*ET/i
  );
  return match ? parseDate(match[1], fallbackYear) : null;
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
    throw new Error(`Conference Board request failed with HTTP ${response.status}.`);
  }
  return response.text();
}

function event(
  seriesKey: string,
  title: string,
  sourceUrl: string,
  pageText: string,
  releaseDate: Date,
  status: "released" | "scheduled"
): EconomicSourceEvent {
  const year = releaseDate.getUTCFullYear();
  const month = releaseDate.getUTCMonth() + 1;
  const day = releaseDate.getUTCDate();
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const externalId = `conference-board:${seriesKey}:${date}`;
  const eventTime = easternTimeToUtc(year, month, day, 10, 0);

  return {
    externalId,
    seriesKey,
    title,
    country: "United States",
    currency: "USD",
    eventTime,
    eventKind: "data",
    category: "Confidence & Leading Indicators",
    referencePeriod: `${MONTHS[month - 1]} ${year}`,
    sourceAgency: CONFERENCE_BOARD_SOURCE_NAME,
    sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: status === "released" ? eventTime : null,
    releaseStatus: status,
    rawPayload: {
      report_url: sourceUrl,
      release_time: "10:00 AM America/New_York",
      values_not_synced: true,
      values_note:
        "This connector stores the official schedule and one-click official report page only; Conference Board values require authorized data access.",
      page_contains_next_release: /next release is/i.test(pageText),
    },
  };
}

async function buildSourceEvents(
  seriesKey: string,
  title: string,
  url: string
): Promise<EconomicSourceEvent[]> {
  const pageText = decodeHtml(await fetchText(url));
  const year = new Date().getUTCFullYear();
  const updated = parseUpdatedDate(pageText, year);
  const next = parseNextRelease(pageText, year);
  const events: EconomicSourceEvent[] = [];
  if (updated) {
    events.push(event(seriesKey, title, url, pageText, updated, "released"));
  }
  if (next) {
    const nextEvent = event(seriesKey, title, url, pageText, next, "scheduled");
    if (!events.some((item) => item.externalId === nextEvent.externalId)) {
      events.push(nextEvent);
    }
  }
  if (events.length === 0) {
    throw new Error(`Conference Board page did not expose dates for ${title}.`);
  }
  return events;
}

export async function fetchConferenceBoardCalendarEvents(): Promise<
  EconomicSourceEvent[]
> {
  const events = [
    ...(await buildSourceEvents(
      "us-conference-board-consumer-confidence",
      "Conference Board Consumer Confidence",
      CONFERENCE_BOARD_CONSUMER_URL
    )),
    ...(await buildSourceEvents(
      "us-conference-board-us-lei",
      "Conference Board U.S. Leading Economic Index",
      CONFERENCE_BOARD_LEI_URL
    )),
  ];
  return events.sort(
    (left, right) =>
      new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime()
  );
}
