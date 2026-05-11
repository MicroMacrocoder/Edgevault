import { NextResponse } from "next/server";
import {
  fetchStooqDxyVolumeOiRows,
  syncStooqDxyVolumeOiReports,
} from "@/lib/stooqDxy";

export async function GET() {
  try {
    const rows = await fetchStooqDxyVolumeOiRows();
    const syncResult = await syncStooqDxyVolumeOiReports();

    return NextResponse.json({
      error: false,
      message: "DXY Volume/OI synced successfully.",
      rowsFound: rows.length,
      synced: syncResult.synced,
      latestComplete: syncResult.latestComplete,
      sample: rows.slice(-5),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Unknown Stooq DXY sync error",
      },
      { status: 500 }
    );
  }
}
