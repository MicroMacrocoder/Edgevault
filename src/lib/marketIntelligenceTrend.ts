import type {
  MarketTrendDirection,
} from "@/lib/marketIntelligence";

export const MARKET_INTELLIGENCE_DAILY_WINDOW = 15;

type DirectionVote =
  | MarketTrendDirection
  | "mixed";

export type RollingTrendAnalysis = {
  direction: MarketTrendDirection;
  observationCount: number;

  firstValue: number;
  lastValue: number;

  risingChanges: number;
  fallingChanges: number;
  unchangedChanges: number;

  slopeVote: DirectionVote;
  changeVote: DirectionVote;
  blockVote: DirectionVote;

  /**
   * Human-readable development note used later by the story engine.
   * This is descriptive only; it does not replace the 15-day direction.
   */
  recentDevelopment:
    | "continuing"
    | "slowing"
    | "stabilizing"
    | "early_turn"
    | "mixed";
};

function median(values: number[]) {
  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle =
    Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}

function signDirection(
  value: number
): DirectionVote {
  if (value > 0) return "rising";
  if (value < 0) return "falling";
  return "sideways";
}

function calculateSlopeVote(
  values: number[]
): DirectionVote {
  /*
   * Least-squares slope across the WHOLE rolling window.
   * We care only about its direction here, not an arbitrary
   * percentage threshold.
   */
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY =
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / n;

  let numerator = 0;
  let denominator = 0;

  for (
    let index = 0;
    index < n;
    index += 1
  ) {
    const xDelta =
      index - meanX;
    const yDelta =
      values[index] - meanY;

    numerator += xDelta * yDelta;
    denominator += xDelta * xDelta;
  }

  if (denominator === 0) {
    return "sideways";
  }

  return signDirection(
    numerator / denominator
  );
}

function calculateChangeVote(
  values: number[]
) {
  let risingChanges = 0;
  let fallingChanges = 0;
  let unchangedChanges = 0;

  for (
    let index = 1;
    index < values.length;
    index += 1
  ) {
    const current =
      values[index];
    const previous =
      values[index - 1];

    if (current > previous) {
      risingChanges += 1;
    } else if (current < previous) {
      fallingChanges += 1;
    } else {
      unchangedChanges += 1;
    }
  }

  let vote: DirectionVote =
    "sideways";

  if (
    risingChanges >
    fallingChanges
  ) {
    vote = "rising";
  } else if (
    fallingChanges >
    risingChanges
  ) {
    vote = "falling";
  }

  return {
    vote,
    risingChanges,
    fallingChanges,
    unchangedChanges,
  };
}

function calculateBlockVote(
  values: number[]
): DirectionVote {
  /*
   * Split the 15 observations into three five-observation sections.
   * Comparing each section's median helps us understand the broad
   * progression without letting one unusually large day decide the trend.
   */
  const blockSize =
    Math.floor(values.length / 3);

  if (blockSize < 1) {
    return "sideways";
  }

  const firstBlock =
    values.slice(0, blockSize);
  const middleBlock =
    values.slice(
      blockSize,
      blockSize * 2
    );
  const lastBlock =
    values.slice(blockSize * 2);

  const firstMedian =
    median(firstBlock);
  const middleMedian =
    median(middleBlock);
  const lastMedian =
    median(lastBlock);

  if (
    firstMedian < middleMedian &&
    middleMedian < lastMedian
  ) {
    return "rising";
  }

  if (
    firstMedian > middleMedian &&
    middleMedian > lastMedian
  ) {
    return "falling";
  }

  /*
   * If the middle block is noisy, the first and last sections can
   * still tell us whether the rolling market has clearly progressed.
   * This is only one vote; the slope and day-to-day votes must still
   * participate in the final decision.
   */
  if (lastMedian > firstMedian) {
    return "rising";
  }

  if (lastMedian < firstMedian) {
    return "falling";
  }

  return "sideways";
}

