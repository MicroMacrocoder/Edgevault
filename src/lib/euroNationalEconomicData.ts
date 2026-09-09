import type { EconomicSourceEvent } from "@/types/economic";

export const EURO_NATIONAL_SOURCE_NAME = "Euro-area National Statistical Offices";

const REQUEST_TIMEOUT_MS = 15_000;
const CURRENT_YEAR = new Date().getUTCFullYear();

type NationalOffice = {
  countryCode: string;
  country: string;
  office: string;
  calendarUrl: string;
  officialUrl: string;
};

export const EURO_NATIONAL_OFFICES: NationalOffice[] = [
  {
    countryCode: "AT",
    country: "Austria",
    office: "Statistics Austria",
    calendarUrl: "https://www.statistik.at/en/",
    officialUrl: "https://www.statistik.at/en/",
  },
  {
    countryCode: "BE",
    country: "Belgium",
    office: "Statbel",
    calendarUrl: "https://statbel.fgov.be/en/",
    officialUrl: "https://statbel.fgov.be/en/",
  },
  {
    countryCode: "BG",
    country: "Bulgaria",
    office: "National Statistical Institute of Bulgaria",
    calendarUrl: "https://www.nsi.bg/en/calendar",
    officialUrl: "https://www.nsi.bg/en/",
  },
  {
    countryCode: "EE",
    country: "Estonia",
    office: "Statistics Estonia",
    calendarUrl: "https://stat.ee/en/calendar",
    officialUrl: "https://stat.ee/en/",
  },
  {
    countryCode: "FI",
    country: "Finland",
    office: "Statistics Finland",
    calendarUrl: "https://stat.fi/en/future-releases",
    officialUrl: "https://stat.fi/en/",
  },
  {
    countryCode: "IE",
    country: "Ireland",
    office: "Central Statistics Office (CSO)",
    calendarUrl: "https://www.cso.ie/en/csolatestnews/releasecalendar/",
    officialUrl: "https://www.cso.ie/en/",
  },
  {
    countryCode: "MT",
    country: "Malta",
    office: "National Statistics Office of Malta",
    calendarUrl: "https://nso.gov.mt/calendars/",
    officialUrl: "https://nso.gov.mt/",
  },
  {
    countryCode: "SI",
    country: "Slovenia",
    office: "Statistical Office of the Republic of Slovenia",
    calendarUrl: "https://www.stat.si/StatWeb/en/releasecal",
    officialUrl: "https://www.stat.si/StatWeb/en/",
  },
];

const ECONOMIC_TERMS = [
  "gdp",
  "gross domestic",
  "inflation",
  "consumer price",
  "harmonised index",
  "harmonized index",
  "hicp",
  "cpi",
  "unemployment",
  "employment",
  "labour",
  "labor",
  "wage",
  "earnings",
  "industrial production",
  "production index",
  "retail",
  "trade",
  "exports",
  "imports",
  "current account",
  "balance of payments",
  "construction",
  "building",
  "house price",
  "services",
  "turnover",
  "business",
  "consumer confidence",
  "government finance",
  "deficit",
  "debt",
  "national accounts",
  "job vacancy",
];

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value: string, base: string): string {
  try {
    return new URL(value, base).toString();
  } catch {
    return base;
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
        "User-Agent": "EdgeVault-Economic-Calendar/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Official national statistics calendar returned HTTP ${response.status}: ${url}`);
    }
    return response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Official national statistics calendar timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isEconomicTitle(value: string): boolean {
  const normalized = value.toLowerCase();
  return ECONOMIC_TERMS.some((term) => normalized.includes(term));
}

function decodeDate(value: string): Date | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  const iso = normalized.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12));
    return date.getUTCFullYear() === Number(iso[1]) && date.getUTCMonth() === Number(iso[2]) - 1 && date.getUTCDate() === Number(iso[3]) ? date : null;
  }
  const european = normalized.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (european) {
    const date = new Date(Date.UTC(Number(european[3]), Number(european[2]) - 1, Number(european[1]), 12));
    return date.getUTCFullYear() === Number(european[3]) && date.getUTCMonth() === Number(european[2]) - 1 && date.getUTCDate() === Number(european[1]) ? date : null;
  }
  const monthName = normalized.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (monthName) return new Date(Date.UTC(Number(monthName[3]), new Date(`${monthName[1]} 1, 2000`).getUTCMonth(), Number(monthName[2]), 12));
  const reverseMonthName = normalized.match(/\b(\d{1,2})\.?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+(20\d{2})\b/i);
  if (reverseMonthName) return new Date(Date.UTC(Number(reverseMonthName[3]), new Date(`${reverseMonthName[2]} 1, 2000`).getUTCMonth(), Number(reverseMonthName[1]), 12));
  return null;
}

