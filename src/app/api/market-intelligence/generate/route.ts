import { NextResponse } from "next/server";

import {
  buildMarketIntelligenceReportDraft,
} from "@/lib/marketIntelligenceEngine";
import {
  MARKET_INTELLIGENCE_SYMBOLS,
  type MarketIntelligenceSymbol,
} from "@/lib/marketIntelligencePrice";
import {
  createMarketIntelligenceReport,
  type MarketIntelligenceReportType,
} from "@/lib/supabase/marketIntelligenceReports";

export const dynamic = "force-dynamic";

type GenerateRequestBody = {
  symbol?: string;
  analysisDate?: string;
  reportType?: string;
};

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

  const date = new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
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

function isAuthorized(
  request: Request
) {
  /*
   * Local development is intentionally allowed so the route can be tested
   * without adding another local secret.
   *
   * Production reuses EdgeVault's existing protected worker secret/header
   * pattern instead of exposing a public report-generation endpoint.
   */
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const expectedSecret =
    process.env.CURRENCY_STRENGTH_WORKER_SECRET?.trim();

  const providedSecret =
    request.headers
      .get("x-edgevault-worker-secret")
      ?.trim();

  return Boolean(
    expectedSecret &&
      providedSecret &&
      expectedSecret === providedSecret
  );
}

export async function POST(
  request: Request
) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Unauthorized Market Intelligence generation request.",
        },
        { status: 401 }
      );
    }

    let body: GenerateRequestBody;

    try {
      body =
        (await request.json()) as GenerateRequestBody;
    } catch {
      return NextResponse.json(
        {
          error: true,
          message:
            "A JSON request body is required.",
        },
        { status: 400 }
      );
    }

    const symbol =
      (body.symbol ?? "")
        .trim()
        .toUpperCase();

    const analysisDate =
      (body.analysisDate ?? "")
        .trim();

    const reportType =
      (body.reportType ?? "")
        .trim()
        .toLowerCase();

    if (!isSupportedSymbol(symbol)) {
      return NextResponse.json(
        {
          error: true,
          message:
            `Unsupported Market Intelligence symbol: ${symbol || "(missing)"}.`,
          supportedSymbols:
            MARKET_INTELLIGENCE_SYMBOLS,
        },
        { status: 400 }
      );
    }

    if (
      !analysisDate ||
      !isValidDate(analysisDate)
    ) {
      return NextResponse.json(
        {
          error: true,
          message:
            "analysisDate must be a real date in YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    if (!isReportType(reportType)) {
      return NextResponse.json(
        {
          error: true,
          message:
            "reportType must be weekly_baseline or daily_update.",
        },
        { status: 400 }
      );
    }

    /*
     * Build first, save second.
     * The deterministic engine remains the single source of truth.
     */
    const draft =
      await buildMarketIntelligenceReportDraft({
        symbol,
        analysisDate,
        reportType,
      });

    /*
     * createMarketIntelligenceReport is idempotent by symbol + analysis date.
     * If this exact report date already exists, it returns the frozen report
     * instead of overwriting historical intelligence.
     */
    const saveResult =
      await createMarketIntelligenceReport(
        draft.report
      );

    if (
      saveResult.error ||
      !saveResult.report
    ) {
      throw new Error(
        saveResult.error?.message ??
          "Market Intelligence report could not be saved."
      );
    }

    return NextResponse.json(
      {
        error: false,
        created:
          saveResult.created,
        message:
          saveResult.created
            ? "Market Intelligence report generated and saved successfully."
            : "A Market Intelligence report already exists for this symbol and analysis date. The existing frozen report was returned unchanged.",
        report:
          saveResult.report,
      },
      {
        status:
          saveResult.created
            ? 201
            : 200,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate Market Intelligence report.",
      },
      { status: 500 }
    );
  }
}