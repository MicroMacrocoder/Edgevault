import type {
  StoredCOTTFFReport,
} from "@/lib/supabase/cotTffReports";

export const MARKET_INTELLIGENCE_COT_WINDOW = 5;

export type AlignedCOTObservation = {
  reportDate: string;

  leveragedFunds: StoredCOTTFFReport;
  assetManagers: StoredCOTTFFReport;
};

export type AlignedCOTWindow = {
  observations: AlignedCOTObservation[];

  observationCount: number;

  firstReportDate: string;
  lastReportDate: string;

  cotAsOf: string;

  leveragedFundsNetPositions: number[];
  assetManagersNetPositions: number[];

  missingLeveragedFundsDates: string[];
  missingAssetManagerDates: string[];
};

function isValidReportDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function isFiniteNetPosition(
  value: number
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

/**
 * Build the five-report COT window used by Market Intelligence.
 *
 * EdgeVault requires BOTH:
 * - Leveraged Funds
 * - Asset Managers
 *
 * to exist on the same CFTC report date.
 *
 * Net Position may legitimately be:
 * - positive
 * - zero
 * - negative
 *
 * Therefore this function NEVER filters a COT report merely because
 * net_position is <= 0.
 *
 * The latest five COMMON valid report dates are selected and returned
 * oldest -> newest.
 */
export function buildAlignedCOTWindow(
  leveragedFundsReports:
    StoredCOTTFFReport[],
  assetManagerReports:
    StoredCOTTFFReport[]
): AlignedCOTWindow {
  const leveragedFundsByDate =
    new Map<
      string,
      StoredCOTTFFReport
    >();

  const assetManagersByDate =
    new Map<
      string,
      StoredCOTTFFReport
    >();

  for (
    const report of
      leveragedFundsReports
  ) {
    if (
      report.participant !==
        "leveraged_funds" ||
      !isValidReportDate(
        report.report_date
      ) ||
      !isFiniteNetPosition(
        report.net_position
      )
    ) {
      continue;
    }

    leveragedFundsByDate.set(
      report.report_date,
      report
    );
  }

  for (
    const report of
      assetManagerReports
  ) {
    if (
      report.participant !==
        "asset_manager" ||
      !isValidReportDate(
        report.report_date
      ) ||
      !isFiniteNetPosition(
        report.net_position
      )
    ) {
      continue;
    }

    assetManagersByDate.set(
      report.report_date,
      report
    );
  }

  const allDates =
    Array.from(
      new Set([
        ...leveragedFundsByDate.keys(),
        ...assetManagersByDate.keys(),
      ])
    ).sort(
      (first, second) =>
        second.localeCompare(first)
    );

  const missingLeveragedFundsDates:
    string[] = [];

  const missingAssetManagerDates:
    string[] = [];

  const newestFirst:
    AlignedCOTObservation[] = [];

  for (
    const reportDate of allDates
  ) {
    const leveragedFunds =
      leveragedFundsByDate.get(
        reportDate
      );

    const assetManagers =
      assetManagersByDate.get(
        reportDate
      );

    if (!leveragedFunds) {
      missingLeveragedFundsDates.push(
        reportDate
      );
      continue;
    }

    if (!assetManagers) {
      missingAssetManagerDates.push(
        reportDate
      );
      continue;
    }

    newestFirst.push({
      reportDate,
      leveragedFunds,
      assetManagers,
    });

    if (
      newestFirst.length ===
      MARKET_INTELLIGENCE_COT_WINDOW
    ) {
      break;
    }
  }

  if (
    newestFirst.length <
    MARKET_INTELLIGENCE_COT_WINDOW
  ) {
    throw new Error(
      `Market Intelligence needs ${MARKET_INTELLIGENCE_COT_WINDOW} complete common COT reports for Leveraged Funds and Asset Managers; only ${newestFirst.length} were available.`
    );
  }

  const observations =
    [...newestFirst].reverse();

  const firstReportDate =
    observations[0].reportDate;

  const lastReportDate =
    observations[
      observations.length - 1
    ].reportDate;

  return {
    observations,

    observationCount:
      observations.length,

    firstReportDate,
    lastReportDate,

    cotAsOf:
      lastReportDate,

    leveragedFundsNetPositions:
      observations.map(
        (observation) =>
          observation.leveragedFunds
            .net_position
      ),

    assetManagersNetPositions:
      observations.map(
        (observation) =>
          observation.assetManagers
            .net_position
      ),

    missingLeveragedFundsDates:
      Array.from(
        new Set(
          missingLeveragedFundsDates
        )
      ).sort(),

    missingAssetManagerDates:
      Array.from(
        new Set(
          missingAssetManagerDates
        )
      ).sort(),
  };
}