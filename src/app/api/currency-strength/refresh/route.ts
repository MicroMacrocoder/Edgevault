import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  CURRENCY_STRENGTH_TIMEFRAMES,
  calculateCurrencyStrength,
  type CurrencyStrengthTimeframe,
  type ForexCandle,
} from "@/lib/currencyStrength";
import {
  createForexPairBatches,
  fetchTwelveDataForexBatch,
} from "@/lib/twelveDataForex";
import {
  CURRENCY_STRENGTH_DAILY_CREDIT_RESERVE,
  CURRENCY_STRENGTH_DAILY_REFRESH_LIMIT,
  CURRENCY_STRENGTH_PROVIDER_DAILY_CREDIT_LIMIT,
  createCurrencyStrengthRefreshJob,
  expireStaleCurrencyStrengthRefreshJobs,
  getActiveCurrencyStrengthRefreshJob,
  getCurrencyStrengthDailyUsage,
  getCurrencyStrengthProviderUsage,
  getCurrencyStrengthRefreshJob,
  getCurrencyStrengthSnapshotById,
  getLatestCurrencyStrengthCreditEvent,
  recordCurrencyStrengthCreditEvent,
  updateCurrencyStrengthRefreshJob,
  upsertCurrencyStrengthSnapshot,
  type CurrencyStrengthRefreshJob,
  type CurrencyStrengthStoredBatch,
} from "@/lib/supabase/currencyStrength";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BATCH_SIZE = 7;
const OUTPUT_SIZE = 60;
const BATCH_COOLDOWN_MS = 65_000;

type StartRefreshBody = {
  action: "start";
  timeframe: string;
};

type ContinueRefreshBody = {
  action: "next";
  jobId: string;
};

type WorkerRefreshBody = {
  action: "worker";
};

type RefreshRequestBody =
  | StartRefreshBody
  | ContinueRefreshBody
  | WorkerRefreshBody;

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isCurrencyStrengthTimeframe(
  value: string,
): value is CurrencyStrengthTimeframe {
  return (
    CURRENCY_STRENGTH_TIMEFRAMES as readonly string[]
  ).includes(value);
}

function readBearerToken(request: NextRequest) {
  const authorization =
    request.headers.get("authorization")?.trim() ?? "";

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() ?? null;
}

function isAuthorizedWorker(request: NextRequest) {
  const configuredSecret =
    process.env.CURRENCY_STRENGTH_WORKER_SECRET?.trim() ?? "";
  const suppliedSecret =
    request.headers
      .get("x-edgevault-worker-secret")
      ?.trim() ?? "";

  if (!configuredSecret || !suppliedSecret) {
    return false;
  }

  const configuredBuffer = Buffer.from(configuredSecret);
  const suppliedBuffer = Buffer.from(suppliedSecret);

  if (configuredBuffer.length !== suppliedBuffer.length) {
    return false;
  }

  return timingSafeEqual(configuredBuffer, suppliedBuffer);
}

async function getAuthenticatedUser(request: NextRequest) {
  const accessToken = readBearerToken(request);

  if (!accessToken) {
    return {
      user: null,
      error: "You must be signed in to refresh Currency Strength.",
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } =
    await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    return {
      user: null,
      error:
        error?.message ??
        "Your session could not be verified.",
    };
  }

  return {
    user: data.user,
    error: null,
  };
}

function parseProviderCandleTime(datetime: string) {
  const value = datetime.trim();
  const normalized = value.replace(" ", "T");
  const hasTimezone =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

  const timestamp = Date.parse(
    hasTimezone ? normalized : `${normalized}Z`,
  );

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `Could not parse Twelve Data candle time: ${datetime}`,
    );
  }

  return timestamp;
}

function toProviderCandleIso(datetime: string) {
  return new Date(
    parseProviderCandleTime(datetime),
  ).toISOString();
}

function filterCandlesAtOrBefore(
  candles: ForexCandle[],
  lockedCandleAt: string,
) {
  const lockedTimestamp = Date.parse(lockedCandleAt);

  if (!Number.isFinite(lockedTimestamp)) {
    throw new Error(
      `The locked candle time is invalid: ${lockedCandleAt}`,
    );
  }

  return candles.filter(
    (candle) =>
      parseProviderCandleTime(candle.datetime) <=
      lockedTimestamp,
  );
}

