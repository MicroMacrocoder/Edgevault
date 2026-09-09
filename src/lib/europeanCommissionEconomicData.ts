import AdmZip from "adm-zip";
import type { EconomicSeriesObservationInput } from "@/lib/blsHistoricalData";
import type { EconomicSourceEvent } from "@/types/economic";

export const ECFIN_LATEST_RELEASES_URL =
  "https://economy-finance.ec.europa.eu/economic-forecast-and-surveys/business-and-consumer-surveys/latest-business-and-consumer-surveys_en";
export const ECFIN_TIME_SERIES_URL =
  "https://economy-finance.ec.europa.eu/economic-forecast-and-surveys/business-and-consumer-surveys/download-business-and-consumer-survey-data/time-series_en";
export const ECFIN_SOURCE_NAME =
  "European Commission DG ECFIN Business and Consumer Surveys";

const ECFIN_SCHEDULE_BASE_URL =
  "https://ec.europa.eu/economy_finance/db_indicators/surveys/documents/calendar";
const ECFIN_ARCHIVE_FILE_NAMES = {
  main: "main_indicators_sa_nace2.zip",
  uncertainty: "uncertainty_total_nsa_nace2.zip",
  labourHoarding: "labourhoarding_total_sa_nace2.zip",
  industry: "industry_total_sa_nace2.zip",
} as const;

type CellValue = string | number | null;

type SeriesDefinition = {
  seriesKey: string;
  title: string;
  category: string;
  unit: string;
  measurement: string;
  sourceFile: keyof typeof ECFIN_ARCHIVE_FILE_NAMES;
  sheetName: string;
  headerName?: string;
  valueColumn?: number;
};

type MonthlyPeriod = {
  referencePeriod: string;
  periodStart: string;
  periodEnd: string;
};

type ScheduledRelease = {
  kind: "flash" | "full";
  eventTime: Date;
  referencePeriod: string;
  sourceUrl: string;
};

type PublishedReleaseLink = {
  kind: "flash" | "full";
  referencePeriod: string;
  sourceUrl: string;
};

const SERIES_DEFINITIONS: SeriesDefinition[] = [
  {
    seriesKey: "eur-ecfin-economic-sentiment",
    title: "Euro Area Economic Sentiment Indicator",
    category: "Surveys",
    unit: "Index",
    measurement: "seasonally_adjusted_index",
    sourceFile: "main",
    sheetName: "MONTHLY",
    headerName: "EA.ESI",
  },
  {
    seriesKey: "eur-ecfin-employment-expectations",
    title: "Euro Area Employment Expectations Indicator",
    category: "Surveys",
    unit: "Index",
    measurement: "seasonally_adjusted_index",
    sourceFile: "main",
    sheetName: "MONTHLY",
    headerName: "EA.EEI",
  },
  {
    seriesKey: "eur-ecfin-industrial-confidence",
    title: "Euro Area Industrial Confidence",
    category: "Surveys",
    unit: "%",
    measurement: "seasonally_adjusted_balance",
    sourceFile: "main",
    sheetName: "MONTHLY",
    headerName: "EA.INDU",
  },
  {
    seriesKey: "eur-ecfin-services-confidence",
    title: "Euro Area Services Confidence",
    category: "Surveys",
    unit: "%",
    measurement: "seasonally_adjusted_balance",
    sourceFile: "main",
    sheetName: "MONTHLY",
    headerName: "EA.SERV",
  },
  {
    seriesKey: "eur-ecfin-consumer-confidence",
    title: "Euro Area Consumer Confidence",
    category: "Surveys",
    unit: "%",
    measurement: "seasonally_adjusted_balance",
    sourceFile: "main",
    sheetName: "MONTHLY",
    headerName: "EA.CONS",
  },
  {
    seriesKey: "eur-ecfin-retail-confidence",
    title: "Euro Area Retail Trade Confidence",
    category: "Surveys",
    unit: "%",
    measurement: "seasonally_adjusted_balance",
    sourceFile: "main",
    sheetName: "MONTHLY",
    headerName: "EA.RETA",
  },
  {
    seriesKey: "eur-ecfin-construction-confidence",
    title: "Euro Area Construction Confidence",
    category: "Surveys",
    unit: "%",
    measurement: "seasonally_adjusted_balance",
    sourceFile: "main",
    sheetName: "MONTHLY",
    headerName: "EA.BUIL",
  },
  {
    seriesKey: "eur-ecfin-economic-uncertainty",
    title: "Euro Area Economic Uncertainty Indicator",
    category: "Surveys",
    unit: "Index",
    measurement: "non_seasonally_adjusted_index",
    sourceFile: "uncertainty",
    sheetName: "AGGREGATE",
    headerName: "EA.UNC",
  },
  {
    seriesKey: "eur-ecfin-labour-hoarding",
    title: "Euro Area Labour Hoarding Indicator",
    category: "Surveys",
    unit: "%",
    measurement: "seasonally_adjusted_balance",
    sourceFile: "labourHoarding",
    sheetName: "AGGREGATE",
    headerName: "EA.LH",
  },
  {
    seriesKey: "eur-ecfin-business-climate",
    title: "Euro Area Business Climate Indicator",
    category: "Surveys",
    unit: "Index",
    measurement: "seasonally_adjusted_index",
    sourceFile: "industry",
    sheetName: "BCI",
    valueColumn: 1,
  },
];

