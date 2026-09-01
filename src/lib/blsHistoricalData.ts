export const BLS_PUBLIC_API_URL =
  "https://api.bls.gov/publicAPI/v2/timeseries/data/";

const BLS_SOURCE_SERIES_IDS = [
  "CES0000000001",
  "LNS14000000",
  "LNS11300000",
  "CES0500000003",
  "CUSR0000SA0",
  "CUUR0000SA0",
  "CUSR0000SA0L1E",
  "CUUR0000SA0L1E",
  "WPSFD4",
  "WPUFD4",
  "WPSFD49116",
  "JTS000000000000000JOL",
  "CIS1010000000000Q",
  "PRS85006092",
  "PRS85006112",
] as const;

type PeriodFrequency = "monthly" | "quarterly";

type BlsApiFootnote = {
  code?: string | null;
  text?: string | null;
};

type BlsApiDatum = {
  year: string;
  period: string;
  periodName?: string;
  value: string;
  footnotes?: Array<BlsApiFootnote | null>;
  latest?: string;
  [key: string]: unknown;
};

type BlsApiSeries = {
  seriesID: string;
  data: BlsApiDatum[];
};

type BlsApiResponse = {
  status?: string;
  message?: string[];
  Results?: {
    series?: BlsApiSeries[];
  };
};

type SourceObservation = {
  sourceSeriesId: string;
  frequency: PeriodFrequency;
  year: number;
  periodNumber: number;
  periodIndex: number;
  rawValue: number;
  rawDatum: BlsApiDatum;
  footnotes: BlsApiFootnote[];
};

export type EconomicSeriesObservationInput = {
  seriesKey: string;
  referencePeriod: string;
  periodStart: string;
  periodEnd: string;
  periodFrequency: PeriodFrequency;
  value: number;
  rawValue: number;
  unit: string;
  measurement: string;
  sourceSeriesId: string;
  sourceName: string;
  sourceUrl: string;
  sourcePayload: Record<string, unknown>;
  footnotes: BlsApiFootnote[];
  isPreliminary: boolean;
  isRevised: boolean;
};

type Transformation = "direct" | "change" | "mom" | "yoy";

type TargetSeriesDefinition = {
  seriesKey: string;
  sourceSeriesId: (typeof BLS_SOURCE_SERIES_IDS)[number];
  frequency: PeriodFrequency;
  unit: string;
  measurement: string;
  transformation: Transformation;
  multiplier?: number;
};

const TARGET_SERIES: TargetSeriesDefinition[] = [
  {
    seriesKey: "us-nonfarm-payrolls",
    sourceSeriesId: "CES0000000001",
    frequency: "monthly",
    unit: "jobs",
    measurement: "monthly_change",
    transformation: "change",
    multiplier: 1000,
  },
  {
    seriesKey: "us-unemployment-rate",
    sourceSeriesId: "LNS14000000",
    frequency: "monthly",
    unit: "%",
    measurement: "rate",
    transformation: "direct",
  },
  {
    seriesKey: "us-labour-force-participation",
    sourceSeriesId: "LNS11300000",
    frequency: "monthly",
    unit: "%",
    measurement: "rate",
    transformation: "direct",
  },
  {
    seriesKey: "us-average-hourly-earnings-mom",
    sourceSeriesId: "CES0500000003",
    frequency: "monthly",
    unit: "%",
    measurement: "month_over_month_percent_change",
    transformation: "mom",
  },
  {
    seriesKey: "us-average-hourly-earnings-yoy",
    sourceSeriesId: "CES0500000003",
    frequency: "monthly",
    unit: "%",
    measurement: "year_over_year_percent_change",
    transformation: "yoy",
  },
  {
    seriesKey: "us-cpi-mom",
    sourceSeriesId: "CUSR0000SA0",
    frequency: "monthly",
    unit: "%",
    measurement: "month_over_month_percent_change",
    transformation: "mom",
  },
  {
    seriesKey: "us-cpi-yoy",
    sourceSeriesId: "CUUR0000SA0",
    frequency: "monthly",
    unit: "%",
    measurement: "year_over_year_percent_change",
    transformation: "yoy",
  },
  {
    seriesKey: "us-core-cpi-mom",
    sourceSeriesId: "CUSR0000SA0L1E",
    frequency: "monthly",
    unit: "%",
    measurement: "month_over_month_percent_change",
    transformation: "mom",
  },
  {
    seriesKey: "us-core-cpi-yoy",
    sourceSeriesId: "CUUR0000SA0L1E",
    frequency: "monthly",
    unit: "%",
    measurement: "year_over_year_percent_change",
    transformation: "yoy",
  },
  {
    seriesKey: "us-ppi-mom",
    sourceSeriesId: "WPSFD4",
    frequency: "monthly",
    unit: "%",
    measurement: "month_over_month_percent_change",
    transformation: "mom",
  },
  {
    seriesKey: "us-ppi-yoy",
    sourceSeriesId: "WPUFD4",
    frequency: "monthly",
    unit: "%",
    measurement: "year_over_year_percent_change",
    transformation: "yoy",
  },
  {
    seriesKey: "us-core-ppi-mom",
    sourceSeriesId: "WPSFD49116",
    frequency: "monthly",
    unit: "%",
    measurement: "month_over_month_percent_change",
    transformation: "mom",
  },
  {
    seriesKey: "us-jolts-job-openings",
    sourceSeriesId: "JTS000000000000000JOL",
    frequency: "monthly",
    unit: "jobs",
    measurement: "level",
    transformation: "direct",
    multiplier: 1000,
  },
  {
    seriesKey: "us-employment-cost-index",
    sourceSeriesId: "CIS1010000000000Q",
    frequency: "quarterly",
    unit: "%",
    measurement: "quarter_over_quarter_percent_change",
    transformation: "direct",
  },
  {
    seriesKey: "us-nonfarm-productivity",
    sourceSeriesId: "PRS85006092",
    frequency: "quarterly",
    unit: "%",
    measurement: "quarter_over_quarter_annualized_percent_change",
    transformation: "direct",
  },
  {
    seriesKey: "us-unit-labour-costs",
    sourceSeriesId: "PRS85006112",
    frequency: "quarterly",
    unit: "%",
    measurement: "quarter_over_quarter_annualized_percent_change",
    transformation: "direct",
  },
];

