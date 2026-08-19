import type {
  MarketIntelligencePriceObservation,
} from "@/lib/marketIntelligencePrice";

export const MARKET_INTELLIGENCE_MARKET_WINDOW = 15;

export type MarketIntelligenceVolumeOIRow = {
  trade_date: string;
  volume: number | null;
  open_interest: number | null;
  source?: string | null;
};

export type AlignedMarketObservation = {
  tradeDate: string;

  price: number;
  openInterest: number;
  volume: number;

  priceSourceSymbol: string;
  priceSourceClose: number;
  priceInverted: boolean;

  volumeOISource: string | null;
};

export type AlignedMarketWindow = {
  observations: AlignedMarketObservation[];

  observationCount: number;

  firstTradeDate: string;
  lastTradeDate: string;

  priceAsOf: string;
  openInterestAsOf: string;
  volumeAsOf: string;

  skippedVolumeOIDates: string[];
  missingPriceDates: string[];
};

function isValidTradeDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function isPositiveFiniteNumber(
  value: number | null
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

/**
 * Build the rolling Price + Open Interest + Volume evidence window.
 *
 * IMPORTANT:
 * Volume/OI is the anchor.
 *
 * EdgeVault does NOT independently take the latest 15 Price candles.
 * Instead it:
 *
 * 1. Starts from the stored Volume/OI report dates.
 * 2. Keeps only rows where BOTH Volume and Open Interest are valid > 0.
 * 3. Finds a completed D1 Price close for that exact same trade date.
 * 4. Keeps the latest 15 complete common observations.
 *
 * Therefore, if Volume/OI ends on Aug 17 while Price has Aug 18,
 * Aug 18 is NOT included.
 *
 * Likewise, if Aug 18 has OI = 0, that date is skipped and EdgeVault
 * walks backward until it has 15 valid aligned observations.
 *
 * Both inputs may contain more history than needed.
 * Output is always oldest -> newest.
 */
export function buildAlignedMarketWindow(
  priceHistory:
    MarketIntelligencePriceObservation[],
  volumeOIReports:
    MarketIntelligenceVolumeOIRow[]
): AlignedMarketWindow {
  const priceByTradeDate =
    new Map<
      string,
      MarketIntelligencePriceObservation
    >();

  for (
    const observation of priceHistory
  ) {
    if (
      !isValidTradeDate(
        observation.tradeDate
      ) ||
      !Number.isFinite(
        observation.close
      ) ||
      observation.close <= 0
    ) {
      continue;
    }

    priceByTradeDate.set(
      observation.tradeDate,
      observation
    );
  }

  const validVolumeOIByDate =
    new Map<
      string,
      MarketIntelligenceVolumeOIRow
    >();

  const skippedVolumeOIDates:
    string[] = [];

  for (
    const report of volumeOIReports
  ) {
    if (
      !isValidTradeDate(
        report.trade_date
      )
    ) {
      continue;
    }

    if (
      !isPositiveFiniteNumber(
        report.volume
      ) ||
      !isPositiveFiniteNumber(
        report.open_interest
      )
    ) {
      skippedVolumeOIDates.push(
        report.trade_date
      );
      continue;
    }

    validVolumeOIByDate.set(
      report.trade_date,
      report
    );
  }

  /*
   * Volume/OI determines the candidate trading dates.
   * Sort newest first so we can select the latest complete common dates.
   */
  const candidateDates =
    Array.from(
      validVolumeOIByDate.keys()
    ).sort(
      (first, second) =>
        second.localeCompare(first)
    );

  const missingPriceDates:
    string[] = [];

  const newestFirst:
    AlignedMarketObservation[] = [];

  for (
    const tradeDate of candidateDates
  ) {
    const volumeOI =
      validVolumeOIByDate.get(
        tradeDate
      );

    if (!volumeOI) {
      continue;
    }

    const price =
      priceByTradeDate.get(
        tradeDate
      );

    if (!price) {
      missingPriceDates.push(
        tradeDate
      );
      continue;
    }

    /*
     * These values were already validated above.
     * The extra guard keeps the returned type unquestionably numeric.
     */
    if (
      !isPositiveFiniteNumber(
        volumeOI.volume
      ) ||
      !isPositiveFiniteNumber(
        volumeOI.open_interest
      )
    ) {
      continue;
    }

    newestFirst.push({
      tradeDate,

      price: price.close,
      openInterest:
        volumeOI.open_interest,
      volume:
        volumeOI.volume,

      priceSourceSymbol:
        price.sourceSymbol,
      priceSourceClose:
        price.sourceClose,
      priceInverted:
        price.inverted,

      volumeOISource:
        volumeOI.source ?? null,
    });

    if (
      newestFirst.length ===
      MARKET_INTELLIGENCE_MARKET_WINDOW
    ) {
      break;
    }
  }

  if (
    newestFirst.length <
    MARKET_INTELLIGENCE_MARKET_WINDOW
  ) {
    throw new Error(
      `Market Intelligence needs ${MARKET_INTELLIGENCE_MARKET_WINDOW} complete aligned Price/Open Interest/Volume observations; only ${newestFirst.length} were available.`
    );
  }

  const observations =
    [...newestFirst].reverse();

  const firstTradeDate =
    observations[0].tradeDate;

  const lastTradeDate =
    observations[
      observations.length - 1
    ].tradeDate;

  return {
    observations,

    observationCount:
      observations.length,

    firstTradeDate,
    lastTradeDate,

    /*
     * Because every observation is aligned on the same date,
     * all three "as of" dates are the last common complete observation.
     */
    priceAsOf:
      lastTradeDate,
    openInterestAsOf:
      lastTradeDate,
    volumeAsOf:
      lastTradeDate,

    skippedVolumeOIDates:
      Array.from(
        new Set(
          skippedVolumeOIDates
        )
      ).sort(),

    missingPriceDates:
      Array.from(
        new Set(
          missingPriceDates
        )
      ).sort(),
  };
}

export function getAlignedPriceValues(
  window: AlignedMarketWindow
) {
  return window.observations.map(
    (observation) =>
      observation.price
  );
}

export function getAlignedOpenInterestValues(
  window: AlignedMarketWindow
) {
  return window.observations.map(
    (observation) =>
      observation.openInterest
  );
}

export function getAlignedVolumeValues(
  window: AlignedMarketWindow
) {
  return window.observations.map(
    (observation) =>
      observation.volume
  );
}