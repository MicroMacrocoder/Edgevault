import type { EconomicSourceEvent } from "@/types/economic";

export const FED_FOMC_CALENDAR_URL =
  "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";

const FED_SOURCE_NAME = "Board of Governors of the Federal Reserve System";
const FED_BASE_URL = "https://www.federalreserve.gov";

type FomcMeeting = {
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  projection: boolean;
  statementUrl: string | null;
  pressConferenceUrl: string | null;
  minutesUrl: string | null;
  projectionsUrl: string | null;
  minutesReleaseDate: { year: number; month: number; day: number } | null;
  rawDate: string;
};

const MONTHS = new Map(
  [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].map((name, index) => [name, index + 1])
);

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(path: string | null): string | null {
  return path ? new URL(path, FED_BASE_URL).toString() : null;
}

function easternTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
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
  return candidate;
}

function dateFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
  return easternTimeToUtc(year, month, day, hour, minute).toISOString();
}

function parseMeetingDate(
  monthText: string,
  dateText: string,
  year: number
): Pick<FomcMeeting, "month" | "startDay" | "endDay" | "projection" | "rawDate"> | null {
  const month = MONTHS.get(monthText.toLowerCase());
  const match = dateText.trim().match(/(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*(\*)?/);
  if (!month || !match) return null;
  const startDay = Number(match[1]);
  const endDay = Number(match[2] || match[1]);
  return {
    month,
    startDay,
    endDay,
    projection: Boolean(match[3]),
    rawDate: dateText.trim(),
  };
}

function parseFomcMeetings(html: string): FomcMeeting[] {
  const meetings: FomcMeeting[] = [];
  const panelPattern =
    /<div class="panel panel-default">[\s\S]*?<h4><a[^>]*>(\d{4}) FOMC Meetings<\/a><\/h4>[\s\S]*?<\/div>([\s\S]*?)(?=<div class="panel panel-default">|$)/gi;

  for (const panelMatch of html.matchAll(panelPattern)) {
    const year = Number(panelMatch[1]);
    const panelHtml = panelMatch[2];
    const rowStarts = [
      ...panelHtml.matchAll(
        /<div class="(?:fomc-meeting--shaded )?row fomc-meeting"[^>]*>/gi
      ),
    ];

    for (let index = 0; index < rowStarts.length; index += 1) {
      const start = rowStarts[index].index ?? 0;
      const end = rowStarts[index + 1]?.index ?? panelHtml.length;
      const rowHtml = panelHtml.slice(start, end);
      const monthHtml = rowHtml.match(
        /fomc-meeting__month[^>]*>([\s\S]*?)<\/div>/i
      )?.[1];
      const dateHtml = rowHtml.match(
        /fomc-meeting__date[^>]*>([\s\S]*?)<\/div>/i
      )?.[1];
      if (!monthHtml || !dateHtml) continue;

      const parsedDate = parseMeetingDate(
        decodeHtml(monthHtml),
        decodeHtml(dateHtml),
        year
      );
      if (!parsedDate) continue;

      const statementPath = rowHtml.match(
        /href="([^"]*\/newsevents\/pressreleases\/monetary\d{8}a\.htm)"/i
      )?.[1] || null;
      const pressConferencePath = rowHtml.match(
        /href="([^"]*\/monetarypolicy\/fomc(?:pressconf|presconf)\d{8}\.htm)"/i
      )?.[1] || null;
      const minutesPath = rowHtml.match(
        /href="([^"]*\/monetarypolicy\/fomcminutes\d{8}\.htm)"/i
      )?.[1] || null;
      const projectionsPath = rowHtml.match(
        /href="([^"]*\/monetarypolicy\/files\/fomcprojtabl\d{8}\.htm)"/i
      )?.[1] || null;
      const minutesRelease = rowHtml.match(
        /Released\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i
      );
      const minutesReleaseDate = minutesRelease
        ? {
            month: MONTHS.get(minutesRelease[1].toLowerCase()) || 0,
            day: Number(minutesRelease[2]),
            year: Number(minutesRelease[3]),
          }
        : null;

      meetings.push({
        year,
        ...parsedDate,
        statementUrl: absoluteUrl(statementPath),
        pressConferenceUrl: absoluteUrl(pressConferencePath),
        minutesUrl: absoluteUrl(minutesPath),
        projectionsUrl: absoluteUrl(projectionsPath),
        minutesReleaseDate:
          minutesReleaseDate && minutesReleaseDate.month > 0
            ? minutesReleaseDate
            : null,
      });
    }
  }

  return meetings;
}

