import type {
  MarketCondition,
  MarketTrendDirection,
} from "@/lib/marketIntelligence";
import type {
  COTPositionState,
  COTTrendAnalysis,
  COTTrendDirection,
} from "@/lib/marketIntelligenceCot";

export type COTCombinationBias =
  | "bullish"
  | "neutral"
  | "bearish"
  | "mixed";

export type COTCombination = {
  id: number;
  key: string;

  leveragedFundsDirection: COTTrendDirection;
  assetManagersDirection: COTTrendDirection;

  bias: COTCombinationBias;
};

export type MarketPositioningRelationship =
  | "aligned"
  | "positioning_leads"
  | "diverging"
  | "neutral"
  | "mixed";

export type CombinedMarketIntelligenceState = {
  /**
   * Unique deterministic state from 1..243.
   *
   * Formula:
   * ((27-state market condition id - 1) * 9) + COT combination id
   */
  combinedStateId: number;
  combinedStateKey: string;

  marketCondition: MarketCondition;
  cotCombination: COTCombination;

  relationship: MarketPositioningRelationship;

  leveragedFunds: {
    direction: COTTrendDirection;
    currentPosition: COTPositionState;
    currentNetPosition: number;
  };

  assetManagers: {
    direction: COTTrendDirection;
    currentPosition: COTPositionState;
    currentNetPosition: number;
  };
};

export const COT_COMBINATIONS: readonly COTCombination[] = [
  {
    id: 1,
    key: "leveraged_bullish_asset_bullish",
    leveragedFundsDirection: "bullish",
    assetManagersDirection: "bullish",
    bias: "bullish",
  },
  {
    id: 2,
    key: "leveraged_bullish_asset_sideways",
    leveragedFundsDirection: "bullish",
    assetManagersDirection: "sideways",
    bias: "bullish",
  },
  {
    id: 3,
    key: "leveraged_bullish_asset_bearish",
    leveragedFundsDirection: "bullish",
    assetManagersDirection: "bearish",
    bias: "mixed",
  },
  {
    id: 4,
    key: "leveraged_sideways_asset_bullish",
    leveragedFundsDirection: "sideways",
    assetManagersDirection: "bullish",
    bias: "bullish",
  },
  {
    id: 5,
    key: "leveraged_sideways_asset_sideways",
    leveragedFundsDirection: "sideways",
    assetManagersDirection: "sideways",
    bias: "neutral",
  },
  {
    id: 6,
    key: "leveraged_sideways_asset_bearish",
    leveragedFundsDirection: "sideways",
    assetManagersDirection: "bearish",
    bias: "bearish",
  },
  {
    id: 7,
    key: "leveraged_bearish_asset_bullish",
    leveragedFundsDirection: "bearish",
    assetManagersDirection: "bullish",
    bias: "mixed",
  },
  {
    id: 8,
    key: "leveraged_bearish_asset_sideways",
    leveragedFundsDirection: "bearish",
    assetManagersDirection: "sideways",
    bias: "bearish",
  },
  {
    id: 9,
    key: "leveraged_bearish_asset_bearish",
    leveragedFundsDirection: "bearish",
    assetManagersDirection: "bearish",
    bias: "bearish",
  },
] as const;

export function getCOTCombination(
  leveragedFundsDirection: COTTrendDirection,
  assetManagersDirection: COTTrendDirection
): COTCombination {
  const combination =
    COT_COMBINATIONS.find(
      (item) =>
        item.leveragedFundsDirection ===
          leveragedFundsDirection &&
        item.assetManagersDirection ===
          assetManagersDirection
    );

  if (!combination) {
    throw new Error(
      `No COT combination found for Leveraged Funds=${leveragedFundsDirection}, Asset Managers=${assetManagersDirection}.`
    );
  }

  return combination;
}

function getPriceSide(
  priceDirection: MarketTrendDirection
): "bullish" | "neutral" | "bearish" {
  if (priceDirection === "rising") {
    return "bullish";
  }

  if (priceDirection === "falling") {
    return "bearish";
  }

  return "neutral";
}

function getRelationship(
  priceDirection: MarketTrendDirection,
  cotBias: COTCombinationBias
): MarketPositioningRelationship {
  const priceSide =
    getPriceSide(priceDirection);

  /*
   * This relationship is intentionally simple and deterministic.
   * The later continuity engine will compare today's complete report
   * with the previous saved report and decide whether the STORY is
   * strengthening, weakening, transitioning, etc.
   */

  if (
    priceSide === "neutral" &&
    cotBias === "neutral"
  ) {
    return "neutral";
  }

  if (
    priceSide === "neutral" &&
    (
      cotBias === "bullish" ||
      cotBias === "bearish"
    )
  ) {
    return "positioning_leads";
  }

  if (
    cotBias === "neutral" ||
    cotBias === "mixed"
  ) {
    return "mixed";
  }

  if (
    (priceSide === "bullish" &&
      cotBias === "bullish") ||
    (priceSide === "bearish" &&
      cotBias === "bearish")
  ) {
    return "aligned";
  }

  return "diverging";
}

/**
 * Combines:
 *
 * - one of the 27 Price/OI/Volume market conditions
 * - one of the 9 five-report COT direction combinations
 *
 * into one deterministic 1..243 Market Intelligence state.
 *
 * IMPORTANT:
 * The 243 state uses the FIVE-REPORT DIRECTION for Leveraged Funds
 * and Asset Managers, as agreed.
 *
 * Their latest actual Net Position (net long / net short / neutral)
 * is preserved separately so the narrative can explain situations like:
 *
 * "Asset Managers remain net long, but their five-report positioning
 * transition has turned bearish."
 */
export function buildCombinedMarketIntelligenceState(
  marketCondition: MarketCondition,
  leveragedFunds: COTTrendAnalysis,
  assetManagers: COTTrendAnalysis
): CombinedMarketIntelligenceState {
  const cotCombination =
    getCOTCombination(
      leveragedFunds.direction,
      assetManagers.direction
    );

  const combinedStateId =
    (marketCondition.id - 1) * 9 +
    cotCombination.id;

  if (
    combinedStateId < 1 ||
    combinedStateId > 243
  ) {
    throw new Error(
      `Combined Market Intelligence state must be between 1 and 243; received ${combinedStateId}.`
    );
  }

  return {
    combinedStateId,
    combinedStateKey:
      `${marketCondition.key}__${cotCombination.key}`,

    marketCondition,
    cotCombination,

    relationship:
      getRelationship(
        marketCondition.price,
        cotCombination.bias
      ),

    leveragedFunds: {
      direction:
        leveragedFunds.direction,
      currentPosition:
        leveragedFunds.currentPosition,
      currentNetPosition:
        leveragedFunds.currentNetPosition,
    },

    assetManagers: {
      direction:
        assetManagers.direction,
      currentPosition:
        assetManagers.currentPosition,
      currentNetPosition:
        assetManagers.currentNetPosition,
    },
  };
}