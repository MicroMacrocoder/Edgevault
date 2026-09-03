import type { EconomicSourceEvent } from "@/types/economic";

export const NAR_RELEASE_SCHEDULE_URL =
  "https://www.nar.realtor/press-releases/nar-statistical-news-release-schedule";
export const NAR_EXISTING_HOME_SALES_URL =
  "https://www.nar.realtor/research-and-statistics/housing-statistics/existing-home-sales";
export const NAR_PENDING_HOME_SALES_URL =
  "https://www.nar.realtor/research-and-statistics/housing-statistics/pending-home-sales";
const NAR_SOURCE_NAME = "National Association of REALTORS";

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

type NarKind = "existing" | "pending";

function decodeHtml(value: string): string {
  return value
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
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

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) throw new Error(`NAR request failed with HTTP ${response.status}.`);
  return response.text();
}

function absoluteUrl(value: string): string {
  return new URL(value, "https://www.nar.realtor").toString();
}

function pageReleaseDate(html: string): Date | null {
  const published = html.match(
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i
  );
  if (!published) return null;
  const date = new Date(published[1]);
  return Number.isFinite(date.getTime()) ? date : null;
}

function currentReportLink(html: string, kind: NarKind): string {
  const pattern =
    kind === "existing"
      ? /href=["']([^"']*\/newsroom\/nar-existing-home-sales[^"']*)["']/i
      : /href=["']([^"']*\/newsroom\/NAR-Pending-Home-Sales[^"']*)["']/i;
  const match = html.match(pattern);
  return match ? absoluteUrl(match[1]) : kind === "existing" ? NAR_EXISTING_HOME_SALES_URL : NAR_PENDING_HOME_SALES_URL;
}

function reportPeriod(html: string, kind: NarKind): { month: number; year: number } | null {
  const text = decodeHtml(html);
  const pattern =
    kind === "existing"
      ? /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})[^.!?]{0,140}(?:existing-home\s+sales|sales)/i
      : /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})[^.!?]{0,160}(?:pending-home\s+sales|index)/i;
  const match = text.match(pattern);
  if (!match) return null;
  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[1].toLowerCase());
  const year = Number(match[2]);
  return month >= 0 && Number.isFinite(year) ? { month, year } : null;
}

function parseCurrentValue(html: string, kind: NarKind): {
  actual: number;
  previous: number | null;
  changePercent: number | null;
} | null {
  const text = decodeHtml(html);
  if (kind === "existing") {
    const actualMatch = text.match(
      /existing-home\s+sales\s+to\s+a\s+seasonally\s+adjusted\s+annual\s+rate\s+of\s+(\d+(?:\.\d+)?)\s+million/i
    );
    const changeMatch = text.match(
      /month-over-month\s+(\d+(?:\.\d+)?)%\s+(decrease|decreases|decline|declined|increase|increases|rise|rose)/i
    );
    if (!actualMatch || !changeMatch) return null;
    const direction = /(?:decrease|decline)/i.test(changeMatch[2]) ? -1 : 1;
    const changePercent = direction * Number(changeMatch[1]);
    const actual = Number(actualMatch[1]);
    return {
      actual,
      previous: actual / (1 + changePercent / 100),
      changePercent,
    };
  }

  const match = text.match(
    /(?:decreased|declined|fell|down|increased|rose|up|grew)\s+(?:by\s+)?(\d+(?:\.\d+)?)%[^.]{0,120}?to\s+(\d+(?:\.\d+)?)/i
  );
  if (!match) return null;
  const direction = /(?:decreased|declined|fell)/i.test(match[0]) ? -1 : 1;
  const changePercent = direction * Number(match[1]);
  const actual = Number(match[2]);
  return {
    actual,
    previous: actual / (1 + changePercent / 100),
    changePercent,
  };
}

function scheduleEvents(text: string, year: number): Array<{ kind: NarKind; releaseDate: Date }> {
  const events: Array<{ kind: NarKind; releaseDate: Date }> = [];
  const monthPattern = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const pattern = new RegExp(
    `(?:Mon|Tue|Wed|Thu|Fri)\\.?[, ]+(${monthPattern})\\.?\\s+(\\d{1,2})\\s+(?:${year}\\s+)?(Existing-Home Sales|Pending Home Sales Index)`,
    "gi"
  );
  const monthMap = new Map([
    ["jan", 0], ["feb", 1], ["mar", 2], ["apr", 3], ["may", 4], ["jun", 5],
    ["jul", 6], ["aug", 7], ["sep", 8], ["oct", 9], ["nov", 10], ["dec", 11],
  ]);
  for (const match of text.matchAll(pattern)) {
    const month = monthMap.get(match[1].slice(0, 3).toLowerCase());
    if (month === undefined) continue;
    const releaseDate = new Date(Date.UTC(year, month, Number(match[2])));
    events.push({
      kind: /Pending/i.test(match[3]) ? "pending" : "existing",
      releaseDate,
    });
  }
  return events;
}

