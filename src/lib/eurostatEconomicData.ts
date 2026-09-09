import type { EconomicSourceEvent } from "@/types/economic";

export const EUROSTAT_RELEASE_CALENDAR_URL =
  "https://ec.europa.eu/eurostat/news/release-calendar";
export const EUROSTAT_EVENTS_URL =
  "https://ec.europa.eu/eurostat/o/calendars/eventsJson";

const EUROSTAT_SOURCE_NAME = "Eurostat";
const EUROSTAT_DATA_BROWSER_URL =
  "https://ec.europa.eu/eurostat/databrowser/view";

type EurostatCalendarRow = {
  recordid?: string;
  start?: string;
  title?: string;
  period?: string;
  datasetCodes?: string;
  euroind?: boolean;
  euroindAuthor?: string;
  theme?: string;
};

type ReleaseMapping = {
  match: (title: string) => boolean;
  releases: Array<{
    seriesKey: string;
    title: string;
    category: string;
    unit: string;
    datasetCode?: string;
  }>;
};

type ValuePeriodKind = "month" | "quarter";

type ValueConfig = {
  datasetCode: string;
  periodKind: ValuePeriodKind;
  query: Record<string, string>;
};

const EUROSTAT_CALENDAR_ONLY_SERIES_KEY = "eur-eurostat-calendar-only";

type JsonStatDataset = {
  id?: string[];
  size?: number[];
  dimension?: Record<string, {
    category?: { index?: Record<string, number> };
  }>;
  value?: Record<string, number>;
};

const RELEASE_MAPPINGS: ReleaseMapping[] = [
  {
    match: (title) => /^flash estimate inflation euro area/i.test(title),
    releases: [
      { seriesKey: "eur-flash-hicp-yoy", title: "Euro Area Flash CPI YoY", category: "Inflation", unit: "%", datasetCode: "prc_hicp_minr" },
      { seriesKey: "eur-flash-hicp-mom", title: "Euro Area Flash CPI MoM", category: "Inflation", unit: "%", datasetCode: "prc_hicp_minr" },
    ],
  },
  {
    match: (title) => /^inflation \(hicp\)/i.test(title),
    releases: [
      { seriesKey: "eur-hicp-yoy", title: "Euro Area CPI YoY", category: "Inflation", unit: "%", datasetCode: "prc_hicp_minr" },
      { seriesKey: "eur-hicp-mom", title: "Euro Area CPI MoM", category: "Inflation", unit: "%", datasetCode: "prc_hicp_minr" },
    ],
  },
  {
    match: (title) => /^gdp main aggregates and employment/i.test(title),
    releases: [
      { seriesKey: "eur-gdp-qoq", title: "Euro Area GDP QoQ", category: "Growth", unit: "%", datasetCode: "namq_10_gdp" },
      { seriesKey: "eur-employment-change-qoq", title: "Euro Area Employment Change QoQ", category: "Labour", unit: "%", datasetCode: "namq_10_a10_e" },
    ],
  },
  { match: (title) => /^unemployment /i.test(title), releases: [{ seriesKey: "eur-unemployment-rate", title: "Euro Area Unemployment Rate", category: "Labour", unit: "%", datasetCode: "une_rt_m" }] },
  { match: (title) => /^industrial production /i.test(title), releases: [{ seriesKey: "eur-industrial-production-mom", title: "Euro Area Industrial Production MoM", category: "Production", unit: "%", datasetCode: "sts_inpr_m" }] },
  { match: (title) => /^retail trade/i.test(title), releases: [{ seriesKey: "eur-retail-sales-mom", title: "Euro Area Retail Sales MoM", category: "Consumption", unit: "%", datasetCode: "sts_trtu_m" }] },
  { match: (title) => /^industrial producer prices/i.test(title), releases: [{ seriesKey: "eur-ppi-mom", title: "Euro Area PPI MoM", category: "Inflation", unit: "%", datasetCode: "sts_inppd_m" }] },
  { match: (title) => /^international trade in goods/i.test(title), releases: [{ seriesKey: "eur-trade-balance", title: "Euro Area Trade Balance", category: "Trade", unit: "EUR million", datasetCode: "ext_st_27_2020msbec" }] },
  { match: (title) => /^balance of payments/i.test(title), releases: [{ seriesKey: "eur-current-account", title: "Euro Area Current Account", category: "Trade", unit: "EUR million", datasetCode: "bop_c6_q" }] },
  { match: (title) => /^production in construction/i.test(title), releases: [{ seriesKey: "eur-construction-output-mom", title: "Euro Area Construction Output MoM", category: "Construction", unit: "%", datasetCode: "sts_copr_m" }] },
  { match: (title) => /^labour cost index/i.test(title), releases: [{ seriesKey: "eur-labour-cost-yoy", title: "Euro Area Labour Cost YoY", category: "Labour", unit: "%", datasetCode: "lc_lci_r2_q" }] },
  { match: (title) => /^job vacancy/i.test(title), releases: [{ seriesKey: "eur-job-vacancy-rate", title: "Euro Area Job Vacancy Rate", category: "Labour", unit: "%", datasetCode: "jvs_q_nace2" }] },
  { match: (title) => /^house price index/i.test(title), releases: [{ seriesKey: "eur-house-price-index", title: "Euro Area House Price Index", category: "Housing", unit: "Index", datasetCode: "prc_hpi_q" }] },
  { match: (title) => /^services production/i.test(title), releases: [{ seriesKey: "eur-services-production", title: "Euro Area Services Production", category: "Production", unit: "%", datasetCode: "sts_sepr_m" }] },
  { match: (title) => /^building permits/i.test(title), releases: [{ seriesKey: "eur-building-permits", title: "Euro Area Building Permits", category: "Housing", unit: "Index", datasetCode: "sts_cobp_m" }] },
  { match: (title) => /^interest rates \(3 months\)/i.test(title), releases: [{ seriesKey: "eur-three-month-interest-rate", title: "Euro Area 3-Month Interest Rate", category: "Interest Rates", unit: "%", datasetCode: "irt_st_m" }] },
  { match: (title) => /^long term government bond yield/i.test(title), releases: [{ seriesKey: "eur-long-term-government-bond-yield", title: "Euro Area Long-Term Government Bond Yield", category: "Interest Rates", unit: "%", datasetCode: "irt_lt_mcby_m" }] },
];

