export const MARKET_INTELLIGENCE_COT_WINDOW = 5;

export type COTPositionState =
  | "net_long"
  | "neutral"
  | "net_short";

export type COTTrendDirection =
  | "bullish"
  | "sideways"
  | "bearish";

type COTDirectionVote =
  | COTTrendDirection
  | "mixed";

export type COTTransition =
  | "crossed_bullish"
  | "crossed_bearish"
  | "remained_long"
  | "remained_short"
  | "remained_neutral"
  | "mixed";

export type COTTrendAnalysis = {
  currentPosition: COTPositionState;
  currentNetPosition: number;

  direction: COTTrendDirection;
  observationCount: number;

  firstNetPosition: number;
  lastNetPosition: number;

  risingChanges: number;
  fallingChanges: number;
  unchangedChanges: number;

  slopeVote: COTDirectionVote;
  changeVote: COTDirectionVote;
  progressionVote: COTDirectionVote;

  transition: COTTransition;

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

function positionState(
  value: number
): COTPositionState {
  if (value > 0) return "net_long";
  if (value < 0) return "net_short";
  return "neutral";
}

function movementVote(
  value: number
): COTDirectionVote {
  if (value > 0) return "bullish";
  if (value < 0) return "bearish";
  return "sideways";
}

function calculateSlopeVote(
  values: number[]
): COTDirectionVote {
  /*
   * Least-squares slope across the WHOLE five-report sequence.
   * Positive slope = positioning is becoming more bullish.
   * Negative slope = positioning is becoming more bearish.
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

  return movementVote(
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

  let vote: COTDirectionVote =
    "sideways";

  if (
    risingChanges >
    fallingChanges
  ) {
    vote = "bullish";
  } else if (
    fallingChanges >
    risingChanges
  ) {
    vote = "bearish";
  }

  return {
    vote,
    risingChanges,
    fallingChanges,
    unchangedChanges,
  };
}

function calculateProgressionVote(
  values: number[]
): COTDirectionVote {
  /*
   * Five COT reports are split into an older pair and a newer pair.
   * The middle report is kept as the bridge between both sides.
   *
   * Comparing the medians of the older and newer reports gives the
   * broad positioning transition without letting one weekly spike
   * control the classification.
   */
  const olderMedian =
    median(values.slice(0, 2));

  const newerMedian =
    median(values.slice(-2));

  if (newerMedian > olderMedian) {
    return "bullish";
  }

  if (newerMedian < olderMedian) {
    return "bearish";
  }

  return "sideways";
}

function resolveDirection(
  votes: COTDirectionVote[]
): COTTrendDirection {
  const bullishVotes =
    votes.filter(
      (vote) => vote === "bullish"
    ).length;

  const bearishVotes =
    votes.filter(
      (vote) => vote === "bearish"
    ).length;

  /*
   * Same philosophy as the 15-day engine:
   * at least two independent views of the complete rolling window
   * must agree before EdgeVault calls the transition bullish/bearish.
   * Otherwise the five-report positioning trend is Sideways.
   */
  if (
    bullishVotes >= 2 &&
    bullishVotes > bearishVotes
  ) {
    return "bullish";
  }

  if (
    bearishVotes >= 2 &&
    bearishVotes > bullishVotes
  ) {
    return "bearish";
  }

  return "sideways";
}

function classifyTransition(
  values: number[]
): COTTransition {
  const first =
    positionState(values[0]);
  const last =
    positionState(
      values[values.length - 1]
    );

  if (
    first === "net_short" &&
    last === "net_long"
  ) {
    return "crossed_bullish";
  }

  if (
    first === "net_long" &&
    last === "net_short"
  ) {
    return "crossed_bearish";
  }

  if (
    first === "net_long" &&
    last === "net_long"
  ) {
    return "remained_long";
  }

  if (
    first === "net_short" &&
    last === "net_short"
  ) {
    return "remained_short";
  }

  if (
    first === "neutral" &&
    last === "neutral"
  ) {
    return "remained_neutral";
  }

  return "mixed";
}

function classifyRecentDevelopment(
  values: number[],
  overallDirection: COTTrendDirection
): COTTrendAnalysis["recentDevelopment"] {
  const recent =
    values.slice(-3);

  if (recent.length < 3) {
    return "mixed";
  }

  const firstMove =
    movementVote(
      recent[1] - recent[0]
    );

  const secondMove =
    movementVote(
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

  const opposite:
    | "bullish"
    | "bearish"
    | null =
    overallDirection === "bullish"
      ? "bearish"
      : overallDirection === "bearish"
        ? "bullish"
        : null;

  if (
    opposite &&
    firstMove === opposite &&
    secondMove === opposite
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
 * Analyze one participant's latest five COT net-position reports.
 *
 * Pass NET POSITION values in chronological order:
 * oldest report -> newest report.
 *
 * The result intentionally keeps TWO separate facts:
 *
 * 1. currentPosition
 *    - net_long / neutral / net_short
 *    - based on the newest report's actual Net Position.
 *
 * 2. direction
 *    - bullish / sideways / bearish
 *    - based on the transition across ALL five reports.
 *
 * Example:
 * -4,866 -> -1,938 -> -1,601 -> +3,849 -> +5,772
 *
 * currentPosition = net_long
 * direction = bullish
 * transition = crossed_bullish
 *
 * Another example:
 * +22,039 -> +19,851 -> +21,612 -> +18,095 -> +16,527
 *
 * currentPosition = net_long
 * direction = bearish
 * transition = remained_long
 *
 * That allows the story engine to say:
 * "Positioning remains net long, but the five-report transition is bearish."
 */
export function analyzeCOTNetPositionTrend(
  netPositions: number[]
): COTTrendAnalysis {
  const validValues =
    netPositions
      .filter(
        (value) =>
          Number.isFinite(value)
      )
      .slice(
        -MARKET_INTELLIGENCE_COT_WINDOW
      );

  if (
    validValues.length <
    MARKET_INTELLIGENCE_COT_WINDOW
  ) {
    throw new Error(
      `Market Intelligence needs ${MARKET_INTELLIGENCE_COT_WINDOW} valid COT net-position reports; received ${validValues.length}.`
    );
  }

  const slopeVote =
    calculateSlopeVote(validValues);

  const changeAnalysis =
    calculateChangeVote(
      validValues
    );

  const progressionVote =
    calculateProgressionVote(
      validValues
    );

  const direction =
    resolveDirection([
      slopeVote,
      changeAnalysis.vote,
      progressionVote,
    ]);

  const lastNetPosition =
    validValues[
      validValues.length - 1
    ];

  return {
    currentPosition:
      positionState(lastNetPosition),
    currentNetPosition:
      lastNetPosition,

    direction,
    observationCount:
      validValues.length,

    firstNetPosition:
      validValues[0],
    lastNetPosition,

    risingChanges:
      changeAnalysis.risingChanges,
    fallingChanges:
      changeAnalysis.fallingChanges,
    unchangedChanges:
      changeAnalysis.unchangedChanges,

    slopeVote,
    changeVote:
      changeAnalysis.vote,
    progressionVote,

    transition:
      classifyTransition(validValues),

    recentDevelopment:
      classifyRecentDevelopment(
        validValues,
        direction
      ),
  };
}