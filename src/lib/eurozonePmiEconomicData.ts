import type { EconomicSourceEvent } from "@/types/economic";

export const EUROZONE_PMI_SOURCE_NAME = "S&P Global / HCOB";
export const EUROZONE_PMI_RELEASE_CALENDAR_URL =
  "https://www.pmi.spglobal.com/Public/Release/ReleaseDates";
export const EUROZONE_PMI_RELEASES_URL =
  "https://www.pmi.spglobal.com/Public/Release/PressReleases";
export const EUROZONE_PMI_HCOB_URL = "https://www.hcob-bank.com/en/insights/pmi/";

// These are verified S&P Global Eurozone report pages. The publisher uses
// opaque IDs, so unknown releases intentionally fall back to the official
// release index instead of guessing a URL.
const VERIFIED_DIRECT_REPORTS: Record<string, string> = {
  "flash:2026-08-21": "https://www.pmi.spglobal.com/Public/Home/PressRelease/96fc596680084e9b86502a39ca84c6b8",
  "flash:2026-07-24": "https://www.pmi.spglobal.com/Public/Home/PressRelease/f3986e5bb316400da00a7873a87d0e82",
  "flash:2026-06-17": "https://www.pmi.spglobal.com/Public/Home/PressRelease/c18861ee69d745fca2faa37bca079211",
  "flash:2026-05-21": "https://www.pmi.spglobal.com/Public/Home/PressRelease/cfc7983038764cd0bf61ed86b6d27a52",
  "flash:2026-04-23": "https://www.pmi.spglobal.com/Public/Home/PressRelease/89d5df92554f42589275c1d9ddb5fde3",
  "final:2026-09-01": "https://www.pmi.spglobal.com/Public/Home/PressRelease/b0f45bd0a1fe40c484bd9e988e2aa430",
  "final:2026-07-09": "https://www.pmi.spglobal.com/Public/Home/PressRelease/6efbc02cd9b849e6aafcc6c3a9b703db",
  "final:2026-06-11": "https://www.pmi.spglobal.com/Public/Home/PressRelease/ee04639d3fa04104b6248a31a71ebd12",
  "final:2026-03-04": "https://www.pmi.spglobal.com/Public/Home/PressRelease/2fda0e818e2047f3b5f1bc7e982f7249",
  "final:2025-12-03": "https://www.pmi.spglobal.com/Public/Home/PressRelease/782bddb90d9a4258928bb1efe5b6a46e86d",
  "final:2026-09-03": "https://www.pmi.spglobal.com/Public/Home/PressRelease/0a3fb112708046bba18d27b555ce7ecb",
};

type PmiVariant = "flash" | "final";
type PmiSector = "manufacturing" | "services" | "composite";

const DEFINITIONS: Array<{
  seriesKey: string;
  sector: PmiSector;
  variant: PmiVariant;
  title: string;
  releaseRule: string;
}> = [
  {
    seriesKey: "eur-hcob-pmi-flash-manufacturing",
    sector: "manufacturing",
    variant: "flash",
    title: "Eurozone HCOB Flash Manufacturing PMI",
    releaseRule: "Official S&P Global calendar flash release date; standard timing is around the 23rd calendar day of the reference month, adjusted to the preceding weekday when necessary.",
  },
  {
    seriesKey: "eur-hcob-pmi-flash-services",
    sector: "services",
    variant: "flash",
    title: "Eurozone HCOB Flash Services PMI",
    releaseRule: "Official S&P Global calendar flash release date; standard timing is around the 23rd calendar day of the reference month, adjusted to the preceding weekday when necessary.",
  },
  {
    seriesKey: "eur-hcob-pmi-flash-composite",
    sector: "composite",
    variant: "flash",
    title: "Eurozone HCOB Flash Composite PMI",
    releaseRule: "Official S&P Global calendar flash release date; standard timing is around the 23rd calendar day of the reference month, adjusted to the preceding weekday when necessary.",
  },
  {
    seriesKey: "eur-hcob-pmi-final-manufacturing",
    sector: "manufacturing",
    variant: "final",
    title: "Eurozone HCOB Manufacturing PMI",
    releaseRule: "First working day of the month following the reference period, per the official S&P Global PMI calendar.",
  },
  {
    seriesKey: "eur-hcob-pmi-final-services",
    sector: "services",
    variant: "final",
    title: "Eurozone HCOB Services PMI",
    releaseRule: "Third working day of the month following the reference period, per the official S&P Global PMI calendar.",
  },
  {
    seriesKey: "eur-hcob-pmi-final-composite",
    sector: "composite",
    variant: "final",
    title: "Eurozone HCOB Composite PMI",
    releaseRule: "Third working day of the month following the reference period, per the official S&P Global PMI calendar.",
  },
];

