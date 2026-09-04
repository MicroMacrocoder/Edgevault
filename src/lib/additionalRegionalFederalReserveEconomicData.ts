import AdmZip from "adm-zip";
import type { EconomicSourceEvent } from "@/types/economic";

const SOURCE_NAME = "Federal Reserve Regional Surveys";

export const DALLAS_MANUFACTURING_URL =
  "https://www.dallasfed.org/research/surveys/tmos";
export const DALLAS_SERVICES_URL =
  "https://www.dallasfed.org/research/surveys/tssos";
export const RICHMOND_MANUFACTURING_URL =
  "https://www.richmondfed.org/region_communities/regional_data_analysis/business_surveys/manufacturing";
export const RICHMOND_MANUFACTURING_SCHEDULE_URL =
  "https://www.richmondfed.org/region_communities/regional_data_analysis/business_surveys/manufacturing/release_schedule";
export const KANSAS_CITY_MANUFACTURING_URL =
  "https://www.kansascityfed.org/surveys/manufacturing-survey/";
export const KANSAS_CITY_MANUFACTURING_SCHEDULE_URL =
  "https://www.kansascityfed.org/surveys/manufacturing-survey/manufacturing-survey-release-dates/";
export const SP_GLOBAL_US_MANUFACTURING_URL =
  "https://www.pmi.spglobal.com/Public/Release/ReleaseDates";
export const CHICAGO_BUSINESS_BAROMETER_URL =
  "https://chicago.ismworld.org/news-publications/reports/research-survey/";

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