function summarizeJob(job: CurrencyStrengthRefreshJob | null) {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    timeframe: job.timeframe,
    status: job.status,
    totalBatches: job.total_batches,
    nextBatch: job.next_batch,
    collectedBatches: job.collected_batches,
    completedPairCount:
      job.collected_batches.length * BATCH_SIZE,
    lockedCandleAt: job.locked_candle_at,
    apiCreditsUsed: job.api_credits_used,
    snapshotId: job.snapshot_id,
    startedAt: job.started_at,
    lastBatchAt: job.last_batch_at,
    completedAt: job.completed_at,
    expiresAt: job.expires_at,
    errorMessage: job.error_message,
  };
}

function getRetryAfterSeconds(referenceTime: string | null) {
  if (!referenceTime) {
    return 0;
  }

  const referenceTimestamp = Date.parse(referenceTime);

  if (!Number.isFinite(referenceTimestamp)) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil(
      (referenceTimestamp +
        BATCH_COOLDOWN_MS -
        Date.now()) /
        1_000,
    ),
  );
}

async function getRefreshContext(userId: string) {
  const [usageResult, providerResult] =
    await Promise.all([
      getCurrencyStrengthDailyUsage(userId),
      getCurrencyStrengthProviderUsage(),
    ]);

  if (usageResult.error || !usageResult.usage) {
    throw new Error(
      usageResult.error?.message ??
        "Could not load your daily refresh allowance.",
    );
  }

  if (providerResult.error || !providerResult.usage) {
    throw new Error(
      providerResult.error?.message ??
        "Could not load the Twelve Data credit allowance.",
    );
  }

  return {
    usage: usageResult.usage,
    providerUsage: providerResult.usage,
  };
}

async function startRefresh(
  timeframe: CurrencyStrengthTimeframe,
  userId: string,
) {
  await expireStaleCurrencyStrengthRefreshJobs();

  const { usage, providerUsage } =
    await getRefreshContext(userId);

  if (usage.remainingRefreshes <= 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          `You have used all ${CURRENCY_STRENGTH_DAILY_REFRESH_LIMIT} Currency Strength refreshes for this reset period.`,
        usage,
        providerUsage,
      },
      { status: 429 },
    );
  }

  const creditsRequired = createForexPairBatches(
    BATCH_SIZE,
  ).flat().length;

  const safeDailyCreditLimit =
    CURRENCY_STRENGTH_PROVIDER_DAILY_CREDIT_LIMIT -
    CURRENCY_STRENGTH_DAILY_CREDIT_RESERVE;

  if (
    providerUsage.creditsUsed + creditsRequired >
    safeDailyCreditLimit
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The protected Twelve Data daily credit allowance does not have enough room for another complete 28-pair refresh.",
        creditsRequired,
        safeDailyCreditLimit,
        reservedCredits:
          CURRENCY_STRENGTH_DAILY_CREDIT_RESERVE,
        usage,
        providerUsage,
      },
      { status: 429 },
    );
  }

  const activeResult =
    await getActiveCurrencyStrengthRefreshJob();

  if (activeResult.error) {
    throw new Error(activeResult.error.message);
  }

  if (activeResult.job) {
    const belongsToUser =
      activeResult.job.requested_by_user_id === userId;

    return NextResponse.json(
      {
        ok: belongsToUser,
        message: belongsToUser
          ? "Your existing Currency Strength refresh is still in progress."
          : "Another Currency Strength refresh is currently in progress. Please wait for it to finish.",
        job: summarizeJob(activeResult.job),
        usage,
        providerUsage,
      },
      { status: belongsToUser ? 200 : 409 },
    );
  }

  const latestCreditResult =
    await getLatestCurrencyStrengthCreditEvent();

  if (latestCreditResult.error) {
    throw new Error(latestCreditResult.error.message);
  }

  const retryAfterSeconds = getRetryAfterSeconds(
    latestCreditResult.event?.used_at ?? null,
  );

  if (retryAfterSeconds > 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please wait for the next Twelve Data credit window before starting a refresh.",
        retryAfterSeconds,
        usage,
        providerUsage,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  const createResult =
    await createCurrencyStrengthRefreshJob(
      timeframe,
      userId,
      5,
    );

  if (createResult.error || !createResult.job) {
    if (
      createResult.error?.message
        .toLowerCase()
        .includes("duplicate")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Another Currency Strength refresh started at the same time. Please wait for it to finish.",
          usage,
          providerUsage,
        },
        { status: 409 },
      );
    }

    throw new Error(
      createResult.error?.message ??
        "Could not create the Currency Strength refresh job.",
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        `${timeframe} refresh started. Batch 1 of 4 is ready.`,
      job: summarizeJob(createResult.job),
      usage,
      providerUsage,
      retryAfterSeconds: 0,
    },
    { status: 201 },
  );
}

