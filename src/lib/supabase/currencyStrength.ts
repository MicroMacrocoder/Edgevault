import { createClient } from "@supabase/supabase-js";
import type {
  CurrencyStrengthCalculation,
  CurrencyStrengthTimeframe,
  ForexCandle,
} from "@/lib/currencyStrength";

export const CURRENCY_STRENGTH_DAILY_REFRESH_LIMIT = 13;
export const CURRENCY_STRENGTH_DAILY_CREDIT_RESERVE = 72;
export const CURRENCY_STRENGTH_PROVIDER_DAILY_CREDIT_LIMIT = 800;
export const CURRENCY_STRENGTH_DAILY_RESET_MINUTE_UTC = 5;

export type CurrencyStrengthSnapshotInput = {
  timeframe: CurrencyStrengthTimeframe;
  interval: string;
  latestCompletedCandleAt: string;
  collectionStartedAt: string;
  collectionCompletedAt: string;
  calculatedAt: string;
  provider?: string;
  calculation: CurrencyStrengthCalculation;
};

export type CurrencyStrengthSnapshot = {
  id: number;
  timeframe: CurrencyStrengthTimeframe;
  interval: string;
  lookback_candles: number;
  volatility_window: number;
  minimum_volatility_samples: number;
  pair_score_cap: number;
  percentage_steepness: number;
  latest_completed_candle_at: string;
  collection_started_at: string;
  collection_completed_at: string;
  calculated_at: string;
  provider: string;
  requested_pair_count: number;
  used_pair_count: number;
  is_complete: boolean;
  readings: CurrencyStrengthCalculation["readings"];
  pair_results: CurrencyStrengthCalculation["pairResults"];
  skipped_pairs: CurrencyStrengthCalculation["skippedPairs"];
  created_at: string;
  updated_at: string;
};

export type CurrencyStrengthRefreshStatus =
  | "collecting"
  | "completed"
  | "failed"
  | "cancelled";

export type CurrencyStrengthStoredBatch = {
  fetchedAt: string;
  candles: Record<string, ForexCandle[]>;
};

export type CurrencyStrengthRefreshJob = {
  id: string;
  timeframe: CurrencyStrengthTimeframe;
  lookback_candles: number;
  status: CurrencyStrengthRefreshStatus;
  provider: string;
  total_batches: number;
  next_batch: number;
  collected_batches: number[];
  locked_candle_at: string | null;
  batch_payloads: Record<string, CurrencyStrengthStoredBatch>;
  api_credits_used: number;
  snapshot_id: number | null;
  requested_by_user_id: string | null;
  started_at: string;
  last_batch_at: string | null;
  completed_at: string | null;
  expires_at: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CurrencyStrengthRefreshJobUpdate = Partial<
  Pick<
    CurrencyStrengthRefreshJob,
    | "status"
    | "next_batch"
    | "collected_batches"
    | "locked_candle_at"
    | "batch_payloads"
    | "api_credits_used"
    | "snapshot_id"
    | "last_batch_at"
    | "completed_at"
    | "expires_at"
    | "error_message"
  >
>;

export type CurrencyStrengthRefreshCreditEvent = {
  id: number;
  job_id: string;
  requested_by_user_id: string | null;
  timeframe: CurrencyStrengthTimeframe;
  batch_number: number;
  credits_used: number;
  used_at: string;
  created_at: string;
};

export type CurrencyStrengthDailyUsage = {
  limit: number;
  completedRefreshes: number;
  remainingRefreshes: number;
  resetAt: string;
};

function getSupabaseServerClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function getDailyWindow(
  referenceDate: Date,
  resetMinuteUtc: number,
) {
  const todayReset = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      0,
      resetMinuteUtc,
      0,
      0,
    ),
  );

  const start =
    referenceDate.getTime() >= todayReset.getTime()
      ? todayReset
      : new Date(todayReset.getTime() - 24 * 60 * 60 * 1_000);

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1_000);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function getAccountRefreshDayWindow(
  referenceDate = new Date(),
) {
  return getDailyWindow(
    referenceDate,
    CURRENCY_STRENGTH_DAILY_RESET_MINUTE_UTC,
  );
}

function getProviderCreditDayWindow(
  referenceDate = new Date(),
) {
  return getDailyWindow(referenceDate, 0);
}