type SurveyValues = {
  period: Date;
  releaseDate: Date;
  actual: number;
  previous: number | null;
  reportUrl: string;
  rawPayload: Record<string, unknown>;
};

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value: string, base: string): string {
  return new URL(value, base).toString();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Additional regional Fed request failed with HTTP ${response.status}: ${url}`);
  }
  return response.text();
}

async function fetchBinary(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*;q=0.1",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Additional regional Fed data request failed with HTTP ${response.status}: ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function monthIndex(value: string): number {
  const normalized = value.toLowerCase().replace(/\./g, "");
  return MONTHS.findIndex((month) => month.toLowerCase().startsWith(normalized.slice(0, 3)));
}

function dateFromParts(monthValue: string, dayValue: string, yearValue: string): Date | null {
  const month = monthIndex(monthValue);
  const date = new Date(Date.UTC(Number(yearValue), month, Number(dayValue)));
  return month >= 0 && date.getUTCMonth() === month ? date : null;
}

function firstBusinessDay(year: number, month: number): Date {
  const date = new Date(Date.UTC(year, month - 1, 1));
  while (
    date.getUTCDay() === 0 ||
    date.getUTCDay() === 6 ||
    (date.getUTCMonth() === 0 && date.getUTCDate() === 1)
  ) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

function lastBusinessDay(year: number, month: number): Date {
  const date = new Date(Date.UTC(year, month, 0));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date;
}

function localTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desired);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
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

function extractHref(html: string, pattern: RegExp, base: string): string | null {
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    if (pattern.test(match[1])) return absoluteUrl(match[1], base);
  }
  return null;
}

function extractHrefs(html: string, pattern: RegExp, base: string): string[] {
  return [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => pattern.test(href))
    .map((href) => absoluteUrl(href, base));
}

function reportPeriodFromDallasUrl(url: string): Date | null {
  const match = url.match(/\/(20\d{2})\/(\d{2})(\d{2})(?:\/|$)/);
  if (!match) return null;
  const month = Number(match[3]) - 1;
  const period = new Date(Date.UTC(Number(match[1]), month, 1));
  return period.getUTCMonth() === month ? period : null;
}

function firstReportDate(text: string): Date | null {
  const match = text.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+(\d{1,2}),\s*(20\d{2})/i
  );
  return match ? dateFromParts(match[1], match[2], match[3]) : null;
}

function parseDallasIndicator(text: string, label: string): { actual: number; previous: number | null } | null {
  const match = text.match(
    new RegExp(
      `${label}\\s*(?:\\|\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*(?:\\|\\s*)?(-?\\d+(?:\\.\\d+)?)\\s*(?:\\|\\s*)?[-+]?\\d+(?:\\.\\d+)?`,
      "i"
    )
  );
  if (!match) return null;
  return { actual: Number(match[1]), previous: Number(match[2]) };
}

function parseDallasNextRelease(text: string, fallbackYear: number): Date | null {
  const match = text.match(
    /Next release:\s*(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June|July|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,\s*(20\d{2}))?/i
  );
  if (!match) return null;
  return dateFromParts(match[1], match[2], match[3] || String(fallbackYear));
}

function periodAfter(period: Date): Date {
  return new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1));
}

function buildEvent(
  seriesKey: string,
  title: string,
  period: Date,
  releaseDate: Date,
  sourceUrl: string,
  timeZone: string,
  releaseHour: number,
  releaseMinute: number,
  actual: number | null,
  previous: number | null,
  status: "released" | "scheduled",
  rawPayload: Record<string, unknown>
): EconomicSourceEvent {
  const periodKey = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}`;
  const externalId = `${seriesKey}:${periodKey}`;
  return {
    externalId,
    seriesKey,
    title,
    country: "United States",
    currency: "USD",
    eventTime: localTimeToUtc(
      timeZone,
      releaseDate.getUTCFullYear(),
      releaseDate.getUTCMonth() + 1,
      releaseDate.getUTCDate(),
      releaseHour,
      releaseMinute
    ),
    eventKind: "data",
    category: "Business Survey",
    referencePeriod: `${MONTHS[period.getUTCMonth()]} ${period.getUTCFullYear()}`,
    sourceAgency: SOURCE_NAME,
    sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: status === "released" ? releaseDate.toISOString() : null,
    previous,
    actual,
    unit: "Index",
    releaseStatus: status,
    rawPayload,
  };
}

async function fetchDallasSurvey(options: {
  landingUrl: string;
  seriesKey: string;
  title: string;
  indicator: string;
}): Promise<EconomicSourceEvent[]> {
  const landingHtml = await fetchText(options.landingUrl);
  const reportCandidates = extractHrefs(
    landingHtml,
    new RegExp(`/research/surveys/${options.seriesKey.includes("services") ? "tssos" : "tmos"}/20\\d{2}/\\d{4}`),
    options.landingUrl
  );
  const reportUrl = reportCandidates
    .sort((left, right) => (reportPeriodFromDallasUrl(right)?.getTime() || 0) - (reportPeriodFromDallasUrl(left)?.getTime() || 0))[0];
  if (!reportUrl) throw new Error(`Dallas Fed did not expose the current report link for ${options.title}.`);

  const reportText = stripHtml(await fetchText(reportUrl));
  const period = reportPeriodFromDallasUrl(reportUrl);
  const releaseDate = firstReportDate(reportText);
  const values = parseDallasIndicator(reportText, options.indicator);
  if (!period || !releaseDate || !values) {
    throw new Error(`Dallas Fed report did not expose a complete ${options.title} release.`);
  }

  const events = [
    buildEvent(
      options.seriesKey,
      options.title,
      period,
      releaseDate,
      reportUrl,
      "America/Chicago",
      9,
      30,
      values.actual,
      values.previous,
      "released",
      {
        landing_page_url: options.landingUrl,
        values_source: "Official Dallas Fed report results table.",
        indicator: options.indicator,
      }
    ),
  ];

  const nextRelease = parseDallasNextRelease(reportText, releaseDate.getUTCFullYear());
  if (nextRelease && nextRelease.getTime() > Date.now()) {
    events.push(
      buildEvent(
        options.seriesKey,
        options.title,
        periodAfter(period),
        nextRelease,
        options.landingUrl,
        "America/Chicago",
        9,
        30,
        null,
        values.actual,
        "scheduled",
        {
          schedule_source_url: options.landingUrl,
          values_available_after_release: true,
          report_link_note: "The Dallas Fed current-report link is refreshed after release.",
        }
      )
    );
  }
  return events;
}

function parseRichmondValues(text: string): { actual: number; previous: number } | null {
  const match = text.match(
    /composite manufacturing index[\s\S]{0,180}?from\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i
  );
  if (!match) return null;
  return { previous: Number(match[1]), actual: Number(match[2]) };
}

function parseRichmondReportUrl(html: string): string {
  return (
    extractHref(html, /\/mfg_[^"']+\.pdf$/i, RICHMOND_MANUFACTURING_URL) ||
    RICHMOND_MANUFACTURING_URL
  );
}

async function fetchRichmondSurvey(): Promise<EconomicSourceEvent[]> {
  const [mainHtml, scheduleHtml] = await Promise.all([
    fetchText(RICHMOND_MANUFACTURING_URL),
    fetchText(RICHMOND_MANUFACTURING_SCHEDULE_URL),
  ]);
  const mainText = stripHtml(mainHtml);
  const releaseDate = firstReportDate(mainText);
  const values = parseRichmondValues(mainText);
  if (!releaseDate || !values) {
    throw new Error("Richmond Fed did not expose a complete current manufacturing release.");
  }

  const period = new Date(Date.UTC(releaseDate.getUTCFullYear(), releaseDate.getUTCMonth(), 1));
  const events = [
    buildEvent(
      "us-richmond-fed-manufacturing",
      "Richmond Fed Manufacturing Index",
      period,
      releaseDate,
      parseRichmondReportUrl(mainHtml),
      "America/New_York",
      10,
      0,
      values.actual,
      values.previous,
      "released",
      {
        report_page_url: RICHMOND_MANUFACTURING_URL,
        schedule_url: RICHMOND_MANUFACTURING_SCHEDULE_URL,
        values_source: "Official Richmond Fed release headline.",
      }
    ),
  ];

  const scheduleMatch = stripHtml(scheduleHtml).match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\s*\|\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday),?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(20\d{2})/i
  );
  if (scheduleMatch) {
    const nextRelease = dateFromParts(scheduleMatch[1], scheduleMatch[2], scheduleMatch[3]);
    if (nextRelease && nextRelease.getTime() > Date.now()) {
      events.push(
        buildEvent(
          "us-richmond-fed-manufacturing",
          "Richmond Fed Manufacturing Index",
          periodAfter(period),
          nextRelease,
          RICHMOND_MANUFACTURING_URL,
          "America/New_York",
          10,
          0,
          null,
          values.actual,
          "scheduled",
          {
            schedule_source_url: RICHMOND_MANUFACTURING_SCHEDULE_URL,
            values_available_after_release: true,
            report_link_note: "The Richmond Fed current report PDF is refreshed after release.",
          }
        )
      );
    }
  }
  return events;
}

function xmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function excelSerialDate(value: string): Date | null {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + number * 86_400_000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseKansasCityHistoricalXlsx(buffer: Buffer): { period: Date; actual: number; previous: number | null } | null {
  const zip = new AdmZip(buffer);
  const sharedEntry = zip.getEntry("xl/sharedStrings.xml");
  const sharedStrings = sharedEntry
    ? [...sharedEntry.getData().toString("utf-8").matchAll(/<si>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/si>/g)].map((match) => xmlDecode(match[1]))
    : [];
  const sheet = zip.getEntries().find((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.entryName));
  if (!sheet) return null;

  const xml = sheet.getData().toString("utf-8");
  const parsedRows: Array<{ rowNumber: number; cells: Map<number, string> }> = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1].match(/\br="(\d+)"/i)?.[1]);
    if (!Number.isFinite(rowNumber)) continue;
    const cells = new Map<number, string>();
    for (const cell of rowMatch[2].matchAll(/<c\b([^>]*?)(?:>([\s\S]*?)<\/c>|\s*\/>)/g)) {
      const attributes = cell[1] || "";
      const address = attributes.match(/\br="([A-Z]+)\d+"/i)?.[1];
      if (!address) continue;
      const column = address
        .split("")
        .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
      const raw = cell[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      const type = attributes.match(/\bt="([^"]+)"/i)?.[1];
      cells.set(column, type === "s" ? sharedStrings[Number(raw)] || "" : xmlDecode(raw));
    }
    parsedRows.push({ rowNumber, cells });
  }

  const compositeRowIndex = parsedRows.findIndex(({ cells }) =>
    [...cells.values()].some((value) => /^composite index$/i.test(value))
  );
  if (compositeRowIndex < 1) return null;

  const dateRow = [...parsedRows.slice(0, compositeRowIndex)]
    .reverse()
    .find(({ cells }) =>
      [...cells.values()].some((value) => {
        const number = Number(value);
        return Number.isFinite(number) && number > 30_000 && excelSerialDate(value) !== null;
      })
    )?.cells;
  const compositeRow = parsedRows[compositeRowIndex].cells;
  if (!dateRow) return null;
  const observations: Array<{ period: Date; value: number }> = [];
  for (const [column, dateValue] of dateRow.entries()) {
    if (column === 0) continue;
    const date = excelSerialDate(dateValue);
    const value = Number(compositeRow.get(column));
    if (!date || !Number.isFinite(value)) continue;
    observations.push({
      period: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
      value,
    });
  }
  const latest = observations[observations.length - 1];
  const previous = observations[observations.length - 2];
  return latest
    ? { period: latest.period, actual: latest.value, previous: previous?.value ?? null }
    : null;
}

