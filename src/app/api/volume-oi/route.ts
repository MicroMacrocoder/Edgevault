import { NextRequest, NextResponse } from "next/server";
import {
  fetchVolumeOIReportsFromCME,
  VOLUME_OI_SYMBOLS,
} from "@/lib/volume-oi/cme";
import {
  getLatestVolumeOITradeDate,
  getLatestVolumeOIUpdatedAt,
  getStoredVolumeOIReports,
  upsertVolumeOIReports,
} from "@/lib/supabase/volumeOi";

const DAILY_VOLUME_OI_REFRESH_HOUR_UTC = 0;
const DAILY_VOLUME_OI_REFRESH_MINUTE_UTC = 0;

/**
 * Volume/OI is daily market data and can naturally lag by one completed
 * business day while the exchange/source finalizes the next report.
 *
 * We therefore treat:
 * - 0 or 1 completed business-day lag = recent/current
 * - 2+ completed business-day lag = stale/incomplete
 *
 * Weekends are ignored. Exchange holidays are not hard-coded here.
 */
function countCompletedBusinessDaysSince(
  tradeDate: string,
  now = new Date()
) {
  const parsedTradeDate = new Date(
    tradeDate + "T00:00:00.000Z"
  );

  if (Number.isNaN(parsedTradeDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const todayUtc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );

  const cursor = new Date(parsedTradeDate);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let completedBusinessDays = 0;

  while (cursor.getTime() < todayUtc.getTime()) {
    const weekday = cursor.getUTCDay();

    if (weekday !== 0 && weekday !== 6) {
      completedBusinessDays += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return completedBusinessDays;
}

function isRecentMarketTradeDate(
  tradeDate: string | null,
  now = new Date()
) {
  if (!tradeDate) {
    return false;
  }

  return countCompletedBusinessDaysSince(
    tradeDate,
    now
  ) <= 1;
}

function getLatestVolumeOIRefreshWindowUtc(
  now = new Date()
) {
  const todayRefreshWindow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      DAILY_VOLUME_OI_REFRESH_HOUR_UTC,
      DAILY_VOLUME_OI_REFRESH_MINUTE_UTC,
      0,
      0
    )
  );

  if (now.getTime() >= todayRefreshWindow.getTime()) {
    return todayRefreshWindow;
  }

  const yesterdayRefreshWindow =
    new Date(todayRefreshWindow);

  yesterdayRefreshWindow.setUTCDate(
    yesterdayRefreshWindow.getUTCDate() - 1
  );

  return yesterdayRefreshWindow;
}

async function getCmeRefreshState(
  latestRefreshWindow: Date
) {
  const results = await Promise.all(
    VOLUME_OI_SYMBOLS.map(async (symbolConfig) => {
      const [updatedResult, tradeDateResult] =
        await Promise.all([
          getLatestVolumeOIUpdatedAt(
            symbolConfig.symbol
          ),
          getLatestVolumeOITradeDate(
            symbolConfig.symbol
          ),
        ]);

      return {
        symbol: symbolConfig.symbol,
        error:
          updatedResult.error ||
          tradeDateResult.error,
        updatedAt: updatedResult.updatedAt,
        tradeDate: tradeDateResult.tradeDate,
      };
    })
  );

  const failedCheck = results.find(
    (result) => result.error
  );

  if (failedCheck) {
    return {
      error: failedCheck.error,
      syncDue: false,
      marketDataCurrent: false,
      latestUpdatedAt: null as string | null,
      oldestUpdatedAt: null as string | null,
      latestTradeDate: null as string | null,
      oldestTradeDate: null as string | null,
      symbols: results,
    };
  }

  const timestamps = results
    .map((result) => result.updatedAt)
    .filter(
      (value): value is string =>
        Boolean(value)
    );

  const tradeDates = results
    .map((result) => result.tradeDate)
    .filter(
      (value): value is string =>
        Boolean(value)
    );

  const allSymbolsHaveSyncTimes =
    timestamps.length ===
    VOLUME_OI_SYMBOLS.length;

  const allSymbolsHaveTradeDates =
    tradeDates.length ===
    VOLUME_OI_SYMBOLS.length;

  const oldestUpdatedAt = timestamps.length
    ? timestamps.reduce((oldest, current) =>
        new Date(current).getTime() <
        new Date(oldest).getTime()
          ? current
          : oldest
      )
    : null;

  const latestUpdatedAt = timestamps.length
    ? timestamps.reduce((latest, current) =>
        new Date(current).getTime() >
        new Date(latest).getTime()
          ? current
          : latest
      )
    : null;

  const oldestTradeDate = tradeDates.length
    ? tradeDates.reduce((oldest, current) =>
        current < oldest ? current : oldest
      )
    : null;

  const latestTradeDate = tradeDates.length
    ? tradeDates.reduce((latest, current) =>
        current > latest ? current : latest
      )
    : null;

  /**
   * syncDue answers only:
   * "Have we already attempted the CME refresh for this window?"
   *
   * It intentionally uses updated_at for cadence, not for market freshness.
   */
  const syncDue =
    !allSymbolsHaveSyncTimes ||
    !oldestUpdatedAt ||
    new Date(oldestUpdatedAt).getTime() <
      latestRefreshWindow.getTime();

  /**
   * marketDataCurrent answers:
   * "Are the actual CME trade dates recent?"
   *
   * All six symbols must have real market dates and the oldest of those
   * dates must still be within the accepted business-day lag.
   */
  const marketDataCurrent =
    allSymbolsHaveTradeDates &&
    isRecentMarketTradeDate(
      oldestTradeDate
    );

  return {
    error: null,
    syncDue,
    marketDataCurrent,
    latestUpdatedAt,
    oldestUpdatedAt,
    latestTradeDate,
    oldestTradeDate,
    symbols: results,
  };
}

async function refreshCmeIfNeeded(
  latestRefreshWindow: Date
) {
  const cmeState = await getCmeRefreshState(
    latestRefreshWindow
  );

  if (cmeState.error) {
    return {
      synced: false,
      syncDue: false,
      marketDataCurrent: false,
      message:
        "Could not check CME Volume/OI status.",
      details: cmeState.error.message,
      latestUpdatedAt: null,
      oldestUpdatedAt: null,
      latestTradeDate: null,
      oldestTradeDate: null,
    };
  }

  if (!cmeState.syncDue) {
    return {
      synced: false,
      syncDue: false,
      marketDataCurrent:
        cmeState.marketDataCurrent,
      message: cmeState.marketDataCurrent
        ? "CME refresh already checked this window; latest market data is current."
        : "CME refresh already checked this window, but the latest market trade date is still behind.",
      latestUpdatedAt:
        cmeState.latestUpdatedAt,
      oldestUpdatedAt:
        cmeState.oldestUpdatedAt,
      latestTradeDate:
        cmeState.latestTradeDate,
      oldestTradeDate:
        cmeState.oldestTradeDate,
    };
  }

  const cmeReports =
    await fetchVolumeOIReportsFromCME(30);

  if (!cmeReports.length) {
    return {
      synced: false,
      syncDue: true,
      marketDataCurrent:
        cmeState.marketDataCurrent,
      message:
        "CME returned no Volume/OI reports.",
      reportCount: 0,
      latestUpdatedAt:
        cmeState.latestUpdatedAt,
      oldestUpdatedAt:
        cmeState.oldestUpdatedAt,
      latestTradeDate:
        cmeState.latestTradeDate,
      oldestTradeDate:
        cmeState.oldestTradeDate,
    };
  }

  const { error: upsertError } =
    await upsertVolumeOIReports(cmeReports);

  if (upsertError) {
    throw new Error(
      "Failed to save CME Volume/OI reports: " +
        upsertError.message
    );
  }

  /**
   * Re-read status after the save so a successful refresh does not
   * incorrectly return syncDue: true.
   */
  const refreshedState =
    await getCmeRefreshState(
      latestRefreshWindow
    );

  return {
    synced: true,
    syncDue: refreshedState.syncDue,
    marketDataCurrent:
      refreshedState.marketDataCurrent,
    message:
      refreshedState.marketDataCurrent
        ? "CME Volume/OI data refreshed successfully; latest market data is current."
        : "CME Volume/OI data refreshed successfully, but the latest market trade date is still behind.",
    reportCount: cmeReports.length,
    previousLatestUpdatedAt:
      cmeState.latestUpdatedAt,
    previousOldestUpdatedAt:
      cmeState.oldestUpdatedAt,
    latestUpdatedAt:
      refreshedState.latestUpdatedAt,
    oldestUpdatedAt:
      refreshedState.oldestUpdatedAt,
    latestTradeDate:
      refreshedState.latestTradeDate,
    oldestTradeDate:
      refreshedState.oldestTradeDate,
  };
}

async function getDxyRefreshState(
  latestRefreshWindow: Date
) {
  const [updatedResult, tradeDateResult] =
    await Promise.all([
      getLatestVolumeOIUpdatedAt("DXY"),
      getLatestVolumeOITradeDate("DXY"),
    ]);

  const error =
    updatedResult.error ||
    tradeDateResult.error;

  if (error) {
    return {
      synced: false,
      syncDue: false,
      marketDataCurrent: false,
      message:
        "Could not check DXY Volume/OI status.",
      details: error.message,
      lastSyncAt: null,
      latestTradeDate: null,
    };
  }

  const updatedAt =
    updatedResult.updatedAt;

  const tradeDate =
    tradeDateResult.tradeDate;

  /**
   * DXY syncDue still means whether the scheduled collector has checked
   * this refresh window.
   */
  const syncDue =
    !updatedAt ||
    new Date(updatedAt).getTime() <
      latestRefreshWindow.getTime();

  /**
   * Actual DXY data freshness comes from trade_date, not updated_at.
   */
  const marketDataCurrent =
    isRecentMarketTradeDate(tradeDate);

  let message: string;

  if (syncDue) {
    message =
      "DXY is waiting for the scheduled browser collector.";
  } else if (!marketDataCurrent) {
    message =
      "DXY collector has checked this window, but the latest complete market data is still behind.";
  } else {
    message =
      "DXY collector has checked this window and the latest complete market data is current.";
  }

  return {
    synced: false,
    syncDue,
    marketDataCurrent,
    message,
    lastSyncAt: updatedAt,
    latestTradeDate: tradeDate,
  };
}

async function checkAndRefreshVolumeOI() {
  const latestRefreshWindow =
    getLatestVolumeOIRefreshWindowUtc();

  const [cmeStatus, dxyStatus] =
    await Promise.all([
      refreshCmeIfNeeded(
        latestRefreshWindow
      ),
      getDxyRefreshState(
        latestRefreshWindow
      ),
    ]);

  return {
    synced: cmeStatus.synced,
    syncDue:
      cmeStatus.syncDue ||
      dxyStatus.syncDue,
    marketDataCurrent:
      cmeStatus.marketDataCurrent &&
      dxyStatus.marketDataCurrent,
    message:
      "CME and DXY sync cadence and market-data freshness checked independently.",
    latestRefreshWindow:
      latestRefreshWindow.toISOString(),
    cme: cmeStatus,
    dxy: dxyStatus,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const symbol =
      searchParams.get("symbol") || "all";

    let refreshStatus = null;

    try {
      refreshStatus =
        await checkAndRefreshVolumeOI();
    } catch (syncError) {
      console.error(
        "VOLUME OI SMART REFRESH ERROR:",
        syncError
      );

      refreshStatus = {
        synced: false,
        syncDue: true,
        marketDataCurrent: false,
        message:
          syncError instanceof Error
            ? syncError.message
            : "Volume/OI smart refresh failed.",
      };
    }

    const { error, reports } =
      await getStoredVolumeOIReports(
        symbol
      );

    if (error) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Failed to fetch stored Volume/OI reports.",
          details: error.message,
          refreshStatus,
          reports: [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: false,
        message:
          "Volume/OI reports fetched successfully.",
        refreshStatus,
        reports,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "VOLUME OI READ API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch Volume/OI reports.",
        reports: [],
      },
      { status: 500 }
    );
  }
}