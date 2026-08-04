import { NextRequest, NextResponse } from "next/server";
import {
  fetchVolumeOIReportsFromCME,
  VOLUME_OI_SYMBOLS,
} from "@/lib/volume-oi/cme";
import {
  getLatestVolumeOIUpdatedAt,
  getStoredVolumeOIReports,
  upsertVolumeOIReports,
} from "@/lib/supabase/volumeOi";

const DAILY_VOLUME_OI_REFRESH_HOUR_UTC = 22;
const DAILY_VOLUME_OI_REFRESH_MINUTE_UTC = 15;

function getLatestVolumeOIRefreshWindowUtc(now = new Date()) {
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

  const yesterdayRefreshWindow = new Date(todayRefreshWindow);
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
      const result = await getLatestVolumeOIUpdatedAt(
        symbolConfig.symbol
      );

      return {
        symbol: symbolConfig.symbol,
        error: result.error,
        updatedAt: result.updatedAt,
      };
    })
  );

  const failedCheck = results.find((result) => result.error);

  if (failedCheck) {
    return {
      error: failedCheck.error,
      syncDue: false,
      latestUpdatedAt: null as string | null,
      oldestUpdatedAt: null as string | null,
    };
  }

  const timestamps = results
    .map((result) => result.updatedAt)
    .filter((value): value is string => Boolean(value));

  const allSymbolsHaveData =
    timestamps.length === VOLUME_OI_SYMBOLS.length;

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

  const syncDue =
    !allSymbolsHaveData ||
    !oldestUpdatedAt ||
    new Date(oldestUpdatedAt).getTime() <
      latestRefreshWindow.getTime();

  return {
    error: null,
    syncDue,
    latestUpdatedAt,
    oldestUpdatedAt,
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
      message: "Could not check CME Volume/OI freshness.",
      details: cmeState.error.message,
      latestUpdatedAt: null,
      oldestUpdatedAt: null,
    };
  }

  if (!cmeState.syncDue) {
    return {
      synced: false,
      syncDue: false,
      message: "CME Volume/OI data is already fresh.",
      latestUpdatedAt: cmeState.latestUpdatedAt,
      oldestUpdatedAt: cmeState.oldestUpdatedAt,
    };
  }

  const cmeReports = await fetchVolumeOIReportsFromCME(30);

  if (!cmeReports.length) {
    return {
      synced: false,
      syncDue: true,
      message: "CME returned no Volume/OI reports.",
      reportCount: 0,
      latestUpdatedAt: cmeState.latestUpdatedAt,
      oldestUpdatedAt: cmeState.oldestUpdatedAt,
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

  return {
    synced: true,
    syncDue: true,
    message: "CME Volume/OI data refreshed successfully.",
    reportCount: cmeReports.length,
    previousLatestUpdatedAt: cmeState.latestUpdatedAt,
    previousOldestUpdatedAt: cmeState.oldestUpdatedAt,
  };
}

async function getDxyRefreshState(
  latestRefreshWindow: Date
) {
  const { error, updatedAt } =
    await getLatestVolumeOIUpdatedAt("DXY");

  if (error) {
    return {
      synced: false,
      syncDue: false,
      message: "Could not check DXY Volume/OI freshness.",
      details: error.message,
      lastSyncAt: null,
    };
  }

  const syncDue =
    !updatedAt ||
    new Date(updatedAt).getTime() <
      latestRefreshWindow.getTime();

  return {
    synced: false,
    syncDue,
    message: syncDue
      ? "DXY is waiting for the scheduled browser collector."
      : "DXY Volume/OI data is fresh.",
    lastSyncAt: updatedAt,
  };
}

async function checkAndRefreshVolumeOI() {
  const latestRefreshWindow =
    getLatestVolumeOIRefreshWindowUtc();

  const [cmeStatus, dxyStatus] = await Promise.all([
    refreshCmeIfNeeded(latestRefreshWindow),
    getDxyRefreshState(latestRefreshWindow),
  ]);

  return {
    synced: cmeStatus.synced,
    syncDue: cmeStatus.syncDue || dxyStatus.syncDue,
    message: "CME and DXY freshness checked independently.",
    latestRefreshWindow:
      latestRefreshWindow.toISOString(),
    cme: cmeStatus,
    dxy: dxyStatus,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "all";

    let refreshStatus = null;

    try {
      refreshStatus = await checkAndRefreshVolumeOI();
    } catch (syncError) {
      console.error(
        "VOLUME OI SMART REFRESH ERROR:",
        syncError
      );

      refreshStatus = {
        synced: false,
        syncDue: true,
        message:
          syncError instanceof Error
            ? syncError.message
            : "Volume/OI smart refresh failed.",
      };
    }

    const { error, reports } =
      await getStoredVolumeOIReports(symbol);

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
    console.error("VOLUME OI READ API ERROR:", error);

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