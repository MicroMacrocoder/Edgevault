import { NextRequest, NextResponse } from "next/server";
import {
  getLatestCOTTFFReportDate,
  getLatestCOTTFFUpdatedAt,
  getStoredCOTTFFReports,
} from "@/lib/supabase/cotTffReports";
import type { COTTFFParticipantName } from "@/lib/cot/tff";

const ALLOWED_SYMBOLS = new Set([
  "DXY",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "CHF",
  "AUD",
  "NZD",
]);

const ALLOWED_PARTICIPANTS = new Set<COTTFFParticipantName>([
  "dealer",
  "asset_manager",
  "leveraged_funds",
  "other_reportables",
]);

function isValidISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const symbol = (searchParams.get("symbol") || "all").toUpperCase();

    const participant =
      (searchParams.get("participant") || "all") as
        | COTTFFParticipantName
        | "all";

    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    if (symbol !== "all" && !ALLOWED_SYMBOLS.has(symbol)) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid TFF symbol.",
          allowedSymbols: Array.from(ALLOWED_SYMBOLS),
          reports: [],
        },
        { status: 400 }
      );
    }

    if (
      participant !== "all" &&
      !ALLOWED_PARTICIPANTS.has(participant)
    ) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid TFF participant.",
          allowedParticipants: Array.from(ALLOWED_PARTICIPANTS),
          reports: [],
        },
        { status: 400 }
      );
    }

    if (startDate && !isValidISODate(startDate)) {
      return NextResponse.json(
        {
          error: true,
          message: "startDate must use YYYY-MM-DD format.",
          reports: [],
        },
        { status: 400 }
      );
    }

    if (endDate && !isValidISODate(endDate)) {
      return NextResponse.json(
        {
          error: true,
          message: "endDate must use YYYY-MM-DD format.",
          reports: [],
        },
        { status: 400 }
      );
    }

    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        {
          error: true,
          message: "startDate cannot be after endDate.",
          reports: [],
        },
        { status: 400 }
      );
    }

    const [
      storedResult,
      latestReportResult,
      latestUpdatedResult,
    ] = await Promise.all([
      getStoredCOTTFFReports({
        symbol,
        participant,
        startDate,
        endDate,
      }),
      getLatestCOTTFFReportDate(),
      getLatestCOTTFFUpdatedAt(),
    ]);

    if (storedResult.error) {
      return NextResponse.json(
        {
          error: true,
          message: "Failed to fetch stored TFF participant reports.",
          details: storedResult.error.message,
          reports: [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: false,
        message: "TFF participant reports fetched successfully.",
        filters: {
          symbol,
          participant,
          startDate: startDate || null,
          endDate: endDate || null,
        },
        latestReportDate: latestReportResult.reportDate,
        lastUpdatedAt: latestUpdatedResult.updatedAt,
        reportCount: storedResult.reports.length,
        reports: storedResult.reports,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("COT TFF READ API ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch TFF participant reports.",
        reports: [],
      },
      { status: 500 }
    );
  }
}