function normalizeRefreshJob(
  row: unknown,
): CurrencyStrengthRefreshJob | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const job = row as CurrencyStrengthRefreshJob;

  return {
    ...job,
    collected_batches: Array.isArray(job.collected_batches)
      ? job.collected_batches
      : [],
    batch_payloads:
      job.batch_payloads &&
      typeof job.batch_payloads === "object" &&
      !Array.isArray(job.batch_payloads)
        ? job.batch_payloads
        : {},
  };
}

export async function upsertCurrencyStrengthSnapshot(
  snapshot: CurrencyStrengthSnapshotInput,
) {
  const supabaseServer = getSupabaseServerClient();
  const { calculation } = snapshot;

  const row = {
    timeframe: snapshot.timeframe,
    interval: snapshot.interval,
    lookback_candles: calculation.options.lookbackCandles,
    volatility_window: calculation.options.volatilityWindow,
    minimum_volatility_samples:
      calculation.options.minimumVolatilitySamples,
    pair_score_cap: calculation.options.pairScoreCap,
    percentage_steepness:
      calculation.options.percentageSteepness,
    latest_completed_candle_at:
      snapshot.latestCompletedCandleAt,
    collection_started_at: snapshot.collectionStartedAt,
    collection_completed_at:
      snapshot.collectionCompletedAt,
    calculated_at: snapshot.calculatedAt,
    provider: snapshot.provider ?? "Twelve Data",
    requested_pair_count: calculation.requestedPairCount,
    used_pair_count: calculation.usedPairCount,
    is_complete: calculation.isComplete,
    readings: calculation.readings,
    pair_results: calculation.pairResults,
    skipped_pairs: calculation.skippedPairs,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("currency_strength_snapshots")
    .upsert(row, {
      onConflict:
        "timeframe,lookback_candles,latest_completed_candle_at",
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "UPSERT CURRENCY STRENGTH SNAPSHOT ERROR:",
      error.message,
    );

    return {
      error,
      snapshot: null as CurrencyStrengthSnapshot | null,
    };
  }

  return {
    error: null,
    snapshot: data as CurrencyStrengthSnapshot,
  };
}

export async function getLatestCurrencyStrengthSnapshot(
  timeframe: CurrencyStrengthTimeframe,
  lookbackCandles = 5,
) {
  const supabaseServer = getSupabaseServerClient();

  const { data, error } = await supabaseServer
    .from("currency_strength_snapshots")
    .select("*")
    .eq("timeframe", timeframe)
    .eq("lookback_candles", lookbackCandles)
    .order("latest_completed_candle_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "GET LATEST CURRENCY STRENGTH SNAPSHOT ERROR:",
      error.message,
    );

    return {
      error,
      snapshot: null as CurrencyStrengthSnapshot | null,
    };
  }

  return {
    error: null,
    snapshot:
      (data as CurrencyStrengthSnapshot | null) ?? null,
  };
}

export async function getCurrencyStrengthSnapshotById(
  snapshotId: number,
) {
  const supabaseServer = getSupabaseServerClient();

  const { data, error } = await supabaseServer
    .from("currency_strength_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    console.error(
      "GET CURRENCY STRENGTH SNAPSHOT BY ID ERROR:",
      error.message,
    );

    return {
      error,
      snapshot: null as CurrencyStrengthSnapshot | null,
    };
  }

  return {
    error: null,
    snapshot:
      (data as CurrencyStrengthSnapshot | null) ?? null,
  };
}

export async function getLatestCompletedCurrencyStrengthRefreshJob(
  timeframe: CurrencyStrengthTimeframe,
  lookbackCandles = 5,
) {
  const supabaseServer = getSupabaseServerClient();

  const { data, error } = await supabaseServer
    .from("currency_strength_refresh_jobs")
    .select("*")
    .eq("timeframe", timeframe)
    .eq("lookback_candles", lookbackCandles)
    .eq("status", "completed")
    .order("completed_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "GET LATEST COMPLETED CURRENCY STRENGTH REFRESH JOB ERROR:",
      error.message,
    );

    return {
      error,
      job: null as CurrencyStrengthRefreshJob | null,
    };
  }

  return {
    error: null,
    job: normalizeRefreshJob(data),
  };
}

