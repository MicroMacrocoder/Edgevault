import { NextRequest, NextResponse } from "next/server";
import { getStoredCOTReports } from "@/lib/supabase/cotReports";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const symbol = searchParams.get("symbol") || "all";

    const { error, reports } = await getStoredCOTReports(symbol);

    if (error) {
      return NextResponse.json(
        {
          error: true,
          message: "Failed to fetch stored COT reports.",
          details: error.message,
          reports: [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: false,
        message: "COT reports fetched successfully.",
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
          error instanceof Error
            ? error.message
            : "Failed to fetch COT reports.",
        reports: [],
      },
      { status: 500 }
    );
  }
}
