import type {
  MarketCondition,
  MarketTrendDirection,
} from "@/lib/marketIntelligence";
import type {
  COTPositionState,
  COTTrendAnalysis,
  COTTrendDirection,
} from "@/lib/marketIntelligenceCot";
import type {
  CombinedMarketIntelligenceState,
  MarketPositioningRelationship,
} from "@/lib/marketIntelligenceCombined";
import type {
  MarketIntelligenceContinuity,
  MarketStoryDevelopment,
} from "@/lib/marketIntelligenceContinuity";
import type {
  RollingTrendAnalysis,
} from "@/lib/marketIntelligenceTrend";

export type PreviousNarrativeContext = {
  analysisDate?: string | null;
  marketConditionLabel?: string | null;
  dashboardSummary?: string | null;
};

export type MarketIntelligenceNarrativeInput = {
  symbol: string;

  marketCondition: MarketCondition;

  price: RollingTrendAnalysis;
  openInterest: RollingTrendAnalysis;
  volume: RollingTrendAnalysis;

  leveragedFunds: COTTrendAnalysis;
  assetManagers: COTTrendAnalysis;

  combined: CombinedMarketIntelligenceState;
  continuity: MarketIntelligenceContinuity;

  previous?: PreviousNarrativeContext | null;
};

export type MarketIntelligenceNarrative = {
  technicalMeaning: string;

  /**
   * Stored as five newline-separated lines for the dashboard.
   * The frontend can split on "\n" later if it wants separate rows.
   */
  dashboardSummary: string;

  detailedAnalysis: string;

  continuationOutlook: string;
  reversalOutlook: string;
};

function directionWord(
  direction: MarketTrendDirection
) {
  if (direction === "rising") {
    return "rising";
  }

  if (direction === "falling") {
    return "falling";
  }

  return "moving sideways";
}

function recentDevelopmentPhrase(
  development:
    RollingTrendAnalysis["recentDevelopment"]
) {
  switch (development) {
    case "continuing":
      return "is continuing that broader pattern in the latest observations";
    case "slowing":
      return "is showing signs of slowing in the latest observations";
    case "stabilizing":
      return "is beginning to stabilize in the latest observations";
    case "early_turn":
      return "is showing an early move in the opposite direction";
    default:
      return "is showing mixed movement inside the broader window";
  }
}

function cotCurrentPositionText(
  position: COTPositionState
) {
  if (position === "net_long") {
    return "net long";
  }

  if (position === "net_short") {
    return "net short";
  }

  return "neutral";
}

function cotDirectionText(
  direction: COTTrendDirection
) {
  if (direction === "bullish") {
    return "bullish";
  }

  if (direction === "bearish") {
    return "bearish";
  }

  return "sideways";
}

function cotRecentDevelopmentText(
  analysis: COTTrendAnalysis
) {
  switch (analysis.recentDevelopment) {
    case "continuing":
      return "and that positioning direction is continuing in the latest reports";
    case "slowing":
      return "although the latest reports show that positioning move is slowing";
    case "stabilizing":
      return "with the latest reports becoming more stable";
    case "early_turn":
      return "but the latest reports show an early turn against the broader five-report direction";
    default:
      return "with mixed movement in the most recent reports";
  }
}

function buildParticipantSentence(
  name: "Leveraged Funds" | "Asset Managers",
  analysis: COTTrendAnalysis
) {
  return (
    `${name} are currently ${cotCurrentPositionText(analysis.currentPosition)}, ` +
    `while their five-report positioning transition is ${cotDirectionText(analysis.direction)} ${cotRecentDevelopmentText(analysis)}.`
  );
}

function relationshipText(
  relationship: MarketPositioningRelationship
) {
  switch (relationship) {
    case "aligned":
      return "COT positioning and the current price direction are broadly aligned.";
    case "positioning_leads":
      return "COT positioning has a directional lean while price remains broadly sideways, so positioning is leading rather than being confirmed by price.";
    case "diverging":
      return "COT positioning and the current price direction are diverging, so the positioning signal is not being confirmed by market behaviour.";
    case "neutral":
      return "Both market direction and COT positioning are broadly neutral.";
    default:
      return "COT positioning is mixed relative to the current market direction, so confirmation is incomplete.";
  }
}

function continuityOpening(
  development: MarketStoryDevelopment,
  symbol: string,
  previous?: PreviousNarrativeContext | null
) {
  if (!previous) {
    return `This report establishes the initial Market Intelligence baseline for ${symbol} from the available evidence.`;
  }

  const previousLabel =
    previous.marketConditionLabel?.trim();

  const previousReference =
    previousLabel
      ? `The previous report classified ${symbol} as ${previousLabel}. `
      : "";

  switch (development) {
    case "continuing":
      return (
        previousReference +
        "The latest evidence keeps the core market story intact."
      );
    case "strengthening":
      return (
        previousReference +
        "The latest evidence strengthens the previous market story."
      );
    case "weakening":
      return (
        previousReference +
        "The latest evidence weakens the support behind the previous market story."
      );
    case "diverging":
      return (
        previousReference +
        "The latest evidence increases the divergence between market behaviour and positioning."
      );
    case "reversing":
      return (
        previousReference +
        "The latest evidence shows a directional reversal from the previous market story."
      );
    default:
      return (
        previousReference +
        "The latest evidence is changing the structure of the previous market story."
      );
  }
}

