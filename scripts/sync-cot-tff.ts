import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  fetchCOTTFFReportsFromCFTC,
} from "../src/lib/cot/tff";

import {
  getLatestCOTTFFReportDate,
  getLatestCOTTFFUpdatedAt,
  upsertCOTTFFReports,
} from "../src/lib/supabase/cotTffReports";

function loadLocalEnvironment() {
  const envFilePath = ".env.local";

  if (!existsSync(envFilePath)) {
    return;
  }

  const fileContent =
    readFileSync(
      envFilePath,
      "utf8"
    );

  for (
    const line of fileContent.split(/\r?\n/)
  ) {
    const trimmedLine =
      line.trim();

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

  const currentYear =
    new Date().getUTCFullYear();

  const startDate =
    `${currentYear}-01-01`;

  console.log(
    "Starting CFTC TFF participant refresh..."
  );

  console.log(
    "Refresh window:",
    startDate,
    "to current"
  );

  const beforeReportDate =
    await getLatestCOTTFFReportDate();

  const beforeUpdatedAt =
    await getLatestCOTTFFUpdatedAt();

  if (beforeReportDate.error) {
    throw new Error(
      "Failed to read latest stored TFF report date: " +
        beforeReportDate.error.message
    );
  }

  if (beforeUpdatedAt.error) {
    throw new Error(
      "Failed to read latest TFF sync time: " +
        beforeUpdatedAt.error.message
    );
  }

  console.log(
    "Latest stored report before refresh:",
    beforeReportDate.reportDate
  );

  console.log(
    "Last stored refresh time:",
    beforeUpdatedAt.updatedAt
  );

  const reports =
    await fetchCOTTFFReportsFromCFTC(
      startDate
    );

  if (!reports.length) {
    throw new Error(
      "No current-year CFTC TFF reports were found."
    );
  }

  const reportDates = reports
    .map(
      (report) =>
        report.report_date
    )
    .filter(Boolean)
    .sort();

  const latestSourceReportDate =
    reportDates[
      reportDates.length - 1
    ] || null;

  console.log(
    "Rows fetched from CFTC:",
    reports.length
  );

  console.log(
    "Latest CFTC report in archive:",
    latestSourceReportDate
  );

  const {
    error,
    count,
  } = await upsertCOTTFFReports(
    reports
  );

  if (error) {
    throw new Error(
      "Failed to save CFTC TFF reports: " +
        error.message
    );
  }

  const afterReportDate =
    await getLatestCOTTFFReportDate();

  const afterUpdatedAt =
    await getLatestCOTTFFUpdatedAt();

  if (afterReportDate.error) {
    throw new Error(
      "Refresh completed but latest report verification failed: " +
        afterReportDate.error.message
    );
  }

  if (afterUpdatedAt.error) {
    throw new Error(
      "Refresh completed but sync-time verification failed: " +
        afterUpdatedAt.error.message
    );
  }

  console.log(
    "Rows upserted:",
    count
  );

  console.log(
    "Latest stored report after refresh:",
    afterReportDate.reportDate
  );

  console.log(
    "Updated at:",
    afterUpdatedAt.updatedAt
  );

  if (
    beforeReportDate.reportDate &&
    afterReportDate.reportDate &&
    afterReportDate.reportDate >
      beforeReportDate.reportDate
  ) {
    console.log(
      "New weekly TFF report detected and saved."
    );
  } else {
    console.log(
      "No newer weekly report was available. Existing current-year rows were safely refreshed."
    );
  }

  console.log(
    "CFTC TFF participant refresh completed successfully."
  );
}

run().catch((error) => {
  console.error(
    "CFTC TFF participant refresh failed."
  );

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exitCode = 1;
});