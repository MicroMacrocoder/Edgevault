import type { EconomicSourceEvent } from "@/types/economic";

export const ECB_SOURCE_NAME = "European Central Bank";
export const ECB_MEETING_CALENDAR_URL =
  "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html";
export const ECB_MONETARY_POLICY_DECISIONS_URL =
  "https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html";
export const ECB_STATEMENTS_URL =
  "https://www.ecb.europa.eu/press/press_conference/monetary-policy-statement/html/index.en.html";
export const ECB_ACCOUNTS_URL =
  "https://www.ecb.europa.eu/press/accounts/html/index.en.html";
export const ECB_OTHER_DECISIONS_URL =
  "https://www.ecb.europa.eu/press/govcdec/otherdec/html/index.en.html";
export const ECB_WEEKLY_SCHEDULE_URL =
  "https://www.ecb.europa.eu/press/calendars/weekly/html/index.en.html";
export const ECB_PRESS_RSS_URL = "https://www.ecb.europa.eu/rss/press.html";
export const ECB_SPEECH_ARCHIVE_URL =
  "https://www.ecb.europa.eu/press/key/html/index.en.html";

type Publication = {
  date: string;
  title: string;
  url: string;
  kind: "decision" | "statement" | "release" | "account" | "other";
};

type RssItem = {
  date: string;
  title: string;
  url: string;
};

const ECB_BASE_URL = "https://www.ecb.europa.eu";
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
  ].map((month, index) => [month, index + 1]),
);

const SERIES = {
  decision: "eur-ecb-monetary-policy-decision",
  statement: "eur-ecb-monetary-policy-statement",
  pressConference: "eur-ecb-press-conference",
  release: "eur-ecb-monetary-policy-release",
  accounts: "eur-ecb-monetary-policy-accounts",
  other: "eur-ecb-other-governing-council-decision",
  speech: "eur-ecb-central-bank-speech",
} as const;

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—");
}

function text(value: unknown): string {
  if (typeof value !== "string") return "";
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function absoluteUrl(value: string): string {
  const url = new URL(decodeHtml(value), ECB_BASE_URL);
  url.search = "";
  return url.toString();
}

function dateFromCode(code: string): string | null {
  const match = code.match(/ecb\.[a-z]+(\d{2})(\d{2})(\d{2})~/i);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

function utcFromBrusselsTime(date: string, hour: number, minute: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desired);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Brussels",
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
        .map((part) => [part.type, Number(part.value)]),
    );
    const observed = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = desired - observed;
    if (correction === 0) break;
    candidate = new Date(candidate.getTime() + correction);
  }
  return candidate.toISOString();
}

function eventTime(date: string, hour: number, minute: number): string {
  return utcFromBrusselsTime(date, hour, minute);
}

function parsePublicationLinks(html: string, kind: Publication["kind"]): Publication[] {
  const publications: Publication[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1]);
    const url = absoluteUrl(href);
    const isEnglish = /\.(?:en\.(?:html|pdf))$/i.test(url);
    if (!isEnglish) continue;
    const date = dateFromCode(url);
    if (!date) continue;
    const title = text(match[2]);
    if (!title) continue;
    publications.push({ date, title, url, kind });
  }
  return publications;
}

async function fetchText(url: string, accept = "text/html"): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: accept, "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) throw new Error(`ECB source failed with HTTP ${response.status}: ${url}`);
  return response.text();
}

async function fetchYearIncludes(baseUrl: string, years: number[]): Promise<string[]> {
  return Promise.all(
    years.map(async (year) => {
      const url = new URL(baseUrl);
      const path = url.pathname.replace(/\/html\/index\.en\.html$/, `/${year}/html/index_include.en.html`);
      url.pathname = path;
      try {
        return await fetchText(url.toString());
      } catch (error) {
        if (year === new Date().getUTCFullYear()) throw error;
        return "";
      }
    }),
  );
}

function uniquePublications(publications: Publication[]): Publication[] {
  const byUrl = new Map<string, Publication>();
  for (const publication of publications) byUrl.set(publication.url, publication);
  return [...byUrl.values()];
}