function buildMarketBehaviourSentence(
  symbol: string,
  input: MarketIntelligenceNarrativeInput
) {
  return (
    `${symbol}'s 15-observation Price trend is ${directionWord(input.price.direction)}, ` +
    `Open Interest is ${directionWord(input.openInterest.direction)}, and Volume is ${directionWord(input.volume.direction)}. ` +
    `Price ${recentDevelopmentPhrase(input.price.recentDevelopment)}; ` +
    `Open Interest ${recentDevelopmentPhrase(input.openInterest.recentDevelopment)}; ` +
    `Volume ${recentDevelopmentPhrase(input.volume.recentDevelopment)}.`
  );
}

function buildCompactMarketLine(
  symbol: string,
  input: MarketIntelligenceNarrativeInput
) {
  return (
    `${symbol}: Price is ${directionWord(input.price.direction)}, ` +
    `Open Interest is ${directionWord(input.openInterest.direction)}, and Volume is ${directionWord(input.volume.direction)} across the rolling 15-observation window.`
  );
}

function buildCompactCOTLine(
  input: MarketIntelligenceNarrativeInput
) {
  return (
    `Leveraged Funds are ${cotCurrentPositionText(input.leveragedFunds.currentPosition)} with a ${cotDirectionText(input.leveragedFunds.direction)} five-report transition; ` +
    `Asset Managers are ${cotCurrentPositionText(input.assetManagers.currentPosition)} with a ${cotDirectionText(input.assetManagers.direction)} five-report transition.`
  );
}

function buildContinuationOutlook(
  condition: MarketCondition
) {
  if (condition.price === "falling") {
    if (
      condition.openInterest === "rising" &&
      condition.volume === "rising"
    ) {
      return (
        "Continuation: Further price weakness while Open Interest and Volume remain elevated or continue rising would keep fresh participation behind the decline and strengthen bearish continuation."
      );
    }

    return (
      "Continuation: Further price weakness accompanied by renewed growth in Open Interest and Volume would provide stronger evidence that fresh participation is entering behind the decline. If participation keeps contracting, downside can continue but remains less structurally supported."
    );
  }

  if (condition.price === "rising") {
    if (
      condition.openInterest === "rising" &&
      condition.volume === "rising"
    ) {
      return (
        "Continuation: Further price strength while Open Interest and Volume remain elevated or continue rising would keep fresh participation behind the advance and strengthen bullish continuation."
      );
    }

    return (
      "Continuation: Further price strength accompanied by renewed growth in Open Interest and Volume would provide stronger evidence that fresh participation is entering behind the advance. If participation keeps contracting, upside can continue but remains less structurally supported."
    );
  }

  return (
    "Continuation: A continued sideways market would keep the current range/compression story intact. Rising Open Interest and Volume inside the range would show participation building, but direction would remain unresolved until price establishes a clearer trend."
  );
}

function buildReversalOutlook(
  condition: MarketCondition
) {
  if (condition.price === "falling") {
    return (
      "Reversal: A sustained turn higher in Price, especially if Open Interest and Volume also begin rising, would show fresh participation supporting the recovery and strengthen the case that the previous decline is exhausting or reversing."
    );
  }

  if (condition.price === "rising") {
    return (
      "Reversal: A sustained turn lower in Price, especially if Open Interest and Volume also begin rising, would show fresh participation supporting the decline and strengthen the case that the previous advance is exhausting or reversing."
    );
  }

  return (
    "Reversal / directional break: Price would need to leave the current sideways structure and establish a sustained rising or falling trend. A simultaneous increase in Open Interest and Volume would make that new direction more structurally meaningful."
  );
}

function buildDetailedAnalysis(
  input: MarketIntelligenceNarrativeInput,
  continuationOutlook: string,
  reversalOutlook: string
) {
  const sections = [
    "CURRENT STORY",
    continuityOpening(
      input.continuity.development,
      input.symbol,
      input.previous
    ),
    input.continuity.changeSummary,

    "",
    "15-OBSERVATION MARKET BEHAVIOUR",
    buildMarketBehaviourSentence(
      input.symbol,
      input
    ),
    `Technical condition: ${input.marketCondition.label}.`,
    `Meaning: ${input.marketCondition.meaning}`,

    "",
    "5-REPORT COT POSITIONING",
    buildParticipantSentence(
      "Leveraged Funds",
      input.leveragedFunds
    ),
    buildParticipantSentence(
      "Asset Managers",
      input.assetManagers
    ),

    "",
    "POSITIONING VS MARKET",
    relationshipText(
      input.combined.relationship
    ),

    "",
    "WHAT TO WATCH",
    continuationOutlook,
    reversalOutlook,
  ];

  return sections.join("\n");
}

/**
 * Zero-cost narrative layer.
 *
 * This function does NOT decide the market state.
 * Every classification has already been produced by EdgeVault's
 * deterministic engines before this function runs.
 *
 * Its only job is to turn those facts into consistent user-facing language.
 * A future AI provider can replace or polish this wording without changing
 * the underlying Market Intelligence calculations.
 */
export function buildMarketIntelligenceNarrative(
  input: MarketIntelligenceNarrativeInput
): MarketIntelligenceNarrative {
  const continuationOutlook =
    buildContinuationOutlook(
      input.marketCondition
    );

  const reversalOutlook =
    buildReversalOutlook(
      input.marketCondition
    );

  const dashboardLines = [
    buildCompactMarketLine(
      input.symbol,
      input
    ),
    buildCompactCOTLine(input),
    relationshipText(
      input.combined.relationship
    ),
    continuationOutlook,
    reversalOutlook,
  ];

  return {
    technicalMeaning:
      input.marketCondition.meaning,

    dashboardSummary:
      dashboardLines.join("\n"),

    detailedAnalysis:
      buildDetailedAnalysis(
        input,
        continuationOutlook,
        reversalOutlook
      ),

    continuationOutlook,
    reversalOutlook,
  };
}