import { NextResponse } from "next/server";
import { fetchCOTTFFReportsFromCFTC } from "@/lib/cot/tff";
import { upsertCOTTFFReports } from "@/lib/supabase/cotTffReports";

const TFF_BACKFILL_START_DATE = "2025-01-01";

export async function GET() {
  try {
    const reports =
      await fetchCOTTFFReportsFromCFTC(
        TFF_BACKFILL_START_DATE
      );

    if (!reports.length) {
      return NextResponse.json(
        {
          error: false,
          message:
            "No CFTC TFF reports found.",
          count: 0,
          startDate:
            TFF_BACKFILL_START_DATE,
        },
        { status: 200 }
      );
    }

    const { error, count } =
      await upsertCOTTFFReports(
        reports
      );

    if (error) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Failed to save CFTC TFF reports to Supabase.",
          details: error.message,
          attemptedCount:
            reports.length,
          savedCount: count,
        },
        { status: 500 }
      );
    }

    const reportDates =
      reports
        .map(
          (report) =>
            report.report_date
        )
        .filter(Boolean)
        .sort();

    const symbols = Array.from(
      new Set(
        reports.map(
          (report) =>
            report.symbol
        )
      )
    );

    const participants =
      Array.from(
        new Set(
          reports.map(
            (report) =>
              report.participant
          )
        )
      );

    return NextResponse.json(
      {
        error: false,
        message:
          "CFTC TFF participant history synced successfully.",
        count,
        startDate:
          TFF_BACKFILL_START_DATE,
        earliestReportDate:
          reportDates[0] || null,
        latestReportDate:
          reportDates[
            reportDates.length - 1
          ] || null,
        symbols,
        participants,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "COT TFF SYNC API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to sync CFTC TFF participant history.",
      },
      { status: 500 }
    );
  }
}