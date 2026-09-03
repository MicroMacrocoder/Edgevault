import type { EconomicSeriesObservationInput } from "@/lib/blsHistoricalData";
import type { EconomicSourceEvent } from "@/types/economic";

export const BEA_API_URL = "https://apps.bea.gov/api/data/";
const BEA_SOURCE_NAME = "U.S. Bureau of Economic Analysis";
const BEA_SOURCE_URL = "https://apps.bea.gov/api/";
export const BEA_RELEASE_SCHEDULE_URL = "https://www.bea.gov/news/schedule";

type BeaApiRow = {
  TableName?: string;
  SeriesCode?: string;
  LineNumber?: string | number;
  LineDescription?: string;
  TimePeriod?: string;
  DataValue?: string;
  CL_UNIT?: string;
  UNIT_MULT?: string | number;
  [key: string]: unknown;
};

type BeaApiResponse = {
  BEAAPI?: {
    Results?: {
      Data?: BeaApiRow[];
    };
    Error?: {
      APIErrorCode?: string;
      APIErrorDescription?: string;
    };
  };
};

type BeaFetchSpec = {
  tableName: string;
  frequency: "M" | "Q";
  years: number[];
};

type DerivedRow = {
  key: string;
  value: number;
  rawValue: number;
  referencePeriod: string;
  periodStart: string;
  periodEnd: string;
  periodFrequency: "monthly" | "quarterly";
  sourceSeriesId: string;
  measurement: string;
  payload: BeaApiRow;
};

const BEA_RELEASES = [
  {
    key: "gdp",
    match: (title: string) => /^gdp\b/i.test(title),
    series: [{ seriesKey: "us-real-gdp-qoq", title: "Real GDP QoQ", category: "Growth" }],
    reference: (title: string) => {
      const quarter = title.match(/(\d)\s*(?:st|nd|rd|th)\s+quarter\s+(\d{4})/i);
      return quarter ? `Q${quarter[1]} ${quarter[2]}` : title;
    },
  },
  {
    key: "personal-income-and-outlays",
    match: (title: string) => /^personal income and outlays$/i.test(title),
    series: [
      { seriesKey: "us-pce-price-index-mom", title: "PCE Price Index MoM", category: "Inflation" },
      { seriesKey: "us-pce-price-index-yoy", title: "PCE Price Index YoY", category: "Inflation" },
      { seriesKey: "us-core-pce-price-index-mom", title: "Core PCE Price Index MoM", category: "Inflation" },
      { seriesKey: "us-core-pce-price-index-yoy", title: "Core PCE Price Index YoY", category: "Inflation" },
      { seriesKey: "us-personal-income-mom", title: "Personal Income MoM", category: "Growth" },
      { seriesKey: "us-personal-spending-mom", title: "Personal Spending MoM", category: "Growth" },
    ],
    reference: (title: string) => title.match(/,\s*(.+)$/)?.[1]?.trim() || title,
  },
] as const;

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function easternTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
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

