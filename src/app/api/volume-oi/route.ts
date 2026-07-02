import { NextRequest, NextResponse } from "next/server";
import { fetchVolumeOIReportsFromCME } from "@/lib/volume-oi/cme";
import {
  getLatestVolumeOIUpdatedAt,
  getStoredVolumeOIReports,
  upsertVolumeOIReports,
} from "@/lib/supabase/volumeOi";
import { syncStooqDxyVolumeOiReports } from "@/lib/stooqDxy";

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
  yesterdayRefreshWindow.setUTCDate(yesterdayRefreshWindow.getUTCDate() - 1);

  return yesterdayRefreshWindow;
}

async function syncVolumeOIReportsIfNeeded() {
  const latestRefreshWindow = getLatestVolumeOIRefreshWindowUtc();

  const { error, updatedAt } = await getLatestVolumeOIUpdatedAt();

  if (error) {
    return {
      synced: false,
      syncDue: false,
      message: "Could not check latest Volume/OI sync time.",
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
      message: "Volume/OI data is already fresh.",
      lastSyncAt: updatedAt,
      latestRefreshWindow: latestRefreshWindow.toISOString(),
    };
  }

  const cmeReports = await fetchVolumeOIReportsFromCME(30);

  if (cmeReports.length) {
    const { error: upsertError } = await upsertVolumeOIReports(cmeReports);

    if (upsertError) {
      return {
        synced: false,
        syncDue: true,
        message: "Failed to save CME Volume/OI reports.",
        error: upsertError.message,
      };
    }
  }

  const dxySyncResult = await syncStooqDxyVolumeOiReports();

  return {
    synced: true,
    syncDue: true,
    message: "Volume/OI data refreshed successfully.",
    cmeCount: cmeReports.length,
    dxyCount: dxySyncResult.synced,
    latestDxyComplete: dxySyncResult.latestComplete,
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
      refreshStatus = await syncVolumeOIReportsIfNeeded();
    } catch (syncError) {
      console.error("VOLUME OI SMART REFRESH ERROR:", syncError);

      refreshStatus = {
        synced: false,
        syncDue: true,
        message:
          syncError instanceof Error
            ? syncError.message
            : "Volume/OI smart refresh failed.",
      };
    }

    const { error, reports } = await getStoredVolumeOIReports(symbol);

    if (error) {
      return NextResponse.json(
        {
          error: true,
          message: "Failed to fetch stored Volume/OI reports.",
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
        message: "Volume/OI reports fetched successfully.",
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