function parseKansasCityReleaseDate(text: string): Date | null {
  const match = text.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(20\d{2})\s+(?:Manufacturing Survey|Survey Results)/i
  );
  return match ? dateFromParts(match[1], match[2], match[3]) : firstReportDate(text);
}

function parseKansasCityReportUrl(html: string): string | null {
  return extractHref(html, /(?:publicnow\.com\/view|manufacturing-survey\/[^"']+$)/i, KANSAS_CITY_MANUFACTURING_URL);
}

function parseKansasCityDataUrl(html: string): string | null {
  return extractHref(html, /\.xlsx(?:\?|$)/i, KANSAS_CITY_MANUFACTURING_URL);
}

function parseKansasCityNextRelease(text: string): Date | null {
  const currentYear = new Date().getUTCFullYear();
  const pattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June|July|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*\|\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday),?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June|July|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})/gi;
  for (const match of text.matchAll(pattern)) {
    const date = dateFromParts(match[1], match[2], String(currentYear));
    if (date && date.getTime() > Date.now()) return date;
  }
  return null;
}

async function fetchKansasCitySurvey(): Promise<EconomicSourceEvent[]> {
  const [landingHtml, scheduleHtml] = await Promise.all([
    fetchText(KANSAS_CITY_MANUFACTURING_URL),
    fetchText(KANSAS_CITY_MANUFACTURING_SCHEDULE_URL),
  ]);
  const landingText = stripHtml(landingHtml);
  const releaseDate = parseKansasCityReleaseDate(landingText);
  const reportUrl = parseKansasCityReportUrl(landingHtml);
  const dataUrl = parseKansasCityDataUrl(landingHtml);
  if (!releaseDate || !dataUrl) {
    throw new Error("Kansas City Fed did not expose an official release date and historical data link.");
  }
  const values = parseKansasCityHistoricalXlsx(await fetchBinary(dataUrl));
  if (!values) throw new Error("Kansas City Fed historical workbook did not expose a Composite Index series.");

  const events = [
    buildEvent(
      "us-kansas-city-fed-manufacturing",
      "Kansas City Fed Manufacturing Index",
      values.period,
      releaseDate,
      reportUrl || KANSAS_CITY_MANUFACTURING_URL,
      "America/Chicago",
      10,
      0,
      values.actual,
      values.previous,
      "released",
      {
        survey_page_url: KANSAS_CITY_MANUFACTURING_URL,
        historical_data_url: dataUrl,
        values_source: "Official Kansas City Fed historical monthly workbook.",
        report_url: reportUrl,
      }
    ),
  ];
  const nextRelease = parseKansasCityNextRelease(stripHtml(scheduleHtml));
  if (nextRelease && nextRelease.getTime() > Date.now()) {
    events.push(
      buildEvent(
        "us-kansas-city-fed-manufacturing",
        "Kansas City Fed Manufacturing Index",
        periodAfter(values.period),
        nextRelease,
        KANSAS_CITY_MANUFACTURING_URL,
        "America/Chicago",
        10,
        0,
        null,
        values.actual,
        "scheduled",
        {
          schedule_source_url: KANSAS_CITY_MANUFACTURING_SCHEDULE_URL,
          values_available_after_release: true,
          report_link_note: "The official Kansas City Fed report link is refreshed after release.",
        }
      )
    );
  }
  return events;
}

