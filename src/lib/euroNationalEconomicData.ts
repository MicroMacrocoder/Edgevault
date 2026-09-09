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
  releaseUrl?: string;
};

type ValuePeriodKind = "month" | "quarter";

type NationalValueRule = {
  key: string;
  match: (title: string) => boolean;
  datasetCode: string;
  periodKind: ValuePeriodKind;
  unit: string;
  measurement: string;
  query: Record<string, string>;
};

type JsonStatDataset = {
  id?: string[];
  size?: number[];
  dimension?: Record<string, {
    category?: { index?: Record<string, number> };
  }>;
  value?: Record<string, number | string>;
};

type NationalObservation = {
  countryCode: string;
  periodCode: string;
  referencePeriod: string;
  periodStart: string;
  periodEnd: string;
  value: number;
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
    countryCode: "NL",
    country: "Netherlands",
    office: "Statistics Netherlands (CBS)",
    calendarUrl: "https://www.cbs.nl/en-gb/publication-calendar",
    officialUrl: "https://www.cbs.nl/en-gb",
    releaseUrl: "https://www.cbs.nl/en-gb/news",
  },
  {
    countryCode: "ES",
    country: "Spain",
    office: "National Statistics Institute of Spain (INE)",
    calendarUrl: "https://www.ine.es/dynt3/Calendario/en/calenHTML.htm",
    officialUrl: "https://www.ine.es/en/",
    releaseUrl: "https://www.ine.es/dyngs/Prensa/en/notasPrensa.htm",
  },
  {
    countryCode: "IT",
    country: "Italy",
    office: "Italian National Institute of Statistics (Istat)",
    calendarUrl: "https://www.istat.it/en/information-and-services-for-users/journalists/press-releases/press-calendar/",
    officialUrl: "https://www.istat.it/en/",
    releaseUrl: "https://www.istat.it/en/information-and-services-for-users/journalists/press-releases/",
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

const NATIONAL_VALUE_COUNTRIES = ["NL", "ES", "IT"] as const;

// These are official Eurostat country-level series. The national offices remain
// the release/link sources; Eurostat supplies the reusable numeric observation.
// Rules are intentionally conservative so an unsupported title stays link-only.
const NATIONAL_VALUE_RULES: NationalValueRule[] = [
  {
    key: "hicp-yoy",
    match: (title) =>
      /\bhicp\b/i.test(title) ||
      /\bharmon(?:ised|ized)\s+consumer prices?\b/i.test(title) ||
      /\bharmon(?:ised|ized)\s+consumer price indices?\b/i.test(title),
    datasetCode: "prc_hicp_minr",
    periodKind: "month",
    unit: "%",
    measurement: "Annual rate of change",
    query: { unit: "RCH_A", coicop18: "TOTAL" },
  },
  {
    key: "gdp-qoq",
    match: (title) => /\b(gdp|gross domestic product|national accounts)\b/i.test(title),
    datasetCode: "namq_10_gdp",
    periodKind: "quarter",
    unit: "%",
    measurement: "Quarter-on-quarter change",
    query: { unit: "CLV_PCH_PRE", s_adj: "SCA", na_item: "B1GQ" },
  },
  {
    key: "unemployment-rate",
    match: (title) => /\bunemployment\b/i.test(title),
    datasetCode: "une_rt_m",
    periodKind: "month",
    unit: "%",
    measurement: "Unemployment rate",
    query: { s_adj: "SA", age: "TOTAL", unit: "PC_ACT", sex: "T" },
  },
  {
    key: "industrial-production",
    match: (title) => /\bindustrial (production|output)\b/i.test(title),
    datasetCode: "sts_inpr_m",
    periodKind: "month",
    unit: "%",
    measurement: "Month-on-month change",
    query: { indic_bt: "PRD", nace_r2: "B-D", s_adj: "SCA", unit: "PCH_PRE" },
  },
  {
    key: "retail-sales",
    match: (title) => /\b(retail trade|retail sales)\b/i.test(title),
    datasetCode: "sts_trtu_m",
    periodKind: "month",
    unit: "%",
    measurement: "Month-on-month change",
    query: { indic_bt: "VOL_SLS", nace_r2: "G47", s_adj: "SCA", unit: "PCH_PRE" },
  },
  {
    key: "retail-turnover",
    match: (title) => /\bretail turnover\b/i.test(title),
    datasetCode: "sts_trtu_m",
    periodKind: "month",
    unit: "%",
    measurement: "Month-on-month change",
    query: { indic_bt: "NETTUR", nace_r2: "G47", s_adj: "SCA", unit: "PCH_PRE" },
  },
  {
    key: "producer-prices",
    match: (title) =>
      /\bindustrial(?:\s+and\s+construction)?\s+producer prices?\b/i.test(title) ||
      /\bindustrial producer price index\b/i.test(title) ||
      /\bproducer price index\b/i.test(title),
    datasetCode: "sts_inppd_m",
    periodKind: "month",
    unit: "%",
    measurement: "Month-on-month change",
    query: { indic_bt: "PRC_PRR_DOM", nace_r2: "B-E36", s_adj: "NSA", unit: "PCH_PRE" },
  },
  {
    key: "construction-output",
    match: (title) => /\b(construction production|construction output)\b/i.test(title),
    datasetCode: "sts_copr_m",
    periodKind: "month",
    unit: "%",
    measurement: "Month-on-month change",
    query: { indic_bt: "PRD", nace_r2: "F", s_adj: "SCA", unit: "PCH_PRE" },
  },
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

function eurostatValueUrl(rule: NationalValueRule): string {
  const params = new URLSearchParams({
    sinceTimePeriod: rule.periodKind === "month" ? "2024-01" : "2024-Q1",
    ...rule.query,
  });
  params.set("geo", NATIONAL_VALUE_COUNTRIES[0]);
  for (const countryCode of NATIONAL_VALUE_COUNTRIES.slice(1)) {
    params.append("geo", countryCode);
  }
  return `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${rule.datasetCode}?${params.toString()}`;
}

async function fetchJsonStat(url: string): Promise<JsonStatDataset> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "EdgeVault-Economic-Calendar/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Eurostat dataset request returned HTTP ${response.status}: ${url}`);
    }
    return (await response.json()) as JsonStatDataset;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Eurostat dataset request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function periodDetails(
  periodCode: string,
  periodKind: ValuePeriodKind
): Omit<NationalObservation, "countryCode" | "value"> | null {
  if (periodKind === "quarter") {
    const match = periodCode.match(/^(20\d{2})-Q([1-4])$/);
    if (!match) return null;
    const year = Number(match[1]);
    const quarter = Number(match[2]);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 0));
    return {
      periodCode,
      referencePeriod: `Q${quarter} ${year}`,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  }

  const match = periodCode.match(/^(20\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const monthName = start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return {
    periodCode,
    referencePeriod: `${monthName} ${year}`,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

function decodeNationalObservations(
  dataset: JsonStatDataset,
  periodKind: ValuePeriodKind
): NationalObservation[] {
  const ids = dataset.id || [];
  const sizes = dataset.size || [];
  const geoIndex = ids.indexOf("geo");
  const timeIndex = ids.indexOf("time");
  if (geoIndex < 0 || timeIndex < 0 || !dataset.value) return [];

  const geoCategories = dataset.dimension?.geo?.category?.index || {};
  const timeCategories = dataset.dimension?.time?.category?.index || {};
  const observations: NationalObservation[] = [];

  for (const [countryCode, countryPosition] of Object.entries(geoCategories)) {
    for (const [periodCode, timePosition] of Object.entries(timeCategories)) {
      const coordinates = new Array(ids.length).fill(0) as number[];
      coordinates[geoIndex] = countryPosition;
      coordinates[timeIndex] = timePosition;

      let flatIndex = 0;
      let multiplier = 1;
      for (let index = sizes.length - 1; index >= 0; index -= 1) {
        flatIndex += coordinates[index] * multiplier;
        multiplier *= sizes[index] || 1;
      }

      const rawValue = dataset.value[String(flatIndex)];
      const value = Number(rawValue);
      const details = periodDetails(periodCode, periodKind);
      if (!details || !Number.isFinite(value)) continue;
      observations.push({ countryCode, value, ...details });
    }
  }

  return observations;
}

async function fetchNationalValueRule(
  rule: NationalValueRule
): Promise<NationalObservation[]> {
  const dataset = await fetchJsonStat(eurostatValueUrl(rule));
  return decodeNationalObservations(dataset, rule.periodKind);
}

function eligibleNationalObservations(
  observations: NationalObservation[],
  eventTime: string
): NationalObservation[] {
  const eventTimestamp = new Date(eventTime).getTime();
  if (!Number.isFinite(eventTimestamp)) return [];
  return observations
    .filter((observation) => {
      const periodEnd = new Date(`${observation.periodEnd}T23:59:59.999Z`).getTime();
      return Number.isFinite(periodEnd) && periodEnd < eventTimestamp;
    })
    .sort((left, right) => left.periodStart.localeCompare(right.periodStart));
}

function periodCodeFromTitle(
  title: string,
  periodKind: ValuePeriodKind
): string | null {
  if (periodKind === "quarter") {
    const quarter = title.match(/\bQ([1-4])\s*[-/]?\s*(20\d{2})\b/i);
    return quarter ? `${quarter[2]}-Q${quarter[1]}` : null;
  }

  const month = title.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+(20\d{2})\b/i
  );
  if (!month) return null;
  const monthNumber =
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
    ].indexOf(month[1].toLowerCase()) + 1;
  return `${month[2]}-${String(monthNumber).padStart(2, "0")}`;
}

export async function attachOfficialNationalValues(
  events: EconomicSourceEvent[]
): Promise<number> {
  const targetEvents = events.filter((event) => {
    const countryCode = String(event.rawPayload.country_code || "");
    return NATIONAL_VALUE_COUNTRIES.includes(countryCode as (typeof NATIONAL_VALUE_COUNTRIES)[number]);
  });
  const matchedRules = NATIONAL_VALUE_RULES.filter((rule) =>
    targetEvents.some((event) => rule.match(event.title))
  );
  const results = await Promise.allSettled(matchedRules.map(fetchNationalValueRule));
  const observationsByRule = new Map<string, NationalObservation[]>();

  results.forEach((result, index) => {
    const rule = matchedRules[index];
    if (result.status === "fulfilled") {
      observationsByRule.set(rule.key, result.value);
    } else {
      console.error(`NATIONAL EUR VALUE WARNING [${rule.key}]:`, result.reason);
    }
  });

  let valueBackedEvents = 0;
  for (const event of targetEvents) {
    const countryCode = String(event.rawPayload.country_code || "");
    const rule = matchedRules.find((candidate) => candidate.match(event.title));
    const observations = rule ? observationsByRule.get(rule.key) || [] : [];
    if (!rule || observations.length === 0) continue;

    const eligible = eligibleNationalObservations(
      observations.filter((observation) => observation.countryCode === countryCode),
      event.eventTime
    );
    const targetPeriodCode = periodCodeFromTitle(event.title, rule.periodKind);
    const latest = targetPeriodCode
      ? eligible.find((observation) => observation.periodCode === targetPeriodCode)
      : eligible.at(-1);
    const latestIndex = latest
      ? observations
          .filter((observation) => observation.countryCode === countryCode)
          .sort((left, right) => left.periodStart.localeCompare(right.periodStart))
          .findIndex((observation) => observation.periodCode === latest.periodCode)
      : -1;
    const countryObservations = observations
      .filter((observation) => observation.countryCode === countryCode)
      .sort((left, right) => left.periodStart.localeCompare(right.periodStart));
    const previous = latestIndex > 0 ? countryObservations[latestIndex - 1] : undefined;
    const scheduledPrevious = targetPeriodCode
      ? eligible.filter((observation) => observation.periodCode < targetPeriodCode).at(-1)
      : undefined;
    if (!latest && !previous && !scheduledPrevious) continue;

    const released = event.releaseStatus === "released" || event.releaseStatus === "revised";
    if (released && latest) {
      event.actual = latest.value;
      event.referencePeriod = latest.referencePeriod;
    }
    if (released && previous) {
      event.previous = previous.value;
    } else if (!released) {
      event.previous = (scheduledPrevious || latest)?.value ?? null;
    }
    event.unit = rule.unit;
    event.rawPayload = {
      ...event.rawPayload,
      values_not_synced: false,
      values_verified: true,
      values_workflow: "official_eurostat_country_statistics_api",
      values_source_name: "Eurostat official statistics API",
      values_source_url: eurostatValueUrl(rule),
      values_dataset_code: rule.datasetCode,
      values_country_code: countryCode,
      values_measurement: rule.measurement,
      values_period: latest?.periodCode || previous?.periodCode || null,
      values_note: "Actual and previous values are taken from the official Eurostat country series. The national office remains the release and direct-link source.",
    };
    if (event.actual !== null || event.previous !== null) valueBackedEvents += 1;
  }

  return valueBackedEvents;
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
  const shortEuropean = normalized.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2})\b/);
  if (shortEuropean) {
    const year = 2000 + Number(shortEuropean[3]);
    const date = new Date(Date.UTC(year, Number(shortEuropean[2]) - 1, Number(shortEuropean[1]), 12));
    return date.getUTCFullYear() === year && date.getUTCMonth() === Number(shortEuropean[2]) - 1 && date.getUTCDate() === Number(shortEuropean[1]) ? date : null;
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
    ...window.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2}\b/g),
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
      country_code: office.countryCode,
      official_calendar_url: office.calendarUrl,
      official_source_url: office.officialUrl,
      official_release_index_url: office.releaseUrl || null,
      values_not_synced: true,
      values_note: "This first national-office connector stores verified official release-calendar metadata and direct official links. Numeric values are added only through separately verified public feeds.",
      release_link_behavior: "Scheduled entries use the official calendar. After publication, the next synchronization uses the direct official release link exposed by the office.",
    },
  };
}

