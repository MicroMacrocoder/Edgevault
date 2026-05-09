import { NextResponse } from "next/server";
import { fetchCOTReportsFromCFTC } from "@/lib/cot/cftc";
import { upsertCOTReports } from "@/lib/supabase/cotReports";

export async function GET() {
  try {
    const reports = await fetchCOTReportsFromCFTC("2025-01-01");

    if (!reports.length) {
      return NextResponse.json(
        {
          error: false,
          message: "No COT reports found from CFTC.",
          count: 0,
        },
        { status: 200 }
      );
    }

    const { error } = await upsertCOTReports(reports);

    if (error) {
      return NextResponse.json(
        {
          error: true,
          message: "Failed to save COT reports to Supabase.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: false,
        message: "COT reports synced successfully.",
        count: reports.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("COT SYNC API ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to sync COT reports.",
      },
      { status: 500 }
    );
  }
}
