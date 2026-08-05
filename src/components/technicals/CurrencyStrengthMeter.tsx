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
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Grid3X3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Timeframe =
  | "Overview"
  | "M1"
  | "M5"
  | "M15"
  | "M30"
  | "H1"
  | "H4"
  | "D1"
  | "W1";

type ViewMode = "analog" | "digital" | "ranking";
type OutputMode = "percentage" | "raw";
type SortOrder = "strongest" | "weakest";

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
  timeframe: Exclude<Timeframe, "Overview">;
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

type CurrencyStrengthApiResponse = {
  ok: boolean;
  message: string;
  timeframe?: string;
  lookbackCandles?: number;
  snapshot: CurrencyStrengthSnapshot | null;
};


type RefreshJobStatus =
  | "collecting"
  | "completed"
  | "failed"
  | "cancelled";

type RefreshJobSummary = {
  id: string;
  timeframe: Exclude<Timeframe, "Overview">;
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
  snapshot?: CurrencyStrengthSnapshot;
  retryAfterSeconds?: number;
};

const timeframes: Timeframe[] = [
  "Overview",
  "M1",
  "M5",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
  "W1",
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

function pointOnCircle(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
) {
  const angleRadians = (angleDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  };
}

function describeArcSegment(index: number) {
  const centerX = 90;
  const centerY = 84;
  const radius = 62;
  const segmentSize = 18;
  const gap = 1.7;
  const startAngle = 180 + index * segmentSize + gap;
  const endAngle = 180 + (index + 1) * segmentSize - gap;
  const start = pointOnCircle(centerX, centerY, radius, startAngle);
  const end = pointOnCircle(centerX, centerY, radius, endAngle);

  return [
    "M",
    start.x.toFixed(2),
    start.y.toFixed(2),
    "A",
    radius,
    radius,
    0,
    0,
    1,
    end.x.toFixed(2),
    end.y.toFixed(2),
  ].join(" ");
}

function formatValue(
  reading: CurrencyReading,
  outputMode: OutputMode,
) {
  if (outputMode === "percentage") {
    return `${reading.percentage.toFixed(2)}%`;
  }

  return `${reading.rawScore >= 0 ? "+" : ""}${reading.rawScore.toFixed(2)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}


function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function OutputSwitch({
  outputMode,
  onChange,
}: {
  outputMode: OutputMode;
  onChange: (mode: OutputMode) => void;
}) {
  const isRaw = outputMode === "raw";

  return (
    <div className="group relative inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2">
      <span
        className={[
          "text-xs font-semibold transition",
          !isRaw ? "text-violet-300" : "text-slate-500",
        ].join(" ")}
      >
        %
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={isRaw}
        aria-label={
          isRaw
            ? "Raw score is active. Switch to percentage."
            : "Percentage is active. Switch to raw score."
        }
        title="Switch between percentage and raw score"
        onClick={() => onChange(isRaw ? "percentage" : "raw")}
        className="relative h-6 w-11 shrink-0 rounded-full border border-violet-400/60 bg-violet-500/20 transition"
      >
        <span
          className={[
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-violet-300 shadow-sm transition-transform duration-200",
            isRaw ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>

      <span
        className={[
          "text-xs font-semibold transition",
          isRaw ? "text-violet-300" : "text-slate-500",
        ].join(" ")}
      >
        Raw
      </span>

      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 shadow-xl group-hover:block">
        Switch between % and raw score.
      </div>
    </div>
  );
}

function AnalogGauge({
  reading,
  outputMode,
}: {
  reading: CurrencyReading;
  outputMode: OutputMode;
}) {
  const needleAngle = 180 + reading.percentage * 1.8;
  const needleEnd = pointOnCircle(90, 84, 47, needleAngle);
  const activeSegments = Math.ceil(reading.percentage / 10);

  return (
    <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">
            {reading.rank}
          </span>
          <span className="truncate text-base font-bold text-white">
            {reading.currency}
          </span>
        </div>

        <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300">
          {formatValue(reading, outputMode)}
        </span>
      </div>

      <svg
        viewBox="0 0 180 102"
        className="mt-1 h-auto w-full"
        role="img"
        aria-label={`${reading.currency} strength ${formatValue(
          reading,
          outputMode,
        )}`}
      >
        {Array.from({ length: 10 }, (_, index) => (
          <path
            key={index}
            d={describeArcSegment(index)}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className={
              index < activeSegments
                ? "text-violet-400"
                : "text-slate-800"
            }
          />
        ))}

        <line
          x1="90"
          y1="84"
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="text-white"
        />

        <circle
          cx="90"
          cy="84"
          r="6"
          fill="currentColor"
          className="text-violet-400"
        />

        <text x="15" y="100" className="fill-slate-500 text-[8px]">
          {outputMode === "percentage" ? "0%" : "-"}
        </text>

        <text
          x="90"
          y="100"
          textAnchor="middle"
          className="fill-slate-500 text-[8px]"
        >
          {outputMode === "percentage" ? "50%" : "0.00"}
        </text>

        <text
          x="165"
          y="100"
          textAnchor="end"
          className="fill-slate-500 text-[8px]"
        >
          {outputMode === "percentage" ? "100%" : "+"}
        </text>
      </svg>

      <div className="grid grid-cols-10 gap-1" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={[
              "h-1 rounded-full",
              index < activeSegments
                ? "bg-violet-400"
                : "bg-slate-800",
            ].join(" ")}
          />
        ))}
      </div>
    </article>
  );
}

function DigitalMeter({
  reading,
  outputMode,
}: {
  reading: CurrencyReading;
  outputMode: OutputMode;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">
            {reading.rank}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-400">
              {reading.currency}
            </p>
            <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-white">
              {formatValue(reading, outputMode)}
            </p>
          </div>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
          <BarChart3 className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, index) => {
          const segmentStart = index * 10;
          const fillPercentage = clamp(
            (reading.percentage - segmentStart) * 10,
            0,
            100,
          );

          return (
            <div
              key={index}
              className="h-2.5 overflow-hidden rounded-full bg-slate-800"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-violet-400"
                style={{ width: `${fillPercentage}%` }}
              />
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function CurrencyStrengthMeter() {
  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [viewMode, setViewMode] =
    useState<ViewMode>("analog");
  const [outputMode, setOutputMode] =
    useState<OutputMode>("percentage");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("strongest");
  const [snapshot, setSnapshot] =
    useState<CurrencyStrengthSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isRefreshStatusLoading, setIsRefreshStatusLoading] =
    useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshJob, setRefreshJob] =
    useState<RefreshJobSummary | null>(null);
  const [activeGlobalJob, setActiveGlobalJob] =
    useState<RefreshJobSummary | null>(null);
  const [refreshUsage, setRefreshUsage] =
    useState<RefreshUsage | null>(null);
  const [providerUsage, setProviderUsage] =
    useState<ProviderUsage | null>(null);
  const [refreshMessage, setRefreshMessage] =
    useState<string | null>(null);
  const [refreshError, setRefreshError] =
    useState<string | null>(null);
  const [refreshStatusError, setRefreshStatusError] =
    useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const isMountedRef = useRef(true);
  const timeframeRef = useRef<Timeframe>(timeframe);

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSnapshot = useCallback(
    async (
      selectedTimeframe: Exclude<Timeframe, "Overview">,
      signal?: AbortSignal,
    ) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          `/api/currency-strength?timeframe=${selectedTimeframe}&lookback=5`,
          {
            cache: "no-store",
            signal,
          },
        );

        const payload =
          (await response.json()) as CurrencyStrengthApiResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.message ||
              "Currency Strength data could not be loaded.",
          );
        }

        if (
          !signal?.aborted &&
          timeframeRef.current === selectedTimeframe
        ) {
          setSnapshot(payload.snapshot);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        if (
          !signal?.aborted &&
          timeframeRef.current === selectedTimeframe
        ) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Currency Strength data could not be loaded.",
          );
        }
      } finally {
        if (
          !signal?.aborted &&
          timeframeRef.current === selectedTimeframe
        ) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    if (timeframe === "Overview") {
      setSnapshot(null);
      setLoadError(null);
      setIsLoading(false);

      return () => controller.abort();
    }

    setSnapshot(null);
    void loadSnapshot(timeframe, controller.signal);

    return () => controller.abort();
  }, [loadSnapshot, timeframe]);

  const getAccessToken = useCallback(async () => {
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

    return accessToken;
  }, []);

  const applyRefreshPayload = useCallback(
    (payload: RefreshApiResponse) => {
      if (payload.job !== undefined) {
        setRefreshJob(payload.job ?? null);
      }

      if (payload.activeJob !== undefined) {
        setActiveGlobalJob(payload.activeJob ?? null);
      } else if (payload.job) {
        setActiveGlobalJob(
          payload.job.status === "collecting"
            ? payload.job
            : null,
        );
      }

      if (payload.usage) {
        setRefreshUsage(payload.usage);
      }

      if (payload.providerUsage) {
        setProviderUsage(payload.providerUsage);
      }
    },
    [],
  );

  const loadRefreshStatus = useCallback(async () => {
    setIsRefreshStatusLoading(true);
    setRefreshStatusError(null);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(error.message);
      }

      const accessToken = data.session?.access_token ?? null;
      setIsSignedIn(Boolean(accessToken));

      if (!accessToken) {
        setRefreshUsage(null);
        setProviderUsage(null);
        setRefreshJob(null);
        setActiveGlobalJob(null);
        return;
      }

      const storedJobId =
        window.localStorage.getItem(
          "edgevault_currency_strength_refresh_job_id",
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
          window.localStorage.removeItem(
            "edgevault_currency_strength_refresh_job_id",
          );
        }

        throw new Error(
          payload.message ||
            "Currency Strength refresh status could not be loaded.",
        );
      }

      applyRefreshPayload(payload);

      if (
        payload.job &&
        payload.job.status !== "collecting"
      ) {
        window.localStorage.removeItem(
          "edgevault_currency_strength_refresh_job_id",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Currency Strength refresh status could not be loaded.";

      console.error(
        "LOAD CURRENCY STRENGTH REFRESH STATUS ERROR:",
        error,
      );

      setRefreshStatusError(message);
    } finally {
      setIsRefreshStatusLoading(false);
    }
  }, [applyRefreshPayload]);

  useEffect(() => {
    void loadRefreshStatus();
  }, [loadRefreshStatus]);

  const waitForNextBatch = useCallback(
    async (seconds: number) => {
      const totalSeconds = Math.max(0, Math.ceil(seconds));

      for (
        let remaining = totalSeconds;
        remaining > 0;
        remaining -= 1
      ) {
        if (!isMountedRef.current) {
          return false;
        }

        setWaitSeconds(remaining);
        await new Promise((resolve) =>
          window.setTimeout(resolve, 1_000),
        );
      }

      if (isMountedRef.current) {
        setWaitSeconds(0);
      }

      return isMountedRef.current;
    },
    [],
  );

  const postRefreshRequest = useCallback(
    async (
      accessToken: string,
      body:
        | {
            action: "start";
            timeframe: Exclude<Timeframe, "Overview">;
          }
        | {
            action: "next";
            jobId: string;
          },
    ) => {
      const response = await fetch(
        "/api/currency-strength/refresh",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const payload =
        (await response.json()) as RefreshApiResponse;

      return {
        response,
        payload,
      };
    },
    [],
  );

  const runRefreshJob = useCallback(
    async (
      initialJob: RefreshJobSummary,
      accessToken: string,
    ) => {
      let currentJob = initialJob;

      while (
        isMountedRef.current &&
        currentJob.status === "collecting"
      ) {
        const { response, payload } =
          await postRefreshRequest(accessToken, {
            action: "next",
            jobId: currentJob.id,
          });

        applyRefreshPayload(payload);

        const retryAfterSeconds = Math.max(
          0,
          Number(payload.retryAfterSeconds ?? 0),
        );

        if (
          response.status === 429 &&
          retryAfterSeconds > 0
        ) {
          setRefreshMessage(payload.message);

          const shouldContinue =
            await waitForNextBatch(retryAfterSeconds);

          if (!shouldContinue) {
            return;
          }

          continue;
        }

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.message ||
              "Currency Strength could not be refreshed.",
          );
        }

        if (!payload.job) {
          throw new Error(
            "The refresh response did not include its job progress.",
          );
        }

        currentJob = payload.job;
        setRefreshJob(currentJob);
        setRefreshMessage(payload.message);

        if (currentJob.status === "completed") {
          window.localStorage.removeItem(
            "edgevault_currency_strength_refresh_job_id",
          );
          setActiveGlobalJob(null);

          if (
            timeframeRef.current === currentJob.timeframe
          ) {
            if (payload.snapshot) {
              setSnapshot(payload.snapshot);
              setLoadError(null);
              setIsLoading(false);
            } else {
              await loadSnapshot(currentJob.timeframe);
            }
          }

          return;
        }

        if (retryAfterSeconds > 0) {
          const shouldContinue =
            await waitForNextBatch(retryAfterSeconds);

          if (!shouldContinue) {
            return;
          }
        }
      }
    },
    [
      applyRefreshPayload,
      loadSnapshot,
      postRefreshRequest,
      waitForNextBatch,
    ],
  );

  const handleRefresh = useCallback(async () => {
    if (timeframe === "Overview" || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setRefreshError(null);
    setRefreshMessage(null);
    setWaitSeconds(0);

    try {
      const accessToken = await getAccessToken();
      setIsSignedIn(true);

      let jobToRun =
        refreshJob?.status === "collecting"
          ? refreshJob
          : null;

      if (!jobToRun) {
        const { response, payload } =
          await postRefreshRequest(accessToken, {
            action: "start",
            timeframe,
          });

        applyRefreshPayload(payload);

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.message ||
              "Currency Strength refresh could not start.",
          );
        }

        if (!payload.job) {
          throw new Error(
            "The refresh started without a job identifier.",
          );
        }

        jobToRun = payload.job;
        setRefreshJob(jobToRun);
        setActiveGlobalJob(jobToRun);
        setRefreshMessage(payload.message);

        window.localStorage.setItem(
          "edgevault_currency_strength_refresh_job_id",
          jobToRun.id,
        );
      }

      await runRefreshJob(jobToRun, accessToken);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Currency Strength could not be refreshed.";

      setRefreshError(message);
      setRefreshMessage(null);
      await loadRefreshStatus();
    } finally {
      setIsRefreshing(false);
      setWaitSeconds(0);
    }
  }, [
    applyRefreshPayload,
    getAccessToken,
    isRefreshing,
    loadRefreshStatus,
    postRefreshRequest,
    refreshJob,
    runRefreshJob,
    timeframe,
  ]);

  const readings = useMemo(() => {
    const savedReadings = snapshot?.readings ?? [];

    return [...savedReadings].sort((first, second) =>
      sortOrder === "strongest"
        ? second.rawScore - first.rawScore
        : first.rawScore - second.rawScore,
    );
  }, [snapshot, sortOrder]);

  const statusLabel =
    timeframe === "Overview"
      ? "Overview pending"
      : isLoading
        ? "Loading snapshot"
        : loadError
          ? "Data unavailable"
          : snapshot
            ? "Saved live snapshot"
            : "No saved snapshot";

  const statusClasses =
    snapshot && !isLoading && !loadError
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
      : loadError
        ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
        : "border-amber-400/30 bg-amber-500/10 text-amber-300";

  const emptyMessage =
    timeframe === "Overview"
      ? "The multi-horizon Overview calculation has not been generated yet."
      : `No saved ${timeframe} snapshot exists yet.`;


  const displayedJob = refreshJob ?? activeGlobalJob;
  const refreshProgress = displayedJob
    ? clamp(
        (displayedJob.completedPairCount / 28) * 100,
        0,
        100,
      )
    : 0;

  const isAnotherRefreshActive = Boolean(
    activeGlobalJob &&
      (!refreshJob || activeGlobalJob.id !== refreshJob.id),
  );

  const refreshButtonDisabled =
    timeframe === "Overview" ||
    isRefreshing ||
    !isSignedIn ||
    isRefreshStatusLoading ||
    isAnotherRefreshActive ||
    (refreshUsage?.remainingRefreshes ?? 1) <= 0;

  const refreshButtonLabel =
    timeframe === "Overview"
      ? "Overview refresh pending"
      : isRefreshing
        ? waitSeconds > 0
          ? `Next batch in ${formatCountdown(waitSeconds)}`
          : `Updating ${displayedJob?.timeframe ?? timeframe}…`
        : refreshJob?.status === "collecting"
          ? `Continue ${refreshJob.timeframe} refresh`
          : `Refresh ${timeframe}`;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">
                Currency Strength Controls
              </p>

              <span
                className={[
                  "rounded-full border px-2 py-1 text-[11px] font-semibold",
                  statusClasses,
                ].join(" ")}
              >
                {statusLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setSortOrder((current) =>
                  current === "strongest"
                    ? "weakest"
                    : "strongest",
                )
              }
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600"
            >
              <ArrowDownUp className="h-4 w-4" />
              {sortOrder === "strongest"
                ? "Strongest first"
                : "Weakest first"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {timeframes.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTimeframe(item)}
                className={[
                  "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                  timeframe === item
                    ? "border-violet-400/70 bg-violet-500/15 text-violet-200"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {
                value: "analog" as ViewMode,
                label: "Analog",
                icon: Gauge,
              },
              {
                value: "digital" as ViewMode,
                label: "Digital",
                icon: Grid3X3,
              },
              {
                value: "ranking" as ViewMode,
                label: "Ranking",
                icon: BarChart3,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setViewMode(item.value)}
                  className={[
                    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition",
                    viewMode === item.value
                      ? "border-violet-400/70 bg-violet-500/15 text-violet-200"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800/90 bg-slate-950/65 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">
                Manual market-data refresh
              </p>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
                28 direct pairs
              </span>
            </div>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Refreshes only the selected timeframe. The four seven-pair
              batches are locked to one completed candle and saved when all
              28 pairs finish.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshButtonDisabled}
            className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-400/50 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600 lg:w-auto"
          >
            <RefreshCw
              className={[
                "h-4 w-4",
                isRefreshing ? "animate-spin" : "",
              ].join(" ")}
            />
            {refreshButtonLabel}
          </button>
        </div>

        {refreshStatusError && !isRefreshStatusLoading ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <p className="text-xs leading-5 text-rose-200">
                {refreshStatusError}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadRefreshStatus()}
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry allowance
            </button>
          </div>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Your allowance
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {isRefreshStatusLoading
                ? "Loading…"
                : refreshUsage
                  ? `${refreshUsage.remainingRefreshes} of ${refreshUsage.limit} remaining`
                  : refreshStatusError
                    ? "Could not load"
                    : isSignedIn
                      ? "Unavailable"
                      : "Sign in required"}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Allowance resets
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {refreshUsage
                ? formatDateTime(refreshUsage.resetAt)
                : "1:05 AM Nigeria time"}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Tracked provider credits
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {providerUsage
                ? `${providerUsage.creditsRemaining} of ${providerUsage.limit} remaining`
                : "Not loaded"}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Refresh cost
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              28 credits · about 4 minutes
            </p>
          </div>
        </div>

        {displayedJob ? (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-300">
                  {displayedJob.timeframe} refresh · {displayedJob.completedPairCount}/28 pairs
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {displayedJob.status === "collecting"
                    ? `Batch ${Math.min(displayedJob.nextBatch, 4)} of 4 is next.`
                    : displayedJob.status === "completed"
                      ? "All four batches completed."
                      : displayedJob.errorMessage ??
                        `Refresh status: ${displayedJob.status}`}
                </p>
              </div>

              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-400">
                {displayedJob.apiCreditsUsed} credits used
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-violet-400 transition-all duration-500"
                style={{ width: `${refreshProgress}%` }}
              />
            </div>
          </div>
        ) : null}

        {isAnotherRefreshActive ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            Another {activeGlobalJob?.timeframe} refresh is in progress. Your
            refresh button will become available when it finishes.
          </div>
        ) : null}

        {refreshMessage ? (
          <div
            className={[
              "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs",
              refreshJob?.status === "completed"
                ? "border-emerald-400/20 bg-emerald-500/5 text-emerald-200"
                : "border-violet-400/20 bg-violet-500/5 text-violet-200",
            ].join(" ")}
          >
            {refreshJob?.status === "completed" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {refreshMessage}
          </div>
        ) : null}

        {refreshError ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/5 px-3 py-2.5 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {refreshError}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {timeframe} comparison
            </p>
            <p className="text-xs text-slate-500">
              All eight currencies are kept together for direct comparison.
            </p>
          </div>

          <OutputSwitch
            outputMode={outputMode}
            onChange={setOutputMode}
          />
        </div>

        {snapshot ? (
          <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5">
              <Database className="h-3.5 w-3.5 text-emerald-300" />
              {snapshot.provider}
            </span>

            <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5">
              {snapshot.used_pair_count}/{snapshot.requested_pair_count} pairs
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5">
              <Clock3 className="h-3.5 w-3.5 text-violet-300" />
              Completed candle at refresh:{" "}
              {formatDateTime(
                snapshot.latest_completed_candle_at,
              )}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-emerald-300" />
              Refreshed at:{" "}
              {formatDateTime(snapshot.calculated_at)}
            </span>

            <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5">
              Lookback: {snapshot.lookback_candles} candles
            </span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 text-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-violet-300" />
            <p className="text-sm font-semibold text-slate-300">
              Loading the saved Currency Strength snapshot…
            </p>
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-rose-400/20 bg-rose-500/5 px-4 text-center">
            <AlertCircle className="h-6 w-6 text-rose-300" />
            <div>
              <p className="text-sm font-semibold text-rose-200">
                Currency Strength could not be loaded.
              </p>
              <p className="mt-1 text-xs text-rose-300/80">
                {loadError}
              </p>
            </div>
          </div>
        ) : null}

        {!isLoading && !loadError && !snapshot ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 text-center">
            <Database className="h-6 w-6 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-300">
                No calculation is available for this selection.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {emptyMessage}
              </p>
            </div>
          </div>
        ) : null}

        {!isLoading &&
        !loadError &&
        snapshot &&
        viewMode === "analog" ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {readings.map((reading) => (
              <AnalogGauge
                key={reading.currency}
                reading={reading}
                outputMode={outputMode}
              />
            ))}
          </div>
        ) : null}

        {!isLoading &&
        !loadError &&
        snapshot &&
        viewMode === "digital" ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {readings.map((reading) => (
              <DigitalMeter
                key={reading.currency}
                reading={reading}
                outputMode={outputMode}
              />
            ))}
          </div>
        ) : null}

        {!isLoading &&
        !loadError &&
        snapshot &&
        viewMode === "ranking" ? (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/70 text-left">
                    <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Rank
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Currency
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      {outputMode === "percentage"
                        ? "Percentage"
                        : "Raw score"}
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Meter
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {readings.map((reading) => (
                    <tr
                      key={reading.currency}
                      className="border-b border-slate-900 last:border-b-0"
                    >
                      <td className="px-3 py-2.5 text-sm font-semibold text-slate-400">
                        {reading.rank}
                      </td>

                      <td className="px-3 py-2.5 text-sm font-bold text-white">
                        {reading.currency}
                      </td>

                      <td className="px-3 py-2.5 text-sm font-semibold text-violet-300">
                        {formatValue(reading, outputMode)}
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-violet-400"
                              style={{
                                width: `${reading.percentage}%`,
                              }}
                            />
                          </div>

                          <span className="w-12 text-right text-[11px] text-slate-500">
                            {reading.percentage.toFixed(2)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}