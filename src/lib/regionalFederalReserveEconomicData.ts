import type { EconomicSourceEvent } from "@/types/economic";

export const REGIONAL_FED_SOURCE_NAME = "Federal Reserve Regional Surveys";
export const NY_EMPIRE_URL =
  "https://www.newyorkfed.org/survey/empire/empiresurvey_overview.html";
export const NY_EMPIRE_CSV_URL =
  "https://www.newyorkfed.org/medialibrary/media/survey/empire/data/esms_seasonallyadjusted_allseries.csv";
export const PHILLY_MBOS_URL =
  "https://www.philadelphiafed.org/surveys-and-data/regional-economic-analysis/manufacturing-business-outlook-survey";
export const PHILLY_MBOS_CSV_URL =
  "https://www.philadelphiafed.org/-/media/FRBP/Assets/Surveys-And-Data/MBOS/Historical-Data/Diffusion-Indexes/bos_dif.csv?sc_lang=en";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function easternTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): string {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desired);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(candidate).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const correction = desired - observed;
    if (correction === 0) break;
    candidate = new Date(candidate.getTime() + correction);
  }
  return candidate.toISOString();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "text/csv,text/html;q=0.9,*/*;q=0.1", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) throw new Error(`Regional Fed request failed with HTTP ${response.status}.`);
  return response.text();
}

function parseCsv(csv: string): string[][] {
  return csv.split(/\r?\n/).filter(Boolean).map((line) => line.split(",").map((value) => value.trim()));
}

function latestCsvValues(csv: string, valueColumn: string): { period: Date; actual: number; previous: number | null } {
  const rows = parseCsv(csv);
  const headers = rows[0];
  const valueIndex = headers.findIndex((header) => header === valueColumn);
  if (valueIndex < 0) throw new Error(`Regional Fed CSV is missing ${valueColumn}.`);
  const values = rows.slice(1).map((row) => ({
    period: new Date(`${row[0]}T00:00:00Z`),
    value: Number(row[valueIndex]),
  })).filter((row) => Number.isFinite(row.period.getTime()) && Number.isFinite(row.value));
  const latest = values[values.length - 1];
  const prior = values[values.length - 2];
  if (!latest) throw new Error(`Regional Fed CSV has no ${valueColumn} observations.`);
  return { period: latest.period, actual: latest.value, previous: prior?.value ?? null };
}

function parseNyHeadline(html: string): { actual: number; previous: number | null } | null {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  const match = text.match(
    /(?:headline\s+)?general\s+business\s+conditions\s+index\s+(rose|fell|increased|decreased)\s+(?:by\s+)?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+points?\s+to\s+(\d+(?:\.\d+)?)/i
  );
  if (!match) return null;
  const direction = /(?:fell|decreased)/i.test(match[1]) ? -1 : 1;
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const magnitude = Number(match[2]) || words[match[2].toLowerCase()];
  const change = direction * magnitude;
  const actual = Number(match[3]);
  return { actual, previous: actual - change };
}

function latestPhillyValues(csv: string): { period: Date; actual: number; previous: number | null } {
  const rows = parseCsv(csv);
  const headers = rows[0];
  const valueIndex = headers.findIndex((header) => header === "GAC");
  if (valueIndex < 0) throw new Error("Philadelphia Fed CSV is missing GAC.");
  const values = rows.slice(1).map((row) => {
    const match = row[0].match(/^([A-Za-z]{3})-(\d{2})$/);
    const month = match ? MONTHS.findIndex((name) => name.slice(0, 3).toLowerCase() === match[1].toLowerCase()) : -1;
    const year = match ? 2000 + Number(match[2]) : NaN;
    return { period: new Date(Date.UTC(year, month, 1)), value: Number(row[valueIndex]) };
  }).filter((row) => row.period.getUTCMonth() >= 0 && Number.isFinite(row.value));
  const latest = values[values.length - 1];
  const prior = values[values.length - 2];
  if (!latest) throw new Error("Philadelphia Fed CSV has no GAC observations.");
  return { period: latest.period, actual: latest.value, previous: prior?.value ?? null };
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value: string, fallback: string): string {
  return new URL(value, fallback).toString();
}

function nySchedule(html: string): Map<number, number> {
  const scheduleTable = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .find((table) => /JAN/i.test(table) && /DEC/i.test(table) && /empire2026/i.test(table));
  const result = new Map<number, number>();
  if (!scheduleTable) return result;
  const rows = [...scheduleTable.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const monthMap = new Map([
    ["JAN", 0], ["FEB", 1], ["MAR", 2], ["APR", 3], ["MAY", 4], ["JUN", 5],
    ["JUL", 6], ["AUG", 7], ["SEP", 8], ["OCT", 9], ["NOV", 10], ["DEC", 11],
  ]);
  for (let index = 0; index < rows.length - 1; index += 1) {
    const months = [...rows[index].matchAll(/<div>\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*<\/div>/gi)]
      .map((match) => monthMap.get(match[1].toUpperCase()))
      .filter((month): month is number => month !== undefined);
    if (months.length === 0) continue;
    const days = [...rows[index + 1].matchAll(/<div>\s*(\d{1,2})(?=\s|&nbsp;|<a|<\/div>)/gi)]
      .map((match) => Number(match[1]));
    months.forEach((month, position) => {
      if (days[position]) result.set(month, days[position]);
    });
  }
  return result;
}

function nyReportUrl(html: string, period: Date): string {
  const year = period.getUTCFullYear();
  const month = String(period.getUTCMonth() + 1).padStart(2, "0");
  const pattern = new RegExp(`href=["']([^"']*${year}[_-]${month}[^"']*\\.pdf)["']`, "i");
  const match = html.match(pattern);
  return match ? absoluteUrl(match[1], NY_EMPIRE_URL) : NY_EMPIRE_URL;
}

function phillyReportUrl(html: string): string {
  const match = html.match(/sidebarData\.reportLink\s*=\s*["']([^"']+)["']/i);
  return match ? absoluteUrl(match[1], PHILLY_MBOS_URL) : PHILLY_MBOS_URL;
}

function thirdThursday(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (4 - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + 14));
}

