import AdmZip from "adm-zip";
import type { EconomicSeriesObservationInput } from "@/lib/blsHistoricalData";
import type { EconomicSourceEvent } from "@/types/economic";

export const CENSUS_RELEASE_SCHEDULE_URL =
  "https://www.census.gov/economic-indicators/calendar-listview.html";

const CENSUS_BASE_URL = "https://www.census.gov";
const CENSUS_SOURCE_NAME = "U.S. Census Bureau";
const CENSUS_DATASET_INDEX_URL = "https://www.census.gov/econ_datasets/";

type CensusSeriesDefinition = {
  seriesKey: string;
  title: string;
  category: string;
  categoryCode: string;
  dataTypeCode: string;
  unit: string;
  measurement: string;
  adjusted: boolean;
  preliminary: boolean;
};

type CensusDatasetDefinition = {
  programCode: string;
  csvFileName: string;
  scheduleMatches: (title: string) => boolean;
  series: CensusSeriesDefinition[];
};

type CensusScheduleRow = {
  title: string;
  releaseTime: Date;
  referencePeriod: string;
  sourceUrl: string;
};

type CensusCsvRow = Record<string, string>;

const CENSUS_DATASETS: CensusDatasetDefinition[] = [
  {
    programCode: "MARTS",
    csvFileName: "MARTS-mf.csv",
    scheduleMatches: (title) =>
      /advance monthly sales for retail and food services/i.test(title),
    series: [
      {
        seriesKey: "us-retail-sales-mom",
        title: "Retail Sales MoM",
        category: "Consumer Spending",
        categoryCode: "44X72",
        dataTypeCode: "MPCSM",
        unit: "%",
        measurement: "month_over_month_percent_change",
        adjusted: true,
        preliminary: true,
      },
      {
        seriesKey: "us-core-retail-sales-mom",
        title: "Core Retail Sales MoM",
        category: "Consumer Spending",
        categoryCode: "44Y72",
        dataTypeCode: "MPCSM",
        unit: "%",
        measurement: "month_over_month_percent_change",
        adjusted: true,
        preliminary: true,
      },
    ],
  },
  {
    programCode: "M3ADV",
    csvFileName: "M3ADV-mf.csv",
    scheduleMatches: (title) =>
      /advance report on durable goods/i.test(title),
    series: [
      {
        seriesKey: "us-durable-goods-orders-mom",
        title: "Durable Goods Orders MoM",
        category: "Manufacturing",
        categoryCode: "MDM",
        dataTypeCode: "MPCNO",
        unit: "%",
        measurement: "month_over_month_percent_change",
        adjusted: true,
        preliminary: true,
      },
      {
        seriesKey: "us-core-durable-goods-orders-mom",
        title: "Core Durable Goods Orders MoM",
        category: "Manufacturing",
        categoryCode: "DXT",
        dataTypeCode: "MPCNO",
        unit: "%",
        measurement: "month_over_month_percent_change",
        adjusted: true,
        preliminary: true,
      },
    ],
  },
  {
    programCode: "M3",
    csvFileName: "M3-mf.csv",
    scheduleMatches: (title) =>
      /full report\s*[-–—]\s*manufacturers' shipments, inventories and orders/i.test(
        title
      ),
    series: [
      {
        seriesKey: "us-factory-orders-mom",
        title: "Factory Orders MoM",
        category: "Manufacturing",
        categoryCode: "MTM",
        dataTypeCode: "MPCNO",
        unit: "%",
        measurement: "month_over_month_percent_change",
        adjusted: true,
        preliminary: false,
      },
    ],
  },
  {
    programCode: "MWTS",
    csvFileName: "MWTS-mf.csv",
    scheduleMatches: (title) =>
      /monthly wholesale trade:\s*sales and inventories/i.test(title),
    series: [
      {
        seriesKey: "us-wholesale-inventories-mom",
        title: "Wholesale Inventories MoM",
        category: "Inventories",
        categoryCode: "42",
        dataTypeCode: "MPCIM",
        unit: "%",
        measurement: "month_over_month_percent_change",
        adjusted: true,
        preliminary: false,
      },
    ],
  },
  {
    programCode: "RESCONST",
    csvFileName: "RESCONST-mf.csv",
    scheduleMatches: (title) =>
      /new residential construction \(building permits, housing starts/i.test(
        title
      ),
    series: [
      {
        seriesKey: "us-building-permits",
        title: "Building Permits",
        category: "Construction & Housing",
        categoryCode: "PERMITS",
        dataTypeCode: "TOTAL",
        unit: "thousands",
        measurement: "seasonally_adjusted_annual_rate_thousands",
        adjusted: false,
        preliminary: false,
      },
      {
        seriesKey: "us-housing-starts",
        title: "Housing Starts",
        category: "Construction & Housing",
        categoryCode: "STARTS",
        dataTypeCode: "TOTAL",
        unit: "thousands",
        measurement: "seasonally_adjusted_annual_rate_thousands",
        adjusted: false,
        preliminary: false,
      },
    ],
  },
  {
    programCode: "RESSALES",
    csvFileName: "RESSALES-mf.csv",
    scheduleMatches: (title) => /new residential sales/i.test(title),
    series: [
      {
        seriesKey: "us-new-home-sales",
        title: "New Home Sales",
        category: "Construction & Housing",
        categoryCode: "SOLD",
        dataTypeCode: "TOTAL",
        unit: "thousands",
        measurement: "seasonally_adjusted_annual_rate_thousands",
        adjusted: false,
        preliminary: false,
      },
    ],
  },
  {
    programCode: "VIP",
    csvFileName: "VIP-mf.csv",
    scheduleMatches: (title) =>
      /construction spending \(construction put in place\)/i.test(title),
    series: [
      {
        seriesKey: "us-construction-spending-mom",
        title: "Construction Spending MoM",
        category: "Construction & Housing",
        categoryCode: "XXXX",
        dataTypeCode: "MPCT",
        unit: "%",
        measurement: "month_over_month_percent_change",
        adjusted: true,
        preliminary: false,
      },
    ],
  },
  {
    programCode: "FTD",
    csvFileName: "FTD-mf.csv",
    scheduleMatches: (title) =>
      /u\.s\. international trade in goods and services/i.test(title),
    series: [
      {
        seriesKey: "us-trade-balance",
        title: "Trade Balance",
        category: "International Trade",
        categoryCode: "BOPGS",
        dataTypeCode: "BAL",
        unit: "$M",
        measurement: "balance_millions_of_dollars",
        adjusted: true,
        preliminary: false,
      },
    ],
  },
];

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
  ].map((month, index) => [month, index + 1])
);

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
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

