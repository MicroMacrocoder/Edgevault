import { NextRequest, NextResponse } from "next/server";
import { fetchCOTReportsFromCFTC } from "@/lib/cot/cftc";
import {
  getLatestCOTUpdatedAt,
  getStoredCOTReports,
  upsertCOTReports,
} from "@/lib/supabase/cotReports";

const WEEKLY_COT_REFRESH_HOUR_UTC = 22;
const WEEKLY_COT_REFRESH_MINUTE_UTC = 15;
const FRIDAY_UTC_DAY = 5;

function getLatestCOTRefreshWindowUtc(now = new Date()) {
  const todayDay = now.getUTCDay();

  const daysSinceFriday =
    todayDay >= FRIDAY_UTC_DAY
      ? todayDay - FRIDAY_UTC_DAY
      : todayDay + 7 - FRIDAY_UTC_DAY;

  const latestFridayRefreshWindow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      WEEKLY_COT_REFRESH_HOUR_UTC,
      WEEKLY_COT_REFRESH_MINUTE_UTC,
      0,
      0
    )
  );

  latestFridayRefreshWindow.setUTCDate(
    latestFridayRefreshWindow.getUTCDate() - daysSinceFriday
  );

  if (now.getTime() >= latestFridayRefreshWindow.getTime()) {
    return latestFridayRefreshWindow;
  }

  latestFridayRefreshWindow.setUTCDate(
    latestFridayRefreshWindow.getUTCDate() - 7
  );

  return latestFridayRefreshWindow;
}

async function syncCOTReportsIfNeeded() {
  const latestRefreshWindow = getLatestCOTRefreshWindowUtc();

  const { error, updatedAt } = await getLatestCOTUpdatedAt();

  if (error) {
    return {
      synced: false,
      syncDue: false,
      message: "Could not check latest COT sync time.",
      details: error.message,
    };
  }

  const lastSyncTime = updatedAt ? new Date(updatedAt) : null;

  const syncDue =
    !lastSyncTime ||
    lastSyncTime.getTime() < latestRefreshWindow.getTime();

  if (!syncDue) {
    return {
      synced: false,
      syncDue: false,
      message: "COT data is already fresh.",
      lastSyncAt: updatedAt,
      latestRefreshWindow: latestRefreshWindow.toISOString(),
    };
  }

  const reports = await fetchCOTReportsFromCFTC("2025-01-01");

  if (!reports.length) {
    return {
      synced: false,
      syncDue: true,
      message: "No COT reports found from CFTC.",
      count: 0,
      previousSyncAt: updatedAt,
      latestRefreshWindow: latestRefreshWindow.toISOString(),
    };
  }

  const { error: upsertError } = await upsertCOTReports(reports);

  if (upsertError) {
    throw new Error("Failed to save COT reports: " + upsertError.message);
  }

  return {
    synced: true,
    syncDue: true,
    message: "COT data refreshed successfully.",
    count: reports.length,
    previousSyncAt: updatedAt,
    latestRefreshWindow: latestRefreshWindow.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const symbol = searchParams.get("symbol") || "all";

    let refreshStatus = null;

    try {
      refreshStatus = await syncCOTReportsIfNeeded();
    } catch (syncError) {
      console.error("COT SMART REFRESH ERROR:", syncError);

      refreshStatus = {
        synced: false,
        syncDue: true,
        message:
          syncError instanceof Error
            ? syncError.message
            : "COT smart refresh failed.",
      };
    }

    const { error, reports } = await getStoredCOTReports(symbol);

    if (error) {
      return NextResponse.json(
        {
          error: true,
          message: "Failed to fetch stored COT reports.",
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
        message: "COT reports fetched successfully.",
        refreshStatus,
        reports,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("COT READ API ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error ? error.message : "Failed to fetch COT reports.",
        reports: [],
      },
      { status: 500 }
    );
  }
}
