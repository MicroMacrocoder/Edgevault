export const MOMENTUM_TIMEFRAMES = [
  "M1",
  "M5",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
  "W1",
] as const;

export type MomentumTimeframe =
  (typeof MOMENTUM_TIMEFRAMES)[number];

export type MovementDirection = "Up" | "Down" | "Flat";
export type MomentumStatus = "Aligned" | "Opposing" | "Flat";

export type MomentumCandle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type MomentumInstrumentSeries = {
  sourceSymbol: string;
  label: string;
  candles: MomentumCandle[];
};

export type MomentumBenchmarkRow = {
  rank: "Ref";
  pair: "DXY";
  sourceSymbol: string;
  movement: MovementDirection;
  startPrice: number;
  currentPrice: number;
  pointMovement: number;
  movePercent: number;
  benchmarkPoints: number;
  score: null;
  status: "Reference";
  candleStartedAt: string;
  updatedAt: string;
  historyCandlesUsed: number;
  comparisonCandlesUsed: number;
  normalizationWindowsUsed: number;
};

export type MomentumRankingRow = {
  rank: number;
  pair: string;
  sourceSymbol: string;
  movement: MovementDirection;
  startPrice: number;
  currentPrice: number;
  pointMovement: number;
  movePercent: number;
  score: number;
  status: MomentumStatus;
  candleStartedAt: string;
  updatedAt: string;
  historyCandlesUsed: number;
  comparisonCandlesUsed: number;
  normalizationWindowsUsed: number;
};

export type MomentumCalculation = {
  benchmark: MomentumBenchmarkRow;
  rankings: MomentumRankingRow[];
};

export const USD_MOMENTUM_PAIRS = [
  { sourceSymbol: "EUR/USD", label: "EURUSD", usdPosition: "quote" },
  { sourceSymbol: "GBP/USD", label: "GBPUSD", usdPosition: "quote" },
  { sourceSymbol: "AUD/USD", label: "AUDUSD", usdPosition: "quote" },
  { sourceSymbol: "NZD/USD", label: "NZDUSD", usdPosition: "quote" },
  { sourceSymbol: "USD/CAD", label: "USDCAD", usdPosition: "base" },
  { sourceSymbol: "USD/CHF", label: "USDCHF", usdPosition: "base" },
  { sourceSymbol: "USD/JPY", label: "USDJPY", usdPosition: "base" },
] as const;

export const MOMENTUM_COMPARISON_CANDLES = 5;
export const MOMENTUM_HISTORY_CANDLES = 49;
export const MOMENTUM_NORMALIZATION_WINDOWS =
  MOMENTUM_HISTORY_CANDLES - MOMENTUM_COMPARISON_CANDLES + 1;

const FLAT_SCORE_THRESHOLD = 5;

