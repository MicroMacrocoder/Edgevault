"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowDownUp,
  BarChart3,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type CurrencyStrengthTimeframe =
  | "M1"
  | "M5"
  | "M15"
  | "M30"
  | "H1"
  | "H4"
  | "D1"
  | "W1";

type DashboardTimeframePreference =
  | "AUTO"
  | CurrencyStrengthTimeframe;

type SortOrder = "strongest" | "weakest";
type OutputMode = "percentage" | "raw";

type CurrencyReading = {
  currency: string;
  rawScore: number;
  percentage: number;
  rank: number;
  relationshipCount: number;
  missingRelationshipCount: number;
};

type CurrencyStrengthSnapshot = {
  id: number;
  timeframe: CurrencyStrengthTimeframe;
  interval: string;
  lookback_candles: number;
  latest_completed_candle_at: string;
  calculated_at: string;
  provider: string;
  requested_pair_count: number;
  used_pair_count: number;
  is_complete: boolean;
  readings: CurrencyReading[];
};

type SnapshotApiResponse = {
  ok: boolean;
  message: string;
  snapshot: CurrencyStrengthSnapshot | null;
};

type RefreshJobStatus =
  | "collecting"
  | "completed"
  | "failed"
  | "cancelled";

type RefreshJobSummary = {
  id: string;
  timeframe: CurrencyStrengthTimeframe;
  status: RefreshJobStatus;
  totalBatches: number;
  nextBatch: number;
  collectedBatches: number[];
  completedPairCount: number;
  lockedCandleAt: string | null;
  apiCreditsUsed: number;
  snapshotId: number | null;
  startedAt: string;
  lastBatchAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  errorMessage: string | null;
};

type RefreshUsage = {
  limit: number;
  completedRefreshes: number;
  remainingRefreshes: number;
  resetAt: string;
};

type ProviderUsage = {
  limit: number;
  creditsUsed: number;
  creditsRemaining: number;
  resetAt: string;
};

type RefreshApiResponse = {
  ok: boolean;
  message: string;
  job?: RefreshJobSummary | null;
  activeJob?: RefreshJobSummary | null;
  usage?: RefreshUsage;
  providerUsage?: ProviderUsage;
  retryAfterSeconds?: number;
};

type SnapshotMap = Record<
  CurrencyStrengthTimeframe,
  CurrencyStrengthSnapshot | null
>;

const timeframes: CurrencyStrengthTimeframe[] = [
  "M1",
  "M5",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
  "W1",
];

const emptySnapshots: SnapshotMap = {
  M1: null,
  M5: null,
  M15: null,
  M30: null,
  H1: null,
  H4: null,
  D1: null,
  W1: null,
};

const refreshJobStorageKey =
  "edgevault_currency_strength_refresh_job_id";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getPreferenceKey(userId: string, setting: string) {
  return `edgevault_currency_strength_dashboard_${setting}_${userId}`;
}

function parseTimeframePreference(
  value: string | null,
): DashboardTimeframePreference {
  if (value === "AUTO") {
    return "AUTO";
  }

  if (
    value &&
    timeframes.includes(value as CurrencyStrengthTimeframe)
  ) {
    return value as CurrencyStrengthTimeframe;
  }

  return "AUTO";
}

function parseSortOrder(value: string | null): SortOrder {
  return value === "weakest" ? "weakest" : "strongest";
}

function parseOutputMode(value: string | null): OutputMode {
  return value === "raw" ? "raw" : "percentage";
}