function event(
  seriesKey: string,
  title: string,
  period: Date,
  releaseDate: Date,
  sourceUrl: string,
  actual: number | null,
  previous: number | null,
  status: "released" | "scheduled",
  rawPayload: Record<string, unknown>
): EconomicSourceEvent {
  const externalId = `${seriesKey}:${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    externalId,
    seriesKey,
    title,
    country: "United States",
    currency: "USD",
    eventTime: easternTimeToUtc(releaseDate.getUTCFullYear(), releaseDate.getUTCMonth() + 1, releaseDate.getUTCDate(), 8, 30),
    eventKind: "data",
    category: "Business Survey",
    referencePeriod: `${MONTHS[period.getUTCMonth()]} ${period.getUTCFullYear()}`,
    sourceAgency: REGIONAL_FED_SOURCE_NAME,
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

export async function fetchRegionalFederalReserveCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const [nyHtml, nyCsv, phillyHtml, phillyCsv] = await Promise.all([
    fetchText(NY_EMPIRE_URL), fetchText(NY_EMPIRE_CSV_URL),
    fetchText(PHILLY_MBOS_URL), fetchText(PHILLY_MBOS_CSV_URL),
  ]);
  const nyCsvValues = latestCsvValues(nyCsv, "GACDSA");
  const nyHeadline = parseNyHeadline(nyHtml);
  const ny = {
    period: nyCsvValues.period,
    actual: nyHeadline?.actual ?? nyCsvValues.actual,
    previous: nyHeadline?.previous ?? nyCsvValues.previous,
  };
  const philly = latestPhillyValues(phillyCsv);
  const now = new Date();
  const events: EconomicSourceEvent[] = [];
  const nyReleaseDays = nySchedule(nyHtml);
  const nyReleaseDay = nyReleaseDays.get(ny.period.getUTCMonth());
  if (!nyReleaseDay) throw new Error("New York Fed page did not expose the official release day.");
  const nyReportLink = nyReportUrl(nyHtml, ny.period);
  const nyReleaseDate = new Date(Date.UTC(ny.period.getUTCFullYear(), ny.period.getUTCMonth(), nyReleaseDay));
  events.push(event("us-ny-empire-state-manufacturing", "NY Empire State Manufacturing Index", new Date(Date.UTC(ny.period.getUTCFullYear(), ny.period.getUTCMonth(), 1)), nyReleaseDate, nyReportLink, ny.actual, ny.previous, "released", { report_page_url: NY_EMPIRE_URL, data_csv_url: NY_EMPIRE_CSV_URL, values_source: nyHeadline ? "Official New York Fed report page headline." : "Official New York Fed seasonally adjusted CSV." }));
  const phillyReleaseDate = thirdThursday(philly.period.getUTCFullYear(), philly.period.getUTCMonth() + 1);
  const phillyReport = phillyReportUrl(phillyHtml);
  events.push(event("us-philadelphia-fed-manufacturing", "Philadelphia Fed Manufacturing Index", philly.period, phillyReleaseDate, phillyReport, philly.actual, philly.previous, "released", { report_page_url: PHILLY_MBOS_URL, data_csv_url: PHILLY_MBOS_CSV_URL, values_source: "Official Philadelphia Fed diffusion-index CSV." }));
  const nextNyPeriod = new Date(Date.UTC(ny.period.getUTCFullYear(), ny.period.getUTCMonth() + 1, 1));
  const nextNyReleaseDay = nyReleaseDays.get(nextNyPeriod.getUTCMonth());
  const nextNyRelease = nextNyReleaseDay ? new Date(Date.UTC(nextNyPeriod.getUTCFullYear(), nextNyPeriod.getUTCMonth(), nextNyReleaseDay)) : null;
  if (nextNyRelease && nextNyRelease.getTime() > now.getTime()) events.push(event("us-ny-empire-state-manufacturing", "NY Empire State Manufacturing Index", nextNyPeriod, nextNyRelease, NY_EMPIRE_URL, null, ny.actual, "scheduled", { schedule_source_url: NY_EMPIRE_URL, values_available_after_release: true, report_link_note: "The official report PDF is refreshed after release." }));
  const nextPhillyPeriod = new Date(Date.UTC(philly.period.getUTCFullYear(), philly.period.getUTCMonth() + 1, 1));
  const nextPhillyRelease = thirdThursday(nextPhillyPeriod.getUTCFullYear(), nextPhillyPeriod.getUTCMonth() + 1);
  if (nextPhillyRelease.getTime() > now.getTime()) events.push(event("us-philadelphia-fed-manufacturing", "Philadelphia Fed Manufacturing Index", nextPhillyPeriod, nextPhillyRelease, PHILLY_MBOS_URL, null, philly.actual, "scheduled", { schedule_source_url: PHILLY_MBOS_URL, values_available_after_release: true, report_link_note: "The official report page and CSV are refreshed after release." }));
  return events.sort((left, right) => new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime());
}
