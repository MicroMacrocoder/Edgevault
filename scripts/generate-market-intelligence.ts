import { existsSync, readFileSync } from "node:fs";

import {
  MARKET_INTELLIGENCE_SYMBOLS,
  type MarketIntelligenceSymbol,
} from "../src/lib/marketIntelligencePrice";

import {
  buildMarketIntelligenceReportDraft,
} from "../src/lib/marketIntelligenceEngine";

import {
  createMarketIntelligenceReport,
  type MarketIntelligenceReportType,
} from "../src/lib/supabase/marketIntelligenceReports";

const REPORT_TIME_ZONE = "America/New_York";

function loadLocalEnvironment() {
  const envFilePath = ".env.local";

  if (!existsSync(envFilePath)) {
    return;
  }

  const fileContent = readFileSync(
    envFilePath,
    "utf8"
  );

  for (const line of fileContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (
      !trimmedLine ||
      trimmedLine.startsWith("#")
    ) {
      continue;
    }

    const separatorIndex =
      trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine
      .slice(0, separatorIndex)
      .trim();

    let value = trimmedLine
      .slice(separatorIndex + 1)
      .trim();

    if (
      (value.startsWith('"') &&
        value.endsWith('"')) ||
      (value.startsWith("'") &&
        value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getDateInTimeZone(
  date: Date,
  timeZone: string
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

  const year =
    parts.find(
      (part) => part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) => part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) => part.type === "day"
    )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Could not resolve the New York analysis date."
    );
  }

  return `${year}-${month}-${day}`;
}

function getWeekdayInTimeZone(
  date: Date,
  timeZone: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      weekday: "short",
    }
  ).format(date);
}

function getReportType(
  date: Date
): MarketIntelligenceReportType {
  const weekday =
    getWeekdayInTimeZone(
      date,
      REPORT_TIME_ZONE
    );

  return weekday === "Sun"
    ? "weekly_baseline"
    : "daily_update";
}

async function generateForSymbol(
  symbol: MarketIntelligenceSymbol,
  analysisDate: string,
  reportType: MarketIntelligenceReportType
) {
  console.log(
    `Generating ${symbol} ${reportType} for ${analysisDate}...`
  );

  const draft =
    await buildMarketIntelligenceReportDraft({
      symbol,
      analysisDate,
      reportType,
    });

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
        `${symbol} Market Intelligence report could not be saved.`
    );
  }

  console.log(
    `${symbol}:`,
    saveResult.created
      ? "created"
      : "already exists - frozen report kept",
    "| condition:",
    saveResult.report.market_condition_label,
    "| market through:",
    saveResult.report.price_as_of,
    "| COT through:",
    saveResult.report.cot_as_of
  );
}

async function run() {
  loadLocalEnvironment();

  const now = new Date();

  const analysisDate =
    getDateInTimeZone(
      now,
      REPORT_TIME_ZONE
    );

  const reportType =
    getReportType(now);

  console.log(
    "Starting Market Intelligence daily generation..."
  );

  console.log(
    "Report timezone:",
    REPORT_TIME_ZONE
  );

  console.log(
    "Analysis date:",
    analysisDate
  );

  console.log(
    "Report type:",
    reportType
  );

  for (
    const symbol of
      MARKET_INTELLIGENCE_SYMBOLS
  ) {
    await generateForSymbol(
      symbol,
      analysisDate,
      reportType
    );
  }

  console.log(
    "Market Intelligence generation completed successfully for:",
    MARKET_INTELLIGENCE_SYMBOLS.join(", ")
  );
}

run().catch((error) => {
  console.error(
    "Market Intelligence generation failed."
  );

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exitCode = 1;
});