export async function getCurrencyStrengthRefreshJob(
  jobId: string,
) {
  const supabaseServer = getSupabaseServerClient();

  const { data, error } = await supabaseServer
    .from("currency_strength_refresh_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error(
      "GET CURRENCY STRENGTH REFRESH JOB ERROR:",
      error.message,
    );

    return {
      error,
      job: null as CurrencyStrengthRefreshJob | null,
    };
  }

  return {
    error: null,
    job: normalizeRefreshJob(data),
  };
}

export async function getActiveCurrencyStrengthRefreshJob(
  timeframe?: CurrencyStrengthTimeframe,
) {
  const supabaseServer = getSupabaseServerClient();

  let query = supabaseServer
    .from("currency_strength_refresh_jobs")
    .select("*")
    .eq("status", "collecting")
    .order("created_at", {
      ascending: false,
    })
    .limit(1);

  if (timeframe) {
    query = query.eq("timeframe", timeframe);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "GET ACTIVE CURRENCY STRENGTH REFRESH JOB ERROR:",
      error.message,
    );

    return {
      error,
      job: null as CurrencyStrengthRefreshJob | null,
    };
  }

  const latestRow =
    Array.isArray(data) && data.length > 0 ? data[0] : null;

  return {
    error: null,
    job: normalizeRefreshJob(latestRow),
  };
}

export async function expireStaleCurrencyStrengthRefreshJobs() {
  const supabaseServer = getSupabaseServerClient();
  const now = new Date().toISOString();

  const { error } = await supabaseServer
    .from("currency_strength_refresh_jobs")
    .update({
      status: "failed",
      completed_at: now,
      error_message:
        "The refresh expired before all four batches were completed.",
    })
    .eq("status", "collecting")
    .lt("expires_at", now);

  if (error) {
    console.error(
      "EXPIRE STALE CURRENCY STRENGTH REFRESH JOBS ERROR:",
      error.message,
    );
  }

  return { error };
}

export async function createCurrencyStrengthRefreshJob(
  timeframe: CurrencyStrengthTimeframe,
  requestedByUserId: string,
  lookbackCandles = 5,
) {
  const supabaseServer = getSupabaseServerClient();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 30 * 60 * 1_000,
  ).toISOString();

  const row = {
    timeframe,
    lookback_candles: lookbackCandles,
    status: "collecting" as const,
    provider: "Twelve Data",
    total_batches: 4,
    next_batch: 1,
    collected_batches: [],
    locked_candle_at: null,
    batch_payloads: {},
    api_credits_used: 0,
    snapshot_id: null,
    requested_by_user_id: requestedByUserId,
    started_at: now.toISOString(),
    last_batch_at: null,
    completed_at: null,
    expires_at: expiresAt,
    error_message: null,
  };

  const { data, error } = await supabaseServer
    .from("currency_strength_refresh_jobs")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error(
      "CREATE CURRENCY STRENGTH REFRESH JOB ERROR:",
      error.message,
    );

    return {
      error,
      job: null as CurrencyStrengthRefreshJob | null,
    };
  }

  return {
    error: null,
    job: normalizeRefreshJob(data),
  };
}

export async function updateCurrencyStrengthRefreshJob(
  jobId: string,
  updates: CurrencyStrengthRefreshJobUpdate,
) {
  const supabaseServer = getSupabaseServerClient();

  const { data, error } = await supabaseServer
    .from("currency_strength_refresh_jobs")
    .update(updates)
    .eq("id", jobId)
    .select("*")
    .single();

  if (error) {
    console.error(
      "UPDATE CURRENCY STRENGTH REFRESH JOB ERROR:",
      error.message,
    );

    return {
      error,
      job: null as CurrencyStrengthRefreshJob | null,
    };
  }

  return {
    error: null,
    job: normalizeRefreshJob(data),
  };
}

