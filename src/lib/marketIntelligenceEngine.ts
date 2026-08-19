import {
  getMarketCondition,
} from "@/lib/marketIntelligence";
import {
  analyzeRollingMarketTrend,
} from "@/lib/marketIntelligenceTrend";
import {
  analyzeCOTNetPositionTrend,
  type COTTrendDirection,
} from "@/lib/marketIntelligenceCot";
import {
  buildCombinedMarketIntelligenceState,
  type MarketPositioningRelationship,
} from "@/lib/marketIntelligenceCombined";
import {
  compareMarketIntelligenceWithPrevious,
} from "@/lib/marketIntelligenceContinuity";
import {
  buildMarketIntelligenceNarrative,
} from "@/lib/marketIntelligenceNarrative";
import {
  fetchMarketIntelligencePriceHistory,
  getMarketIntelligencePriceSource,
  type MarketIntelligenceSymbol,
} from "@/lib/marketIntelligencePrice";
import {
  buildAlignedMarketWindow,
  getAlignedOpenInterestValues,
  getAlignedPriceValues,
  getAlignedVolumeValues,
} from "@/lib/marketIntelligenceWindow";
import {
  buildAlignedCOTWindow,
} from "@/lib/marketIntelligenceCotWindow";
import {
  getStoredVolumeOIReports,
} from "@/lib/supabase/volumeOi";
import {
  getStoredCOTTFFReports,
} from "@/lib/supabase/cotTffReports";
import {
  getPreviousMarketIntelligenceReport,
  type MarketIntelligenceReportInput,
  type MarketIntelligenceReportType,
  type StoredMarketIntelligenceReport,
} from "@/lib/supabase/marketIntelligenceReports";

export type BuildMarketIntelligenceDraftOptions = {
  symbol: MarketIntelligenceSymbol;
  analysisDate: string;
  reportType: MarketIntelligenceReportType;
};

export type MarketIntelligenceDraft = {
  report: MarketIntelligenceReportInput;

  previousReport:
    | StoredMarketIntelligenceReport
    | null;
};

function isValidAnalysisDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function isCOTTrendDirection(
  value: unknown
): value is COTTrendDirection {
  return (
    value === "bullish" ||
    value === "sideways" ||
    value === "bearish"
  );
}

function isMarketRelationship(
  value: unknown
): value is MarketPositioningRelationship {
  return (
    value === "aligned" ||
    value === "positioning_leads" ||
    value === "diverging" ||
    value === "neutral" ||
    value === "mixed"
  );
}

function getPreviousContinuityState(
  previous:
    | StoredMarketIntelligenceReport
    | null
) {
  if (!previous) {
    return null;
  }

  return {
    marketConditionId:
      previous.market_condition_id,

    priceTrend:
      previous.price_trend,
    openInterestTrend:
      previous.oi_trend,
    volumeTrend:
      previous.volume_trend,

    leveragedFundsDirection:
      isCOTTrendDirection(
        previous.leveraged_funds_state
      )
        ? previous.leveraged_funds_state
        : null,

    assetManagersDirection:
      isCOTTrendDirection(
        previous.asset_managers_state
      )
        ? previous.asset_managers_state
        : null,

    relationship:
      isMarketRelationship(
        previous.cot_relationship
      )
        ? previous.cot_relationship
        : null,
  };
}

/**
 * Build a complete Market Intelligence report draft.
 *
 * This function DOES NOT save anything to Supabase.
 *
 * It only:
 * 1. reads the existing source data,
 * 2. builds the aligned evidence windows,
 * 3. runs the deterministic classifiers,
 * 4. compares with the previous saved report,
 * 5. produces the zero-cost narrative,
 * 6. returns the exact report object that can be saved later.
 *
 * Keeping saving out of this step makes the engine safe to test before
 * we allow scheduled jobs to write permanent historical reports.
 */