function parseMeetingCalendar(html: string): Array<{ date: string; description: string }> {
  const meetings: Array<{ date: string; description: string }> = [];
  for (const match of html.matchAll(/<dt>\s*(\d{2})\/(\d{2})\/(\d{4})\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi)) {
    meetings.push({
      date: `${match[3]}-${match[2]}-${match[1]}`,
      description: text(match[4] ?? ""),
    });
  }
  return meetings;
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const body = match[1];
    const title = text(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    const rawUrl = body.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim();
    const rawDate = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    if (!title || !rawUrl || !rawDate) continue;
    const url = absoluteUrl(rawUrl.replace(/^https:\/\/www\.ecb\.europa\.eu\/\//, "/"));
    if (!/\/press\/key\/date\/\d{4}\/html\/ecb\.sp/i.test(url)) continue;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) continue;
    items.push({ date: date.toISOString(), title, url });
  }
  return items;
}

function parseReferencePeriod(title: string): string | null {
  const match = title.match(/Meeting of\s+(.+)/i);
  return match ? match[1].trim() : null;
}

function makeEvent(args: {
  externalId: string;
  seriesKey: string;
  title: string;
  eventKind: EconomicSourceEvent["eventKind"];
  eventTime: string;
  sourceUrl: string;
  referencePeriod?: string | null;
  released: boolean;
  rawPayload: Record<string, unknown>;
}): EconomicSourceEvent {
  return {
    externalId: args.externalId,
    seriesKey: args.seriesKey,
    title: args.title,
    country: "Euro Area",
    currency: "EUR",
    eventTime: args.eventTime,
    eventKind: args.eventKind,
    category: "Monetary Policy",
    referencePeriod: args.referencePeriod || null,
    sourceAgency: ECB_SOURCE_NAME,
    sourceUrl: args.sourceUrl,
    sourceEventId: args.externalId,
    sourcePublishedAt: args.released ? args.eventTime : null,
    unit: null,
    releaseStatus: args.released ? "released" : "scheduled",
    rawPayload: args.rawPayload,
  };
}

function policyEvents(publications: Publication[]): EconomicSourceEvent[] {
  const events: EconomicSourceEvent[] = [];
  for (const publication of publications) {
    const date = publication.date;
    if (publication.kind === "decision") {
      events.push(makeEvent({
        externalId: `ecb:decision:${date}`,
        seriesKey: SERIES.decision,
        title: "ECB Monetary Policy Decision",
        eventKind: "decision",
        eventTime: eventTime(date, 14, 15),
        sourceUrl: publication.url,
        referencePeriod: date,
        released: true,
        rawPayload: { publication_type: "monetary_policy_decision", official_url: publication.url },
      }));
    } else if (publication.kind === "statement") {
      events.push(makeEvent({
        externalId: `ecb:statement:${date}`,
        seriesKey: SERIES.statement,
        title: "ECB Monetary Policy Statement and Q&A",
        eventKind: "document",
        eventTime: eventTime(date, 15, 0),
        sourceUrl: publication.url,
        referencePeriod: date,
        released: true,
        rawPayload: { publication_type: "monetary_policy_statement_with_qa", official_url: publication.url },
      }));
      events.push(makeEvent({
        externalId: `ecb:press-conference:${date}`,
        seriesKey: SERIES.pressConference,
        title: "ECB Monetary Policy Press Conference",
        eventKind: "speech",
        eventTime: eventTime(date, 14, 45),
        sourceUrl: publication.url,
        referencePeriod: date,
        released: true,
        rawPayload: {
          publication_type: "press_conference",
          transcript_source: "monetary_policy_statement_with_qa",
          official_url: publication.url,
        },
      }));
    } else if (publication.kind === "release") {
      events.push(makeEvent({
        externalId: `ecb:release:${date}`,
        seriesKey: SERIES.release,
        title: "ECB Combined Monetary Policy Decisions and Statement",
        eventKind: "document",
        eventTime: eventTime(date, 14, 15),
        sourceUrl: publication.url,
        referencePeriod: date,
        released: true,
        rawPayload: { publication_type: "combined_monetary_policy_release", official_url: publication.url },
      }));
    } else if (publication.kind === "account") {
      events.push(makeEvent({
        externalId: `ecb:account:${date}`,
        seriesKey: SERIES.accounts,
        title: "ECB Monetary Policy Account",
        eventKind: "minutes",
        eventTime: eventTime(date, 8, 0),
        sourceUrl: publication.url,
        referencePeriod: parseReferencePeriod(publication.title) || date,
        released: true,
        rawPayload: { publication_type: "monetary_policy_account", official_url: publication.url, meeting_title: publication.title },
      }));
    } else if (publication.kind === "other") {
      events.push(makeEvent({
        externalId: `ecb:other-decision:${date}`,
        seriesKey: SERIES.other,
        title: "ECB Governing Council Other Decisions",
        eventKind: "decision",
        eventTime: eventTime(date, 8, 0),
        sourceUrl: publication.url,
        referencePeriod: date,
        released: true,
        rawPayload: { publication_type: "other_governing_council_decisions", official_url: publication.url, publication_title: publication.title },
      }));
    }
  }
  return events;
}

function scheduledPolicyEvents(calendar: Array<{ date: string; description: string }>): EconomicSourceEvent[] {
  const events: EconomicSourceEvent[] = [];
  for (const meeting of calendar) {
    if (!/monetary policy meeting/i.test(meeting.description) || !/day 2/i.test(meeting.description)) continue;
    if (new Date(`${meeting.date}T23:59:59Z`).getTime() <= Date.now()) continue;
    events.push(makeEvent({
      externalId: `ecb:decision:${meeting.date}`,
      seriesKey: SERIES.decision,
      title: "ECB Monetary Policy Decision",
      eventKind: "decision",
      eventTime: eventTime(meeting.date, 14, 15),
      sourceUrl: ECB_MEETING_CALENDAR_URL,
      referencePeriod: meeting.date,
      released: false,
      rawPayload: { publication_type: "monetary_policy_decision", schedule_url: ECB_MEETING_CALENDAR_URL, scheduled_description: meeting.description },
    }));
    events.push(makeEvent({
      externalId: `ecb:press-conference:${meeting.date}`,
      seriesKey: SERIES.pressConference,
      title: "ECB Monetary Policy Press Conference",
      eventKind: "speech",
      eventTime: eventTime(meeting.date, 14, 45),
      sourceUrl: ECB_MEETING_CALENDAR_URL,
      referencePeriod: meeting.date,
      released: false,
      rawPayload: { publication_type: "press_conference", schedule_url: ECB_MEETING_CALENDAR_URL, scheduled_description: meeting.description },
    }));
  }
  return events;
}

function speechEvents(items: RssItem[]): EconomicSourceEvent[] {
  return items.map((item) => {
    const date = item.date.slice(0, 10);
    const stableTitle = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
    return makeEvent({
      externalId: `ecb:speech:${date}:${stableTitle}`,
      seriesKey: SERIES.speech,
      title: item.title,
      eventKind: "speech",
      eventTime: item.date,
      sourceUrl: item.url,
      referencePeriod: date,
      released: true,
      rawPayload: { publication_type: "executive_board_speech", official_url: item.url, rss_url: ECB_PRESS_RSS_URL },
    });
  });
}

export async function fetchEcbCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 6 }, (_, index) => currentYear - 4 + index);
  const [decisionIncludes, statementIncludes, accountIncludes, otherIncludes, meetingHtml, rss] = await Promise.all([
    fetchYearIncludes(ECB_MONETARY_POLICY_DECISIONS_URL, years),
    fetchYearIncludes(ECB_STATEMENTS_URL, years),
    fetchYearIncludes(ECB_ACCOUNTS_URL, years),
    fetchYearIncludes(ECB_OTHER_DECISIONS_URL, years),
    fetchText(ECB_MEETING_CALENDAR_URL),
    fetchText(ECB_PRESS_RSS_URL, "application/rss+xml, text/xml"),
  ]);
  const publications = uniquePublications([
    ...decisionIncludes.flatMap((html) => parsePublicationLinks(html, "decision").filter((item) => /\/press\/pr\/date\/\d{4}\/html\/ecb\.mp/i.test(item.url))),
    ...statementIncludes.flatMap((html) => parsePublicationLinks(html, "statement").filter((item) => /\/press\/press_conference\/monetary-policy-statement\/\d{4}\/html\/ecb\.is/i.test(item.url))),
    ...statementIncludes.flatMap((html) => parsePublicationLinks(html, "release").filter((item) => /\/press\/press_conference\/monetary-policy-statement\/shared\/pdf\/ecb\.ds/i.test(item.url))),
    ...accountIncludes.flatMap((html) => parsePublicationLinks(html, "account").filter((item) => /\/press\/accounts\/\d{4}\/html\/ecb\.mg/i.test(item.url))),
    ...otherIncludes.flatMap((html) => parsePublicationLinks(html, "other").filter((item) => /\/press\/govcdec\/otherdec\/\d{4}\/html\/ecb\.gc/i.test(item.url))),
  ]);
  const published = policyEvents(publications);
  const scheduled = scheduledPolicyEvents(parseMeetingCalendar(meetingHtml));
  const speeches = speechEvents(parseRssItems(rss));
  const byExternalId = new Map<string, EconomicSourceEvent>();
  for (const event of [...scheduled, ...published, ...speeches]) byExternalId.set(event.externalId, event);
  return [...byExternalId.values()].filter((event) => {
    const timestamp = new Date(event.eventTime).getTime();
    return timestamp >= Date.now() - 6 * 365 * 86400000 && timestamp <= Date.now() + 18 * 30 * 86400000;
  });
}
