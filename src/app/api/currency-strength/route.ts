import { NextRequest, NextResponse } from "next/server";
import {
  CURRENCY_STRENGTH_TIMEFRAMES,
  TWELVE_DATA_INTERVALS,
  calculateCurrencyStrength,
  type CurrencyStrengthTimeframe,
  type ForexCandle,
} from "@/lib/currencyStrength";
import {
  getCurrencyStrengthSnapshotById,
  getLatestCompletedCurrencyStrengthRefreshJob,
  getLatestCurrencyStrengthSnapshot,
  updateCurrencyStrengthRefreshJob,
  upsertCurrencyStrengthSnapshot,
  type CurrencyStrengthSnapshot,
} from "@/lib/supabase/currencyStrength";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function isCurrencyStrengthTimeframe(
  value: string,
): value is CurrencyStrengthTimeframe {
  return (
    CURRENCY_STRENGTH_TIMEFRAMES as readonly string[]
  ).includes(value);
}

function snapshotMatchesRequest(
  snapshot: CurrencyStrengthSnapshot,
  timeframe: CurrencyStrengthTimeframe,
  lookbackCandles: number,
) {
  return (
    snapshot.timeframe === timeframe &&
    Number(snapshot.lookback_candles) === lookbackCandles
  );
}

async function recoverSnapshotFromCompletedRefresh(
  timeframe: CurrencyStrengthTimeframe,
  lookbackCandles: number,
) {
  const jobResult =
    await getLatestCompletedCurrencyStrengthRefreshJob(
      timeframe,
      lookbackCandles,
    );

  if (jobResult.error) {
    throw new Error(jobResult.error.message);
  }

  const job = jobResult.job;

  if (!job) {
    return null;
  }

  if (job.snapshot_id !== null) {
    const snapshotResult =
      await getCurrencyStrengthSnapshotById(job.snapshot_id);

    if (snapshotResult.error) {
      throw new Error(snapshotResult.error.message);
    }

    if (
      snapshotResult.snapshot &&
      snapshotMatchesRequest(
        snapshotResult.snapshot,
        timeframe,
        lookbackCandles,
      )
    ) {
      return snapshotResult.snapshot;
    }
  }

  if (!job.locked_candle_at) {
    throw new Error(
      `The latest completed ${timeframe} refresh has no locked candle time.`,
    );
  }

  const combinedCandles: Record<string, ForexCandle[]> = {};

  for (const storedBatch of Object.values(job.batch_payloads)) {
    Object.assign(combinedCandles, storedBatch.candles);
  }

  const calculation = calculateCurrencyStrength(
    combinedCandles,
    {
      lookbackCandles,
    },
  );

  if (!calculation.isComplete) {
    throw new Error(
      `The latest completed ${timeframe} refresh contains only ${calculation.usedPairCount}/${calculation.requestedPairCount} usable pairs, so its snapshot cannot be repaired.`,
    );
  }

  const saveResult = await upsertCurrencyStrengthSnapshot({
    timeframe,
    interval: TWELVE_DATA_INTERVALS[timeframe],
    latestCompletedCandleAt: job.locked_candle_at,
    collectionStartedAt: job.started_at,
    collectionCompletedAt:
      job.last_batch_at ??
      job.completed_at ??
      job.updated_at,
    calculatedAt: job.completed_at ?? job.updated_at,
    provider: job.provider,
    calculation,
  });

  if (saveResult.error || !saveResult.snapshot) {
    throw new Error(
      saveResult.error?.message ??
        `The completed ${timeframe} refresh was found, but its snapshot could not be repaired.`,
    );
  }

  if (job.snapshot_id !== saveResult.snapshot.id) {
    const updateResult =
      await updateCurrencyStrengthRefreshJob(job.id, {
        snapshot_id: saveResult.snapshot.id,
      });

    if (updateResult.error) {
      console.error(
        "REPAIR CURRENCY STRENGTH JOB SNAPSHOT LINK ERROR:",
        updateResult.error.message,
      );
    }
  }

  return saveResult.snapshot;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedTimeframe =
      searchParams.get("timeframe")?.toUpperCase() ?? "H1";

    const requestedLookback =
      searchParams.get("lookback") ?? "5";

    const lookbackCandles = Number(requestedLookback);

    if (!isCurrencyStrengthTimeframe(requestedTimeframe)) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Invalid timeframe. Use M1, M5, M15, M30, H1, H4, D1, or W1.",
          snapshot: null,
        },
        400,
      );
    }

    if (
      !Number.isInteger(lookbackCandles) ||
      lookbackCandles < 1
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "lookback must be a positive whole number.",
          snapshot: null,
        },
        400,
      );
    }

    const { error, snapshot } =
      await getLatestCurrencyStrengthSnapshot(
        requestedTimeframe,
        lookbackCandles,
      );

    if (error) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Failed to fetch the latest Currency Strength snapshot.",
          details: error.message,
          snapshot: null,
        },
        500,
      );
    }

    const resolvedSnapshot =
      snapshot ??
      (await recoverSnapshotFromCompletedRefresh(
        requestedTimeframe,
        lookbackCandles,
      ));

    if (!resolvedSnapshot) {
      return jsonResponse({
        ok: true,
        message:
          "No saved Currency Strength snapshot was found for this timeframe and lookback.",
        timeframe: requestedTimeframe,
        lookbackCandles,
        snapshot: null,
      });
    }

    return jsonResponse({
      ok: true,
      message:
        snapshot === null
          ? "The completed Currency Strength refresh was recovered and linked to its saved snapshot."
          : "Latest Currency Strength snapshot fetched successfully.",
      timeframe: requestedTimeframe,
      lookbackCandles,
      snapshot: resolvedSnapshot,
    });
  } catch (error) {
    console.error("CURRENCY STRENGTH READ API ERROR:", error);

    return jsonResponse(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch Currency Strength.",
        snapshot: null,
      },
      500,
    );
  }
}
