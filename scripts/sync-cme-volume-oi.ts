import { existsSync, readFileSync } from "node:fs";

import {
  fetchVolumeOIReportsFromCME,
  VOLUME_OI_SYMBOLS,
} from "../src/lib/volume-oi/cme";

import {
  getLatestVolumeOITradeDate,
  upsertVolumeOIReports,
} from "../src/lib/supabase/volumeOi";

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

async function run() {
  loadLocalEnvironment();

  console.log(
    "Starting CME FX Volume/OI refresh..."
  );

  const reports =
    await fetchVolumeOIReportsFromCME(30);

  if (!reports.length) {
    throw new Error(
      "CME returned no usable Volume/OI reports."
    );
  }

  const fetchedSymbols =
    Array.from(
      new Set(
        reports.map(
          (report) => report.symbol
        )
      )
    ).sort();

  const expectedSymbols =
    VOLUME_OI_SYMBOLS
      .map(
        (symbolConfig) =>
          symbolConfig.symbol
      )
      .sort();

  const missingSymbols =
    expectedSymbols.filter(
      (symbol) =>
        !fetchedSymbols.includes(symbol)
    );

  if (missingSymbols.length) {
    throw new Error(
      "CME refresh is incomplete. Missing symbols: " +
        missingSymbols.join(", ")
    );
  }

  const { error } =
    await upsertVolumeOIReports(reports);

  if (error) {
    throw new Error(
      "Failed to save CME Volume/OI reports: " +
        error.message
    );
  }

  console.log(
    "CME rows fetched:",
    reports.length
  );

  console.log(
    "CME symbols refreshed:",
    fetchedSymbols.join(", ")
  );

  for (const symbol of expectedSymbols) {
    const latest =
      await getLatestVolumeOITradeDate(
        symbol
      );

    if (latest.error) {
      throw new Error(
        `Could not verify latest ${symbol} Volume/OI trade date: ${latest.error.message}`
      );
    }

    console.log(
      `${symbol} latest saved trade date:`,
      latest.tradeDate
    );
  }

  console.log(
    "CME FX Volume/OI refresh completed successfully."
  );
}

run().catch((error) => {
  console.error(
    "CME FX Volume/OI refresh failed."
  );

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exitCode = 1;
});