import type { EconomicSourceEvent } from "@/types/economic";

export const TREASURY_RELEASE_CALENDAR_URL =
  "https://api.fiscaldata.treasury.gov/services/calendar/release";
export const TREASURY_METADATA_URL =
  "https://api.fiscaldata.treasury.gov/services/dtg/metadata/";

const TREASURY_SOURCE_NAME = "U.S. Department of the Treasury";
const TREASURY_RELEASE_CALENDAR_PAGE =
  "https://fiscaldata.treasury.gov/release-calendar/";

type TreasuryRelease = {
  datasetId: string;
  date: string;
  time: string;
  released: string | boolean;
};

type TreasuryDataset = {
  dataset_id: string;
  title: string;
  dataset_path?: string;
};

type TreasurySeriesDefinition = {
  datasetId: string;
  seriesKey: string;
  title: string;
  category: string;
  impactScore: number;
};

export const TREASURY_SERIES = [
  {
    datasetId: "015-BFS-2014Q1-13",
    seriesKey: "us-treasury-monthly-statement",
    title: "Monthly Treasury Statement",
    category: "Fiscal Policy",
    impactScore: 70,
  },
  {
    datasetId: "015-BFS-2014Q1-03",
    seriesKey: "us-treasury-daily-statement",
    title: "Daily Treasury Statement",
    category: "Fiscal Policy",
    impactScore: 35,
  },
  {
    datasetId: "015-BFS-2014Q1-11",
    seriesKey: "us-treasury-monthly-public-debt",
    title: "Monthly Statement of Public Debt",
    category: "Fiscal Policy",
    impactScore: 40,
  },
  {
    datasetId: "015-BFS-2014Q3-065",
    seriesKey: "us-treasury-debt-to-the-penny",
    title: "Debt to the Penny",
    category: "Fiscal Policy",
    impactScore: 30,
  },
  {
    datasetId: "015-BFS-2014Q3-045",
    seriesKey: "us-treasury-securities-auctions",
    title: "Treasury Securities Auctions",
    category: "Financial Markets",
    impactScore: 55,
  },
] satisfies TreasurySeriesDefinition[];

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

function parseTreasuryDate(date: string, time: string): string | null {
  const dateParts = date.split("-").map(Number);
  const timeParts = time.split(":").map(Number);
  if (
    dateParts.length !== 3 ||
    timeParts.length < 2 ||
    dateParts.some((part) => !Number.isFinite(part)) ||
    timeParts.some((part) => !Number.isFinite(part))
  ) {
    return null;
  }

  return easternTimeToUtc(
    dateParts[0],
    dateParts[1],
    dateParts[2],
    timeParts[0],
    timeParts[1]
  );
}

function isReleased(value: string | boolean): boolean {
  return value === true || value === "true";
}

export async function fetchTreasuryCalendarEvents(): Promise<
  EconomicSourceEvent[]
> {
  const [releaseResponse, metadataResponse] = await Promise.all([
    fetch(TREASURY_RELEASE_CALENDAR_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "EdgeVault-Economic-Calendar/1.0",
      },
    }),
    fetch(TREASURY_METADATA_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "EdgeVault-Economic-Calendar/1.0",
      },
    }),
  ]);

  if (!releaseResponse.ok) {
    throw new Error(
      `Treasury release calendar failed with HTTP ${releaseResponse.status}.`
    );
  }
  if (!metadataResponse.ok) {
    throw new Error(
      `Treasury metadata failed with HTTP ${metadataResponse.status}.`
    );
  }

  const releases = (await releaseResponse.json()) as TreasuryRelease[];
  const metadata = (await metadataResponse.json()) as TreasuryDataset[];
  const metadataById = new Map(
    metadata.map((dataset) => [dataset.dataset_id, dataset])
  );
  const definitionsByDatasetId = new Map(
    TREASURY_SERIES.map((definition) => [definition.datasetId, definition])
  );

  const events: EconomicSourceEvent[] = [];
  const seen = new Set<string>();

  for (const release of releases) {
    const definition = definitionsByDatasetId.get(release.datasetId);
    if (!definition) continue;

    const eventTime = parseTreasuryDate(release.date, release.time);
    if (!eventTime) continue;

    const sourceEventId = `treasury:${release.datasetId}:${release.date}:${release.time}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const dataset = metadataById.get(release.datasetId);
    const sourceUrl = dataset?.dataset_path
      ? `https://fiscaldata.treasury.gov/datasets/${dataset.dataset_path}/`
      : TREASURY_RELEASE_CALENDAR_PAGE;

    events.push({
      externalId: sourceEventId,
      seriesKey: definition.seriesKey,
      title: definition.title,
      country: "United States",
      currency: "USD",
      eventTime,
      eventKind: "data",
      category: definition.category,
      referencePeriod: null,
      sourceAgency: TREASURY_SOURCE_NAME,
      sourceUrl,
      sourceEventId,
      sourcePublishedAt: isReleased(release.released) ? eventTime : null,
      releaseStatus: isReleased(release.released) ? "released" : "scheduled",
      rawPayload: {
        release_calendar_url: TREASURY_RELEASE_CALENDAR_URL,
        dataset_id: release.datasetId,
        dataset_title: dataset?.title || definition.title,
        release_date: release.date,
        release_time: release.time,
        released: release.released,
      },
    });
  }

  if (events.length === 0) {
    throw new Error("The Treasury release calendar returned no supported events.");
  }

  return events.sort(
    (left, right) =>
      new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime()
  );
}