export async function recordCurrencyStrengthCreditEvent({
  jobId,
  requestedByUserId,
  timeframe,
  batchNumber,
  creditsUsed,
  usedAt = new Date().toISOString(),
}: {
  jobId: string;
  requestedByUserId: string;
  timeframe: CurrencyStrengthTimeframe;
  batchNumber: number;
  creditsUsed: number;
  usedAt?: string;
}) {
  const supabaseServer = getSupabaseServerClient();

  const row = {
    job_id: jobId,
    requested_by_user_id: requestedByUserId,
    timeframe,
    batch_number: batchNumber,
    credits_used: Math.max(0, Math.trunc(creditsUsed)),
    used_at: usedAt,
  };

  const { data, error } = await supabaseServer
    .from("currency_strength_refresh_credit_events")
    .upsert(row, {
      onConflict: "job_id,batch_number",
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "RECORD CURRENCY STRENGTH CREDIT EVENT ERROR:",
      error.message,
    );

    return {
      error,
      event:
        null as CurrencyStrengthRefreshCreditEvent | null,
    };
  }

  return {
    error: null,
    event: data as CurrencyStrengthRefreshCreditEvent,
  };
}

export async function getCurrencyStrengthDailyUsage(
  requestedByUserId: string,
  referenceDate = new Date(),
) {
  const supabaseServer = getSupabaseServerClient();
  const { startAt, endAt } =
    getAccountRefreshDayWindow(referenceDate);

  const { count, error } = await supabaseServer
    .from("currency_strength_refresh_jobs")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("requested_by_user_id", requestedByUserId)
    .eq("status", "completed")
    .gte("completed_at", startAt)
    .lt("completed_at", endAt);

  if (error) {
    console.error(
      "GET CURRENCY STRENGTH DAILY USAGE ERROR:",
      error.message,
    );

    return {
      error,
      usage: null as CurrencyStrengthDailyUsage | null,
    };
  }

  const completedRefreshes = count ?? 0;

  return {
    error: null,
    usage: {
      limit: CURRENCY_STRENGTH_DAILY_REFRESH_LIMIT,
      completedRefreshes,
      remainingRefreshes: Math.max(
        0,
        CURRENCY_STRENGTH_DAILY_REFRESH_LIMIT -
          completedRefreshes,
      ),
      resetAt: endAt,
    },
  };
}

export async function getCurrencyStrengthDailyCreditsUsed(
  referenceDate = new Date(),
) {
  const supabaseServer = getSupabaseServerClient();
  const { startAt, endAt } =
    getProviderCreditDayWindow(referenceDate);

  const { data, error } = await supabaseServer
    .from("currency_strength_refresh_credit_events")
    .select("credits_used")
    .gte("used_at", startAt)
    .lt("used_at", endAt);

  if (error) {
    console.error(
      "GET CURRENCY STRENGTH DAILY CREDITS USED ERROR:",
      error.message,
    );

    return {
      error,
      creditsUsed: null as number | null,
      resetAt: endAt,
    };
  }

  const creditsUsed = (data ?? []).reduce(
    (total, row) =>
      total +
      (Number.isFinite(Number(row.credits_used))
        ? Number(row.credits_used)
        : 0),
    0,
  );

  return {
    error: null,
    creditsUsed,
    resetAt: endAt,
  };
}

export async function getLatestCurrencyStrengthCreditEvent() {
  const supabaseServer = getSupabaseServerClient();

  const { data, error } = await supabaseServer
    .from("currency_strength_refresh_credit_events")
    .select("*")
    .order("used_at", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    console.error(
      "GET LATEST CURRENCY STRENGTH CREDIT EVENT ERROR:",
      error.message,
    );

    return {
      error,
      event:
        null as CurrencyStrengthRefreshCreditEvent | null,
    };
  }

  const latestRow =
    Array.isArray(data) && data.length > 0 ? data[0] : null;

  return {
    error: null,
    event:
      (latestRow as CurrencyStrengthRefreshCreditEvent | null) ??
      null,
  };
}

export async function getCurrencyStrengthProviderUsage(
  referenceDate = new Date(),
) {
  const result =
    await getCurrencyStrengthDailyCreditsUsed(referenceDate);

  if (result.error || result.creditsUsed === null) {
    return {
      error: result.error,
      usage: null as {
        limit: number;
        creditsUsed: number;
        creditsRemaining: number;
        resetAt: string;
      } | null,
    };
  }

  return {
    error: null,
    usage: {
      limit: CURRENCY_STRENGTH_PROVIDER_DAILY_CREDIT_LIMIT,
      creditsUsed: result.creditsUsed,
      creditsRemaining: Math.max(
        0,
        CURRENCY_STRENGTH_PROVIDER_DAILY_CREDIT_LIMIT -
          result.creditsUsed,
      ),
      resetAt: result.resetAt,
    },
  };
}
