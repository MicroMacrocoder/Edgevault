import type {
  MarketTrendDirection,
} from "@/lib/marketIntelligence";
import type {
  COTTrendDirection,
} from "@/lib/marketIntelligenceCot";
import type {
  CombinedMarketIntelligenceState,
  MarketPositioningRelationship,
} from "@/lib/marketIntelligenceCombined";

export type MarketStoryDevelopment =
  | "continuing"
  | "strengthening"
  | "weakening"
  | "diverging"
  | "transitioning"
  | "reversing";

export type MarketIntelligenceContinuityInput = {
  current: CombinedMarketIntelligenceState;

  currentPriceTrend: MarketTrendDirection;
  currentOpenInterestTrend: MarketTrendDirection;
  currentVolumeTrend: MarketTrendDirection;

  previous:
    | {
        marketConditionId: number | null;
        priceTrend: MarketTrendDirection | null;
        openInterestTrend: MarketTrendDirection | null;
        volumeTrend: MarketTrendDirection | null;

        leveragedFundsDirection:
          | COTTrendDirection
          | null;
        assetManagersDirection:
          | COTTrendDirection
          | null;

        relationship:
          | MarketPositioningRelationship
          | null;
      }
    | null;
};

export type MarketIntelligenceContinuity = {
  development: MarketStoryDevelopment;

  isFirstReport: boolean;

  marketConditionChanged: boolean;
  priceTrendChanged: boolean;
  openInterestTrendChanged: boolean;
  volumeTrendChanged: boolean;

  leveragedFundsChanged: boolean;
  assetManagersChanged: boolean;
  relationshipChanged: boolean;

  previousMarketConditionId: number | null;
  currentMarketConditionId: number;

  previousRelationship:
    | MarketPositioningRelationship
    | null;
  currentRelationship:
    MarketPositioningRelationship;

  participationSupportChange:
    | "increased"
    | "unchanged"
    | "decreased"
    | "not_directional";

  changeSummary: string;
};

function oppositeDirectionalMove(
  previous: MarketTrendDirection | null,
  current: MarketTrendDirection
) {
  return (
    (previous === "rising" &&
      current === "falling") ||
    (previous === "falling" &&
      current === "rising")
  );
}

function participationSupportScore(
  priceTrend: MarketTrendDirection,
  openInterestTrend: MarketTrendDirection,
  volumeTrend: MarketTrendDirection
): number | null {
  /*
   * For a directional Price trend, rising OI and rising Volume
   * mean stronger fresh participation behind the move.
   *
   * Falling OI and/or Volume mean weaker fresh participation.
   *
   * For sideways Price, this is not treated as directional support:
   * rising participation may instead mean compression / position buildup.
   */
  if (priceTrend === "sideways") {
    return null;
  }

  const scorePart = (
    trend: MarketTrendDirection
  ) => {
    if (trend === "rising") return 2;
    if (trend === "sideways") return 1;
    return 0;
  };

  return (
    scorePart(openInterestTrend) +
    scorePart(volumeTrend)
  );
}

function compareParticipationSupport(
  previousPriceTrend: MarketTrendDirection | null,
  previousOpenInterestTrend: MarketTrendDirection | null,
  previousVolumeTrend: MarketTrendDirection | null,
  currentPriceTrend: MarketTrendDirection,
  currentOpenInterestTrend: MarketTrendDirection,
  currentVolumeTrend: MarketTrendDirection
): MarketIntelligenceContinuity["participationSupportChange"] {
  if (
    previousPriceTrend === null ||
    previousOpenInterestTrend === null ||
    previousVolumeTrend === null
  ) {
    return "not_directional";
  }

  if (
    previousPriceTrend !== currentPriceTrend ||
    currentPriceTrend === "sideways"
  ) {
    return "not_directional";
  }

  const previousScore =
    participationSupportScore(
      previousPriceTrend,
      previousOpenInterestTrend,
      previousVolumeTrend
    );

  const currentScore =
    participationSupportScore(
      currentPriceTrend,
      currentOpenInterestTrend,
      currentVolumeTrend
    );

  if (
    previousScore === null ||
    currentScore === null
  ) {
    return "not_directional";
  }

  if (currentScore > previousScore) {
    return "increased";
  }

  if (currentScore < previousScore) {
    return "decreased";
  }

  return "unchanged";
}

function relationshipImproved(
  previous:
    | MarketPositioningRelationship
    | null,
  current:
    MarketPositioningRelationship
) {
  if (previous === current) {
    return false;
  }

  if (current === "aligned") {
    return true;
  }

  if (
    previous === "diverging" &&
    (
      current === "mixed" ||
      current === "positioning_leads" ||
      current === "neutral"
    )
  ) {
    return true;
  }

  return false;
}

function relationshipWeakened(
  previous:
    | MarketPositioningRelationship
    | null,
  current:
    MarketPositioningRelationship
) {
  if (previous === current) {
    return false;
  }

  if (current === "diverging") {
    return true;
  }

  if (
    previous === "aligned" &&
    current !== "aligned"
  ) {
    return true;
  }

  return false;
}