const VALUE_CONFIGS: Record<string, ValueConfig> = {
  "eur-flash-hicp-yoy": { datasetCode: "prc_hicp_minr", periodKind: "month", query: { unit: "RCH_A", coicop18: "TOTAL" } },
  "eur-flash-hicp-mom": { datasetCode: "prc_hicp_minr", periodKind: "month", query: { unit: "RCH_M", coicop18: "TOTAL" } },
  "eur-hicp-yoy": { datasetCode: "prc_hicp_minr", periodKind: "month", query: { unit: "RCH_A", coicop18: "TOTAL" } },
  "eur-hicp-mom": { datasetCode: "prc_hicp_minr", periodKind: "month", query: { unit: "RCH_M", coicop18: "TOTAL" } },
  "eur-gdp-qoq": { datasetCode: "namq_10_gdp", periodKind: "quarter", query: { unit: "CLV_PCH_PRE", s_adj: "SCA", na_item: "B1GQ" } },
  "eur-employment-change-qoq": { datasetCode: "namq_10_a10_e", periodKind: "quarter", query: { unit: "PCH_PRE_PER", nace_r2: "TOTAL", s_adj: "SCA", na_item: "EMP_DC" } },
  "eur-unemployment-rate": { datasetCode: "une_rt_m", periodKind: "month", query: { s_adj: "SA", age: "TOTAL", unit: "PC_ACT", sex: "T" } },
  "eur-industrial-production-mom": { datasetCode: "sts_inpr_m", periodKind: "month", query: { indic_bt: "PRD", nace_r2: "B-D", s_adj: "SCA", unit: "PCH_PRE" } },
  "eur-retail-sales-mom": { datasetCode: "sts_trtu_m", periodKind: "month", query: { indic_bt: "VOL_SLS", nace_r2: "G47", s_adj: "SCA", unit: "PCH_PRE" } },
  "eur-ppi-mom": { datasetCode: "sts_inppd_m", periodKind: "month", query: { indic_bt: "PRC_PRR_DOM", nace_r2: "B-E36", s_adj: "NSA", unit: "PCH_PRE" } },
  "eur-construction-output-mom": { datasetCode: "sts_copr_m", periodKind: "month", query: { indic_bt: "PRD", nace_r2: "F", s_adj: "SCA", unit: "PCH_PRE" } },
  "eur-labour-cost-yoy": { datasetCode: "lc_lci_r2_q", periodKind: "quarter", query: { s_adj: "SCA", unit: "PCH_PRE", nace_r2: "B-S", lcstruct: "D1_D4_MD5" } },
  "eur-house-price-index": { datasetCode: "prc_hpi_q", periodKind: "quarter", query: { purchase: "TOTAL", unit: "RCH_Q" } },
  "eur-services-production": { datasetCode: "sts_sepr_m", periodKind: "month", query: { indic_bt: "PRD", nace_r2: "G-N_X_K", s_adj: "SCA", unit: "PCH_PRE" } },
  "eur-building-permits": { datasetCode: "sts_cobp_m", periodKind: "month", query: { indic_bt: "BPRM_DW", cpa2_1: "CPA_F41001", s_adj: "NSA", unit: "PCH_PRE" } },
  "eur-job-vacancy-rate": { datasetCode: "jvs_q_nace2", periodKind: "quarter", query: { s_adj: "NSA", nace_r2: "B-S", sizeclas: "TOTAL", indic_em: "JVR" } },
  "eur-three-month-interest-rate": { datasetCode: "irt_st_m", periodKind: "month", query: { geo: "EA", int_rt: "IRT_M3" } },
  "eur-long-term-government-bond-yield": { datasetCode: "irt_lt_mcby_m", periodKind: "month", query: { geo: "EA", int_rt: "MCBY" } },
};