function firstOrNthWeekday(year: number, month: number, occurrence: number): Date {
  let count = 0;
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1) break;
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    count += 1;
    if (count === occurrence) return date;
  }
  throw new Error(`Could not calculate PMI working day for ${year}-${month}.`);
}

function flashDate(year: number, month: number): Date {
  const date = new Date(Date.UTC(year, month - 1, 23));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  return date;
}

function referencePeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildEvent(definition: (typeof DEFINITIONS)[number], year: number, month: number): EconomicSourceEvent {
  const releaseDate = definition.variant === "flash"
    ? flashDate(year, month)
    : firstOrNthWeekday(year, month === 12 ? 1 : month + 1, definition.sector === "manufacturing" ? 1 : 3);
  const releaseYear = definition.variant === "flash" ? year : month === 12 ? year + 1 : year;
  const releaseTime = new Date(Date.UTC(releaseYear, releaseDate.getUTCMonth(), releaseDate.getUTCDate(), 8, 0));
  const released = releaseTime.getTime() <= Date.now();
  const directReportUrl = VERIFIED_DIRECT_REPORTS[`${definition.variant}:${releaseTime.toISOString().slice(0, 10)}`] || null;
  const externalId = `eurozone-pmi:${definition.variant}:${definition.sector}:${referencePeriod(year, month)}`;
  return {
    externalId,
    seriesKey: definition.seriesKey,
    title: definition.title,
    country: "Eurozone",
    currency: "EUR",
    eventTime: releaseTime.toISOString(),
    eventKind: "data",
    category: "Business Survey",
    referencePeriod: referencePeriod(year, month),
    sourceAgency: EUROZONE_PMI_SOURCE_NAME,
    sourceUrl: directReportUrl || (released ? EUROZONE_PMI_RELEASES_URL : EUROZONE_PMI_RELEASE_CALENDAR_URL),
    sourceEventId: externalId,
    sourcePublishedAt: released ? releaseTime.toISOString() : null,
    unit: "Index",
    releaseStatus: released ? "released" : "scheduled",
    rawPayload: {
      official_release_calendar_url: EUROZONE_PMI_RELEASE_CALENDAR_URL,
      official_releases_url: EUROZONE_PMI_RELEASES_URL,
      hcob_source_url: EUROZONE_PMI_HCOB_URL,
      sector: definition.sector,
      variant: definition.variant,
      release_rule: definition.releaseRule,
      release_time: "08:00 UTC",
      direct_report_url: directReportUrl,
      release_link_mode: directReportUrl ? "direct_official_eurozone_report" : released ? "official_release_index" : "official_release_calendar",
      values_not_synced: true,
      values_note: "S&P Global / HCOB PMI numeric data is treated as restricted. EdgeVault stores the separate release schedule and official publisher link only.",
      report_link_note: directReportUrl
        ? "Verified direct official S&P Global Eurozone report page for this release."
        : released
          ? "The release is published, but its opaque official report ID has not been verified; the official release index is used without guessing a URL."
          : "The official release calendar is used until publication.",
    },
  };
}

export async function fetchEurozonePmiCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const currentYear = new Date().getUTCFullYear();
  const events: EconomicSourceEvent[] = [];
  for (let year = currentYear - 1; year <= currentYear + 1; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      for (const definition of DEFINITIONS) events.push(buildEvent(definition, year, month));
    }
  }
  return events.filter((event) => {
    const timestamp = new Date(event.eventTime).getTime();
    return timestamp >= Date.now() - 365 * 86400000 && timestamp <= Date.now() + 18 * 30 * 86400000;
  });
}

export const EUROZONE_PMI_SERIES = DEFINITIONS;