function statementDate(meeting: FomcMeeting): { year: number; month: number; day: number } {
  const match = meeting.statementUrl?.match(/monetary(\d{4})(\d{2})(\d{2})a\.htm/i);
  return match
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : { year: meeting.year, month: meeting.month, day: meeting.endDay };
}

function event(
  meeting: FomcMeeting,
  seriesKey: string,
  title: string,
  eventKind: "decision" | "document" | "speech" | "minutes",
  eventTime: string,
  sourceUrl: string,
  extra: Record<string, unknown> = {}
): EconomicSourceEvent {
  const externalId = `fed:fomc:${meeting.year}-${String(meeting.month).padStart(2, "0")}-${String(meeting.endDay).padStart(2, "0")}:${seriesKey}`;
  return {
    externalId,
    seriesKey,
    title,
    country: "United States",
    currency: "USD",
    eventTime,
    eventKind,
    category: "Monetary Policy",
    referencePeriod: `FOMC ${meeting.year}-${String(meeting.month).padStart(2, "0")}`,
    sourceAgency: FED_SOURCE_NAME,
    sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: null,
    rawPayload: {
      calendar_url: FED_FOMC_CALENDAR_URL,
      meeting_date: meeting.rawDate,
      projection_meeting: meeting.projection,
      ...extra,
    },
  };
}

export async function fetchFederalReserveCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const response = await fetch(FED_FOMC_CALENDAR_URL, {
    cache: "no-store",
    headers: {
      Accept: "text/html",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Federal Reserve FOMC calendar failed with HTTP ${response.status}.`);
  }

  const meetings = parseFomcMeetings(await response.text());
  const events: EconomicSourceEvent[] = [];

  for (const meeting of meetings) {
    const decisionDate = statementDate(meeting);
    const decisionTime = dateFromParts(
      decisionDate.year,
      decisionDate.month,
      decisionDate.day,
      14,
      0
    );
    const statementUrl = meeting.statementUrl || FED_FOMC_CALENDAR_URL;
    events.push(
      event(
        meeting,
        "us-fomc-rate-decision",
        "FOMC Interest Rate Decision",
        "decision",
        decisionTime,
        statementUrl,
        { statement_url: meeting.statementUrl }
      ),
      event(
        meeting,
        "us-fomc-statement",
        "FOMC Statement",
        "document",
        decisionTime,
        statementUrl,
        { statement_url: meeting.statementUrl }
      ),
      event(
        meeting,
        "us-fomc-press-conference",
        "FOMC Press Conference",
        "speech",
        dateFromParts(
          decisionDate.year,
          decisionDate.month,
          decisionDate.day,
          14,
          30
        ),
        meeting.pressConferenceUrl || FED_FOMC_CALENDAR_URL,
        { press_conference_url: meeting.pressConferenceUrl }
      )
    );

    if (meeting.projection || meeting.projectionsUrl) {
      events.push(
        event(
          meeting,
          "us-fomc-projections",
          "FOMC Economic Projections",
          "document",
          decisionTime,
          meeting.projectionsUrl || FED_FOMC_CALENDAR_URL,
          { projections_url: meeting.projectionsUrl }
        )
      );
    }

    const minutesDate = meeting.minutesReleaseDate || {
      ...decisionDate,
      day: decisionDate.day + 21,
    };
    events.push(
      event(
        meeting,
        "us-fomc-minutes",
        "FOMC Meeting Minutes",
        "minutes",
        dateFromParts(
          minutesDate.year,
          minutesDate.month,
          minutesDate.day,
          14,
          0
        ),
        meeting.minutesUrl || FED_FOMC_CALENDAR_URL,
        {
          minutes_url: meeting.minutesUrl,
          minutes_release_date: meeting.minutesReleaseDate
            ? `${minutesDate.year}-${String(minutesDate.month).padStart(2, "0")}-${String(minutesDate.day).padStart(2, "0")}`
            : null,
          estimated_release_date: !meeting.minutesReleaseDate,
        }
      )
    );
  }

  if (events.length === 0) {
    throw new Error("The Federal Reserve calendar returned no FOMC meetings.");
  }
  return events;
}