function round(value: number, decimalPlaces = 2) {
  const multiplier = 10 ** decimalPlaces;
  return Math.round(value * multiplier) / multiplier;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function getTypicalFiveCandleMovementPercent(candles: MomentumCandle[]) {
  const windowMovements: number[] = [];

  for (
    let newestIndex = 0;
    newestIndex <= candles.length - MOMENTUM_COMPARISON_CANDLES;
    newestIndex += 1
  ) {
    const newestCandle = candles[newestIndex];
    const oldestCandle =
      candles[newestIndex + MOMENTUM_COMPARISON_CANDLES - 1];

    if (!newestCandle || !oldestCandle || oldestCandle.open <= 0) {
      continue;
    }

    const movementPercent = Math.abs(
      ((newestCandle.close - oldestCandle.open) / oldestCandle.open) * 100,
    );

    if (Number.isFinite(movementPercent)) {
      windowMovements.push(movementPercent);
    }
  }

  const medianMovement = median(windowMovements);

  if (medianMovement > 0) {
    return {
      typicalMovementPercent: medianMovement,
      normalizationWindowsUsed: windowMovements.length,
    };
  }

  if (windowMovements.length === 0) {
    return {
      typicalMovementPercent: 0,
      normalizationWindowsUsed: 0,
    };
  }

  return {
    typicalMovementPercent:
      windowMovements.reduce((total, value) => total + value, 0) /
      windowMovements.length,
    normalizationWindowsUsed: windowMovements.length,
  };
}

function getPointSize(symbol: string, label: string) {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (label === "DXY" || normalized === "DXY" || normalized.endsWith("JPY")) {
    return 0.001;
  }

  return 0.00001;
}

function getMovementDirection(normalizedMovement: number): MovementDirection {
  if (normalizedMovement > FLAT_SCORE_THRESHOLD) {
    return "Up";
  }

  if (normalizedMovement < -FLAT_SCORE_THRESHOLD) {
    return "Down";
  }

  return "Flat";
}

function getStatus(score: number): MomentumStatus {
  if (score > FLAT_SCORE_THRESHOLD) {
    return "Aligned";
  }

  if (score < -FLAT_SCORE_THRESHOLD) {
    return "Opposing";
  }

  return "Flat";
}

function getHistoricalCandles(series: MomentumInstrumentSeries) {
  const minimumRequired = MOMENTUM_HISTORY_CANDLES + 1;

  if (series.candles.length < minimumRequired) {
    throw new Error(
      `${series.label} returned ${series.candles.length} usable candles. ` +
        `${minimumRequired} are required: one current candle plus ` +
        `${MOMENTUM_HISTORY_CANDLES} completed candles for normalization.`,
    );
  }

  return series.candles.slice(1, MOMENTUM_HISTORY_CANDLES + 1);
}

function getComparisonCandles(
  series: MomentumInstrumentSeries,
  comparisonDatetimes: string[],
) {
  const candlesByDatetime = new Map(
    series.candles.map((candle) => [candle.datetime, candle]),
  );
  const comparisonCandles = comparisonDatetimes.map((datetime) =>
    candlesByDatetime.get(datetime),
  );

  const missingIndex = comparisonCandles.findIndex((candle) => !candle);

  if (missingIndex >= 0) {
    throw new Error(
      `${series.label} is missing the comparison candle at ` +
        `${comparisonDatetimes[missingIndex]}. Refresh again after the provider aligns all symbols.`,
    );
  }

  return comparisonCandles as MomentumCandle[];
}

function calculateRawMovement({
  series,
  updatedAt,
  comparisonDatetimes,
}: {
  series: MomentumInstrumentSeries;
  updatedAt: string;
  comparisonDatetimes: string[];
}) {
  if (comparisonDatetimes.length !== MOMENTUM_COMPARISON_CANDLES) {
    throw new Error(
      `Exactly ${MOMENTUM_COMPARISON_CANDLES} comparison candles are required.`,
    );
  }

  const comparisonCandles = getComparisonCandles(
    series,
    comparisonDatetimes,
  );
  const newestCandle = comparisonCandles[0];
  const oldestCandle =
    comparisonCandles[MOMENTUM_COMPARISON_CANDLES - 1];
  const history = getHistoricalCandles(series);
  const rawPriceMovement = newestCandle.close - oldestCandle.open;
  const rawPercentMovement =
    oldestCandle.open > 0
      ? (rawPriceMovement / oldestCandle.open) * 100
      : 0;
  const {
    typicalMovementPercent,
    normalizationWindowsUsed,
  } = getTypicalFiveCandleMovementPercent(history);
  const normalizedMovement =
    typicalMovementPercent > 0
      ? (rawPercentMovement / typicalMovementPercent) * 100
      : 0;

  return {
    startPrice: oldestCandle.open,
    currentPrice: newestCandle.close,
    rawPointMovement: round(
      rawPriceMovement / getPointSize(series.sourceSymbol, series.label),
      1,
    ),
    rawPercentMovement: round(rawPercentMovement, 4),
    normalizedMovement,
    movement: getMovementDirection(normalizedMovement),
    candleStartedAt: oldestCandle.datetime,
    updatedAt,
    historyCandlesUsed: history.length,
    comparisonCandlesUsed: comparisonCandles.length,
    normalizationWindowsUsed,
  };
}

function getAlignmentMultiplier(
  usdPosition: "base" | "quote",
  dxyMovement: MovementDirection,
) {
  if (dxyMovement === "Flat") {
    return 0;
  }

  const dxyDirectionMultiplier = dxyMovement === "Up" ? 1 : -1;
  const usdPositionMultiplier = usdPosition === "base" ? 1 : -1;

  return dxyDirectionMultiplier * usdPositionMultiplier;
}

export function calculateUsdMomentum({
  dxySeries,
  pairSeries,
  updatedAt,
}: {
  dxySeries: MomentumInstrumentSeries;
  pairSeries: MomentumInstrumentSeries[];
  updatedAt: string;
}): MomentumCalculation {
  if (dxySeries.candles.length < MOMENTUM_COMPARISON_CANDLES) {
    throw new Error(
      `DXY returned fewer than ${MOMENTUM_COMPARISON_CANDLES} comparison candles.`,
    );
  }

  const comparisonDatetimes = dxySeries.candles
    .slice(0, MOMENTUM_COMPARISON_CANDLES)
    .map((candle) => candle.datetime);
  const benchmarkMovement = calculateRawMovement({
    series: dxySeries,
    updatedAt,
    comparisonDatetimes,
  });

  const benchmark: MomentumBenchmarkRow = {
    rank: "Ref",
    pair: "DXY",
    sourceSymbol: dxySeries.sourceSymbol,
    movement: benchmarkMovement.movement,
    startPrice: benchmarkMovement.startPrice,
    currentPrice: benchmarkMovement.currentPrice,
    pointMovement: benchmarkMovement.rawPointMovement,
    movePercent: benchmarkMovement.rawPercentMovement,
    benchmarkPoints: Math.round(benchmarkMovement.normalizedMovement),
    score: null,
    status: "Reference",
    candleStartedAt: benchmarkMovement.candleStartedAt,
    updatedAt: benchmarkMovement.updatedAt,
    historyCandlesUsed: benchmarkMovement.historyCandlesUsed,
    comparisonCandlesUsed: benchmarkMovement.comparisonCandlesUsed,
    normalizationWindowsUsed: benchmarkMovement.normalizationWindowsUsed,
  };

  const pairConfigBySymbol = new Map<string, (typeof USD_MOMENTUM_PAIRS)[number]>(
    USD_MOMENTUM_PAIRS.map((pair) => [pair.sourceSymbol, pair]),
  );

  const unrankedRows = pairSeries.map((series) => {
    const config = pairConfigBySymbol.get(series.sourceSymbol);

    if (!config) {
      throw new Error(`${series.sourceSymbol} is not a supported USD momentum pair.`);
    }

    const rawMovement = calculateRawMovement({
      series,
      updatedAt,
      comparisonDatetimes,
    });
    const alignmentMultiplier = getAlignmentMultiplier(
      config.usdPosition,
      benchmark.movement,
    );
    const alignedScore = rawMovement.normalizedMovement * alignmentMultiplier;

    return {
      pair: config.label,
      sourceSymbol: config.sourceSymbol,
      movement: rawMovement.movement,
      startPrice: rawMovement.startPrice,
      currentPrice: rawMovement.currentPrice,
      pointMovement: rawMovement.rawPointMovement,
      movePercent: rawMovement.rawPercentMovement,
      score: Math.round(alignedScore),
      status:
        benchmark.movement === "Flat"
          ? ("Flat" as const)
          : getStatus(alignedScore),
      candleStartedAt: rawMovement.candleStartedAt,
      updatedAt: rawMovement.updatedAt,
      historyCandlesUsed: rawMovement.historyCandlesUsed,
      comparisonCandlesUsed: rawMovement.comparisonCandlesUsed,
      normalizationWindowsUsed: rawMovement.normalizationWindowsUsed,
    };
  });

  const rankings: MomentumRankingRow[] = unrankedRows
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return Math.abs(second.movePercent) - Math.abs(first.movePercent);
    })
    .map((row, index) => ({
      rank: index + 1,
      ...row,
    }));

  return { benchmark, rankings };
}