function absoluteUrl(path: string | undefined): string {
  return path ? new URL(path, CENSUS_BASE_URL).toString() : CENSUS_BASE_URL;
}

function parseScheduleDate(value: string, time: string): Date | null {
  const dateMatch = value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!dateMatch || !timeMatch) return null;

  const month = MONTHS.get(dateMatch[1].toLowerCase());
  if (!month) return null;

  let hour = Number(timeMatch[1]) % 12;
  if (timeMatch[3].toUpperCase() === "PM") hour += 12;

  return easternTimeToUtc(
    Number(dateMatch[3]),
    month,
    Number(dateMatch[2]),
    hour,
    Number(timeMatch[2])
  );
}

function parseScheduleRows(html: string): CensusScheduleRow[] {
  const rows: CensusScheduleRow[] = [];

  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1];
    const cells = [
      ...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
    ].map((cell) => decodeHtml(cell[1]));
    if (cells.length < 4) continue;

    const releaseTime = parseScheduleDate(cells[1], cells[2]);
    if (!releaseTime || !cells[0] || !cells[3]) continue;

    const sourcePath = rowHtml.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1];
    rows.push({
      title: cells[0],
      releaseTime,
      referencePeriod: cells[3],
      sourceUrl: absoluteUrl(sourcePath),
    });
  }

  return rows;
}