async function claimNextBatch(
  job: CurrencyStrengthRefreshJob,
) {
  const supabaseAdmin = getSupabaseAdmin();
  const claimedAt = new Date().toISOString();

  let query = supabaseAdmin
    .from("currency_strength_refresh_jobs")
    .update({
      last_batch_at: claimedAt,
      error_message: null,
    })
    .eq("id", job.id)
    .eq("status", "collecting")
    .eq("next_batch", job.next_batch);

  if (job.last_batch_at) {
    query = query.eq(
      "last_batch_at",
      job.last_batch_at,
    );
  } else {
    query = query.is("last_batch_at", null);
  }

  const { data, error } = await query
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not reserve Batch ${job.next_batch}: ${error.message}`,
    );
  }

  return {
    claimedAt,
    job: (data as CurrencyStrengthRefreshJob | null) ?? null,
  };
}

async function failRefreshJob(
  jobId: string,
  message: string,
) {
  const completedAt = new Date().toISOString();

  await updateCurrencyStrengthRefreshJob(jobId, {
    status: "failed",
    completed_at: completedAt,
    error_message: message,
  });
}

async function continueRefresh(
  jobId: string,
  userId: string,
) {
  await expireStaleCurrencyStrengthRefreshJobs();

  const jobResult =
    await getCurrencyStrengthRefreshJob(jobId);

  if (jobResult.error) {
    throw new Error(jobResult.error.message);
  }

  const job = jobResult.job;

  if (!job) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The Currency Strength refresh job was not found.",
      },
      { status: 404 },
    );
  }

  if (job.requested_by_user_id !== userId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "You do not have permission to continue this refresh.",
      },
      { status: 403 },
    );
  }

  const { usage, providerUsage } =
    await getRefreshContext(userId);

  if (job.status === "completed") {
    return NextResponse.json(
      {
        ok: true,
        message:
          `${job.timeframe} Currency Strength is already updated.`,
        job: summarizeJob(job),
        usage,
        providerUsage,
      },
      { status: 200 },
    );
  }

  if (job.status !== "collecting") {
    return NextResponse.json(
      {
        ok: false,
        message:
          job.error_message ??
          `This refresh can no longer continue because its status is ${job.status}.`,
        job: summarizeJob(job),
        usage,
        providerUsage,
      },
      { status: 409 },
    );
  }

  if (
    !Number.isInteger(job.next_batch) ||
    job.next_batch < 1 ||
    job.next_batch > 4
  ) {
    await failRefreshJob(
      job.id,
      "The refresh job contains an invalid next-batch value.",
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "The refresh job contains an invalid next-batch value.",
      },
      { status: 500 },
    );
  }

  if (providerUsage.creditsRemaining < BATCH_SIZE) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "There are not enough tracked Twelve Data credits remaining for the next seven-pair batch.",
        job: summarizeJob(job),
        usage,
        providerUsage,
      },
      { status: 429 },
    );
  }

  const latestCreditResult =
    await getLatestCurrencyStrengthCreditEvent();

  if (latestCreditResult.error) {
    throw new Error(latestCreditResult.error.message);
  }

  const latestCreditAt =
    latestCreditResult.event?.used_at ?? null;

  const cooldownReference =
    latestCreditAt &&
    (!job.last_batch_at ||
      Date.parse(latestCreditAt) >
        Date.parse(job.last_batch_at))
      ? latestCreditAt
      : job.last_batch_at;

  const retryAfterSeconds = getRetryAfterSeconds(
    cooldownReference,
  );

  if (retryAfterSeconds > 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          `Batch ${job.next_batch} will be ready after the Twelve Data credit window resets.`,
        retryAfterSeconds,
        job: summarizeJob(job),
        usage,
        providerUsage,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  const claimResult = await claimNextBatch(job);

  if (!claimResult.job) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This batch is already being processed. Please wait for the current request to finish.",
        retryAfterSeconds: 5,
        job: summarizeJob(job),
        usage,
        providerUsage,
      },
      {
        status: 409,
        headers: {
          "Retry-After": "5",
        },
      },
    );
  }

  const claimedJob = claimResult.job;
  const batches = createForexPairBatches(BATCH_SIZE);
  const batchNumber = claimedJob.next_batch;
  const selectedBatch = batches[batchNumber - 1];

  if (!selectedBatch) {
    await failRefreshJob(
      claimedJob.id,
      `Batch ${batchNumber} does not exist.`,
    );

    return NextResponse.json(
      {
        ok: false,
        message: `Batch ${batchNumber} does not exist.`,
      },
      { status: 500 },
    );
  }

  try {
    const result = await fetchTwelveDataForexBatch({
      pairs: selectedBatch,
      timeframe: claimedJob.timeframe,
      outputSize: OUTPUT_SIZE,
    });

    const creditsUsed =
      result.apiCreditsUsed ?? selectedBatch.length;

    const creditResult =
      await recordCurrencyStrengthCreditEvent({
        jobId: claimedJob.id,
        requestedByUserId: userId,
        timeframe: claimedJob.timeframe,
        batchNumber,
        creditsUsed,
        usedAt: result.fetchedAt,
      });

    if (creditResult.error) {
      throw new Error(
        `The market data was fetched, but its credit usage could not be recorded: ${creditResult.error.message}`,
      );
    }

    const updatedCreditsUsed =
      claimedJob.api_credits_used + creditsUsed;

    if (result.pairErrors.length > 0) {
      throw new Error(
        `Twelve Data Batch ${batchNumber} failed: ${result.pairErrors
          .map(
            (pairError) =>
              `${pairError.pair}: ${pairError.message}`,
          )
          .join(" | ")}`,
      );
    }

    const latestTimes = [
      ...new Set(
        selectedBatch
          .map(
            (pair) =>
              result.candles[pair]?.[0]?.datetime ??
              null,
          )
          .filter(
            (value): value is string => Boolean(value),
          ),
      ),
    ];

    if (latestTimes.length !== 1) {
      throw new Error(
        `Batch ${batchNumber} did not return one shared completed ${claimedJob.timeframe} candle. Found: ${
          latestTimes.join(", ") || "none"
        }.`,
      );
    }

    let lockedCandleAt =
      claimedJob.locked_candle_at;

    if (batchNumber === 1) {
      lockedCandleAt =
        toProviderCandleIso(latestTimes[0]);
    }

    if (!lockedCandleAt) {
      throw new Error(
        "The refresh job has no locked completed candle.",
      );
    }

    const storedCandles: Record<string, ForexCandle[]> =
      {};

    for (const pair of selectedBatch) {
      const providerCandles =
        result.candles[pair] ?? [];

      const lockedCandles = filterCandlesAtOrBefore(
        providerCandles,
        lockedCandleAt,
      );

      if (lockedCandles.length === 0) {
        throw new Error(
          `${pair} has no candle at or before ${lockedCandleAt}.`,
        );
      }

      const latestUsableAt =
        toProviderCandleIso(
          lockedCandles[0].datetime,
        );

      if (
        Date.parse(latestUsableAt) !==
        Date.parse(lockedCandleAt)
      ) {
        throw new Error(
          `${pair} does not contain the locked ${lockedCandleAt} candle. Its latest usable candle is ${latestUsableAt}.`,
        );
      }

      storedCandles[pair] = lockedCandles;
    }

    const storedBatch: CurrencyStrengthStoredBatch = {
      fetchedAt: result.fetchedAt,
      candles: storedCandles,
    };

    const batchPayloads = {
      ...claimedJob.batch_payloads,
      [String(batchNumber)]: storedBatch,
    };

    const collectedBatches = [
      ...new Set([
        ...claimedJob.collected_batches,
        batchNumber,
      ]),
    ].sort((first, second) => first - second);

    if (batchNumber < 4) {
      const updateResult =
        await updateCurrencyStrengthRefreshJob(
          claimedJob.id,
          {
            next_batch: batchNumber + 1,
            collected_batches: collectedBatches,
            locked_candle_at: lockedCandleAt,
            batch_payloads: batchPayloads,
            api_credits_used: updatedCreditsUsed,
            last_batch_at: result.fetchedAt,
            error_message: null,
          },
        );

      if (updateResult.error || !updateResult.job) {
        throw new Error(
          updateResult.error?.message ??
            "Could not save the completed batch.",
        );
      }

      const refreshedContext =
        await getRefreshContext(userId);

      return NextResponse.json(
        {
          ok: true,
          message:
            `Batch ${batchNumber} of 4 completed. ${selectedBatch.length} pairs were collected.`,
          job: summarizeJob(updateResult.job),
          usage: refreshedContext.usage,
          providerUsage:
            refreshedContext.providerUsage,
          retryAfterSeconds: Math.ceil(
            BATCH_COOLDOWN_MS / 1_000,
          ),
        },
        { status: 200 },
      );
    }

    const combinedCandles: Record<
      string,
      ForexCandle[]
    > = {};

    for (const stored of Object.values(
      batchPayloads,
    )) {
      Object.assign(
        combinedCandles,
        stored.candles,
      );
    }

    const calculation =
      calculateCurrencyStrength(
        combinedCandles,
        {
          lookbackCandles:
            claimedJob.lookback_candles,
        },
      );

    if (!calculation.isComplete) {
      throw new Error(
        `The calculation used ${calculation.usedPairCount}/${calculation.requestedPairCount} pairs. A complete 28-pair result is required.`,
      );
    }

    const calculatedAt = new Date().toISOString();

    const saveResult =
      await upsertCurrencyStrengthSnapshot({
        timeframe: claimedJob.timeframe,
        interval: result.interval,
        latestCompletedCandleAt:
          lockedCandleAt,
        collectionStartedAt:
          claimedJob.started_at,
        collectionCompletedAt:
          result.fetchedAt,
        calculatedAt,
        provider: result.provider,
        calculation,
      });

    if (saveResult.error || !saveResult.snapshot) {
      throw new Error(
        saveResult.error?.message ??
          "The completed Currency Strength snapshot could not be saved.",
      );
    }

    const verificationResult =
      await getCurrencyStrengthSnapshotById(
        saveResult.snapshot.id,
      );

    if (
      verificationResult.error ||
      !verificationResult.snapshot
    ) {
      throw new Error(
        verificationResult.error?.message ??
          "The Currency Strength snapshot was returned by Supabase but could not be read back after saving.",
      );
    }

    const verifiedSnapshot = verificationResult.snapshot;
    const completedAt = new Date().toISOString();

    const completionResult =
      await updateCurrencyStrengthRefreshJob(
        claimedJob.id,
        {
          status: "completed",
          next_batch: 5,
          collected_batches: collectedBatches,
          locked_candle_at: lockedCandleAt,
          batch_payloads: batchPayloads,
          api_credits_used: updatedCreditsUsed,
          snapshot_id: verifiedSnapshot.id,
          last_batch_at: result.fetchedAt,
          completed_at: completedAt,
          error_message: null,
        },
      );

    if (
      completionResult.error ||
      !completionResult.job
    ) {
      throw new Error(
        completionResult.error?.message ??
          "The completed refresh job could not be finalized.",
      );
    }

    const refreshedContext =
      await getRefreshContext(userId);

    return NextResponse.json(
      {
        ok: true,
        message:
          `${claimedJob.timeframe} Currency Strength refreshed successfully using all 28 direct forex pairs.`,
        job: summarizeJob(completionResult.job),
        snapshot: verifiedSnapshot,
        usage: refreshedContext.usage,
        providerUsage:
          refreshedContext.providerUsage,
        retryAfterSeconds: 0,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The Currency Strength batch failed.";

    await failRefreshJob(claimedJob.id, message);

    const refreshedContext =
      await getRefreshContext(userId);

    return NextResponse.json(
      {
        ok: false,
        message,
        job: {
          ...summarizeJob(claimedJob),
          status: "failed",
          errorMessage: message,
        },
        usage: refreshedContext.usage,
        providerUsage:
          refreshedContext.providerUsage,
      },
      { status: 500 },
    );
  }
}


async function runBackgroundWorker() {
  await expireStaleCurrencyStrengthRefreshJobs();

  const activeResult =
    await getActiveCurrencyStrengthRefreshJob();

  if (activeResult.error) {
    throw new Error(activeResult.error.message);
  }

  const activeJob = activeResult.job;

  if (!activeJob) {
    return NextResponse.json(
      {
        ok: true,
        workerStatus: "idle",
        message:
          "No active Currency Strength refresh is waiting for a batch.",
        job: null,
      },
      { status: 200 },
    );
  }

  const ownerUserId =
    activeJob.requested_by_user_id?.trim() ?? "";

  if (!ownerUserId) {
    const message =
      "The active Currency Strength refresh has no account owner.";

    await failRefreshJob(activeJob.id, message);

    return NextResponse.json(
      {
        ok: false,
        workerStatus: "failed",
        message,
        job: {
          ...summarizeJob(activeJob),
          status: "failed",
          errorMessage: message,
        },
      },
      { status: 500 },
    );
  }

  const latestCreditResult =
    await getLatestCurrencyStrengthCreditEvent();

  if (latestCreditResult.error) {
    throw new Error(latestCreditResult.error.message);
  }

  const latestCreditAt =
    latestCreditResult.event?.used_at ?? null;

  const cooldownReference =
    latestCreditAt &&
    (!activeJob.last_batch_at ||
      Date.parse(latestCreditAt) >
        Date.parse(activeJob.last_batch_at))
      ? latestCreditAt
      : activeJob.last_batch_at;

  const retryAfterSeconds = getRetryAfterSeconds(
    cooldownReference,
  );

  if (retryAfterSeconds > 0) {
    return NextResponse.json(
      {
        ok: true,
        workerStatus: "waiting",
        message:
          `The next ${activeJob.timeframe} batch is waiting for the Twelve Data credit window.`,
        retryAfterSeconds,
        job: summarizeJob(activeJob),
      },
      {
        status: 200,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  return continueRefresh(activeJob.id, ownerUserId);
}

export async function GET(request: NextRequest) {
  try {
    const authentication =
      await getAuthenticatedUser(request);

    if (!authentication.user) {
      return NextResponse.json(
        {
          ok: false,
          message: authentication.error,
        },
        { status: 401 },
      );
    }

    await expireStaleCurrencyStrengthRefreshJobs();

    const jobId =
      request.nextUrl.searchParams.get("jobId");

    const [context, activeResult] =
      await Promise.all([
        getRefreshContext(authentication.user.id),
        getActiveCurrencyStrengthRefreshJob(),
      ]);

    if (activeResult.error) {
      throw new Error(activeResult.error.message);
    }

    let requestedJob:
      | CurrencyStrengthRefreshJob
      | null = null;

    if (jobId) {
      const jobResult =
        await getCurrencyStrengthRefreshJob(jobId);

      if (jobResult.error) {
        throw new Error(jobResult.error.message);
      }

      if (
        jobResult.job &&
        jobResult.job.requested_by_user_id !==
          authentication.user.id
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "You do not have permission to view this refresh.",
          },
          { status: 403 },
        );
      }

      requestedJob = jobResult.job;
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "Currency Strength refresh status loaded.",
        job: summarizeJob(requestedJob),
        activeJob: summarizeJob(activeResult.job),
        usage: context.usage,
        providerUsage: context.providerUsage,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "CURRENCY STRENGTH REFRESH STATUS ERROR:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not load Currency Strength refresh status.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body =
      (await request.json()) as RefreshRequestBody;

    if (body.action === "worker") {
      if (!isAuthorizedWorker(request)) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "The Currency Strength background worker secret is invalid.",
          },
          { status: 401 },
        );
      }

      return runBackgroundWorker();
    }

    const authentication =
      await getAuthenticatedUser(request);

    if (!authentication.user) {
      return NextResponse.json(
        {
          ok: false,
          message: authentication.error,
        },
        { status: 401 },
      );
    }

    if (body.action === "start") {
      const timeframe =
        String(body.timeframe ?? "").toUpperCase();

      if (!isCurrencyStrengthTimeframe(timeframe)) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "timeframe must be M1, M5, M15, M30, H1, H4, D1, or W1.",
          },
          { status: 400 },
        );
      }

      return startRefresh(
        timeframe,
        authentication.user.id,
      );
    }

    if (body.action === "next") {
      const jobId = String(
        body.jobId ?? "",
      ).trim();

      if (!jobId) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "jobId is required to continue a refresh.",
          },
          { status: 400 },
        );
      }

      return continueRefresh(
        jobId,
        authentication.user.id,
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          'action must be "start", "next", or the protected "worker" action.',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error(
      "CURRENCY STRENGTH REFRESH API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The Currency Strength refresh request failed.",
        limits: {
          accountRefreshesPerResetPeriod:
            CURRENCY_STRENGTH_DAILY_REFRESH_LIMIT,
          providerDailyCredits:
            CURRENCY_STRENGTH_PROVIDER_DAILY_CREDIT_LIMIT,
        },
      },
      { status: 500 },
    );
  }
}