function parseScheduleDate(value: string, year: number): { month: number; day: number } | null {
  const match = value.match(/^([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return null;
  const month = new Date(`${match[1]} 1, ${year}`).getMonth() + 1;
  return Number.isFinite(month) ? { month, day: Number(match[2]) } : null;
}

function parseBeaSchedule(html: string): Array<{ date: Date; title: string }> {
  const year = new Date().getUTCFullYear();
  const rows: Array<{ date: Date; title: string }> = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decodeHtml(cell[1]));
    if (cells.length < 3) continue;
    const dateParts = parseScheduleDate(cells[0], year);
    const timeMatch = cells[1].match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    const title = cells.slice(2).join(" ").trim();
    if (!dateParts || !timeMatch || !title) continue;
    let hour = Number(timeMatch[1]) % 12;
    if (timeMatch[3].toUpperCase() === "PM") hour += 12;
    rows.push({
      date: easternTimeToUtc(year, dateParts.month, dateParts.day, hour, Number(timeMatch[2])),
      title,
    });
  }
  return rows;
}

export async function fetchBeaCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const response = await fetch(BEA_RELEASE_SCHEDULE_URL, {
    cache: "no-store",
    headers: { Accept: "text/html", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) throw new Error(`BEA release schedule failed with HTTP ${response.status}.`);
  const rows = parseBeaSchedule(await response.text());
  const events: EconomicSourceEvent[] = [];
  for (const row of rows) {
    const mapping = BEA_RELEASES.find((candidate) => candidate.match(row.title));
    if (!mapping) continue;
    const eventTime = row.date.toISOString();
    for (const series of mapping.series) {
      const externalId = `bea:${mapping.key}:${eventTime}:${series.seriesKey}`;
      events.push({
        externalId,
        seriesKey: series.seriesKey,
        title: series.title,
        country: "United States",
        currency: "USD",
        eventTime,
        eventKind: "data",
        category: series.category,
        referencePeriod: mapping.reference(row.title),
        sourceAgency: BEA_SOURCE_NAME,
        sourceUrl: BEA_RELEASE_SCHEDULE_URL,
        sourceEventId: externalId,
        sourcePublishedAt: null,
        rawPayload: { schedule_title: row.title, schedule_url: BEA_RELEASE_SCHEDULE_URL },
      });
    }
  }
  if (events.length === 0) throw new Error("The BEA release schedule returned no supported USD events.");
  return events;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized || normalized === "..." || normalized === "---") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDescription(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function yearsForHistory(): number[] {
  const currentYear = new Date().getUTCFullYear();
  return Array.from({ length: 6 }, (_, index) => currentYear - 5 + index);
}

function periodParts(timePeriod: string, frequency: "M" | "Q") {
  const match = frequency === "M"
    ? timePeriod.match(/^(\d{4})M(\d{2})$/i)
    : timePeriod.match(/^(\d{4})Q([1-4])$/i);

  if (!match) return null;

  const year = Number(match[1]);
  const periodNumber = Number(match[2]);
  const month = frequency === "M" ? periodNumber : (periodNumber - 1) * 3 + 3;
  const periodStartMonth = frequency === "M" ? month : month - 2;
  const periodStart = new Date(Date.UTC(year, periodStartMonth - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  const referencePeriod = frequency === "M"
    ? periodStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : `Q${periodNumber} ${year}`;

  return {
    year,
    periodNumber,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    referencePeriod,
  };
}

async function fetchBeaTable(spec: BeaFetchSpec): Promise<BeaApiRow[]> {
  const userId = process.env.BEA_API_KEY?.trim();
  if (!userId) throw new Error("Missing BEA_API_KEY.");

  const params = new URLSearchParams({
    UserID: userId,
    method: "GetData",
    DatasetName: "NIPA",
    TableName: spec.tableName,
    Frequency: spec.frequency,
    Year: spec.years.join(","),
    ResultFormat: "JSON",
  });

  const response = await fetch(`${BEA_API_URL}?${params.toString()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0 (+https://edgevault-six.vercel.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`BEA API request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as BeaApiResponse;
  const apiError = payload.BEAAPI?.Error;
  if (apiError) {
    throw new Error(
      `BEA API error ${apiError.APIErrorCode || "unknown"}: ${apiError.APIErrorDescription || "Unknown error."}`
    );
  }

  return payload.BEAAPI?.Results?.Data || [];
}

function toObservation(row: DerivedRow): EconomicSeriesObservationInput {
  return {
    seriesKey: row.key,
    referencePeriod: row.referencePeriod,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    periodFrequency: row.periodFrequency,
    value: row.value,
    rawValue: row.rawValue,
    unit: "%",
    measurement: row.measurement,
    sourceSeriesId: row.sourceSeriesId,
    sourceName: BEA_SOURCE_NAME,
    sourceUrl: BEA_SOURCE_URL,
    sourcePayload: row.payload as Record<string, unknown>,
    footnotes: [],
    isPreliminary: false,
    isRevised: false,
  };
}

function deriveMonthlyChanges(
  rows: BeaApiRow[],
  descriptionMatcher: (description: string) => boolean,
  key: string,
  sourceLabel: string
): DerivedRow[] {
  const levels = rows
    .filter((row) => descriptionMatcher(normalizeDescription(row.LineDescription)))
    .map((row) => {
      const value = parseNumber(row.DataValue);
      const period = row.TimePeriod ? periodParts(row.TimePeriod, "M") : null;
      return value == null || !period ? null : { row, value, period };
    })
    .filter((row): row is { row: BeaApiRow; value: number; period: NonNullable<ReturnType<typeof periodParts>> } => Boolean(row))
    .sort((left, right) => left.row.TimePeriod!.localeCompare(right.row.TimePeriod!));

  return levels.map((current, index) => {
    const prior = levels[index - 1];
    if (!prior || prior.value === 0) return null;
    return {
      key,
      value: round(((current.value - prior.value) / prior.value) * 100),
      rawValue: current.value,
      referencePeriod: current.period.referencePeriod,
      periodStart: current.period.periodStart,
      periodEnd: current.period.periodEnd,
      periodFrequency: "monthly",
      sourceSeriesId: `${sourceLabel}:${current.row.SeriesCode || current.row.LineNumber || "unknown"}`,
      measurement: "month_over_month_percent_change",
      payload: current.row,
    };
  }).filter((row): row is DerivedRow => Boolean(row));
}

function deriveMonthlyYearOverYear(
  rows: BeaApiRow[],
  descriptionMatcher: (description: string) => boolean,
  key: string,
  sourceLabel: string
): DerivedRow[] {
  const levels = rows
    .filter((row) => descriptionMatcher(normalizeDescription(row.LineDescription)))
    .map((row) => {
      const value = parseNumber(row.DataValue);
      const period = row.TimePeriod ? periodParts(row.TimePeriod, "M") : null;
      return value == null || !period ? null : { row, value, period };
    })
    .filter((row): row is { row: BeaApiRow; value: number; period: NonNullable<ReturnType<typeof periodParts>> } => Boolean(row))
    .sort((left, right) => left.row.TimePeriod!.localeCompare(right.row.TimePeriod!));

  return levels.map((current, index) => {
    const prior = levels[index - 12];
    if (!prior || prior.value === 0) return null;
    return {
      key,
      value: round(((current.value - prior.value) / prior.value) * 100),
      rawValue: current.value,
      referencePeriod: current.period.referencePeriod,
      periodStart: current.period.periodStart,
      periodEnd: current.period.periodEnd,
      periodFrequency: "monthly",
      sourceSeriesId: `${sourceLabel}:${current.row.SeriesCode || current.row.LineNumber || "unknown"}`,
      measurement: "year_over_year_percent_change",
      payload: current.row,
    };
  }).filter((row): row is DerivedRow => Boolean(row));
}

export async function fetchBeaHistoricalObservations(): Promise<{
  observations: EconomicSeriesObservationInput[];
  startYear: number;
  endYear: number;
}> {
  const years = yearsForHistory();
  const [gdpRows, pceRows, incomeRows] = await Promise.all([
    fetchBeaTable({ tableName: "T10101", frequency: "Q", years }),
    fetchBeaTable({ tableName: "T20804", frequency: "M", years }),
    fetchBeaTable({ tableName: "T20100", frequency: "M", years }),
  ]);

  const observations: EconomicSeriesObservationInput[] = [];

  for (const row of gdpRows) {
    const description = normalizeDescription(row.LineDescription);
    const value = parseNumber(row.DataValue);
    const period = row.TimePeriod ? periodParts(row.TimePeriod, "Q") : null;
    if (!value || !period || description !== "gross domestic product") continue;
    observations.push(toObservation({
      key: "us-real-gdp-qoq",
      value,
      rawValue: value,
      referencePeriod: period.referencePeriod,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodFrequency: "quarterly",
      sourceSeriesId: `${row.TableName || "T10101"}:${row.SeriesCode || row.LineNumber || "1"}`,
      measurement: "quarter_over_quarter_percent_change_saar",
      payload: row,
    }));
  }

  const pceHeadline = (description: string) => description === "personal consumption expenditures (pce)";
  const pceCore = (description: string) => description === "pce excluding food and energy";
  const income = (description: string) => description === "personal income";
  const spending = (description: string) => description === "personal consumption expenditures";

  const derived = [
    ...deriveMonthlyChanges(pceRows, pceHeadline, "us-pce-price-index-mom", "T20804"),
    ...deriveMonthlyYearOverYear(pceRows, pceHeadline, "us-pce-price-index-yoy", "T20804"),
    ...deriveMonthlyChanges(pceRows, pceCore, "us-core-pce-price-index-mom", "T20804"),
    ...deriveMonthlyYearOverYear(pceRows, pceCore, "us-core-pce-price-index-yoy", "T20804"),
    ...deriveMonthlyChanges(incomeRows, income, "us-personal-income-mom", "T20100"),
    ...deriveMonthlyChanges(incomeRows, spending, "us-personal-spending-mom", "T20100"),
  ];

  observations.push(...derived.map(toObservation));

  if (observations.length === 0) {
    throw new Error("BEA returned no supported economic observations.");
  }

  return {
    observations,
    startYear: years[0],
    endYear: years[years.length - 1],
  };
}