function canonicalMonthlyPeriod(value: string): {
  referencePeriod: string;
  periodStart: string;
  periodEnd: string;
} | null {
  const match = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS.get(match[1].toLowerCase());
  if (!month) return null;

  const year = Number(match[2]);
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  return {
    referencePeriod: `${match[1]} ${year}`,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

function parseSection(csv: string, sectionName: string): CensusCsvRow[] {
  const lines = csv.replace(/\r/g, "").split("\n");
  const sectionIndex = lines.findIndex((line) => line.trim() === sectionName);
  if (sectionIndex < 0) return [];

  let headerIndex = sectionIndex + 1;
  while (headerIndex < lines.length && !lines[headerIndex].trim()) {
    headerIndex += 1;
  }
  if (headerIndex >= lines.length) return [];

  const headers = parseCsvLine(lines[headerIndex]);
  const rows: CensusCsvRow[] = [];

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) break;
    const values = parseCsvLine(line);
    if (values.length !== headers.length) continue;
    rows.push(
      Object.fromEntries(
        headers.map((header, headerIndex) => [
          header,
          values[headerIndex]?.trim() || "",
        ])
      )
    );
  }

  return rows;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function periodFromCensusName(value: string): {
  referencePeriod: string;
  periodStart: string;
  periodEnd: string;
} | null {
  const match = value.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = MONTHS.get(
    new Date(`${match[1]} 1, 2000`)
      .toLocaleString("en-US", { month: "long" })
      .toLowerCase()
  );
  if (!month) return null;
  return canonicalMonthlyPeriod(
    `${new Date(Date.UTC(2000, month - 1, 1)).toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    })} ${match[2]}`
  );
}

function buildEvents(rows: CensusScheduleRow[]): EconomicSourceEvent[] {
  const events: EconomicSourceEvent[] = [];

  for (const row of rows) {
    const dataset = CENSUS_DATASETS.find((candidate) =>
      candidate.scheduleMatches(row.title)
    );
    const period = canonicalMonthlyPeriod(row.referencePeriod);
    if (!dataset || !period) continue;

    for (const series of dataset.series) {
      const eventTime = row.releaseTime.toISOString();
      const externalId = `census:${dataset.programCode}:${eventTime}:${series.seriesKey}:${period.referencePeriod}`;
      events.push({
        externalId,
        seriesKey: series.seriesKey,
        title: series.title,
        country: "United States",
        currency: "USD",
        eventTime,
        eventKind: "data",
        category: series.category,
        referencePeriod: period.referencePeriod,
        sourceAgency: CENSUS_SOURCE_NAME,
        sourceUrl: row.sourceUrl,
        sourceEventId: externalId,
        sourcePublishedAt: null,
        rawPayload: {
          calendar_title: row.title,
          release_schedule_url: CENSUS_RELEASE_SCHEDULE_URL,
          program_code: dataset.programCode,
          reference_period: row.referencePeriod,
        },
      });
    }
  }

  return events;
}

export async function fetchCensusCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const response = await fetch(CENSUS_RELEASE_SCHEDULE_URL, {
    cache: "no-store",
    headers: {
      Accept: "text/html",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0 (+https://edgevault-six.vercel.app)",
    },
  });
  if (!response.ok) {
    throw new Error(`Census release schedule failed with HTTP ${response.status}.`);
  }

  const events = buildEvents(parseScheduleRows(await response.text()));
  if (events.length === 0) {
    throw new Error("The Census release schedule returned no supported USD events.");
  }
  return events;
}

function zipCsvFileName(zip: AdmZip, expectedFileName: string): string {
  const exact = zip.getEntry(expectedFileName);
  if (exact) return expectedFileName;
  const fallback = zip
    .getEntries()
    .find((entry) => /\.csv$/i.test(entry.entryName));
  if (!fallback) throw new Error(`Census archive is missing ${expectedFileName}.`);
  return fallback.entryName;
}

function rowsFromDataset(
  csv: string,
  dataset: CensusDatasetDefinition
): EconomicSeriesObservationInput[] {
  const categories = new Map(
    parseSection(csv, "CATEGORIES").map((row) => [row.cat_idx, row.cat_code])
  );
  const dataTypes = new Map(
    parseSection(csv, "DATA TYPES").map((row) => [row.dt_idx, row.dt_code])
  );
  const periods = new Map(
    parseSection(csv, "TIME PERIODS").map((row) => [row.per_idx, row.per_name])
  );
  const dataRows = parseSection(csv, "DATA");
  const currentYear = new Date().getUTCFullYear();
  const minimumYear = currentYear - 5;
  const observations: EconomicSeriesObservationInput[] = [];

  for (const definition of dataset.series) {
    for (const row of dataRows) {
      if (row.geo_idx !== "1") continue;
      if (definition.adjusted !== (row.is_adj === "1")) continue;
      if (categories.get(row.cat_idx) !== definition.categoryCode) continue;
      if (dataTypes.get(row.dt_idx) !== definition.dataTypeCode) continue;

      const period = periodFromCensusName(periods.get(row.per_idx) || "");
      const value = parseNumber(row.val);
      if (!period || value == null) continue;
      if (Number(period.periodStart.slice(0, 4)) < minimumYear) continue;

      observations.push({
        seriesKey: definition.seriesKey,
        referencePeriod: period.referencePeriod,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        periodFrequency: "monthly",
        value,
        rawValue: value,
        unit: definition.unit,
        measurement: definition.measurement,
        sourceSeriesId: `${dataset.programCode}:${definition.categoryCode}:${definition.dataTypeCode}`,
        sourceName: CENSUS_SOURCE_NAME,
        sourceUrl: `${CENSUS_BASE_URL}/econ_getzippedfile/?programCode=${dataset.programCode}`,
        sourcePayload: {
          program_code: dataset.programCode,
          category_code: definition.categoryCode,
          data_type_code: definition.dataTypeCode,
          period_name: periods.get(row.per_idx) || null,
          is_adjusted: row.is_adj === "1",
          raw_row: row,
          dataset_index_url: CENSUS_DATASET_INDEX_URL,
        },
        footnotes: [],
        isPreliminary: definition.preliminary,
        isRevised: false,
      });
    }
  }

  return observations;
}

async function fetchDatasetObservations(
  dataset: CensusDatasetDefinition
): Promise<EconomicSeriesObservationInput[]> {
  const archiveUrl = `${CENSUS_BASE_URL}/econ_getzippedfile/?programCode=${dataset.programCode}`;
  const response = await fetch(archiveUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/zip, application/octet-stream",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0 (+https://edgevault-six.vercel.app)",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Census ${dataset.programCode} archive failed with HTTP ${response.status}.`
    );
  }

  const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
  const csvEntry = zip.getEntry(zipCsvFileName(zip, dataset.csvFileName));
  const csv = csvEntry?.getData().toString("utf-8");
  if (!csv) throw new Error(`Census ${dataset.programCode} archive contains no CSV data.`);
  return rowsFromDataset(csv, dataset);
}

export async function fetchCensusHistoricalObservations(): Promise<{
  observations: EconomicSeriesObservationInput[];
  startYear: number;
  endYear: number;
}> {
  const results = await Promise.all(
    CENSUS_DATASETS.map((dataset) => fetchDatasetObservations(dataset))
  );
  const observations = results.flat();
  if (observations.length === 0) {
    throw new Error("Census archives returned no supported USD observations.");
  }

  return {
    observations,
    startYear: new Date().getUTCFullYear() - 5,
    endYear: new Date().getUTCFullYear(),
  };
}
