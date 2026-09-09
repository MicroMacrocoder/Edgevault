import type { EconomicSourceEvent } from "@/types/economic";

export const ECB_STATISTICAL_SOURCE_NAME = "European Central Bank";
export const ECB_STATISTICAL_CALENDAR_URL =
  "https://www.ecb.europa.eu/press/calendars/statscal/html/index.en.html";
export const ECB_STATISTICAL_PORTAL_URL = "https://data.ecb.europa.eu/";
export const ECB_STATISTICAL_RSS_URL = "https://www.ecb.europa.eu/rss/press.html";

const ECB_BASE_URL = "https://www.ecb.europa.eu";

type CalendarRow = {
  date: string;
  hour: number;
  minute: number;
  zone: "CET" | "CEST";
  description: string;
};

type RssItem = { date: string; title: string; url: string };

const SERIES_BY_FAMILY: Record<string, { key: string; name: string; notes: string }> = {
  HICP: {
    key: "eur-ecb-stat-hicp",
    name: "ECB Statistical Release — HICP",
    notes: "Harmonised consumer-price statistics and related HICP releases.",
  },
  BPS: {
    key: "eur-ecb-stat-balance-of-payments",
    name: "ECB Statistical Release — Balance of Payments",
    notes: "Balance of payments and international investment position releases.",
  },
  MIR: {
    key: "eur-ecb-stat-bank-rates",
    name: "ECB Statistical Release — Bank Rates",
    notes: "Monetary financial institution interest-rate statistics.",
  },
  BSI: {
    key: "eur-ecb-stat-monetary-developments",
    name: "ECB Statistical Release — Monetary Developments",
    notes: "MFI balance-sheet, monetary aggregate and related monetary developments releases.",
  },
  BLS: {
    key: "eur-ecb-stat-bank-lending-survey",
    name: "ECB Statistical Release — Bank Lending Survey",
    notes: "Bank Lending Survey releases and related lending conditions information.",
  },
  GFS: {
    key: "eur-ecb-stat-government-finance",
    name: "ECB Statistical Release — Government Finance",
    notes: "Government finance, deficit, debt and government debt securities releases.",
  },
  IVF: {
    key: "eur-ecb-stat-investment-funds",
    name: "ECB Statistical Release — Investment Funds",
    notes: "Investment fund statistics releases.",
  },
  PAY: {
    key: "eur-ecb-stat-payments",
    name: "ECB Statistical Release — Payments",
    notes: "Payments and payment-system statistics releases.",
  },
};

const TITLE_FAMILY_RULES: Array<[string, RegExp]> = [
  ["HICP", /harmonised consumer price|hicp|consumer prices/i],
  ["BPS", /balance of payments|international investment position/i],
  ["MIR", /interest rate statistics|bank interest rate/i],
  ["BSI", /monetary development|mfi balance sheet|money supply/i],
  ["BLS", /bank lending survey|lending conditions/i],
  ["GFS", /government finance|government debt|deficit and debt/i],
  ["IVF", /investment fund/i],
  ["PAY", /payments statistics|payment statistics|payments/i],
];

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

async function fetchText(url: string, accept = "text/html"): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: accept, "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) throw new Error(`ECB statistics source failed with HTTP ${response.status}: ${url}`);
  return response.text();
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
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const correction = desired - observed;
    if (correction === 0) break;
    candidate = new Date(candidate.getTime() + correction);
  }
  return candidate.toISOString();
}

