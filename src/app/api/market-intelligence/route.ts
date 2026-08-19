import { NextResponse } from "next/server";

import {
  MARKET_INTELLIGENCE_SYMBOLS,
  type MarketIntelligenceSymbol,
} from "@/lib/marketIntelligencePrice";
import {
  getLatestMarketIntelligenceReport,
  getMarketIntelligenceHistory,
  getMarketIntelligenceReportByDate,
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date =
    new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function parseLimit(
  value: string | null
) {
  if (!value) return 120;

  const parsed =
    Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 120;
  }

  return Math.min(
    Math.max(parsed, 1),
    366
  );
}

/**
 * READ-ONLY Market Intelligence API.
 *
 * Latest:
 *   /api/market-intelligence?symbol=CHF
 *
 * Exact saved date:
 *   /api/market-intelligence?symbol=CHF&date=2026-08-19
 *
 * History:
 *   /api/market-intelligence?symbol=CHF&history=true
 *
 * Optional history range:
 *   &startDate=2026-08-01
 *   &endDate=2026-08-31
 *   &limit=120
 */
export async function GET(
  request: Request
) {
  try {
    const requestUrl =
      new URL(request.url);

    const symbol =
      (
        requestUrl.searchParams.get(
          "symbol"
        ) ?? "DXY"
      )
        .trim()
        .toUpperCase();

    if (!isSupportedSymbol(symbol)) {
      return NextResponse.json(
        {
          error: true,
          message:
            `Unsupported Market Intelligence symbol: ${symbol}.`,
          supportedSymbols:
            MARKET_INTELLIGENCE_SYMBOLS,
        },
        { status: 400 }
      );
    }

    const date =
      (
        requestUrl.searchParams.get(
          "date"
        ) ?? ""
      ).trim();

    const history =
      (
        requestUrl.searchParams.get(
          "history"
        ) ?? ""
      )
        .trim()
        .toLowerCase();

    const startDate =
      (
        requestUrl.searchParams.get(
          "startDate"
        ) ?? ""
      ).trim();

    const endDate =
      (
        requestUrl.searchParams.get(
          "endDate"
        ) ?? ""
      ).trim();

    const limit =
      parseLimit(
        requestUrl.searchParams.get(
          "limit"
        )
      );

    if (
      date &&
      !isValidDate(date)
    ) {
      return NextResponse.json(
        {
          error: true,
          message:
            "date must be a real date in YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    if (
      startDate &&
      !isValidDate(startDate)
    ) {
      return NextResponse.json(
        {
          error: true,
          message:
            "startDate must be a real date in YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    if (
      endDate &&
      !isValidDate(endDate)
    ) {
      return NextResponse.json(
        {
          error: true,
          message:
            "endDate must be a real date in YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    if (date) {
      const result =
        await getMarketIntelligenceReportByDate(
          symbol,
          date
        );

      if (result.error) {
        throw new Error(
          result.error.message
        );
      }

      if (!result.report) {
        return NextResponse.json(
          {
            error: false,
            found: false,
            symbol,
            analysisDate: date,
            report: null,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: false,
          found: true,
          mode: "date",
          symbol,
          analysisDate: date,
          report:
            result.report,
        },
        { status: 200 }
      );
    }

    if (
      history === "true" ||
      history === "1" ||
      startDate ||
      endDate
    ) {
      const result =
        await getMarketIntelligenceHistory({
          symbol,
          startDate:
            startDate || undefined,
          endDate:
            endDate || undefined,
          limit,
        });

      if (result.error) {
        throw new Error(
          result.error.message
        );
      }

      return NextResponse.json(
        {
          error: false,
          mode: "history",
          symbol,
          count:
            result.reports.length,
          reports:
            result.reports,
        },
        { status: 200 }
      );
    }

    const result =
      await getLatestMarketIntelligenceReport(
        symbol
      );

    if (result.error) {
      throw new Error(
        result.error.message
      );
    }

    if (!result.report) {
      return NextResponse.json(
        {
          error: false,
          found: false,
          mode: "latest",
          symbol,
          report: null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: false,
        found: true,
        mode: "latest",
        symbol,
        report:
          result.report,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to read Market Intelligence reports.",
      },
      { status: 500 }
    );
  }
}