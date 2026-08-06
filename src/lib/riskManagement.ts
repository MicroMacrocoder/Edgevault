export type Direction = "buy" | "sell";

export type PairSymbol =
  | "EURUSD"
  | "GBPUSD"
  | "AUDUSD"
  | "NZDUSD"
  | "USDCHF"
  | "USDCAD"
  | "USDJPY"
  | "XAUUSD"
  | "XAGUSD"
  | "US30";

export type PairSettings = {
  label: string;
  pipValuePerLot: number;
  pipLabel: string;
  placeholder: string;
};

export type ExposureEntry = {
  id: number;
  pair: PairSymbol;
  direction: Direction;
  entryPrice: string;
  lotSize: string;
};

export const PAIRS: PairSymbol[] = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCHF",
  "USDCAD",
  "USDJPY",
  "XAUUSD",
  "XAGUSD",
  "US30",
];

export function getPairSettings(
  pair: PairSymbol
): PairSettings {
  if (pair === "USDJPY") {
    return {
      label: "JPY Pair",
      pipValuePerLot: 10,
      pipLabel: "pips",
      placeholder: "155.000",
    };
  }

  if (pair === "XAUUSD") {
    return {
      label: "Gold",
      pipValuePerLot: 100,
      pipLabel: "points",
      placeholder: "2350.00",
    };
  }

  if (pair === "XAGUSD") {
    return {
      label: "Silver",
      pipValuePerLot: 10,
      pipLabel: "points / pips",
      placeholder: "30.000",
    };
  }

  if (pair === "US30") {
    return {
      label: "Index",
      pipValuePerLot: 10,
      pipLabel: "points",
      placeholder: "39000",
    };
  }

  return {
    label: "Forex Major",
    pipValuePerLot: 10,
    pipLabel: "pips",
    placeholder: "1.08500",
  };
}

export function toNumber(
  value: string | number
): number {
  return Number(value) || 0;
}

export function money(
  value: number | string
): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function number(
  value: number | string
): string {
  return Number(value || 0).toFixed(2);
}

type CalculateExposureParams = {
  balance: string;
  riskPercent: string;
  targetAmount: string;
  maxEntries: string;
  entries: ExposureEntry[];
};

export const calculateExposure = ({
  balance,
  riskPercent,
  targetAmount,
  maxEntries,
  entries,
}: CalculateExposureParams) => {
  const accountBalance =
    toNumber(balance);

  const riskBucket =
    accountBalance *
    (toNumber(riskPercent) / 100);

  const targetProfit =
    toNumber(targetAmount);

  const targetEquity =
    accountBalance + targetProfit;

  const validEntries = entries
    .map((entry) => {
      const pairSettings =
        getPairSettings(entry.pair);

      const lotSize =
        toNumber(entry.lotSize);

      const entryPrice =
        toNumber(entry.entryPrice);

      const pipValue =
        lotSize *
        pairSettings.pipValuePerLot;

      return {
        ...entry,
        lotSize,
        entryPrice,
        pairLabel:
          pairSettings.label,
        pipLabel:
          pairSettings.pipLabel,
        pipValue,
      };
    })
    .filter(
      (entry) => entry.lotSize > 0
    );

  const totalLotSize =
    validEntries.reduce(
      (sum, entry) =>
        sum + entry.lotSize,
      0
    );

  const combinedPipValue =
    validEntries.reduce(
      (sum, entry) =>
        sum + entry.pipValue,
      0
    );

  const distanceToDanger =
    combinedPipValue > 0
      ? riskBucket /
        combinedPipValue
      : 0;

  const distanceToTarget =
    combinedPipValue > 0
      ? targetProfit /
        combinedPipValue
      : 0;

  const riskUsedPercent =
    accountBalance > 0
      ? (riskBucket /
          accountBalance) *
        100
      : 0;

  const targetReturnPercent =
    accountBalance > 0
      ? (targetProfit /
          accountBalance) *
        100
      : 0;

  const maxAllowedEntries =
    Math.max(
      1,
      Math.floor(
        toNumber(maxEntries)
      )
    );

  const pairBreakdown =
    PAIRS.map((pair) => {
      const pairEntries =
        validEntries.filter(
          (entry) =>
            entry.pair === pair
        );

      const settings =
        getPairSettings(pair);

      const pairLots =
        pairEntries.reduce(
          (sum, entry) =>
            sum + entry.lotSize,
          0
        );

      const pairPipValue =
        pairEntries.reduce(
          (sum, entry) =>
            sum + entry.pipValue,
          0
        );

      return {
        pair,
        label: settings.label,
        pipLabel:
          settings.pipLabel,
        entries:
          pairEntries.length,
        totalLots: pairLots,
        pipValue: pairPipValue,
        buyEntries:
          pairEntries.filter(
            (entry) =>
              entry.direction ===
              "buy"
          ).length,
        sellEntries:
          pairEntries.filter(
            (entry) =>
              entry.direction ===
              "sell"
          ).length,
      };
    }).filter(
      (item) => item.entries > 0
    );

  return {
    accountBalance,
    riskBucket,
    targetProfit,
    targetEquity,
    validEntries,
    totalLotSize,
    combinedPipValue,
    distanceToDanger,
    distanceToTarget,
    riskUsedPercent,
    targetReturnPercent,
    maxAllowedEntries,
    pairBreakdown,
  };
};
