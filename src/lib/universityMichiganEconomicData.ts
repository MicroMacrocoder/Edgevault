import type { EconomicSourceEvent } from "@/types/economic";

export const UMICH_SURVEY_INFO_URL =
  "https://data.sca.isr.umich.edu/survey-info.php";
export const UMICH_REPORTS_URL = "https://data.sca.isr.umich.edu/reports.php";
const UMICH_SOURCE_NAME = "University of Michigan Surveys of Consumers";
const UMICH_BASE_URL = "https://data.sca.isr.umich.edu";

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

type ReleaseDate = { month: number; preliminary: number; final: number };

// These dates are published in the official University of Michigan release-date
// documents. The map intentionally fails closed for an unconfigured year rather
// than inventing release dates.
const OFFICIAL_RELEASE_DATES: Record<number, ReleaseDate[]> = {
  2026: [
    { month: 1, preliminary: 9, final: 23 },
    { month: 2, preliminary: 6, final: 20 },
    { month: 3, preliminary: 13, final: 27 },
    { month: 4, preliminary: 10, final: 24 },
    { month: 5, preliminary: 8, final: 22 },
    { month: 6, preliminary: 12, final: 26 },
    { month: 7, preliminary: 17, final: 31 },
    { month: 8, preliminary: 14, final: 28 },
    { month: 9, preliminary: 11, final: 25 },
    { month: 10, preliminary: 9, final: 23 },
    { month: 11, preliminary: 6, final: 20 },
    { month: 12, preliminary: 4, final: 18 },
  ],
  2027: [
    { month: 1, preliminary: 8, final: 22 },
    { month: 2, preliminary: 12, final: 26 },
    { month: 3, preliminary: 12, final: 25 },
    { month: 4, preliminary: 9, final: 23 },
    { month: 5, preliminary: 7, final: 21 },
    { month: 6, preliminary: 11, final: 25 },
    { month: 7, preliminary: 16, final: 30 },
    { month: 8, preliminary: 13, final: 27 },
    { month: 9, preliminary: 10, final: 24 },
    { month: 10, preliminary: 8, final: 22 },
    { month: 11, preliminary: 5, final: 19 },
    { month: 12, preliminary: 3, final: 17 },
  ],
};

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

function absoluteUrl(path: string): string {
  return new URL(path, UMICH_BASE_URL).toString();
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

type ReportLinks = Map<string, string>;

function parseReportLinks(html: string): ReportLinks {
  const links: ReportLinks = new Map();
  const monthPattern =
    "January|February|March|April|May|June|July|August|September|October|November|December";
  const blockPattern = new RegExp(
    `(${monthPattern})\\s+(\\d{4})([\\s\\S]*?)(?=(?:${monthPattern})\\s+\\d{4}|Copyright|$)`,
    "gi"
  );

  for (const match of html.matchAll(blockPattern)) {
    const month = MONTHS.findIndex(
      (name) => name.toLowerCase() === match[1].toLowerCase()
    );
    const year = Number(match[2]);
    if (month < 0 || !Number.isInteger(year)) continue;

    const block = match[3];
    const anchorPattern =
      /<a[^>]+href=["']([^"']*fetchdoc\.php\?docid=\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const anchor of block.matchAll(anchorPattern)) {
      const title = decodeHtml(anchor[2]);
      const stage = /preliminary results/i.test(title)
        ? "preliminary"
        : /final results/i.test(title)
          ? "final"
          : null;
      if (!stage) continue;
      links.set(
        `${year}-${String(month + 1).padStart(2, "0")}:${stage}`,
        absoluteUrl(anchor[1])
      );
    }
  }

  return links;
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
    throw new Error(`University of Michigan request failed with HTTP ${response.status}.`);
  }
  return response.text();
}

function buildEvent(
  year: number,
  release: ReleaseDate,
  stage: "preliminary" | "final",
  reportUrl: string | null
): EconomicSourceEvent {
  const month = String(release.month).padStart(2, "0");
  const day = stage === "preliminary" ? release.preliminary : release.final;
  const date = `${year}-${month}-${String(day).padStart(2, "0")}`;
  const title =
    stage === "preliminary"
      ? "Michigan Consumer Sentiment Preliminary"
      : "Michigan Consumer Sentiment Final";
  const externalId = `umich:consumer-sentiment:${date}:${stage}`;
  const eventTime = easternTimeToUtc(year, release.month, day, 10, 0);
  const released = new Date(eventTime).getTime() <= Date.now();
  const sourceUrl = reportUrl || (released ? UMICH_REPORTS_URL : UMICH_SURVEY_INFO_URL);

  return {
    externalId,
    seriesKey:
      stage === "preliminary"
        ? "us-umich-consumer-sentiment-preliminary"
        : "us-umich-consumer-sentiment-final",
    title,
    country: "United States",
    currency: "USD",
    eventTime,
    eventKind: "data",
    category: "Consumer Confidence",
    referencePeriod: `${MONTHS[release.month - 1]} ${year}`,
    sourceAgency: UMICH_SOURCE_NAME,
    sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: released ? eventTime : null,
    releaseStatus: released ? "released" : "scheduled",
    rawPayload: {
      release_schedule_url: UMICH_SURVEY_INFO_URL,
      reports_url: UMICH_REPORTS_URL,
      report_url: reportUrl,
      report_url_available: Boolean(reportUrl),
      report_url_note: reportUrl
        ? "Official University of Michigan report PDF."
        : released
          ? "The official report was not found in the published reports index; the current official reports page is used."
          : "The official report link becomes available when the report is published.",
      release_time: "10:00 AM America/New_York",
      values_not_synced: true,
      values_note:
        "This connector stores the official release schedule and report link only; no licensed survey values are copied into EdgeVault.",
    },
  };
}

export async function fetchUniversityMichiganCalendarEvents(): Promise<
  EconomicSourceEvent[]
> {
  const year = new Date().getUTCFullYear();
  const releaseDates = OFFICIAL_RELEASE_DATES[year];
  if (!releaseDates) {
    throw new Error(
      `The official University of Michigan release-date map is not configured for ${year}.`
    );
  }

  const reportLinks = parseReportLinks(await fetchText(UMICH_REPORTS_URL));
  const events = releaseDates.flatMap((release) =>
    (["preliminary", "final"] as const).map((stage) => {
      const key = `${year}-${String(release.month).padStart(2, "0")}:${stage}`;
      return buildEvent(year, release, stage, reportLinks.get(key) || null);
    })
  );

  if (events.length === 0) {
    throw new Error("The University of Michigan release schedule returned no events.");
  }
  return events;
}
