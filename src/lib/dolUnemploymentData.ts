import type { EconomicSeriesObservationInput } from "@/lib/blsHistoricalData";
import type { EconomicSourceEvent } from "@/types/economic";

export const DOL_CLAIMS_PAGE_URL =
  "https://oui.doleta.gov/unemploy/claims.asp";
export const DOL_CLAIMS_ARCHIVE_URL =
  "https://oui.doleta.gov/unemploy/claims_arch.asp";
export const DOL_CLAIMS_REPORT_URL =
  "https://oui.doleta.gov/unemploy/wkclaims/report.asp";

const DOL_SOURCE_NAME =
  "U.S. Department of Labor, Employment and Training Administration";
const DOL_USER_AGENT =
  "EdgeVault-Economic-Calendar/1.0 (+https://edgevault-six.vercel.app)";

type ClaimsWeek = {
  weekEnded: Date;
  initialClaims: number;
  continuingClaims: number;
  initialClaims4Week: number | null;
  continuingClaims4Week: number | null;
  rawXml: string;
};

type ReleaseException = {
  normalReleaseDate: string;
  releaseDate: string;
};

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function tagValue(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1]
    ?.trim();
}

function parseWeekEnded(value: string | undefined): Date | null {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]))
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseClaimsWeeks(xml: string): ClaimsWeek[] {
  const weeks: ClaimsWeek[] = [];

  for (const match of xml.matchAll(/<week\b[^>]*>([\s\S]*?)<\/week>/gi)) {
    const weekXml = match[1];
    const weekEnded = parseWeekEnded(tagValue(weekXml, "weekEnded"));
    const initialClaims = parseNumber(
      tagValue(tagValue(weekXml, "InitialClaims") || "", "SA")
    );
    const continuingClaims = parseNumber(
      tagValue(tagValue(weekXml, "ContinuedClaims") || "", "SA")
    );
    if (!weekEnded || initialClaims == null || continuingClaims == null) {
      continue;
    }

    weeks.push({
      weekEnded,
      initialClaims,
      continuingClaims,
      initialClaims4Week: parseNumber(
        tagValue(tagValue(weekXml, "InitialClaims") || "", "SA4WK")
      ),
      continuingClaims4Week: parseNumber(
        tagValue(tagValue(weekXml, "ContinuedClaims") || "", "SA4WK")
      ),
      rawXml: weekXml,
    });
  }

  return weeks.sort(
    (left, right) => left.weekEnded.getTime() - right.weekEnded.getTime()
  );
}

function parseArchiveDate(value: string): Date | null {
  const match = value.match(
    /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/i
  );
  if (!match) return null;
  const date = new Date(`${match[1]} ${match[2]}, ${match[3]} UTC`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseReleaseExceptions(html: string): ReleaseException[] {
  const exceptions: ReleaseException[] = [];
  const table = html.match(
    /Publication Schedule:[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i
  )?.[1];
  if (!table) return exceptions;

  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [
      ...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
    ].map((cell) => decodeHtml(cell[1]));
    if (cells.length < 1) continue;
    const releaseDate = parseArchiveDate(cells[0]);
    if (!releaseDate) continue;
    const normalReleaseDate = new Date(releaseDate);
    const releaseDay = normalReleaseDate.getUTCDay();
    const dayOffset =
      releaseDay < 4 ? 4 - releaseDay : -(releaseDay - 4);
    normalReleaseDate.setUTCDate(normalReleaseDate.getUTCDate() + dayOffset);
    exceptions.push({
      normalReleaseDate: utcDateKey(normalReleaseDate),
      releaseDate: utcDateKey(releaseDate),
    });
  }

  return exceptions;
}

async function fetchText(
  url: string,
  init?: RequestInit
): Promise<string> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "text/plain, text/html, application/xml, text/xml, */*",
      "User-Agent": DOL_USER_AGENT,
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`DOL request failed with HTTP ${response.status}.`);
  }
  return response.text();
}

