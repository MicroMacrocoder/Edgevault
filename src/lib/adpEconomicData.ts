import type { EconomicSourceEvent } from "@/types/economic";

export const ADP_REPORT_DATA_URL =
  "https://adpemploymentreport.com/ner_production.json";
export const ADP_REPORT_HOME_URL = "https://adpemploymentreport.com/";
const ADP_SOURCE_NAME = "ADP Research";

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

type AdpReport = {
  reportMonth?: string;
  reportYear?: string;
  reportDownloadLink?: string;
  reportPressReleaseLink?: string;
  reportOverview?: {
    title?: string;
    cards?: Array<{ metricValue?: string; metricDirection?: string }>;
  };
  futureReports?: Array<{ reportDate?: string }>;
  chartSections?: Array<{
    chartSubsections?: Array<{ jsonFile?: string }>;
  }>;
};

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const number = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function parseSignedMetric(
  value: string | null | undefined,
  direction: string | null | undefined
): number | null {
  const number = parseNumber(value);
  if (number === null) return null;
  return direction?.toLowerCase() === "down" ? -Math.abs(number) : number;
}

function easternTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
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
  return candidate.toISOString();
}

function parseDate(value: string): Date | null {
  const match = value.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!match) return null;
  const month = MONTHS.findIndex(
    (name) => name.toLowerCase() === match[1].toLowerCase()
  );
  if (month < 0) return null;
  const result = new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
  return result.getUTCMonth() === month ? result : null;
}

function monthIndex(month: string | undefined): number {
  return MONTHS.findIndex(
    (name) => name.toLowerCase() === (month || "").toLowerCase()
  );
}

function monthYearAfter(month: number, year: number, offset: number) {
  const date = new Date(Date.UTC(year, month + offset, 1));
  return { month: date.getUTCMonth(), year: date.getUTCFullYear() };
}

function releaseDateFromLink(link: string | undefined): Date | null {
  const match = link?.match(/\/us_ner\/(\d{4})(\d{2})(\d{2})\//);
  if (!match) return null;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) throw new Error(`ADP request failed with HTTP ${response.status}.`);
  return (await response.json()) as T;
}

async function fetchCsv(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) throw new Error(`ADP history request failed with HTTP ${response.status}.`);
  return response.text();
}

function parseNationalCsv(csv: string): Array<{ date: Date; value: number }> {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [dateValue, metricValue] = line.split(",");
      const date = new Date(`${dateValue}T00:00:00Z`);
      const value = Number(metricValue);
      return { date, value };
    })
    .filter(
      (row) =>
        Number.isFinite(row.date.getTime()) && Number.isFinite(row.value)
    );
}

function event(
  reportMonth: number,
  reportYear: number,
  eventTime: string,
  sourceUrl: string,
  status: "released" | "scheduled",
  actual: number | null,
  previous: number | null,
  rawPayload: Record<string, unknown>
): EconomicSourceEvent {
  const externalId = `adp:private-employment:${reportYear}-${String(
    reportMonth + 1
  ).padStart(2, "0")}`;
  return {
    externalId,
    seriesKey: "us-adp-private-employment",
    title: "ADP National Employment Report",
    country: "United States",
    currency: "USD",
    eventTime,
    eventKind: "data",
    category: "Labour",
    referencePeriod: `${MONTHS[reportMonth]} ${reportYear}`,
    sourceAgency: ADP_SOURCE_NAME,
    sourceUrl,
    sourceEventId: externalId,
    sourcePublishedAt: status === "released" ? eventTime : null,
    previous,
    actual,
    unit: "Jobs",
    releaseStatus: status,
    rawPayload,
  };
}

export async function fetchAdpCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const report = await fetchJson<AdpReport>(ADP_REPORT_DATA_URL);
  const reportMonth = monthIndex(report.reportMonth);
  const reportYear = Number(report.reportYear);
  if (reportMonth < 0 || !Number.isFinite(reportYear)) {
    throw new Error("ADP report did not expose a valid report month and year.");
  }

  const releaseDate = releaseDateFromLink(report.reportDownloadLink);
  const actual = parseSignedMetric(
    report.reportOverview?.cards?.[0]?.metricValue,
    report.reportOverview?.cards?.[0]?.metricDirection
  );
  if (!releaseDate || actual === null) {
    throw new Error("ADP report did not expose a current release date and value.");
  }

  let previous: number | null = null;
  const chartJsonUrl = report.chartSections?.[0]?.chartSubsections?.[0]?.jsonFile;
  if (chartJsonUrl) {
    const chart = await fetchJson<{ data?: { csvURL?: string } }>(chartJsonUrl);
    if (chart.data?.csvURL) {
      const rows = parseNationalCsv(await fetchCsv(chart.data.csvURL));
      const currentIndex = rows.findIndex(
        (row) =>
          row.date.getUTCFullYear() === reportYear &&
          row.date.getUTCMonth() === reportMonth
      );
      if (currentIndex > 0) {
        previous =
          currentIndex > 1
            ? rows[currentIndex - 1].value - rows[currentIndex - 2].value
            : null;
      }
    }
  }

  const events: EconomicSourceEvent[] = [
    event(
      reportMonth,
      reportYear,
      easternTimeToUtc(
        releaseDate.getUTCFullYear(),
        releaseDate.getUTCMonth() + 1,
        releaseDate.getUTCDate(),
        8,
        15
      ),
      report.reportPressReleaseLink || ADP_REPORT_HOME_URL,
      "released",
      actual,
      previous,
      {
        report_data_url: ADP_REPORT_DATA_URL,
        report_download_url: report.reportDownloadLink || null,
        report_press_release_url: report.reportPressReleaseLink || null,
        values_source: "ADP official report JSON and national history CSV.",
        previous_derived_from_history: previous !== null,
      }
    ),
  ];

  let nextReportOffset = 1;
  for (const future of report.futureReports || []) {
    if (!future.reportDate || future.reportDate.toLowerCase().includes("weekly")) {
      if (nextReportOffset > 1) break;
      continue;
    }
    const futureDate = future.reportDate ? parseDate(future.reportDate) : null;
    if (!futureDate) continue;
    const nextPeriod = monthYearAfter(reportMonth, reportYear, nextReportOffset);
    nextReportOffset += 1;
    const eventTime = easternTimeToUtc(
      futureDate.getUTCFullYear(),
      futureDate.getUTCMonth() + 1,
      futureDate.getUTCDate(),
      8,
      15
    );
    events.push(
      event(
        nextPeriod.month,
        nextPeriod.year,
        eventTime,
        ADP_REPORT_HOME_URL,
        "scheduled",
        null,
        nextReportOffset === 2 ? actual : null,
        {
          schedule_source_url: ADP_REPORT_HOME_URL,
          report_data_url: ADP_REPORT_DATA_URL,
          values_available_after_release: true,
          report_link_note:
            "The official report link is refreshed after release by the economic worker.",
        }
      )
    );
  }

  return events.sort(
    (left, right) =>
      new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime()
  );
}
