import { NextResponse } from "next/server";
import { fetchVolumeOIReportsFromCME } from "@/lib/volume-oi/cme";
import { upsertVolumeOIReports } from "@/lib/supabase/volumeOi";

export async function GET() {
  try {
    const reports = await fetchVolumeOIReportsFromCME(30);

    if (!reports.length) {
      return NextResponse.json(
        {
          error: false,
          message: "No Volume/OI reports found from CME.",
          count: 0,
        },
        { status: 200 }
      );
    }

    const { error } = await upsertVolumeOIReports(reports);

    if (error) {
      return NextResponse.json(
        {
          error: true,
          message: "Failed to save Volume/OI reports to Supabase.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: false,
        message: "Volume/OI reports synced successfully.",
        count: reports.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("VOLUME OI SYNC API ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to sync Volume/OI reports.",
      },
      { status: 500 }
    );
  }
}
