import type {
  EconomicReleaseStatus,
  EconomicSourceEvent,
} from "@/types/economic";

export const TREASURY_RELEASE_CALENDAR_URL =
  "https://api.fiscaldata.treasury.gov/services/calendar/release";
export const TREASURY_METADATA_URL =
  "https://api.fiscaldata.treasury.gov/services/dtg/metadata/";
export const TREASURY_AUCTIONS_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query";

const TREASURY_SOURCE_NAME = "U.S. Department of the Treasury";
const TREASURY_RELEASE_CALENDAR_PAGE =
  "https://fiscaldata.treasury.gov/release-calendar/";
const TREASURY_AUCTIONS_PAGE =
  "https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/";
const TREASURY_AUCTIONS_DATASET_ID = "015-BFS-2014Q3-045";
const TREASURY_AUCTIONS_SERIES_KEY = "us-treasury-securities-auctions";

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

type TreasuryAuctionRow = {
  record_date?: string;
  cusip?: string;
  security_type?: string;
  security_term?: string;
  auction_date?: string;
  announcemt_date?: string;
  closing_time_comp?: string;
  closing_time_noncomp?: string;
  high_yield?: string | null;
  high_discnt_rate?: string | null;
  high_investment_rate?: string | null;
  offering_amt?: string | null;
  bid_to_cover_ratio?: string | null;
  [key: string]: unknown;
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
    datasetId: TREASURY_AUCTIONS_DATASET_ID,
    seriesKey: TREASURY_AUCTIONS_SERIES_KEY,
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

function parseDate(value: unknown): [number, number, number] | null {
  if (typeof value !== "string") return null;
  const parts = value.split("-").map(Number);
  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isInteger(part) || part <= 0)
  ) {
    return null;
  }
  return [parts[0], parts[1], parts[2]];
}

function parseClock(value: unknown): [number, number] | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }

  return [hour, minute];
}

function parseTreasuryDateTime(
  date: unknown,
  time: unknown
): string | null {
  const dateParts = parseDate(date);
  const timeParts = parseClock(time);
  if (!dateParts || !timeParts) return null;

  return easternTimeToUtc(
    dateParts[0],
    dateParts[1],
    dateParts[2],
    timeParts[0],
    timeParts[1]
  );
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isReleased(value: string | boolean): boolean {
  return value === true || value === "true";
}

function auctionMetric(row: TreasuryAuctionRow): {
  value: number | null;
  label: string | null;
} {
  const securityType = (row.security_type || "").toLowerCase();
  if (securityType === "bill") {
    const discountRate = numeric(row.high_discnt_rate);
    if (discountRate !== null) {
      return { value: discountRate, label: "High Discount Rate" };
    }
  }

  const highYield = numeric(row.high_yield);
  if (highYield !== null) return { value: highYield, label: "High Yield" };

  const investmentRate = numeric(row.high_investment_rate);
  if (investmentRate !== null) {
    return { value: investmentRate, label: "High Investment Rate" };
  }

  const discountRate = numeric(row.high_discnt_rate);
  if (discountRate !== null) {
    return { value: discountRate, label: "High Discount Rate" };
  }

  return { value: null, label: null };
}

function auctionTitle(row: TreasuryAuctionRow): string {
  const term = row.security_term?.trim();
  const type = row.security_type?.trim();
  if (term && type) return `${term} ${type} Auction`;
  if (term) return `${term} Treasury Auction`;
  if (type) return `${type} Auction`;
  return "Treasury Securities Auction";
}

function auctionKey(row: TreasuryAuctionRow): string {
  return `${row.security_type || "unknown"}|${row.security_term || "unknown"}`.toLowerCase();
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Treasury API failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as T;
}

async function fetchTreasuryAuctionRows(): Promise<TreasuryAuctionRow[]> {
  const startYear = new Date().getUTCFullYear() - 5;
  const url = new URL(TREASURY_AUCTIONS_URL);
  url.searchParams.set("filter", `record_date:gte:${startYear}-01-01`);
  url.searchParams.set("format", "json");
  url.searchParams.set("page[size]", "10000");
  url.searchParams.set("sort", "record_date");

  const payload = await fetchJson<{ data?: TreasuryAuctionRow[] }>(url);
  if (!Array.isArray(payload.data)) {
    throw new Error("Treasury auction API returned an invalid data array.");
  }
  return payload.data;
}

function buildGenericReleaseEvents(
  releases: TreasuryRelease[],
  metadataById: Map<string, TreasuryDataset>,
  definitionsByDatasetId: Map<string, TreasurySeriesDefinition>
): EconomicSourceEvent[] {
  const events: EconomicSourceEvent[] = [];
  const seen = new Set<string>();

  for (const release of releases) {
    if (release.datasetId === TREASURY_AUCTIONS_DATASET_ID) continue;

    const definition = definitionsByDatasetId.get(release.datasetId);
    if (!definition) continue;

    const eventTime = parseTreasuryDateTime(release.date, release.time);
    if (!eventTime) continue;

    const sourceEventId = `treasury:${release.datasetId}:${release.date}:${release.time}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const dataset = metadataById.get(release.datasetId);
    const sourceUrl = dataset?.dataset_path
      ? `https://fiscaldata.treasury.gov/datasets/${dataset.dataset_path}/`
      : TREASURY_RELEASE_CALENDAR_PAGE;
    const released = isReleased(release.released);

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
      sourcePublishedAt: released ? eventTime : null,
      releaseStatus: released ? "released" : "scheduled",
      rawPayload: {
        release_calendar_url: TREASURY_RELEASE_CALENDAR_URL,
        dataset_id: release.datasetId,
        dataset_title: metadataById.get(release.datasetId)?.title || definition.title,
        release_date: release.date,
        release_time: release.time,
        released: release.released,
      },
    });
  }

  return events;
}