function parseOfficeCalendar(office: NationalOffice, html: string, pageUrl: string): EconomicSourceEvent[] {
  const events: EconomicSourceEvent[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const rawTitle = stripHtml(match[3]);
    if (rawTitle.length < 8 || rawTitle.length > 220 || !isEconomicTitle(rawTitle)) continue;
    const date = extractDateNear(html, match.index || 0);
    if (!date || date.getUTCFullYear() < CURRENT_YEAR - 1 || date.getUTCFullYear() > CURRENT_YEAR + 1) continue;
    const link = absoluteUrl(match[2], pageUrl);
    const key = `${date.toISOString().slice(0, 10)}:${rawTitle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const released = date.getTime() <= Date.now();
    const isReleasePage = pageUrl === office.releaseUrl;
    events.push(eventFromCandidate(office, rawTitle, date, released && isReleasePage ? link : released ? link : office.calendarUrl, released));
  }
  return events.slice(0, 250);
}

async function fetchOffice(office: NationalOffice): Promise<EconomicSourceEvent[]> {
  const urls = [...new Set([office.calendarUrl, office.releaseUrl, office.officialUrl].filter((url): url is string => Boolean(url)))];
  const failures: string[] = [];
  const eventsById = new Map<string, EconomicSourceEvent>();
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const events = parseOfficeCalendar(office, html, url);
      for (const event of events) {
        const existing = eventsById.get(event.externalId);
        if (!existing || (event.releaseStatus !== "scheduled" && existing.releaseStatus === "scheduled")) {
          eventsById.set(event.externalId, event);
        }
      }
      if (events.length > 0) continue;
      failures.push(`${url}: no parseable economic release entries`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (eventsById.size > 0) return [...eventsById.values()];
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