function buildLinkOnlyEvent(options: {
  seriesKey: string;
  title: string;
  sourceAgency: string;
  sourceUrl: string;
  releaseDate: Date;
  referencePeriod: Date;
  timeZone: string;
  releaseHour: number;
  releaseMinute: number;
  releaseRule: string;
}): EconomicSourceEvent {
  const periodKey = `${options.referencePeriod.getUTCFullYear()}-${String(
    options.referencePeriod.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  const externalId = `${options.seriesKey}:${periodKey}`;
  const eventTime = localTimeToUtc(
    options.timeZone,
    options.releaseDate.getUTCFullYear(),
    options.releaseDate.getUTCMonth() + 1,
    options.releaseDate.getUTCDate(),
    options.releaseHour,
    options.releaseMinute
  );
  const released = new Date(eventTime).getTime() <= Date.now();
  return {
    externalId,
    seriesKey: options.seriesKey,
    title: options.title,
    country: "United States",
    currency: "USD",
    eventTime,
    eventKind: "data",
    category: "Business Survey",
    referencePeriod: `${MONTHS[options.referencePeriod.getUTCMonth()]} ${options.referencePeriod.getUTCFullYear()}`,
    sourceAgency: options.sourceAgency,
    sourceUrl: options.sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: released ? eventTime : null,
    previous: null,
    actual: null,
    unit: "Index",
    releaseStatus: released ? "released" : "scheduled",
    rawPayload: {
      official_source_url: options.sourceUrl,
      release_rule: options.releaseRule,
      values_not_synced: true,
      values_note:
        "This connector stores the official release schedule and one-click source page only; the publisher does not provide an accessible public machine-readable value feed.",
      report_link_note:
        "The official source page is refreshed after release and is used for the released report.",
    },
  };
}

function buildSpGlobalEvents(year: number): EconomicSourceEvent[] {
  const events: EconomicSourceEvent[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const releaseDate = firstBusinessDay(year, month);
    const referencePeriod = new Date(Date.UTC(year, month - 2, 1));
    events.push(
      buildLinkOnlyEvent({
        seriesKey: "us-sp-global-manufacturing-pmi",
        title: "S&P Global Manufacturing PMI",
        sourceAgency: "S&P Global",
        sourceUrl: SP_GLOBAL_US_MANUFACTURING_URL,
        releaseDate,
        referencePeriod,
        timeZone: "America/New_York",
        releaseHour: 9,
        releaseMinute: 45,
        releaseRule: "First working day of each month at 13:45 UTC.",
      })
    );
  }
  return events;
}

function buildChicagoEvents(year: number): EconomicSourceEvent[] {
  const published2026ReleaseDays = [30, 27, 31, 30, 29, 30, 31, 28, 30, 30, 30, 30];
  const events: EconomicSourceEvent[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const releaseDate =
      year === 2026
        ? new Date(Date.UTC(year, month - 1, published2026ReleaseDays[month - 1]))
        : lastBusinessDay(year, month);
    const referencePeriod = new Date(Date.UTC(year, month - 1, 1));
    events.push(
      buildLinkOnlyEvent({
        seriesKey: "us-chicago-business-barometer",
        title: "Chicago PMI (Business Barometer)",
        sourceAgency: "ISM Chicago / MNI Indicators",
        sourceUrl: CHICAGO_BUSINESS_BAROMETER_URL,
        releaseDate,
        referencePeriod,
        timeZone: "America/New_York",
        releaseHour: 9,
        releaseMinute: 45,
        releaseRule: "Last working day of each month at 09:45 America/New_York.",
      })
    );
  }
  return events;
}

export async function fetchAdditionalRegionalFederalReserveCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const results = await Promise.allSettled([
    fetchDallasSurvey({
      landingUrl: DALLAS_MANUFACTURING_URL,
      seriesKey: "us-dallas-fed-manufacturing",
      title: "Dallas Fed Manufacturing Activity Index",
      indicator: "Production",
    }),
    fetchDallasSurvey({
      landingUrl: DALLAS_SERVICES_URL,
      seriesKey: "us-dallas-fed-services",
      title: "Dallas Fed Services Revenue Index",
      indicator: "Revenue",
    }),
    fetchRichmondSurvey(),
    fetchKansasCitySurvey(),
  ]);
  const events: EconomicSourceEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    } else {
      console.error("ADDITIONAL REGIONAL FED SOURCE WARNING:", result.reason);
    }
  }
  const year = new Date().getUTCFullYear();
  events.push(...buildSpGlobalEvents(year), ...buildChicagoEvents(year));
  if (events.length === 0) {
    throw new Error("No additional regional Federal Reserve survey data could be synchronized.");
  }
  return events;
}