function extractDateNear(html: string, index: number): Date | null {
  const windowStart = Math.max(0, index - 1_000);
  const windowEnd = Math.min(html.length, index + 1_000);
  const window = stripHtml(html.slice(windowStart, windowEnd));
  const candidates = [
    ...window.matchAll(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g),
    ...window.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-]20\d{2}\b/g),
    ...window.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+\d{1,2},?\s+20\d{2}\b/gi),
    ...window.matchAll(/\b\d{1,2}\.?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+20\d{2}\b/gi),
  ];
  let closest: { distance: number; date: Date } | null = null;
  for (const candidate of candidates) {
    const date = decodeDate(candidate[0]);
    if (!date) continue;
    const absoluteIndex = windowStart + (candidate.index || 0);
    const distance = Math.abs(absoluteIndex - index);
    if (!closest || distance < closest.distance) closest = { distance, date };
  }
  return closest?.date || null;
}

function eventFromCandidate(
  office: NationalOffice,
  title: string,
  date: Date,
  sourceUrl: string,
  released: boolean
): EconomicSourceEvent {
  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  const dateKey = date.toISOString().slice(0, 10);
  const seriesKey = `eur-national-${office.countryCode.toLowerCase()}`;
  const externalId = `${seriesKey}:${dateKey}:${normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90)}`;
  return {
    externalId,
    seriesKey,
    title: `${office.country} ${normalizedTitle}`,
    country: office.country,
    currency: "EUR",
    eventTime: date.toISOString(),
    eventKind: "data",
    category: "National Statistics",
    referencePeriod: null,
    sourceAgency: office.office,
    sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: released ? date.toISOString() : null,
    previous: null,
    actual: null,
    unit: null,
    releaseStatus: released ? "released" : "scheduled",
    rawPayload: {
      official_calendar_url: office.calendarUrl,
      official_source_url: office.officialUrl,
      values_not_synced: true,
      values_note: "This first national-office connector stores verified official release-calendar metadata and direct official links. Numeric values are added only through separately verified public feeds.",
      release_link_behavior: "Scheduled entries use the official calendar. After publication, the next synchronization uses the direct official release link exposed by the office.",
    },
  };
}

function parseOfficeCalendar(office: NationalOffice, html: string): EconomicSourceEvent[] {
  const events: EconomicSourceEvent[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const rawTitle = stripHtml(match[3]);
    if (rawTitle.length < 8 || rawTitle.length > 220 || !isEconomicTitle(rawTitle)) continue;
    const date = extractDateNear(html, match.index || 0);
    if (!date || date.getUTCFullYear() < CURRENT_YEAR - 1 || date.getUTCFullYear() > CURRENT_YEAR + 1) continue;
    const link = absoluteUrl(match[2], office.calendarUrl);
    const key = `${date.toISOString().slice(0, 10)}:${rawTitle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const released = date.getTime() <= Date.now();
    events.push(eventFromCandidate(office, rawTitle, released ? date : date, released ? link : office.calendarUrl, released));
  }
  return events.slice(0, 250);
}

async function fetchOffice(office: NationalOffice): Promise<EconomicSourceEvent[]> {
  const urls = [...new Set([office.calendarUrl, office.officialUrl])];
  const failures: string[] = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const events = parseOfficeCalendar(office, html);
      if (events.length > 0) return events;
      failures.push(`${url}: no parseable economic release entries`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`${office.office} calendar unavailable. ${failures.join(" | ")}`);
}

export type EuroNationalCalendarSync = {
  events: EconomicSourceEvent[];
  availableCountries: string[];
  unavailableCountries: string[];
};

export async function fetchEuroNationalCalendarSync(): Promise<EuroNationalCalendarSync> {
  const results = await Promise.allSettled(EURO_NATIONAL_OFFICES.map(fetchOffice));
  const events: EconomicSourceEvent[] = [];
  const availableCountries: string[] = [];
  const unavailableCountries: string[] = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const office = EURO_NATIONAL_OFFICES[index];
    if (result.status === "fulfilled") {
      events.push(...result.value);
      availableCountries.push(office.country);
    } else {
      console.error(`NATIONAL EUR SOURCE WARNING [${office.countryCode}]:`, result.reason);
      unavailableCountries.push(office.country);
    }
  }
  if (events.length === 0) throw new Error("No euro-area national statistical release entries could be synchronized.");
  return {
    events: events.sort((left, right) => new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime()),
    availableCountries,
    unavailableCountries,
  };
}

export async function fetchEuroNationalCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const result = await fetchEuroNationalCalendarSync();
  return result.events;
}
