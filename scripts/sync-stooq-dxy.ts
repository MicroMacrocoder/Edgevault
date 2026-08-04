import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  parseStooqDxyVolumeOiRows,
  STOOQ_DXY_URL,
  syncStooqDxyVolumeOiRows,
} from "../src/lib/stooqDxy";

function loadLocalEnvironment() {
  const envFilePath = ".env.local";

  if (!existsSync(envFilePath)) {
    return;
  }

  const fileContent = readFileSync(envFilePath, "utf8");

  for (const line of fileContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
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

  const dryRun = process.env.DRY_RUN === "1";

  console.log("Starting Stooq DXY Volume/OI collector...");
  console.log("Mode:", dryRun ? "Dry run" : "Supabase sync");

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/151.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    console.log("Opening:", STOOQ_DXY_URL);

    await page.goto(STOOQ_DXY_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    console.log("Waiting for Stooq verification and data table...");

    await page.waitForFunction(
      () => document.body?.innerText.includes("Open Interest"),
      null,
      {
        timeout: 120000,
      }
    );

    await page.waitForTimeout(1000);

    const renderedHtml = await page.content();
    const rows = parseStooqDxyVolumeOiRows(renderedHtml);

    const completeRows = rows.filter(
      (row) => row.volume > 0 && row.open_interest > 0
    );

    if (completeRows.length === 0) {
      throw new Error(
        "Stooq loaded successfully, but no complete DXY rows were found."
      );
    }

    const latestAvailable = rows[rows.length - 1];
    const latestComplete = completeRows[completeRows.length - 1];

    console.log("Parsed rows:", rows.length);
    console.log("Complete rows:", completeRows.length);
    console.log("Latest available row:", latestAvailable);
    console.log("Latest complete row:", latestComplete);

    if (dryRun) {
      console.log("Dry run completed. Supabase was not changed.");
      return;
    }

    const syncResult = await syncStooqDxyVolumeOiRows(rows);

    console.log("Supabase sync completed.");
    console.log("Rows synced:", syncResult.synced);
    console.log("Latest saved row:", syncResult.latestComplete);
    console.log("Updated at:", syncResult.updatedAt);
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("DXY Volume/OI collector failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});