function parseCalendar(html: string): CalendarRow[] {
  const rows: CalendarRow[] = [];
  const pattern = /<dt>\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(CET|CEST)?\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi;
  for (const match of html.matchAll(pattern)) {
    rows.push({
      date: `${match[3]}-${match[2]}-${match[1]}`,
      hour: Number(match[4]),
      minute: Number(match[5]),
      zone: (match[6]?.toUpperCase() === "CEST" ? "CEST" : "CET"),
      description: text(match[7] || ""),
    });
  }
  return rows;
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const body = match[1];
    const title = text(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    const rawUrl = body.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim();
    const rawDate = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    if (!title || !rawUrl || !rawDate) continue;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) continue;
    items.push({ date: date.toISOString(), title, url: absoluteUrl(rawUrl.replace(/^https:\/\/www\.ecb\.europa\.eu\/\//, "/")) });
  }
  return items;
}

function parseDataset(description: string): string | null {
  return description.match(/\(Dataset:\s*([A-Z0-9_]+)\)/i)?.[1]?.toUpperCase() || null;
}

function familyFor(description: string, dataset: string | null): string | null {
  if (dataset) {
    const exact = Object.keys(SERIES_BY_FAMILY).find((family) => dataset === family || dataset.startsWith(`${family}_`));
    if (exact) return exact;
  }
  return TITLE_FAMILY_RULES.find(([, rule]) => rule.test(description))?.[0] || null;
}

function cleanTitle(description: string): string {
  return description
    .replace(/\s*\(Dataset:\s*[A-Z0-9_]+\)\s*/i, " ")
    .replace(/\s*(Includes press release|Tentative)\s*/gi, " ")
    .replace(/Reference period:\s*[^.]+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function referencePeriod(description: string): string | null {
  return description.match(/Reference period:\s*([^,;]+)/i)?.[1]?.trim() || null;
}

function releaseMatch(row: CalendarRow, family: string | null, rss: RssItem[]): RssItem | null {
  const rowDate = new Date(`${row.date}T00:00:00Z`).getTime();
  return rss
    .filter((item) => {
      const itemDate = new Date(item.date).getTime();
      if (Math.abs(itemDate - rowDate) > 3 * 86400000) return false;
      if (!/\/press\/pr\//i.test(item.url)) return false;
      if (!family) return /statistics|statistical|publishes|release/i.test(item.title);
      const rule = TITLE_FAMILY_RULES.find(([candidate]) => candidate === family)?.[1];
      return rule ? rule.test(item.title) : false;
    })
    .sort((a, b) => Math.abs(new Date(a.date).getTime() - rowDate) - Math.abs(new Date(b.date).getTime() - rowDate))[0] || null;
}

function makeEvent(row: CalendarRow, rss: RssItem[]): EconomicSourceEvent {
  const dataset = parseDataset(row.description);
  const family = familyFor(row.description, dataset);
  const definition = family ? SERIES_BY_FAMILY[family] : null;
  const dateTime = utcFromBrusselsTime(row.date, row.hour, row.minute);
  const released = new Date(dateTime).getTime() <= Date.now();
  const publication = released ? releaseMatch(row, family, rss) : null;
  const title = `ECB Statistical Release — ${cleanTitle(row.description) || "Official ECB statistics"}`;
  const stablePart = `${dataset || "general"}:${row.date}:${cleanTitle(row.description)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
  const externalId = `ecb:statistics:${stablePart}`;
  return {
    externalId,
    seriesKey: definition?.key || "eur-ecb-statistical-release",
    title,
    country: "Euro Area",
    currency: "EUR",
    eventTime: dateTime,
    eventKind: "data",
    category: "ECB Statistics",
    referencePeriod: referencePeriod(row.description) || row.date,
    sourceAgency: ECB_STATISTICAL_SOURCE_NAME,
    sourceUrl: publication?.url || ECB_STATISTICAL_CALENDAR_URL,
    sourceEventId: externalId,
    sourcePublishedAt: publication?.date || (released ? dateTime : null),
    unit: null,
    releaseStatus: released ? "released" : "scheduled",
    rawPayload: {
      dataset_code: dataset,
      dataset_family: family,
      official_calendar_url: ECB_STATISTICAL_CALENDAR_URL,
      data_portal_url: ECB_STATISTICAL_PORTAL_URL,
      scheduled_timezone: row.zone,
      scheduled_description: row.description,
      release_link_mode: publication ? "direct_official_press_release" : "official_statistical_calendar",
      direct_release_url: publication?.url || null,
      values_not_synced: true,
      values_note: definition?.notes || "This connector captures the official ECB statistical release calendar. ECB Data Portal values are multidimensional and are not copied into a single calendar row without a verified series definition.",
    },
  };
}

export async function fetchEcbStatisticalCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const [calendarHtml, rss] = await Promise.all([
    fetchText(ECB_STATISTICAL_CALENDAR_URL),
    fetchText(ECB_STATISTICAL_RSS_URL, "application/rss+xml, text/xml").catch(() => ""),
  ]);
  const rows = parseCalendar(calendarHtml);
  if (rows.length === 0) throw new Error("The official ECB statistical calendar returned no structured release rows.");
  return rows
    .map((row) => makeEvent(row, parseRssItems(rss)))
    .filter((event) => {
      const timestamp = new Date(event.eventTime).getTime();
      return timestamp >= Date.now() - 365 * 86400000 && timestamp <= Date.now() + 18 * 30 * 86400000;
    });
}

export const ECB_STATISTICAL_SERIES = {
  ...Object.fromEntries(Object.values(SERIES_BY_FAMILY).map((definition) => [definition.key, definition])),
  "eur-ecb-statistical-release": {
    key: "eur-ecb-statistical-release",
    name: "ECB Statistical Release — Other",
    notes: "Official ECB statistical calendar release not assigned to a named dataset family.",
  },
} as const;