const MONTH_NAMES = [
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
];

const QUARTER_NAMES = ["First", "Second", "Third", "Fourth"];

function roundValue(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function periodBoundaries(
  frequency: PeriodFrequency,
  year: number,
  periodNumber: number
) {
  if (frequency === "monthly") {
    const start = new Date(Date.UTC(year, periodNumber - 1, 1));
    const end = new Date(Date.UTC(year, periodNumber, 0));
    return {
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      referencePeriod: `${MONTH_NAMES[periodNumber - 1]} ${year}`,
    };
  }

  const startMonth = (periodNumber - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    referencePeriod: `${QUARTER_NAMES[periodNumber - 1]} Quarter ${year}`,
  };
}

function normalizeSourceSeries(series: BlsApiSeries): SourceObservation[] {
  const normalized: SourceObservation[] = [];

  for (const datum of series.data || []) {
    const monthly = datum.period.match(/^M(0[1-9]|1[0-2])$/);
    const quarterly = datum.period.match(/^Q0?([1-4])$/);
    if (!monthly && !quarterly) continue;

    const year = Number(datum.year);
    const rawValue = Number(datum.value.replace(/,/g, ""));
    if (!Number.isFinite(year) || !Number.isFinite(rawValue)) continue;

    const frequency: PeriodFrequency = monthly ? "monthly" : "quarterly";
    const periodNumber = Number(monthly?.[1] || quarterly?.[1]);
    const periodIndex =
      frequency === "monthly"
        ? year * 12 + periodNumber - 1
        : year * 4 + periodNumber - 1;

    normalized.push({
      sourceSeriesId: series.seriesID,
      frequency,
      year,
      periodNumber,
      periodIndex,
      rawValue,
      rawDatum: datum,
      footnotes: (datum.footnotes || []).filter(
        (footnote): footnote is BlsApiFootnote => Boolean(footnote)
      ),
    });
  }

  return normalized.sort((left, right) => left.periodIndex - right.periodIndex);
}

function transformedValue(
  definition: TargetSeriesDefinition,
  current: SourceObservation,
  observationsByPeriod: ReadonlyMap<number, SourceObservation>
): number | null {
  const multiplier = definition.multiplier || 1;
  if (definition.transformation === "direct") {
    return roundValue(current.rawValue * multiplier);
  }

  const comparisonOffset = definition.transformation === "yoy" ? 12 : 1;
  const previous = observationsByPeriod.get(current.periodIndex - comparisonOffset);
  if (!previous) return null;

  if (definition.transformation === "change") {
    return roundValue((current.rawValue - previous.rawValue) * multiplier, 0);
  }

  if (previous.rawValue === 0) return null;
  return roundValue(((current.rawValue / previous.rawValue) - 1) * 100);
}

function footnoteHas(observation: SourceObservation, pattern: RegExp): boolean {
  return observation.footnotes.some(
    (footnote) =>
      pattern.test(footnote.code || "") || pattern.test(footnote.text || "")
  );
}

export function deriveBlsEconomicObservations(
  apiSeries: BlsApiSeries[],
  startYear: number,
  endYear: number
): EconomicSeriesObservationInput[] {
  const sources = new Map(
    apiSeries.map((series) => [series.seriesID, normalizeSourceSeries(series)])
  );
  const output: EconomicSeriesObservationInput[] = [];

  for (const definition of TARGET_SERIES) {
    const source = sources.get(definition.sourceSeriesId) || [];
    const observationsByPeriod = new Map(
      source.map((observation) => [observation.periodIndex, observation])
    );

    for (const current of source) {
      if (
        current.frequency !== definition.frequency ||
        current.year < startYear ||
        current.year > endYear
      ) {
        continue;
      }

      const value = transformedValue(definition, current, observationsByPeriod);
      if (value === null) continue;

      const period = periodBoundaries(
        definition.frequency,
        current.year,
        current.periodNumber
      );

      output.push({
        seriesKey: definition.seriesKey,
        referencePeriod: period.referencePeriod,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        periodFrequency: definition.frequency,
        value,
        rawValue: current.rawValue,
        unit: definition.unit,
        measurement: definition.measurement,
        sourceSeriesId: definition.sourceSeriesId,
        sourceName: "U.S. Bureau of Labor Statistics",
        sourceUrl: `https://data.bls.gov/timeseries/${definition.sourceSeriesId}`,
        sourcePayload: {
          transformation: definition.transformation,
          multiplier: definition.multiplier || 1,
          bls_datum: current.rawDatum,
        },
        footnotes: current.footnotes,
        isPreliminary: footnoteHas(current, /^p$|\bpreliminary\b/i),
        isRevised: footnoteHas(current, /^r$|\brevised\b/i),
      });
    }
  }

  return output.sort((left, right) =>
    left.seriesKey === right.seriesKey
      ? left.periodStart.localeCompare(right.periodStart)
      : left.seriesKey.localeCompare(right.seriesKey)
  );
}

async function requestBlsSeries(
  registrationKey: string,
  startYear: number,
  endYear: number
): Promise<BlsApiSeries[]> {
  const response = await fetch(BLS_PUBLIC_API_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent":
        "EdgeVault-Economic-Calendar/1.0 (+https://edgevault-six.vercel.app)",
    },
    body: JSON.stringify({
      seriesid: BLS_SOURCE_SERIES_IDS,
      startyear: String(startYear),
      endyear: String(endYear),
      registrationkey: registrationKey,
      catalog: false,
      calculations: false,
      annualaverage: false,
      aspects: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`BLS data request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as BlsApiResponse;
  if (payload.status !== "REQUEST_SUCCEEDED") {
    throw new Error(
      `BLS data request failed: ${(payload.message || []).join(" ") || "Unknown API error."}`
    );
  }

  return payload.Results?.series || [];
}

export async function fetchBlsHistoricalObservations(options?: {
  startYear?: number;
  endYear?: number;
}): Promise<{
  observations: EconomicSeriesObservationInput[];
  sourceSeriesCount: number;
  startYear: number;
  endYear: number;
}> {
  const registrationKey = process.env.BLS_API_KEY?.trim();
  if (!registrationKey) throw new Error("Missing BLS_API_KEY.");

  const endYear = options?.endYear || new Date().getUTCFullYear();
  const startYear = options?.startYear || endYear - 19;
  if (endYear < startYear || endYear - startYear > 19) {
    throw new Error("A registered BLS request can cover at most 20 years.");
  }

  const [requestedRange, priorYear] = await Promise.all([
    requestBlsSeries(registrationKey, startYear, endYear),
    requestBlsSeries(registrationKey, startYear - 1, startYear - 1),
  ]);

  const combinedBySeries = new Map<string, BlsApiSeries>();
  for (const series of [...priorYear, ...requestedRange]) {
    const existing = combinedBySeries.get(series.seriesID);
    if (existing) existing.data.push(...series.data);
    else combinedBySeries.set(series.seriesID, { ...series, data: [...series.data] });
  }

  const combinedSeries = [...combinedBySeries.values()];
  const returnedSeriesIds = new Set(combinedSeries.map((series) => series.seriesID));
  const missingSeries = BLS_SOURCE_SERIES_IDS.filter(
    (seriesId) => !returnedSeriesIds.has(seriesId)
  );
  if (missingSeries.length > 0) {
    throw new Error(`BLS returned no data for: ${missingSeries.join(", ")}`);
  }

  return {
    observations: deriveBlsEconomicObservations(
      combinedSeries,
      startYear,
      endYear
    ),
    sourceSeriesCount: combinedSeries.length,
    startYear,
    endYear,
  };
}