function resolveDirection(
  votes: DirectionVote[]
): MarketTrendDirection {
  const risingVotes =
    votes.filter(
      (vote) => vote === "rising"
    ).length;

  const fallingVotes =
    votes.filter(
      (vote) => vote === "falling"
    ).length;

  /*
   * A direction needs agreement from at least two independent views
   * of the same 15-day sequence:
   *
   * 1. whole-window slope
   * 2. majority of day-to-day changes
   * 3. progression of early/middle/recent blocks
   *
   * If neither side gets two votes, the market is sideways.
   * This avoids inventing a fixed "flat percentage" threshold.
   */
  if (
    risingVotes >= 2 &&
    risingVotes > fallingVotes
  ) {
    return "rising";
  }

  if (
    fallingVotes >= 2 &&
    fallingVotes > risingVotes
  ) {
    return "falling";
  }

  return "sideways";
}

function classifyRecentDevelopment(
  values: number[],
  overallDirection: MarketTrendDirection
): RollingTrendAnalysis["recentDevelopment"] {
  /*
   * The latest three observations describe how the established
   * 15-day condition is evolving. They do NOT choose the 27-state
   * market condition.
   */
  const recent =
    values.slice(-3);

  if (recent.length < 3) {
    return "mixed";
  }

  const firstMove =
    signDirection(
      recent[1] - recent[0]
    );
  const secondMove =
    signDirection(
      recent[2] - recent[1]
    );

  if (
    firstMove === overallDirection &&
    secondMove === overallDirection
  ) {
    return "continuing";
  }

  if (
    firstMove === "sideways" &&
    secondMove === "sideways"
  ) {
    return "stabilizing";
  }

  const oppositeDirection:
    | "rising"
    | "falling"
    | null =
    overallDirection === "rising"
      ? "falling"
      : overallDirection === "falling"
        ? "rising"
        : null;

  if (
    oppositeDirection &&
    firstMove === oppositeDirection &&
    secondMove === oppositeDirection
  ) {
    return "early_turn";
  }

  if (
    overallDirection !== "sideways" &&
    (
      firstMove === "sideways" ||
      secondMove === "sideways" ||
      firstMove !== secondMove
    )
  ) {
    return "slowing";
  }

  return "mixed";
}

/**
 * Classifies one Price / Open Interest / Volume rolling window.
 *
 * IMPORTANT:
 * - Pass observations in chronological order, oldest -> newest.
 * - The engine uses the latest 15 VALID observations.
 * - Invalid/non-finite values and zero/negative values are ignored.
 *   This prevents an unavailable OI value such as 0 from being treated
 *   as a real collapse in Open Interest.
 * - The whole 15-day sequence chooses Rising / Sideways / Falling.
 * - The latest few observations only describe how that established
 *   condition is developing.
 */
export function analyzeRollingMarketTrend(
  observations: number[]
): RollingTrendAnalysis {
  const validValues =
    observations
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value > 0
      )
      .slice(
        -MARKET_INTELLIGENCE_DAILY_WINDOW
      );

  if (
    validValues.length <
    MARKET_INTELLIGENCE_DAILY_WINDOW
  ) {
    throw new Error(
      `Market Intelligence needs ${MARKET_INTELLIGENCE_DAILY_WINDOW} valid observations; received ${validValues.length}.`
    );
  }

  const slopeVote =
    calculateSlopeVote(validValues);

  const changeAnalysis =
    calculateChangeVote(
      validValues
    );

  const blockVote =
    calculateBlockVote(validValues);

  const direction =
    resolveDirection([
      slopeVote,
      changeAnalysis.vote,
      blockVote,
    ]);

  return {
    direction,
    observationCount:
      validValues.length,

    firstValue:
      validValues[0],
    lastValue:
      validValues[
        validValues.length - 1
      ],

    risingChanges:
      changeAnalysis.risingChanges,
    fallingChanges:
      changeAnalysis.fallingChanges,
    unchangedChanges:
      changeAnalysis.unchangedChanges,

    slopeVote,
    changeVote:
      changeAnalysis.vote,
    blockVote,

    recentDevelopment:
      classifyRecentDevelopment(
        validValues,
        direction
      ),
  };
}