function priorMonth(date: Date): { month: number; year: number } {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return { month: value.getUTCMonth(), year: value.getUTCFullYear() };
}

function buildEvent(
  kind: NarKind,
  period: { month: number; year: number },
  releaseDate: Date,
  status: "released" | "scheduled",
  sourceUrl: string,
  actual: number | null,
  previous: number | null,
  rawPayload: Record<string, unknown>
): EconomicSourceEvent {
  const isExisting = kind === "existing";
  const externalId = `nar:${kind}:${period.year}-${String(period.month + 1).padStart(2, "0")}`;
  return {
    externalId,
    seriesKey: isExisting ? "us-nar-existing-home-sales" : "us-nar-pending-home-sales",
    title: isExisting ? "Existing Home Sales" : "Pending Home Sales",
    country: "United States",
    currency: "USD",
    eventTime: easternTimeToUtc(
      releaseDate.getUTCFullYear(),
      releaseDate.getUTCMonth() + 1,
      releaseDate.getUTCDate(),
      10,
      0
    ),
    eventKind: "data",
    category: "Housing",
    referencePeriod: `${MONTHS[period.month]} ${period.year}`,
    sourceAgency: NAR_SOURCE_NAME,
    sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: status === "released" ? releaseDate.toISOString() : null,
    previous,
    actual,
    unit: isExisting ? "Million units" : "Index",
    releaseStatus: status,
    rawPayload,
  };
}

export async function fetchNarCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const year = new Date().getUTCFullYear();
  const [scheduleHtml, existingHtml, pendingHtml] = await Promise.all([
    fetchText(NAR_RELEASE_SCHEDULE_URL),
    fetchText(NAR_EXISTING_HOME_SALES_URL),
    fetchText(NAR_PENDING_HOME_SALES_URL),
  ]);
  const pages: Array<{ kind: NarKind; html: string; pageUrl: string }> = [
    { kind: "existing", html: existingHtml, pageUrl: NAR_EXISTING_HOME_SALES_URL },
    { kind: "pending", html: pendingHtml, pageUrl: NAR_PENDING_HOME_SALES_URL },
  ];
  const events: EconomicSourceEvent[] = [];
  const now = Date.now();

  for (const page of pages) {
    const reportUrl = currentReportLink(page.html, page.kind);
    const reportHtml = reportUrl === page.pageUrl ? page.html : await fetchText(reportUrl);
    const period = reportPeriod(reportHtml, page.kind) || reportPeriod(page.html, page.kind);
    const values = parseCurrentValue(reportHtml, page.kind) || parseCurrentValue(page.html, page.kind);
    const published = pageReleaseDate(reportHtml) || pageReleaseDate(page.html);
    if (period && values && published) {
      events.push(
        buildEvent(
          page.kind,
          period,
          published,
          "released",
          reportUrl,
          values.actual,
          values.previous,
          {
            indicator_page_url: page.pageUrl,
            release_schedule_url: NAR_RELEASE_SCHEDULE_URL,
            official_change_percent: values.changePercent,
            previous_derived_from_official_change: values.previous !== null,
          }
        )
      );
    }
  }

  for (const scheduled of scheduleEvents(decodeHtml(scheduleHtml), year)) {
    if (scheduled.releaseDate.getTime() <= now) continue;
    const period = priorMonth(scheduled.releaseDate);
    const page = pages.find((item) => item.kind === scheduled.kind)!;
    const latest = events.find((item) => item.seriesKey === (scheduled.kind === "existing" ? "us-nar-existing-home-sales" : "us-nar-pending-home-sales"));
    events.push(
      buildEvent(
        scheduled.kind,
        period,
        scheduled.releaseDate,
        "scheduled",
        page.pageUrl,
        null,
        latest?.actual ?? null,
        {
          indicator_page_url: page.pageUrl,
          release_schedule_url: NAR_RELEASE_SCHEDULE_URL,
          values_available_after_release: true,
          report_link_note:
            "The official newsroom link is refreshed after release by the economic worker.",
        }
      )
    );
  }

  return events.sort(
    (left, right) =>
      new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime()
  );
}