export async function buildMarketIntelligenceReportDraft(
  options: BuildMarketIntelligenceDraftOptions
): Promise<MarketIntelligenceDraft> {
  const {
    symbol,
    analysisDate,
    reportType,
  } = options;

  if (
    !isValidAnalysisDate(
      analysisDate
    )
  ) {
    throw new Error(
      `Invalid Market Intelligence analysis date: ${analysisDate}`
    );
  }

  const [
    priceHistoryResult,
    volumeOIResult,
    leveragedFundsResult,
    assetManagersResult,
    previousResult,
  ] = await Promise.all([
    fetchMarketIntelligencePriceHistory(
      symbol
    ),

    getStoredVolumeOIReports(
      symbol
    ),

    getStoredCOTTFFReports({
      symbol,
      participant:
        "leveraged_funds",
      endDate:
        analysisDate,
    }),

    getStoredCOTTFFReports({
      symbol,
      participant:
        "asset_manager",
      endDate:
        analysisDate,
    }),

    getPreviousMarketIntelligenceReport(
      symbol,
      analysisDate
    ),
  ]);

  if (volumeOIResult.error) {
    throw new Error(
      `Could not load stored Volume/Open Interest data for ${symbol}: ${volumeOIResult.error.message}`
    );
  }

  if (leveragedFundsResult.error) {
    throw new Error(
      `Could not load Leveraged Funds COT data for ${symbol}: ${leveragedFundsResult.error.message}`
    );
  }

  if (assetManagersResult.error) {
    throw new Error(
      `Could not load Asset Managers COT data for ${symbol}: ${assetManagersResult.error.message}`
    );
  }

  if (previousResult.error) {
    throw new Error(
      `Could not load the previous Market Intelligence report for ${symbol}: ${previousResult.error.message}`
    );
  }

  /*
   * Do not allow a draft for an earlier analysis date to accidentally
   * consume later Price or Volume/OI trade dates.
   *
   * This is a basic chronological guard. Historical backfill/replay
   * should still be treated separately because release-time knowledge
   * (especially COT publication timing) requires its own controls.
   */
  const eligiblePriceHistory =
    priceHistoryResult.filter(
      (observation) =>
        observation.tradeDate <=
        analysisDate
    );

  const eligibleVolumeOI =
    volumeOIResult.reports.filter(
      (report) =>
        report.trade_date <=
        analysisDate
    );

  /*
   * Volume/OI is the anchor.
   * Price is matched to those exact complete report dates.
   */
  const marketWindow =
    buildAlignedMarketWindow(
      eligiblePriceHistory,
      eligibleVolumeOI
    );

  const priceTrend =
    analyzeRollingMarketTrend(
      getAlignedPriceValues(
        marketWindow
      )
    );

  const openInterestTrend =
    analyzeRollingMarketTrend(
      getAlignedOpenInterestValues(
        marketWindow
      )
    );

  const volumeTrend =
    analyzeRollingMarketTrend(
      getAlignedVolumeValues(
        marketWindow
      )
    );

  const marketCondition =
    getMarketCondition(
      priceTrend.direction,
      openInterestTrend.direction,
      volumeTrend.direction
    );

  const cotWindow =
    buildAlignedCOTWindow(
      leveragedFundsResult.reports,
      assetManagersResult.reports
    );

  const leveragedFunds =
    analyzeCOTNetPositionTrend(
      cotWindow
        .leveragedFundsNetPositions
    );

  const assetManagers =
    analyzeCOTNetPositionTrend(
      cotWindow
        .assetManagersNetPositions
    );

  const combined =
    buildCombinedMarketIntelligenceState(
      marketCondition,
      leveragedFunds,
      assetManagers
    );

  const previousReport =
    previousResult.report;

  const continuity =
    compareMarketIntelligenceWithPrevious(
      {
        current:
          combined,

        currentPriceTrend:
          priceTrend.direction,
        currentOpenInterestTrend:
          openInterestTrend.direction,
        currentVolumeTrend:
          volumeTrend.direction,

        previous:
          getPreviousContinuityState(
            previousReport
          ),
      }
    );

  const narrative =
    buildMarketIntelligenceNarrative(
      {
        symbol,

        marketCondition,

        price:
          priceTrend,
        openInterest:
          openInterestTrend,
        volume:
          volumeTrend,

        leveragedFunds,
        assetManagers,

        combined,
        continuity,

        previous:
          previousReport
            ? {
                analysisDate:
                  previousReport.analysis_date,
                marketConditionLabel:
                  previousReport.market_condition_label,
                dashboardSummary:
                  previousReport.dashboard_summary,
              }
            : null,
      }
    );

  const priceSource =
    getMarketIntelligencePriceSource(
      symbol
    );

  const report:
    MarketIntelligenceReportInput =
    {
      symbol,
      analysis_date:
        analysisDate,
      report_type:
        reportType,

      previous_report_id:
        previousReport?.id ??
        null,

      engine_version:
        "v1",
      narrative_source:
        "template",
      narrative_model:
        null,

      cot_as_of:
        cotWindow.cotAsOf,
      price_as_of:
        marketWindow.priceAsOf,
      oi_as_of:
        marketWindow.openInterestAsOf,
      volume_as_of:
        marketWindow.volumeAsOf,

      price_trend:
        priceTrend.direction,
      oi_trend:
        openInterestTrend.direction,
      volume_trend:
        volumeTrend.direction,

      market_condition_id:
        marketCondition.id,
      market_condition_key:
        marketCondition.key,
      market_condition_label:
        marketCondition.label,

      /*
       * These columns store the five-report DIRECTION,
       * not the latest net-position sign.
       *
       * Current net-long/net-short status is preserved below
       * inside analysis_state.
       */
      leveraged_funds_state:
        leveragedFunds.direction,
      asset_managers_state:
        assetManagers.direction,

      cot_relationship:
        combined.relationship,

      combined_state_key:
        combined.combinedStateKey,

      story_development:
        continuity.development,

      change_from_previous:
        continuity.changeSummary,

      technical_meaning:
        narrative.technicalMeaning,

      dashboard_summary:
        narrative.dashboardSummary,

      detailed_analysis:
        narrative.detailedAnalysis,

      continuation_outlook:
        narrative.continuationOutlook,

      reversal_outlook:
        narrative.reversalOutlook,

      /*
       * Freeze the exact evidence used for this report.
       */
      market_window:
        marketWindow.observations,

      cot_window:
        cotWindow.observations.map(
          (observation) => ({
            reportDate:
              observation.reportDate,
            leveragedFunds:
              observation.leveragedFunds,
            assetManagers:
              observation.assetManagers,
          })
        ),

      analysis_state: {
        price:
          priceTrend,
        openInterest:
          openInterestTrend,
        volume:
          volumeTrend,

        marketCondition: {
          id:
            marketCondition.id,
          key:
            marketCondition.key,
          label:
            marketCondition.label,
        },

        leveragedFunds: {
          ...leveragedFunds,
        },

        assetManagers: {
          ...assetManagers,
        },

        cotCombination: {
          id:
            combined.cotCombination.id,
          key:
            combined.cotCombination.key,
          bias:
            combined.cotCombination.bias,
        },

        combinedStateId:
          combined.combinedStateId,
        combinedStateKey:
          combined.combinedStateKey,

        relationship:
          combined.relationship,

        continuity,
      },

      source_snapshot: {
        price: {
          provider:
            priceSource.provider,
          sourceSymbol:
            priceSource.streamSymbol,
          interval:
            priceSource.interval,
          inverted:
            priceSource.inverted,
          asOf:
            marketWindow.priceAsOf,
        },

        volumeOpenInterest: {
          asOf:
            marketWindow.openInterestAsOf,
          skippedInvalidDates:
            marketWindow.skippedVolumeOIDates,
          missingPriceDates:
            marketWindow.missingPriceDates,
        },

        cot: {
          provider:
            "CFTC TFF Futures Only",
          asOf:
            cotWindow.cotAsOf,
          firstReportDate:
            cotWindow.firstReportDate,
          lastReportDate:
            cotWindow.lastReportDate,
          missingLeveragedFundsDates:
            cotWindow.missingLeveragedFundsDates,
          missingAssetManagerDates:
            cotWindow.missingAssetManagerDates,
        },
      },
    };

  return {
    report,
    previousReport,
  };
}