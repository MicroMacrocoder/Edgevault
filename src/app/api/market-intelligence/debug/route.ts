import { NextResponse } from "next/server";

import {
  buildMarketIntelligenceReportDraft,
} from "@/lib/marketIntelligenceEngine";
import {
  MARKET_INTELLIGENCE_SYMBOLS,
  type MarketIntelligenceSymbol,
} from "@/lib/marketIntelligencePrice";
import type {
  MarketIntelligenceReportType,
} from "@/lib/supabase/marketIntelligenceReports";

export const dynamic = "force-dynamic";

function isSupportedSymbol(
  value: string
): value is MarketIntelligenceSymbol {
  return (
    MARKET_INTELLIGENCE_SYMBOLS as readonly string[]
  ).includes(value);
}

function isValidDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function isReportType(
  value: string
): value is MarketIntelligenceReportType {
  return (
    value === "weekly_baseline" ||
    value === "daily_update"
  );
}

/**
 * READ-ONLY Market Intelligence diagnostic.
 *
 * This route builds the complete report draft but DOES NOT save
 * anything to market_intelligence_reports or any other table.
 *
 * Example:
 *
 * /api/market-intelligence/debug
 *   ?symbol=DXY
 *   &date=2026-08-19
 *   &type=daily_update
 */
export async function GET(
  request: Request
) {
  try {
    const requestUrl =
      new URL(request.url);

    const symbolParameter =
      (
        requestUrl.searchParams.get(
          "symbol"
        ) ?? "DXY"
      )
        .trim()
        .toUpperCase();

    const analysisDate =
      (
        requestUrl.searchParams.get(
          "date"
        ) ?? ""
      ).trim();

    const reportTypeParameter =
      (
        requestUrl.searchParams.get(
          "type"
        ) ?? "daily_update"
      )
        .trim()
        .toLowerCase();

    if (
      !isSupportedSymbol(
        symbolParameter
      )
    ) {
      return NextResponse.json(
        {
          error: true,
          message:
            `Unsupported Market Intelligence symbol: ${symbolParameter}.`,
          supportedSymbols:
            MARKET_INTELLIGENCE_SYMBOLS,
        },
        { status: 400 }
      );
    }

    if (
      !analysisDate ||
      !isValidDate(
        analysisDate
      )
    ) {
      return NextResponse.json(
        {
          error: true,
          message:
            "A valid date query parameter is required in YYYY-MM-DD format.",
          example:
            "/api/market-intelligence/debug?symbol=DXY&date=2026-08-19&type=daily_update",
        },
        { status: 400 }
      );
    }

    if (
      !isReportType(
        reportTypeParameter
      )
    ) {
      return NextResponse.json(
        {
          error: true,
          message:
            "type must be weekly_baseline or daily_update.",
        },
        { status: 400 }
      );
    }

    const result =
      await buildMarketIntelligenceReportDraft(
        {
          symbol:
            symbolParameter,
          analysisDate,
          reportType:
            reportTypeParameter,
        }
      );

    return NextResponse.json(
      {
        error: false,

        message:
          "Market Intelligence diagnostic completed. No report was saved.",

        readOnly: true,

        requested: {
          symbol:
            symbolParameter,
          analysisDate,
          reportType:
            reportTypeParameter,
        },

        previousReport: result.previousReport
          ? {
              id:
                result.previousReport.id,
              analysisDate:
                result.previousReport.analysis_date,
              marketCondition:
                result.previousReport.market_condition_label,
              storyDevelopment:
                result.previousReport.story_development,
            }
          : null,

        report:
          result.report,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        readOnly: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to build Market Intelligence diagnostic draft.",
      },
      { status: 500 }
    );
  }
}