export default function CurrencyStrengthDashboardWidget({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const [snapshots, setSnapshots] =
    useState<SnapshotMap>(emptySnapshots);
  const [timeframePreference, setTimeframePreference] =
    useState<DashboardTimeframePreference>("AUTO");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("strongest");
  const [outputMode, setOutputMode] =
    useState<OutputMode>("percentage");
  const [userId, setUserId] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoadingSnapshots, setIsLoadingSnapshots] =
    useState(true);
  const [isLoadingStatus, setIsLoadingStatus] =
    useState(true);
  const [isStartingRefresh, setIsStartingRefresh] =
    useState(false);
  const [activeJob, setActiveJob] =
    useState<RefreshJobSummary | null>(null);
  const [requestedJob, setRequestedJob] =
    useState<RefreshJobSummary | null>(null);
  const [usage, setUsage] =
    useState<RefreshUsage | null>(null);
  const [providerUsage, setProviderUsage] =
    useState<ProviderUsage | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const previousActiveJobRef = useRef<string | null>(null);
  const lastLoadedSnapshotIdRef = useRef<number | null>(null);

  const loadSnapshots = useCallback(async () => {
    setIsLoadingSnapshots(true);

    try {
      const results = await Promise.all(
        timeframes.map(async (timeframe) => {
          const response = await fetch(
            `/api/currency-strength?timeframe=${timeframe}&lookback=5`,
            { cache: "no-store" },
          );

          const payload =
            (await response.json()) as SnapshotApiResponse;

          if (!response.ok || !payload.ok) {
            throw new Error(
              payload.message ||
                `Could not load ${timeframe} Currency Strength.`,
            );
          }

          return [timeframe, payload.snapshot] as const;
        }),
      );

      const nextSnapshots = { ...emptySnapshots };

      for (const [timeframe, snapshot] of results) {
        nextSnapshots[timeframe] = snapshot;
      }

      setSnapshots(nextSnapshots);
    } catch (error) {
      console.error(
        "LOAD DASHBOARD CURRENCY STRENGTH SNAPSHOTS ERROR:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load Currency Strength snapshots.",
      );
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, []);

  const loadRefreshStatus = useCallback(async () => {
    setIsLoadingStatus(true);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(error.message);
      }

      const session = data.session;
      const accessToken = session?.access_token ?? null;
      const sessionUserId = session?.user.id ?? "";

      setIsSignedIn(Boolean(accessToken));
      setUserId(sessionUserId);

      if (!accessToken) {
        setActiveJob(null);
        setRequestedJob(null);
        setUsage(null);
        setProviderUsage(null);
        return;
      }

      const storedJobId = window.localStorage.getItem(
        refreshJobStorageKey,
      );
      const query = storedJobId
        ? `?jobId=${encodeURIComponent(storedJobId)}`
        : "";

      const response = await fetch(
        `/api/currency-strength/refresh${query}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const payload =
        (await response.json()) as RefreshApiResponse;

      if (!response.ok || !payload.ok) {
        if (response.status === 403 && storedJobId) {
          window.localStorage.removeItem(refreshJobStorageKey);
        }

        throw new Error(
          payload.message ||
            "Could not load Currency Strength refresh status.",
        );
      }

      const nextActiveJob = payload.activeJob ?? null;
      const nextRequestedJob = payload.job ?? null;
      const previousActiveJobId = previousActiveJobRef.current;

      setActiveJob(nextActiveJob);
      setRequestedJob(nextRequestedJob);
      setUsage(payload.usage ?? null);
      setProviderUsage(payload.providerUsage ?? null);

      if (
        nextRequestedJob &&
        nextRequestedJob.status !== "collecting"
      ) {
        window.localStorage.removeItem(refreshJobStorageKey);
      }

      const completedSnapshotId =
        nextRequestedJob?.status === "completed"
          ? nextRequestedJob.snapshotId
          : null;

      if (
        (previousActiveJobId && !nextActiveJob) ||
        (completedSnapshotId !== null &&
          completedSnapshotId !==
            lastLoadedSnapshotIdRef.current)
      ) {
        await loadSnapshots();
        lastLoadedSnapshotIdRef.current =
          completedSnapshotId;
      }

      previousActiveJobRef.current =
        nextActiveJob?.id ?? null;
    } catch (error) {
      console.error(
        "LOAD DASHBOARD CURRENCY STRENGTH STATUS ERROR:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load refresh status.",
      );
    } finally {
      setIsLoadingStatus(false);
    }
  }, [loadSnapshots]);

  useEffect(() => {
    void loadSnapshots();
    void loadRefreshStatus();
  }, [loadRefreshStatus, loadSnapshots]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    setTimeframePreference(
      parseTimeframePreference(
        window.localStorage.getItem(
          getPreferenceKey(userId, "timeframe"),
        ),
      ),
    );
    setSortOrder(
      parseSortOrder(
        window.localStorage.getItem(
          getPreferenceKey(userId, "sort"),
        ),
      ),
    );
    setOutputMode(
      parseOutputMode(
        window.localStorage.getItem(
          getPreferenceKey(userId, "output"),
        ),
      ),
    );
  }, [userId]);

  useEffect(() => {
    const interval = window.setInterval(
      () => void loadRefreshStatus(),
      activeJob ? 5_000 : 20_000,
    );

    return () => window.clearInterval(interval);
  }, [activeJob, loadRefreshStatus]);

  const latestRefreshedTimeframe = useMemo(() => {
    const availableSnapshots = timeframes
      .map((timeframe) => snapshots[timeframe])
      .filter(
        (
          snapshot,
        ): snapshot is CurrencyStrengthSnapshot =>
          Boolean(snapshot),
      );

    if (availableSnapshots.length === 0) {
      return "H1" as CurrencyStrengthTimeframe;
    }

    return availableSnapshots.reduce((latest, current) =>
      Date.parse(current.calculated_at) >
      Date.parse(latest.calculated_at)
        ? current
        : latest,
    ).timeframe;
  }, [snapshots]);

  const displayedTimeframe =
    timeframePreference === "AUTO"
      ? latestRefreshedTimeframe
      : timeframePreference;

  const displayedSnapshot = snapshots[displayedTimeframe];

  const sortedReadings = useMemo(() => {
    const readings = [...(displayedSnapshot?.readings ?? [])];

    readings.sort((first, second) =>
      sortOrder === "strongest"
        ? second.rawScore - first.rawScore
        : first.rawScore - second.rawScore,
    );

    return readings;
  }, [displayedSnapshot, sortOrder]);

  const rawRange = useMemo(() => {
    if (sortedReadings.length === 0) {
      return { minimum: -1, maximum: 1 };
    }

    const scores = sortedReadings.map(
      (reading) => reading.rawScore,
    );

    return {
      minimum: Math.min(...scores),
      maximum: Math.max(...scores),
    };
  }, [sortedReadings]);

  const storedJobId =
    typeof window !== "undefined"
      ? window.localStorage.getItem(refreshJobStorageKey)
      : null;

  const isCurrentUsersJob = Boolean(
    activeJob &&
      (activeJob.id === storedJobId ||
        requestedJob?.id === activeJob.id),
  );

  const activeProgress = activeJob
    ? clamp(activeJob.completedPairCount, 0, 28)
    : 0;

  function saveTimeframePreference(
    preference: DashboardTimeframePreference,
  ) {
    setTimeframePreference(preference);

    if (userId) {
      window.localStorage.setItem(
        getPreferenceKey(userId, "timeframe"),
        preference,
      );
    }
  }

  function toggleSortOrder() {
    const nextOrder =
      sortOrder === "strongest" ? "weakest" : "strongest";

    setSortOrder(nextOrder);

    if (userId) {
      window.localStorage.setItem(
        getPreferenceKey(userId, "sort"),
        nextOrder,
      );
    }
  }

  function toggleOutputMode() {
    const nextMode =
      outputMode === "percentage" ? "raw" : "percentage";

    setOutputMode(nextMode);

    if (userId) {
      window.localStorage.setItem(
        getPreferenceKey(userId, "output"),
        nextMode,
      );
    }
  }

  async function startRefresh() {
    setIsStartingRefresh(true);
    setMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(error.message);
      }

      const accessToken = data.session?.access_token ?? null;

      if (!accessToken) {
        throw new Error(
          "You must be signed in to refresh Currency Strength.",
        );
      }

      const response = await fetch(
        "/api/currency-strength/refresh",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "start",
            timeframe: displayedTimeframe,
          }),
        },
      );

      const payload =
        (await response.json()) as RefreshApiResponse;

      if (payload.job?.id) {
        window.localStorage.setItem(
          refreshJobStorageKey,
          payload.job.id,
        );
      }

      setActiveJob(
        payload.activeJob ?? payload.job ?? activeJob,
      );
      setRequestedJob(payload.job ?? null);
      setUsage(payload.usage ?? usage);
      setProviderUsage(
        payload.providerUsage ?? providerUsage,
      );

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.message ||
            "The Currency Strength refresh could not start.",
        );
      }

      setMessage(payload.message);
      await loadRefreshStatus();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Currency Strength refresh could not start.",
      );
    } finally {
      setIsStartingRefresh(false);
    }
  }

  function getBarWidth(reading: CurrencyReading) {
    if (outputMode === "percentage") {
      return clamp(reading.percentage, 0, 100);
    }

    const range = rawRange.maximum - rawRange.minimum;

    if (range <= 0) {
      return 50;
    }

    return clamp(
      ((reading.rawScore - rawRange.minimum) / range) * 100,
      4,
      100,
    );
  }

  function formatReading(reading: CurrencyReading) {
    if (outputMode === "percentage") {
      return `${reading.percentage.toFixed(2)}%`;
    }

    return `${reading.rawScore >= 0 ? "+" : ""}${reading.rawScore.toFixed(2)}`;
  }

  const isBusy = Boolean(activeJob) || isStartingRefresh;

  return (
    <section className="border border-gray-800 bg-[#111111] p-5 shadow-[0_0_35px_rgba(34,211,238,0.04)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
            Technicals
          </p>
          <div className="mt-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-yellow-400" />
            <h2 className="font-mono text-lg font-bold text-white">
              Currency Strength
            </h2>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            The dashboard uses the same saved result and refresh job as the full meter.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex w-fit items-center gap-2 border border-gray-800 px-3 py-2 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          Open meter
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="min-w-0">
          <span className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
            Dashboard timeframe
          </span>
          <select
            value={timeframePreference}
            onChange={(event) =>
              saveTimeframePreference(
                event.target.value as DashboardTimeframePreference,
              )
            }
            className="w-full border border-gray-800 bg-black px-3 py-2.5 font-mono text-xs font-bold text-white outline-none transition focus:border-yellow-400"
          >
            <option value="AUTO">
              Automatic — latest refreshed timeframe
            </option>
            {timeframes.map((timeframe) => (
              <option key={timeframe} value={timeframe}>
                {timeframe}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={toggleSortOrder}
          className="mt-auto inline-flex items-center justify-center gap-2 border border-gray-800 px-3 py-2.5 font-mono text-xs font-bold text-gray-300 transition hover:border-cyan-400 hover:text-cyan-300"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          {sortOrder === "strongest"
            ? "Strongest first"
            : "Weakest first"}
        </button>

        <button
          type="button"
          onClick={toggleOutputMode}
          title="Switch between % and raw score"
          className="mt-auto border border-gray-800 px-3 py-2.5 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          {outputMode === "percentage" ? "%" : "Raw"}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 border border-gray-800 bg-black p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-yellow-400 px-2.5 py-1 font-mono text-xs font-black text-black">
              {displayedTimeframe}
            </span>
            {timeframePreference === "AUTO" ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300">
                Latest refreshed
              </span>
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">
                Custom default
              </span>
            )}
          </div>

          {displayedSnapshot ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-violet-300" />
                Completed candle: {formatDateTime(displayedSnapshot.latest_completed_candle_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-emerald-300" />
                Refreshed: {formatDateTime(displayedSnapshot.calculated_at)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="border border-gray-800 px-3 py-2 font-mono text-xs text-gray-400">
            {isLoadingStatus
              ? "Allowance loading…"
              : usage
                ? `${usage.remainingRefreshes} of ${usage.limit} remaining`
                : isSignedIn
                  ? "Allowance unavailable"
                  : "Sign in required"}
          </div>

          <button
            type="button"
            onClick={() => void startRefresh()}
            disabled={
              isBusy ||
              !isSignedIn ||
              !usage ||
              usage.remainingRefreshes <= 0
            }
            className="inline-flex items-center justify-center gap-2 bg-cyan-400 px-4 py-2 font-mono text-xs font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
          >
            {isStartingRefresh ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh {displayedTimeframe}
          </button>
        </div>
      </div>

      {activeJob ? (
        <div
          className={
            isCurrentUsersJob
              ? "mt-3 border border-cyan-400/30 bg-cyan-400/10 p-3"
              : "mt-3 border border-yellow-400/30 bg-yellow-400/10 p-3"
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <LoaderCircle
                className={
                  isCurrentUsersJob
                    ? "mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan-300"
                    : "mt-0.5 h-4 w-4 shrink-0 animate-spin text-yellow-300"
                }
              />
              <div>
                <p className="font-mono text-xs font-bold text-white">
                  {isCurrentUsersJob
                    ? `Your ${activeJob.timeframe} refresh is continuing in the background`
                    : `Another ${activeJob.timeframe} refresh is currently active`}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {activeProgress} of 28 pairs collected. A second refresh will not start and no allowance will be used.
                </p>
              </div>
            </div>

            <span className="font-mono text-xs font-bold text-white">
              {activeProgress}/28
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden bg-gray-900">
            <div
              className={
                isCurrentUsersJob
                  ? "h-full bg-cyan-400 transition-all duration-500"
                  : "h-full bg-yellow-400 transition-all duration-500"
              }
              style={{
                width: `${(activeProgress / 28) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="mt-3 flex items-start gap-2 border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="mt-4">
        {isLoadingSnapshots ? (
          <div className="flex min-h-[270px] items-center justify-center border border-gray-800 bg-black">
            <div className="text-center">
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-cyan-300" />
              <p className="mt-3 font-mono text-xs text-gray-500">
                Loading latest saved Currency Strength…
              </p>
            </div>
          </div>
        ) : !displayedSnapshot ? (
          <div className="flex min-h-[270px] items-center justify-center border border-gray-800 bg-black p-6 text-center">
            <div>
              <BarChart3 className="mx-auto h-8 w-8 text-gray-700" />
              <p className="mt-3 font-mono text-sm font-bold text-white">
                No saved {displayedTimeframe} result yet
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Refresh this timeframe once to create its first saved result.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 border border-gray-800 bg-black p-4">
            {sortedReadings.map((reading, index) => (
              <div
                key={reading.currency}
                className="grid grid-cols-[30px_42px_minmax(0,1fr)_72px] items-center gap-2"
              >
                <span className="font-mono text-xs text-gray-600">
                  {index + 1}
                </span>
                <span className="font-mono text-sm font-black text-white">
                  {reading.currency}
                </span>
                <div className="h-2.5 overflow-hidden bg-gray-900">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-500"
                    style={{
                      width: `${getBarWidth(reading)}%`,
                      opacity: clamp(
                        0.45 +
                          (outputMode === "percentage"
                            ? reading.percentage / 180
                            : getBarWidth(reading) / 180),
                        0.45,
                        1,
                      ),
                    }}
                  />
                </div>
                <span className="text-right font-mono text-xs font-bold text-yellow-300">
                  {formatReading(reading)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {providerUsage ? (
        <p className="mt-3 text-right font-mono text-[11px] text-gray-600">
          Tracked Twelve Data credits: {providerUsage.creditsRemaining} of {providerUsage.limit} remaining
        </p>
      ) : null}
    </section>
  );
}