const FLASH_SERIES_KEY = "eur-ecfin-flash-consumer-confidence";

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function xmlAttribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name.replace(":", "\\:")}="([^"]*)"`));
  return match ? decodeXml(match[1]) : null;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si\b[\s\S]*?<\/si>/g)) {
    strings.push(
      [...match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((item) => decodeXml(item[1]))
        .join("")
    );
  }
  return strings;
}

function parseSheetRows(xml: string, sharedStrings: string[]): CellValue[][] {
  const rows: CellValue[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: CellValue[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const cellRef = xmlAttribute(attributes, "r");
      if (!cellRef) continue;
      const columnLetters = cellRef.match(/^([A-Z]+)/i)?.[1].toUpperCase();
      if (!columnLetters) continue;
      let column = 0;
      for (const letter of columnLetters) column = column * 26 + letter.charCodeAt(0) - 64;
      column -= 1;

      const type = xmlAttribute(attributes, "t");
      const body = cellMatch[2] || "";
      const rawValue = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || "";
      let value: CellValue = rawValue ? decodeXml(rawValue) : null;

      if (type === "s" && rawValue) {
        value = sharedStrings[Number(rawValue)] ?? null;
      } else if (type === "inlineStr") {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
          .map((item) => decodeXml(item[1]))
          .join("");
      } else if (!type && rawValue !== "" && Number.isFinite(Number(rawValue))) {
        value = Number(rawValue);
      }

      row[column] = value;
    }
    rows.push(row);
  }
  return rows;
}

