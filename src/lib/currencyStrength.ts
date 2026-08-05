export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_STRENGTH_TIMEFRAMES = [
  "M1",
  "M5",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
  "W1",
] as const;

export type CurrencyStrengthTimeframe =
  (typeof CURRENCY_STRENGTH_TIMEFRAMES)[number];

export const TWELVE_DATA_INTERVALS: Record<
  CurrencyStrengthTimeframe,
  string
> = {
  M1: "1min",
  M5: "5min",
  M15: "15min",
  M30: "30min",
  H1: "1h",
  H4: "4h",
  D1: "1day",
  W1: "1week",
};

export const FOREX_PAIRS = [
  "AUD/CAD",
  "AUD/CHF",
  "AUD/JPY",
  "AUD/NZD",
  "AUD/USD",
  "CAD/CHF",
  "CAD/JPY",
  "CHF/JPY",
  "EUR/AUD",
  "EUR/CAD",
  "EUR/CHF",
  "EUR/GBP",
  "EUR/JPY",
  "EUR/NZD",
  "EUR/USD",
  "GBP/AUD",
  "GBP/CAD",
  "GBP/CHF",
  "GBP/JPY",
  "GBP/NZD",
  "GBP/USD",
  "NZD/CAD",
  "NZD/CHF",
  "NZD/JPY",
  "NZD/USD",
  "USD/CAD",
  "USD/CHF",
  "USD/JPY",
] as const;

export type ForexPair = (typeof FOREX_PAIRS)[number];

export type ForexCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type PairStrengthResult = {
  pair: ForexPair;
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  rawReturn: number;
  volatility: number;
  normalizedScore: number;
  candleCount: number;
};

export type CurrencyStrengthReading = {
  currency: CurrencyCode;
  rawScore: number;
  percentage: number;
  rank: number;
  relationshipCount: number;
  missingRelationshipCount: number;
};

export type SkippedPair = {
  pair: ForexPair;
  reason: string;
};

export type CurrencyStrengthCalculation = {
  readings: CurrencyStrengthReading[];
  pairResults: PairStrengthResult[];
  skippedPairs: SkippedPair[];
  requestedPairCount: number;
  usedPairCount: number;
  isComplete: boolean;
  options: Required<CurrencyStrengthOptions>;
};

export type CurrencyStrengthOptions = {
  lookbackCandles?: number;
  volatilityWindow?: number;
  minimumVolatilitySamples?: number;
  pairScoreCap?: number;
  percentageSteepness?: number;
};

const DEFAULT_OPTIONS: Required<CurrencyStrengthOptions> = {
  lookbackCandles: 5,
  volatilityWindow: 50,
  minimumVolatilitySamples: 20,
  pairScoreCap: 3,
  percentageSteepness: 1.25,
};

const EXPECTED_RELATIONSHIPS_PER_CURRENCY = CURRENCIES.length - 1;
const MINIMUM_POSITIVE_PRICE = 1e-12;
const MINIMUM_VOLATILITY = 1e-10;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizePairSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z]/g, "");
}

function parsePair(pair: ForexPair) {
  const [baseCurrency, quoteCurrency] = pair.split("/") as [
    CurrencyCode,
    CurrencyCode,
  ];

  return {
    baseCurrency,
    quoteCurrency,
  };
}

function populationStandardDeviation(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const mean =
    values.reduce((total, value) => total + value, 0) / values.length;

  const variance =
    values.reduce((total, value) => {
      const difference = value - mean;
      return total + difference * difference;
    }, 0) / values.length;

  return Math.sqrt(variance);
}

function prepareCandles(candles: readonly ForexCandle[]) {
  const byDatetime = new Map<string, ForexCandle>();

  for (const candle of candles) {
    if (
      !candle.datetime ||
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close) ||
      candle.open <= MINIMUM_POSITIVE_PRICE ||
      candle.high <= MINIMUM_POSITIVE_PRICE ||
      candle.low <= MINIMUM_POSITIVE_PRICE ||
      candle.close <= MINIMUM_POSITIVE_PRICE
    ) {
      continue;
    }

    byDatetime.set(candle.datetime, candle);
  }

  return [...byDatetime.values()].sort((first, second) =>
    first.datetime.localeCompare(second.datetime),
  );
}

function calculatePairStrength(
  pair: ForexPair,
  candles: readonly ForexCandle[],
  options: Required<CurrencyStrengthOptions>,
): PairStrengthResult | SkippedPair {
  const preparedCandles = prepareCandles(candles);
  const minimumRequiredCandles = Math.max(
    options.lookbackCandles + 1,
    options.minimumVolatilitySamples + 1,
  );

  if (preparedCandles.length < minimumRequiredCandles) {
    return {
      pair,
      reason: `Not enough completed candles. Required at least ${minimumRequiredCandles}, received ${preparedCandles.length}.`,
    };
  }

  const closes = preparedCandles.map((candle) => candle.close);
  const singleCandleReturns: number[] = [];

  for (let index = 1; index < closes.length; index += 1) {
    singleCandleReturns.push(Math.log(closes[index] / closes[index - 1]));
  }

  const volatilityReturns = singleCandleReturns.slice(
    -options.volatilityWindow,
  );

  if (volatilityReturns.length < options.minimumVolatilitySamples) {
    return {
      pair,
      reason: `Not enough volatility samples. Required at least ${options.minimumVolatilitySamples}, received ${volatilityReturns.length}.`,
    };
  }

  const volatility = populationStandardDeviation(volatilityReturns);

  if (!Number.isFinite(volatility) || volatility <= MINIMUM_VOLATILITY) {
    return {
      pair,
      reason: "Volatility is zero or invalid.",
    };
  }

  const latestClose = closes[closes.length - 1];
  const startingClose = closes[closes.length - 1 - options.lookbackCandles];
  const rawReturn = Math.log(latestClose / startingClose);

  const normalizedScore = clamp(
    rawReturn /
      (volatility * Math.sqrt(options.lookbackCandles)),
    -options.pairScoreCap,
    options.pairScoreCap,
  );

  const { baseCurrency, quoteCurrency } = parsePair(pair);

  return {
    pair,
    baseCurrency,
    quoteCurrency,
    rawReturn,
    volatility,
    normalizedScore,
    candleCount: preparedCandles.length,
  };
}