async function fetchClaimsWeeks(): Promise<ClaimsWeek[]> {
  const currentYear = new Date().getUTCFullYear();
  const form = new URLSearchParams({
    level: "us",
    final_yr: String(currentYear + 1),
    strtdate: String(currentYear - 5),
    enddate: String(currentYear),
    filetype: "xml",
    submit: "Submit",
  });
  const xml = await fetchText(DOL_CLAIMS_REPORT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const weeks = parseClaimsWeeks(xml);
  if (weeks.length === 0) {
    throw new Error("The DOL claims report returned no supported weekly observations.");
  }
  return weeks;
}

async function fetchReleaseExceptions(): Promise<Map<string, string>> {
  try {
    const exceptions = parseReleaseExceptions(
      await fetchText(DOL_CLAIMS_ARCHIVE_URL, { headers: { Accept: "text/html" } })
    );
    return new Map(
      exceptions.map((exception) => [
        exception.normalReleaseDate,
        exception.releaseDate,
      ])
    );
  } catch {
    return new Map();
  }
}

function releaseTimeForWeek(
  weekEnded: Date,
  releaseExceptions: Map<string, string>
): Date {
  const normalReleaseDate = new Date(weekEnded);
  normalReleaseDate.setUTCDate(normalReleaseDate.getUTCDate() + 5);
  const releaseDateKey =
    releaseExceptions.get(utcDateKey(normalReleaseDate)) ||
    utcDateKey(normalReleaseDate);
  const [year, month, day] = releaseDateKey.split("-").map(Number);
  return easternTimeToUtc(year, month, day, 8, 30);
}

function periodForWeek(weekEnded: Date) {
  const periodStart = new Date(weekEnded);
  periodStart.setUTCDate(periodStart.getUTCDate() - 6);
  return {
    referencePeriod: `Week ending ${weekEnded.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })}`,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: weekEnded.toISOString().slice(0, 10),
  };
}

function buildEvents(
  weeks: ClaimsWeek[],
  releaseExceptions: Map<string, string>
): EconomicSourceEvent[] {
  const now = new Date();
  const latestWeek = weeks[weeks.length - 1]?.weekEnded;
  if (!latestWeek) return [];

  const scheduledWeeks = [...weeks];
  for (let index = 1; index <= 12; index += 1) {
    const futureWeek = new Date(latestWeek);
    futureWeek.setUTCDate(futureWeek.getUTCDate() + index * 7);
    const releaseTime = releaseTimeForWeek(futureWeek, releaseExceptions);
    if (releaseTime.getTime() <= now.getTime() + 21 * 24 * 60 * 60 * 1000) {
      scheduledWeeks.push({
        weekEnded: futureWeek,
        initialClaims: 0,
        continuingClaims: 0,
        initialClaims4Week: null,
        continuingClaims4Week: null,
        rawXml: "",
      });
    }
  }

  const uniqueWeeks = new Map(
    scheduledWeeks.map((week) => [utcDateKey(week.weekEnded), week])
  );
  const events: EconomicSourceEvent[] = [];
  const definitions = [
    ["us-initial-jobless-claims", "Initial Jobless Claims"],
    ["us-continuing-jobless-claims", "Continuing Jobless Claims"],
  ] as const;

  for (const week of [...uniqueWeeks.values()]) {
    const period = periodForWeek(week.weekEnded);
    const eventTime = releaseTimeForWeek(week.weekEnded, releaseExceptions);
    for (const [seriesKey, title] of definitions) {
      const externalId = `dol:ui:${utcDateKey(week.weekEnded)}:${seriesKey}`;
      events.push({
        externalId,
        seriesKey,
        title,
        country: "United States",
        currency: "USD",
        eventTime: eventTime.toISOString(),
        eventKind: "data",
        category: "Labour",
        referencePeriod: period.referencePeriod,
        sourceAgency: DOL_SOURCE_NAME,
        sourceUrl: DOL_CLAIMS_PAGE_URL,
        sourceEventId: externalId,
        sourcePublishedAt: null,
        rawPayload: {
          source: DOL_SOURCE_NAME,
          claims_page_url: DOL_CLAIMS_PAGE_URL,
          archive_url: DOL_CLAIMS_ARCHIVE_URL,
          report_url: DOL_CLAIMS_REPORT_URL,
          week_ended: utcDateKey(week.weekEnded),
          release_time_et: "08:30",
          release_time: eventTime.toISOString(),
          release_schedule: "Thursday at 8:30 AM Eastern, with official holiday exceptions",
        },
      });
    }
  }

  return events.sort(
    (left, right) =>
      new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime()
  );
}

export async function fetchDolCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const [weeks, releaseExceptions] = await Promise.all([
    fetchClaimsWeeks(),
    fetchReleaseExceptions(),
  ]);
  const events = buildEvents(weeks, releaseExceptions);
  if (events.length === 0) {
    throw new Error("The DOL claims report returned no calendar events.");
  }
  return events;
}

export async function fetchDolHistoricalObservations(): Promise<{
  observations: EconomicSeriesObservationInput[];
  startYear: number;
  endYear: number;
}> {
  const weeks = await fetchClaimsWeeks();
  const currentYear = new Date().getUTCFullYear();
  const minimumYear = currentYear - 5;
  const observations: EconomicSeriesObservationInput[] = [];

  for (const week of weeks) {
    const year = week.weekEnded.getUTCFullYear();
    if (year < minimumYear || year > currentYear) continue;
    const period = periodForWeek(week.weekEnded);
    const rawPayload = {
      source: DOL_SOURCE_NAME,
      week_ended: utcDateKey(week.weekEnded),
      raw_xml: week.rawXml,
    };

    observations.push(
      {
        seriesKey: "us-initial-jobless-claims",
        referencePeriod: period.referencePeriod,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        periodFrequency: "weekly",
        value: week.initialClaims,
        rawValue: week.initialClaims,
        unit: "claims",
        measurement: "seasonally_adjusted_weekly_claims",
        sourceSeriesId: "UI:InitialClaims:SA",
        sourceName: DOL_SOURCE_NAME,
        sourceUrl: DOL_CLAIMS_REPORT_URL,
        sourcePayload: rawPayload,
        footnotes: [],
        isPreliminary: false,
        isRevised: false,
      },
      {
        seriesKey: "us-continuing-jobless-claims",
        referencePeriod: period.referencePeriod,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        periodFrequency: "weekly",
        value: week.continuingClaims,
        rawValue: week.continuingClaims,
        unit: "claims",
        measurement: "seasonally_adjusted_weekly_claims",
        sourceSeriesId: "UI:ContinuedClaims:SA",
        sourceName: DOL_SOURCE_NAME,
        sourceUrl: DOL_CLAIMS_REPORT_URL,
        sourcePayload: rawPayload,
        footnotes: [],
        isPreliminary: false,
        isRevised: false,
      }
    );
  }

  return {
    observations,
    startYear: minimumYear,
    endYear: currentYear,
  };
}