function sheetTarget(zip: AdmZip, sheetName: string): string {
  const workbook = zip.getEntry("xl/workbook.xml")?.getData().toString("utf-8") || "";
  const relationships = zip.getEntry("xl/_rels/workbook.xml.rels")?.getData().toString("utf-8") || "";
  const sheet = [...workbook.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)].find(
    (match) => xmlAttribute(match[1], "name") === sheetName
  );
  const relationId = sheet ? xmlAttribute(sheet[1], "r:id") : null;
  if (!relationId) throw new Error(`ECFIN workbook is missing the ${sheetName} sheet.`);
  const relation = [...relationships.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g)].find(
    (match) => xmlAttribute(match[1], "Id") === relationId
  );
  const target = relation ? xmlAttribute(relation[1], "Target") : null;
  if (!target) throw new Error(`ECFIN workbook has no target for the ${sheetName} sheet.`);
  return target.replace(/^\//, "").startsWith("xl/")
    ? target.replace(/^\//, "")
    : `xl/${target.replace(/^\//, "")}`;
}

function readWorkbookSheet(zip: AdmZip, sheetName: string): CellValue[][] {
  const sharedStrings = parseSharedStrings(
    zip.getEntry("xl/sharedStrings.xml")?.getData().toString("utf-8") || ""
  );
  const target = sheetTarget(zip, sheetName);
  const xml = zip.getEntry(target)?.getData().toString("utf-8");
  if (!xml) throw new Error(`ECFIN workbook is missing ${target}.`);
  return parseSheetRows(xml, sharedStrings);
}

function parseNumber(value: CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized || /^(?:NA|N\/A|:|---)$/i.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function excelDate(value: CellValue): Date | null {
  if (typeof value === "number" && value > 30000) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  }
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthlyPeriod(value: CellValue): MonthlyPeriod | null {
  const date = excelDate(value);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    referencePeriod: start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

function utcFromEuropeanLocalTime(year: number, month: number, day: number, hour: number, minute: number): Date {
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
      formatter.formatToParts(candidate)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const correction = desired - observed;
    if (correction === 0) break;
    candidate = new Date(candidate.getTime() + correction);
  }
  return candidate;
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const runtime = globalThis as typeof globalThis & { DOMMatrix?: unknown };
  if (!runtime.DOMMatrix) {
    class ServerDOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(init?: string | number[]) {
        if (Array.isArray(init) && init.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }
    Object.defineProperty(globalThis, "DOMMatrix", { value: ServerDOMMatrix, configurable: true });
  }
  const pdfjs = await import(/* webpackIgnore: true */ "pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n");
}

function scheduleUrl(year: number): string {
  return `${ECFIN_SCHEDULE_BASE_URL}/Publication%20dates%20${year}.pdf`;
}

function parseScheduleText(text: string, year: number, sourceUrl: string): ScheduledRelease[] {
  const rows = [...text.matchAll(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2})h(\d{2})/g)].map((match) => {
    const month = new Date(`${match[2]} 1, ${match[3]}`).getMonth() + 1;
    return {
      date: utcFromEuropeanLocalTime(Number(match[3]), month, Number(match[1]), Number(match[4]), Number(match[5])),
      localYear: Number(match[3]),
      localMonth: month,
      hour: Number(match[4]),
    };
  });
  const flashes = rows.filter((row) => row.hour === 16).sort((a, b) => a.date.getTime() - b.date.getTime());
  const full = rows.filter((row) => row.hour === 11).sort((a, b) => a.date.getTime() - b.date.getTime());
  const releases: ScheduledRelease[] = [];
  for (let index = 0; index < flashes.length; index += 1) {
    const row = flashes[index];
    releases.push({
      kind: "flash",
      eventTime: row.date,
      referencePeriod: new Date(Date.UTC(row.localYear, row.localMonth - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      sourceUrl,
    });
  }
  for (let index = 0; index < full.length; index += 1) {
    const row = full[index];
    const reference = flashes[index] || row;
    releases.push({
      kind: "full",
      eventTime: row.date,
      referencePeriod: new Date(Date.UTC(reference.localYear, reference.localMonth - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      sourceUrl,
    });
  }
  return releases;
}

async function fetchSchedule(year: number, required: boolean): Promise<ScheduledRelease[]> {
  const sourceUrl = scheduleUrl(year);
  const response = await fetch(sourceUrl, {
    cache: "no-store",
    headers: { Accept: "application/pdf", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) {
    if (!required) return [];
    throw new Error(`European Commission release schedule failed with HTTP ${response.status}.`);
  }
  const releases = parseScheduleText(await extractPdfText(await response.arrayBuffer()), year, sourceUrl);
  if (releases.length === 0 && required) throw new Error("European Commission release schedule returned no release dates.");
  return releases;
}

function withinCalendarWindow(date: Date): boolean {
  const now = Date.now();
  return date.getTime() >= now - 370 * 86400000 && date.getTime() <= now + 370 * 86400000;
}

function eventForRelease(
  release: ScheduledRelease,
  seriesKey: string,
  title: string,
  category: string,
  unit: string,
  publishedReleaseUrl?: string
): EconomicSourceEvent {
  const eventTime = release.eventTime.toISOString();
  const released = release.eventTime.getTime() <= Date.now();
  const externalId = `ecfin:${release.kind}:${release.referencePeriod}:${seriesKey}`;
  const sourceUrl = publishedReleaseUrl || (released ? ECFIN_LATEST_RELEASES_URL : release.sourceUrl);
  return {
    externalId,
    seriesKey,
    title,
    country: "Euro Area",
    currency: "EUR",
    eventTime,
    eventKind: "data",
    category,
    referencePeriod: release.referencePeriod,
    sourceAgency: ECFIN_SOURCE_NAME,
    sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: released ? eventTime : null,
    unit,
    releaseStatus: released ? "released" : "scheduled",
    rawPayload: {
      release_kind: release.kind,
      release_schedule_url: release.sourceUrl,
      latest_releases_url: ECFIN_LATEST_RELEASES_URL,
      direct_release_url: publishedReleaseUrl || null,
      reference_period: release.referencePeriod,
      values_workflow: release.kind === "full" ? "official_ecfin_bulk_time_series" : "calendar_only",
      calendar_only_reason: release.kind === "flash" ? "flash_release_has_no_separate_machine_readable_series_in_the_official_bulk_files" : null,
    },
  };
}

function parsePublishedReleaseLinks(html: string): PublishedReleaseLink[] {
  const links: PublishedReleaseLink[] = [];
  const filePattern = /<li[^>]*ecl-file__detail-meta-item[^>]*>([\s\S]*?)<\/li>[\s\S]*?<div[^>]*ecl-file__title[^>]*>([\s\S]*?)<\/div>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*ecl-file__download/gi;
  for (const match of html.matchAll(filePattern)) {
    const dateText = decodeXml(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const title = decodeXml(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const dateMatch = dateText.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (!dateMatch) continue;
    const parsedDate = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`);
    if (Number.isNaN(parsedDate.getTime())) continue;

    const normalizedTitle = title.toLowerCase();
    const kind = normalizedTitle.includes("flash consumer confidence indicator")
      ? "flash"
      : normalizedTitle.includes("press release business and consumer survey results") &&
          !normalizedTitle.includes("statistical annex")
        ? "full"
        : null;
    if (!kind) continue;

    const referencePeriod = parsedDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    links.push({
      kind,
      referencePeriod,
      sourceUrl: new URL(decodeXml(match[3]), ECFIN_LATEST_RELEASES_URL).toString(),
    });
  }
  return links;
}

async function fetchPublishedReleaseLinks(): Promise<Map<string, string>> {
  const response = await fetch(ECFIN_LATEST_RELEASES_URL, {
    cache: "no-store",
    headers: { Accept: "text/html", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) throw new Error(`European Commission latest releases page failed with HTTP ${response.status}.`);
  const links = parsePublishedReleaseLinks(await response.text());
  return new Map(links.map((link) => [`${link.kind}:${link.referencePeriod}`, link.sourceUrl]));
}

async function findArchiveUrls(): Promise<Record<keyof typeof ECFIN_ARCHIVE_FILE_NAMES, string>> {
  const response = await fetch(ECFIN_TIME_SERIES_URL, {
    cache: "no-store",
    headers: { Accept: "text/html", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) throw new Error(`European Commission time-series page failed with HTTP ${response.status}.`);
  const html = await response.text();
  const entries = Object.entries(ECFIN_ARCHIVE_FILE_NAMES).map(([key, fileName]) => {
    const match = html.match(new RegExp(`href=["']([^"']*${fileName.replace(".", "\\.")})["']`, "i"));
    if (!match) throw new Error(`European Commission time-series page is missing ${fileName}.`);
    return [key, new URL(match[1], ECFIN_TIME_SERIES_URL).toString()] as const;
  });
  return Object.fromEntries(entries) as Record<keyof typeof ECFIN_ARCHIVE_FILE_NAMES, string>;
}

async function downloadWorkbook(url: string): Promise<AdmZip> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/zip, application/octet-stream", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) throw new Error(`European Commission data archive failed with HTTP ${response.status}.`);
  const archive = new AdmZip(Buffer.from(await response.arrayBuffer()));
  const entry = archive.getEntries().find((candidate) => /\.xlsx$/i.test(candidate.entryName));
  if (!entry) throw new Error(`European Commission archive ${url} contains no XLSX workbook.`);
  return new AdmZip(entry.getData());
}

function observationsFromWorkbook(
  workbook: AdmZip,
  definition: SeriesDefinition,
  archiveUrl: string,
  minimumYear: number
): EconomicSeriesObservationInput[] {
  const rows = readWorkbookSheet(workbook, definition.sheetName);
  const header = rows[0] || [];
  const valueColumn = definition.headerName
    ? header.findIndex((value) => value === definition.headerName)
    : definition.valueColumn ?? -1;
  if (valueColumn < 0) throw new Error(`European Commission workbook is missing ${definition.headerName || definition.seriesKey}.`);
  const observations: EconomicSeriesObservationInput[] = [];
  for (const row of rows.slice(1)) {
    const period = monthlyPeriod(row[0]);
    const value = parseNumber(row[valueColumn]);
    if (!period || value == null || Number(period.periodStart.slice(0, 4)) < minimumYear) continue;
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
      sourceSeriesId: `ECFIN:${definition.sheetName}:${definition.headerName || "EA.BCI"}`,
      sourceName: ECFIN_SOURCE_NAME,
      sourceUrl: archiveUrl,
      sourcePayload: {
        archive_url: archiveUrl,
        time_series_page: ECFIN_TIME_SERIES_URL,
        sheet_name: definition.sheetName,
        series_name: definition.headerName || "Euro area Business Climate Indicator",
      },
      footnotes: [],
      isPreliminary: false,
      isRevised: false,
    });
  }
  return observations;
}

export async function fetchEuropeanCommissionHistoricalObservations(): Promise<{
  observations: EconomicSeriesObservationInput[];
  startYear: number;
  endYear: number;
}> {
  const currentYear = new Date().getUTCFullYear();
  const minimumYear = currentYear - 5;
  const archiveUrls = await findArchiveUrls();
  const workbooks = new Map<keyof typeof ECFIN_ARCHIVE_FILE_NAMES, AdmZip>();
  await Promise.all(
    (Object.keys(archiveUrls) as Array<keyof typeof ECFIN_ARCHIVE_FILE_NAMES>).map(async (key) => {
      workbooks.set(key, await downloadWorkbook(archiveUrls[key]));
    })
  );
  const observations = SERIES_DEFINITIONS.flatMap((definition) => {
    const workbook = workbooks.get(definition.sourceFile);
    return workbook ? observationsFromWorkbook(workbook, definition, archiveUrls[definition.sourceFile], minimumYear) : [];
  });
  if (observations.length === 0) throw new Error("European Commission archives returned no supported euro-area observations.");
  return { observations, startYear: minimumYear, endYear: currentYear };
}

export async function fetchEuropeanCommissionCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const currentYear = new Date().getUTCFullYear();
  const [previous, current, publishedReleaseLinks] = await Promise.all([
    fetchSchedule(currentYear - 1, false),
    fetchSchedule(currentYear, true),
    fetchPublishedReleaseLinks().catch(() => new Map<string, string>()),
  ]);
  const releases = [...previous, ...current].filter((release) => withinCalendarWindow(release.eventTime));
  const events: EconomicSourceEvent[] = [];
  for (const release of releases) {
    const publishedReleaseUrl = publishedReleaseLinks.get(`${release.kind}:${release.referencePeriod}`);
    if (release.kind === "flash") {
      events.push(eventForRelease(release, FLASH_SERIES_KEY, "Euro Area Flash Consumer Confidence Indicator", "Surveys", "%", publishedReleaseUrl));
      continue;
    }
    for (const definition of SERIES_DEFINITIONS) {
      events.push(eventForRelease(release, definition.seriesKey, definition.title, definition.category, definition.unit, publishedReleaseUrl));
    }
  }

  const deduped = [...new Map(events.map((event) => [event.externalId, event])).values()];
  try {
    const history = await fetchEuropeanCommissionHistoricalObservations();
    const values = new Map<string, EconomicSeriesObservationInput>();
    for (const observation of history.observations) values.set(`${observation.seriesKey}:${observation.referencePeriod}`, observation);
    for (const event of deduped) {
      if (event.seriesKey === FLASH_SERIES_KEY) continue;
      const current = values.get(`${event.seriesKey}:${event.referencePeriod || ""}`);
      const previousPeriod = current
        ? new Date(Date.UTC(Number(current.periodStart.slice(0, 4)), Number(current.periodStart.slice(5, 7)) - 2, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
        : null;
      const previous = previousPeriod ? values.get(`${event.seriesKey}:${previousPeriod}`) : null;
      if (current && new Date(event.eventTime).getTime() <= Date.now()) event.actual = current.value;
      if (previous) event.previous = previous.value;
      event.rawPayload = {
        ...event.rawPayload,
        values_dataset_file: current?.sourceUrl || null,
        values_reference_period: event.referencePeriod,
        values_verified: Boolean(current || previous),
      };
    }
  } catch {
    // Calendar synchronization remains available if the optional numeric archives time out.
  }
  if (deduped.length === 0) throw new Error("European Commission returned no scheduled BCS releases.");
  return deduped;
}