export function mapRawScoreToPercentage(
  rawScore: number,
  percentageSteepness = DEFAULT_OPTIONS.percentageSteepness,
) {
  if (!Number.isFinite(rawScore)) {
    return 50;
  }

  const percentage =
    100 / (1 + Math.exp(-percentageSteepness * rawScore));

  return Number(clamp(percentage, 0, 100).toFixed(2));
}

export function calculateCurrencyStrength(
  pairCandles: Record<string, readonly ForexCandle[]>,
  suppliedOptions: CurrencyStrengthOptions = {},
): CurrencyStrengthCalculation {
  const options: Required<CurrencyStrengthOptions> = {
    ...DEFAULT_OPTIONS,
    ...suppliedOptions,
  };

  if (!Number.isInteger(options.lookbackCandles) || options.lookbackCandles < 1) {
    throw new Error("lookbackCandles must be a positive whole number.");
  }

  if (!Number.isInteger(options.volatilityWindow) || options.volatilityWindow < 2) {
    throw new Error("volatilityWindow must be a whole number of at least 2.");
  }

  if (
    !Number.isInteger(options.minimumVolatilitySamples) ||
    options.minimumVolatilitySamples < 2
  ) {
    throw new Error(
      "minimumVolatilitySamples must be a whole number of at least 2.",
    );
  }

  if (options.minimumVolatilitySamples > options.volatilityWindow) {
    throw new Error(
      "minimumVolatilitySamples cannot exceed volatilityWindow.",
    );
  }

  if (!Number.isFinite(options.pairScoreCap) || options.pairScoreCap <= 0) {
    throw new Error("pairScoreCap must be greater than zero.");
  }

  if (
    !Number.isFinite(options.percentageSteepness) ||
    options.percentageSteepness <= 0
  ) {
    throw new Error("percentageSteepness must be greater than zero.");
  }

  const normalizedCandleMap = new Map<string, readonly ForexCandle[]>();

  for (const [symbol, candles] of Object.entries(pairCandles)) {
    normalizedCandleMap.set(normalizePairSymbol(symbol), candles);
  }

  const contributions = new Map<CurrencyCode, number[]>(
    CURRENCIES.map((currency) => [currency, []]),
  );

  const pairResults: PairStrengthResult[] = [];
  const skippedPairs: SkippedPair[] = [];

  for (const pair of FOREX_PAIRS) {
    const candles =
      normalizedCandleMap.get(normalizePairSymbol(pair)) ?? [];

    const result = calculatePairStrength(pair, candles, options);

    if ("reason" in result) {
      skippedPairs.push(result);
      continue;
    }

    pairResults.push(result);

    contributions
      .get(result.baseCurrency)
      ?.push(result.normalizedScore);

    contributions
      .get(result.quoteCurrency)
      ?.push(-result.normalizedScore);
  }

  const unsortedReadings = CURRENCIES.map((currency) => {
    const currencyContributions = contributions.get(currency) ?? [];
    const rawScore =
      currencyContributions.length > 0
        ? currencyContributions.reduce(
            (total, contribution) => total + contribution,
            0,
          ) / currencyContributions.length
        : 0;

    return {
      currency,
      rawScore: Number(rawScore.toFixed(6)),
      percentage: mapRawScoreToPercentage(
        rawScore,
        options.percentageSteepness,
      ),
      rank: 0,
      relationshipCount: currencyContributions.length,
      missingRelationshipCount:
        EXPECTED_RELATIONSHIPS_PER_CURRENCY -
        currencyContributions.length,
    };
  });

  const readings = [...unsortedReadings]
    .sort((first, second) => {
      if (second.rawScore !== first.rawScore) {
        return second.rawScore - first.rawScore;
      }

      return first.currency.localeCompare(second.currency);
    })
    .map((reading, index) => ({
      ...reading,
      rank: index + 1,
    }));

  return {
    readings,
    pairResults,
    skippedPairs,
    requestedPairCount: FOREX_PAIRS.length,
    usedPairCount: pairResults.length,
    isComplete:
      pairResults.length === FOREX_PAIRS.length &&
      readings.every(
        (reading) =>
          reading.relationshipCount ===
          EXPECTED_RELATIONSHIPS_PER_CURRENCY,
      ),
    options,
  };
}

export function getTwelveDataInterval(
  timeframe: CurrencyStrengthTimeframe,
) {
  return TWELVE_DATA_INTERVALS[timeframe];
}