function dataBrowserUrl(datasetCode?: string): string {
  return datasetCode
    ? `${EUROSTAT_DATA_BROWSER_URL}/${datasetCode}/default/table?lang=en`
    : EUROSTAT_RELEASE_CALENDAR_URL;
}

function periodCode(referencePeriod: string | null | undefined, kind: ValuePeriodKind): string | null {
  if (!referencePeriod) return null;
  if (kind === "quarter") {
    const match = referencePeriod.match(/Q([1-4])\s*[\/]\s*(20\d{2})/i);
    return match ? `${match[2]}-Q${match[1]}` : null;
  }
  const match = referencePeriod.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
  if (!match) return null;
  const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(match[1].toLowerCase()) + 1;
  return `${match[2]}-${String(month).padStart(2, "0")}`;
}

function previousPeriodCode(code: string, kind: ValuePeriodKind): string {
  if (kind === "quarter") {
    const [yearText, quarterText] = code.split("-Q");
    const year = Number(yearText);
    const quarter = Number(quarterText);
    return quarter === 1 ? `${year - 1}-Q4` : `${year}-Q${quarter - 1}`;
  }
  const [yearText, monthText] = code.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function decodeJsonStatValues(dataset: JsonStatDataset): Map<string, number> {
  const result = new Map<string, number>();
  const ids = dataset.id || [];
  const sizes = dataset.size || [];
  const timeIndex = ids.indexOf("time");
  if (timeIndex < 0 || !dataset.value) return result;
  const timeCategories = dataset.dimension?.time?.category?.index || {};
  const orderedTimes = Object.entries(timeCategories).sort(([, a], [, b]) => a - b);
  for (const [timeCode, timePosition] of orderedTimes) {
    let flatIndex = 0;
    let multiplier = 1;
    for (let index = sizes.length - 1; index >= 0; index -= 1) {
      const coordinate = index === timeIndex ? timePosition : 0;
      flatIndex += coordinate * multiplier;
      multiplier *= sizes[index] || 1;
    }
    const value = dataset.value[String(flatIndex)];
    if (typeof value === "number" && Number.isFinite(value)) result.set(timeCode, value);
  }
  return result;
}

async function fetchValueSeries(config: ValueConfig): Promise<Map<string, number>> {
  const params = new URLSearchParams({
    geo: "EA21",
    sinceTimePeriod: config.periodKind === "month" ? "2024-01" : "2024-Q1",
    ...config.query,
  });
  const response = await fetch(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${config.datasetCode}?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Eurostat dataset ${config.datasetCode} failed with HTTP ${response.status}.`);
  return decodeJsonStatValues((await response.json()) as JsonStatDataset);
}

async function attachOfficialValues(events: EconomicSourceEvent[]): Promise<number> {
  const entries = Object.entries(VALUE_CONFIGS);
  const results = await Promise.allSettled(entries.map(([, config]) => fetchValueSeries(config)));
  const valuesBySeries = new Map<string, Map<string, number>>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled") valuesBySeries.set(entries[index][0], result.value);
  });
  let valueBackedEvents = 0;
  for (const event of events) {
    const config = VALUE_CONFIGS[event.seriesKey];
    const values = valuesBySeries.get(event.seriesKey);
    const currentCode = periodCode(event.referencePeriod, config?.periodKind || "month");
    if (!config || !values || !currentCode) continue;
    const actual = values.get(currentCode);
    const previous = values.get(previousPeriodCode(currentCode, config.periodKind));
    if (actual !== undefined && new Date(event.eventTime).getTime() <= Date.now()) event.actual = actual;
    if (previous !== undefined) event.previous = previous;
    if (actual !== undefined || previous !== undefined) valueBackedEvents += 1;
    event.rawPayload = {
      ...event.rawPayload,
      values_workflow: "official_eurostat_statistics_api",
      values_dataset_code: config.datasetCode,
      values_geo: "EA21",
      values_period: currentCode,
    };
  }
  return valueBackedEvents;
}

function parseRows(payload: unknown): EurostatCalendarRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter((row): row is EurostatCalendarRow => Boolean(row && typeof row === "object"));
}

function firstDatasetCode(datasetCodes: string | undefined): string | undefined {
  return datasetCodes
    ?.split(",")
    .map((code) => code.trim())
    .find(Boolean);
}

function calendarWindow(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function fetchEurostatCalendarEvents(): Promise<EconomicSourceEvent[]> {
  const { start, end } = calendarWindow();
  const params = new URLSearchParams({
    start,
    end,
    theme: "",
    category: "",
    keywords: "",
    isEuroindicator: "",
    authorInclude: "",
    authorExclude: "",
  });
  const response = await fetch(`${EUROSTAT_EVENTS_URL}?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) throw new Error(`Eurostat release calendar failed with HTTP ${response.status}.`);

  const events: EconomicSourceEvent[] = [];
  for (const row of parseRows(await response.json())) {
    if (row.euroindAuthor !== "estat" || !row.recordid || !row.start || !row.title) continue;
    const mapping = RELEASE_MAPPINGS.find((candidate) => candidate.match(row.title!));
    const eventTime = new Date(row.start).toISOString();
    const releases = mapping?.releases || [{
      seriesKey: EUROSTAT_CALENDAR_ONLY_SERIES_KEY,
      title: row.title,
      category: row.theme || "Eurostat",
      unit: "",
      datasetCode: firstDatasetCode(row.datasetCodes),
    }];
    for (const release of releases) {
      const externalId = `eurostat:${row.recordid}:${release.seriesKey}`;
      const sourceEventId = `${row.recordid}:${release.seriesKey}`;
      const released = new Date(eventTime).getTime() <= Date.now();
      events.push({
        externalId,
        seriesKey: release.seriesKey,
        title: release.title,
        country: "Euro Area",
        currency: "EUR",
        eventTime,
        eventKind: "data",
        category: release.category,
        referencePeriod: row.period || null,
        sourceAgency: EUROSTAT_SOURCE_NAME,
        sourceUrl: dataBrowserUrl(release.datasetCode),
        sourceEventId,
        sourcePublishedAt: released ? eventTime : null,
        unit: release.unit,
        releaseStatus: released ? "released" : "scheduled",
        rawPayload: {
          eurostat_record_id: row.recordid,
          eurostat_title: row.title,
          eurostat_period: row.period || null,
          eurostat_theme: row.theme || null,
          eurostat_dataset_codes: row.datasetCodes || null,
          release_calendar_url: EUROSTAT_RELEASE_CALENDAR_URL,
          dataset_code: release.datasetCode || null,
          values_workflow: mapping ? "official_eurostat_statistics_api" : "calendar_only",
          values_not_synced: !mapping,
          calendar_only_reason: mapping ? null : "unmapped_eurostat_release",
        },
      });
    }
  }
  if (events.length === 0) throw new Error("Eurostat returned no supported euro-area releases.");
  await attachOfficialValues(events);
  return events;
}