function buildChangeSummary(
  development: MarketStoryDevelopment,
  input: {
    marketConditionChanged: boolean;
    priceTrendChanged: boolean;
    openInterestTrendChanged: boolean;
    volumeTrendChanged: boolean;
    leveragedFundsChanged: boolean;
    assetManagersChanged: boolean;
    relationshipChanged: boolean;
    participationSupportChange:
      MarketIntelligenceContinuity["participationSupportChange"];
  }
) {
  const changed: string[] = [];

  if (input.priceTrendChanged) {
    changed.push("Price trend changed");
  }

  if (input.openInterestTrendChanged) {
    changed.push("Open Interest trend changed");
  }

  if (input.volumeTrendChanged) {
    changed.push("Volume trend changed");
  }

  if (input.leveragedFundsChanged) {
    changed.push(
      "Leveraged Funds 5-report direction changed"
    );
  }

  if (input.assetManagersChanged) {
    changed.push(
      "Asset Managers 5-report direction changed"
    );
  }

  if (input.relationshipChanged) {
    changed.push(
      "positioning/market relationship changed"
    );
  }

  if (!changed.length) {
    return `The previous Market Intelligence state is ${development}. No core classification changed.`;
  }

  return (
    `The market story is ${development}. ` +
    changed.join("; ") +
    "."
  );
}

/**
 * Compare the CURRENT deterministic Market Intelligence state with the
 * PREVIOUS SAVED report.
 *
 * This is the continuity layer. It does not write the final narrative.
 * It only decides what changed so the narrative/template layer can tell
 * the next chapter accurately.
 *
 * Priority:
 * 1. Reversing   -> Price flipped Rising <-> Falling.
 * 2. Diverging   -> COT/market relationship newly moved into divergence.
 * 3. Strengthening -> Same directional Price move gained participation
 *                     support or positioning became more aligned.
 * 4. Weakening   -> Same directional Price move lost participation
 *                   support or positioning moved away from alignment.
 * 5. Transitioning -> One or more core classifications changed.
 * 6. Continuing  -> Core classifications remain the same.
 */
export function compareMarketIntelligenceWithPrevious(
  input: MarketIntelligenceContinuityInput
): MarketIntelligenceContinuity {
  const {
    current,
    currentPriceTrend,
    currentOpenInterestTrend,
    currentVolumeTrend,
    previous,
  } = input;

  if (!previous) {
    return {
      development: "transitioning",
      isFirstReport: true,

      marketConditionChanged: false,
      priceTrendChanged: false,
      openInterestTrendChanged: false,
      volumeTrendChanged: false,

      leveragedFundsChanged: false,
      assetManagersChanged: false,
      relationshipChanged: false,

      previousMarketConditionId: null,
      currentMarketConditionId:
        current.marketCondition.id,

      previousRelationship: null,
      currentRelationship:
        current.relationship,

      participationSupportChange:
        "not_directional",

      changeSummary:
        "This is the first saved Market Intelligence report, so there is no previous report to compare with.",
    };
  }

  const marketConditionChanged =
    previous.marketConditionId !==
    current.marketCondition.id;

  const priceTrendChanged =
    previous.priceTrend !==
    currentPriceTrend;

  const openInterestTrendChanged =
    previous.openInterestTrend !==
    currentOpenInterestTrend;

  const volumeTrendChanged =
    previous.volumeTrend !==
    currentVolumeTrend;

  const leveragedFundsChanged =
    previous.leveragedFundsDirection !==
    current.leveragedFunds.direction;

  const assetManagersChanged =
    previous.assetManagersDirection !==
    current.assetManagers.direction;

  const relationshipChanged =
    previous.relationship !==
    current.relationship;

  const participationSupportChange =
    compareParticipationSupport(
      previous.priceTrend,
      previous.openInterestTrend,
      previous.volumeTrend,
      currentPriceTrend,
      currentOpenInterestTrend,
      currentVolumeTrend
    );

  let development:
    MarketStoryDevelopment =
      "continuing";

  if (
    oppositeDirectionalMove(
      previous.priceTrend,
      currentPriceTrend
    )
  ) {
    development = "reversing";
  } else if (
    current.relationship ===
      "diverging" &&
    previous.relationship !==
      "diverging"
  ) {
    development = "diverging";
  } else if (
    participationSupportChange ===
      "increased" ||
    relationshipImproved(
      previous.relationship,
      current.relationship
    )
  ) {
    development = "strengthening";
  } else if (
    participationSupportChange ===
      "decreased" ||
    relationshipWeakened(
      previous.relationship,
      current.relationship
    )
  ) {
    development = "weakening";
  } else if (
    marketConditionChanged ||
    priceTrendChanged ||
    openInterestTrendChanged ||
    volumeTrendChanged ||
    leveragedFundsChanged ||
    assetManagersChanged ||
    relationshipChanged
  ) {
    development = "transitioning";
  }

  const changeSummary =
    buildChangeSummary(
      development,
      {
        marketConditionChanged,
        priceTrendChanged,
        openInterestTrendChanged,
        volumeTrendChanged,
        leveragedFundsChanged,
        assetManagersChanged,
        relationshipChanged,
        participationSupportChange,
      }
    );

  return {
    development,
    isFirstReport: false,

    marketConditionChanged,
    priceTrendChanged,
    openInterestTrendChanged,
    volumeTrendChanged,

    leveragedFundsChanged,
    assetManagersChanged,
    relationshipChanged,

    previousMarketConditionId:
      previous.marketConditionId,
    currentMarketConditionId:
      current.marketCondition.id,

    previousRelationship:
      previous.relationship,
    currentRelationship:
      current.relationship,

    participationSupportChange,

    changeSummary,
  };
}