function buildAuctionEvents(rows: TreasuryAuctionRow[]): EconomicSourceEvent[] {
  const sortedRows = [...rows].sort((left, right) => {
    const leftDate = `${left.auction_date || ""}|${left.record_date || ""}`;
    const rightDate = `${right.auction_date || ""}|${right.record_date || ""}`;
    return leftDate.localeCompare(rightDate);
  });
  const previousByAuctionKey = new Map<string, number>();
  const events: EconomicSourceEvent[] = [];
  const seen = new Set<string>();

  for (const row of sortedRows) {
    const eventTime = parseTreasuryDateTime(
      row.auction_date,
      row.closing_time_comp || row.closing_time_noncomp
    );
    if (!eventTime) continue;

    const identity =
      row.cusip ||
      `${row.security_type || "unknown"}:${row.security_term || "unknown"}:${row.auction_date || "unknown"}:${row.record_date || "unknown"}`;
    const sourceEventId = `treasury-auction:${identity}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const metric = auctionMetric(row);
    const previous = previousByAuctionKey.get(auctionKey(row)) ?? null;
    const recordDate = parseDate(row.record_date);
    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    );
    const recordDateUtc = recordDate
      ? Date.UTC(recordDate[0], recordDate[1] - 1, recordDate[2])
      : Number.POSITIVE_INFINITY;
    const released = Boolean(
      metric.value !== null || recordDateUtc < todayUtc
    );
    const releaseStatus: EconomicReleaseStatus = released
      ? "released"
      : "scheduled";

    events.push({
      externalId: sourceEventId,
      seriesKey: TREASURY_AUCTIONS_SERIES_KEY,
      title: auctionTitle(row),
      country: "United States",
      currency: "USD",
      eventTime,
      eventKind: "data",
      category: "Financial Markets",
      referencePeriod: row.auction_date
        ? `Auction date ${row.auction_date}`
        : null,
      sourceAgency: TREASURY_SOURCE_NAME,
      sourceUrl: TREASURY_AUCTIONS_PAGE,
      sourceEventId,
      sourcePublishedAt:
        released && row.record_date
          ? `${row.record_date}T00:00:00.000Z`
          : null,
      forecast: null,
      previous,
      actual: released ? metric.value : null,
      unit: metric.value !== null ? "%" : null,
      releaseStatus,
      rawPayload: {
        treasury_auction_url: TREASURY_AUCTIONS_URL,
        record_date: row.record_date ?? null,
        cusip: row.cusip ?? null,
        security_type: row.security_type ?? null,
        security_term: row.security_term ?? null,
        auction_date: row.auction_date ?? null,
        announcement_date: row.announcemt_date ?? null,
        closing_time_competitive: row.closing_time_comp ?? null,
        closing_time_noncompetitive: row.closing_time_noncomp ?? null,
        result_metric: metric.label,
        high_yield: row.high_yield ?? null,
        high_discount_rate: row.high_discnt_rate ?? null,
        high_investment_rate: row.high_investment_rate ?? null,
        offering_amount: row.offering_amt ?? null,
        bid_to_cover_ratio: row.bid_to_cover_ratio ?? null,
        official_record: row,
      },
    });

    if (released && metric.value !== null) {
      previousByAuctionKey.set(auctionKey(row), metric.value);
    }
  }

  return events;
}

export async function fetchTreasuryCalendarEvents(): Promise<
  EconomicSourceEvent[]
> {
  const [releases, metadata, auctionRows] = await Promise.all([
    fetchJson<TreasuryRelease[]>(new URL(TREASURY_RELEASE_CALENDAR_URL)),
    fetchJson<TreasuryDataset[]>(new URL(TREASURY_METADATA_URL)),
    fetchTreasuryAuctionRows(),
  ]);

  const metadataById = new Map(
    metadata.map((dataset) => [dataset.dataset_id, dataset])
  );
  const definitionsByDatasetId = new Map(
    TREASURY_SERIES.map((definition) => [definition.datasetId, definition])
  );

  const events = [
    ...buildGenericReleaseEvents(
      releases,
      metadataById,
      definitionsByDatasetId
    ),
    ...buildAuctionEvents(auctionRows),
  ];

  if (events.length === 0) {
    throw new Error("The Treasury APIs returned no supported events.");
  }

  return events.sort(
    (left, right) =>
      new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime()
  );
}
