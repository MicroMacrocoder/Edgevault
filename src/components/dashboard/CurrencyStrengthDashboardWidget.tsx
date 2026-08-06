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
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BarChart3,
  Clock3,
  ExternalLink,
  Gauge,
  Hash,
  List,
  LoaderCircle,
  Percent,
  RefreshCw,
} from "lucide-react";
import CompactCycleSelect from "@/components/dashboard/CompactCycleSelect";
import { supabase } from "@/lib/supabase";
import { useDashboardPreferences } from "@/components/dashboard/DashboardPreferencesProvider";

type CurrencyStrengthTimeframe =
  | "M1"
  | "M5"
  | "M15"
  | "M30"
  | "H1"
  | "H4"
  | "D1"
  | "W1";

type DashboardTimeframePreference = CurrencyStrengthTimeframe;

type SortOrder = "strongest" | "weakest";
type OutputMode = "percentage" | "raw";
type ViewMode = "analog" | "digital";

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

const timeframeOptions = timeframes.map((timeframe) => ({
  value: timeframe,
  label: timeframe,
  shortLabel: timeframe,
  description: `Timeframe: ${timeframe}`,
}));

const viewOptions = [
  {
    value: "analog" as const,
    label: "Analog display",
    shortLabel: "",
    description: "Analog strength display",
    icon: <Gauge className="h-4 w-4" />,
  },
  {
    value: "digital" as const,
    label: "Digital display",
    shortLabel: "",
    description: "Digital strength display",
    icon: <List className="h-4 w-4" />,
  },
];

const sortOptions = [
  {
    value: "strongest" as const,
    label: "Strongest first",
    shortLabel: "",
    description: "Sort strongest to weakest",
    icon: <ArrowDownWideNarrow className="h-4 w-4" />,
  },
  {
    value: "weakest" as const,
    label: "Weakest first",
    shortLabel: "",
    description: "Sort weakest to strongest",
    icon: <ArrowUpNarrowWide className="h-4 w-4" />,
  },
];

const outputOptions = [
  {
    value: "percentage" as const,
    label: "Percentage values",
    shortLabel: "",
    description: "Show percentage values",
    icon: <Percent className="h-4 w-4" />,
  },
  {
    value: "raw" as const,
    label: "Raw values",
    shortLabel: "",
    description: "Show raw strength values",
    icon: <Hash className="h-4 w-4" />,
  },
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

function getPreferenceKey(owner: string, setting: string) {
  return `edgevault_currency_strength_dashboard_${setting}_${owner}`;
}

function parseTimeframePreference(
  value: string | null,
): DashboardTimeframePreference {
  if (
    value &&
    timeframes.includes(value as CurrencyStrengthTimeframe)
  ) {
    return value as CurrencyStrengthTimeframe;
  }

  return "H1";
}

function parseSortOrder(value: string | null): SortOrder {
  return value === "weakest" ? "weakest" : "strongest";
}

function parseOutputMode(value: string | null): OutputMode {
  return value === "raw" ? "raw" : "percentage";
}

function parseViewMode(value: string | null): ViewMode {
  return value === "digital" ? "digital" : "analog";
}

export default function CurrencyStrengthDashboardWidget({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const { preferences, updateSection: updatePreferenceSection } =
    useDashboardPreferences();
  const timeframePreference =
    preferences.currencyStrength.timeframe as DashboardTimeframePreference;
  const sortOrder = preferences.currencyStrength.sort as SortOrder;
  const outputMode = preferences.currencyStrength.output as OutputMode;
  const viewMode = preferences.currencyStrength.view as ViewMode;

  const [snapshots, setSnapshots] =
    useState<SnapshotMap>(emptySnapshots);
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
      setErrorMessage("");
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

      setIsSignedIn(Boolean(accessToken));

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
        lastLoadedSnapshotIdRef.current = completedSnapshotId;
      }

      previousActiveJobRef.current = nextActiveJob?.id ?? null;
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
    const interval = window.setInterval(
      () => void loadRefreshStatus(),
      activeJob ? 5_000 : 20_000,
    );

    return () => window.clearInterval(interval);
  }, [activeJob, loadRefreshStatus]);

  const displayedTimeframe = timeframePreference;
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

  function savePreference<
    Setting extends keyof typeof preferences.currencyStrength,
  >(
    setting: Setting,
    value: (typeof preferences.currencyStrength)[Setting],
  ) {
    void updatePreferenceSection("currencyStrength", {
      ...preferences.currencyStrength,
      [setting]: value,
    });
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

      setActiveJob(payload.activeJob ?? payload.job ?? activeJob);
      setRequestedJob(payload.job ?? null);
      setUsage(payload.usage ?? usage);
      setProviderUsage(payload.providerUsage ?? providerUsage);

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

  function getReadingPosition(reading: CurrencyReading) {
    if (outputMode === "percentage") {
      return clamp(reading.percentage, 0, 100);
    }

    const range = rawRange.maximum - rawRange.minimum;

    if (range <= 0) {
      return 50;
    }

    return clamp(
      ((reading.rawScore - rawRange.minimum) / range) * 100,
      0,
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
    <section className="flex h-full flex-col border border-gray-800 bg-[#111111] p-4 shadow-[0_0_35px_rgba(34,211,238,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Technicals
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 shrink-0 text-yellow-400" />
            <h2 className="truncate font-mono text-base font-bold text-white">
              Currency Strength
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          title="Open the full Currency Strength meter"
          aria-label="Open the full Currency Strength meter"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-gray-800 text-gray-400 transition hover:border-yellow-400 hover:text-yellow-300"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        <CompactCycleSelect<DashboardTimeframePreference>
          label="Timeframe"
          value={timeframePreference}
          options={timeframeOptions}
          onChange={(value) => savePreference("timeframe", value)}
          accent="yellow"
          compact
          hideLabel
          className="w-[102px] shrink-0"
        />

        <CompactCycleSelect<ViewMode>
          label="Display"
          value={viewMode}
          options={viewOptions}
          onChange={(value) => savePreference("view", value)}
          accent="cyan"
          compact
          hideLabel
          className="w-[82px] shrink-0"
        />

        <CompactCycleSelect<SortOrder>
          label="Order"
          value={sortOrder}
          options={sortOptions}
          onChange={(value) => savePreference("sort", value)}
          accent="cyan"
          compact
          hideLabel
          className="w-[82px] shrink-0"
        />

        <CompactCycleSelect<OutputMode>
          label="Values"
          value={outputMode}
          options={outputOptions}
          onChange={(value) => savePreference("output", value)}
          accent="yellow"
          compact
          hideLabel
          className="w-[82px] shrink-0"
        />
      </div>

      <div className="mt-2 flex min-h-8 items-center justify-between gap-3 border-y border-gray-800 py-1.5">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-gray-500">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          {displayedSnapshot
            ? formatDateTime(displayedSnapshot.calculated_at)
            : `No saved ${displayedTimeframe} result`}
        </p>

        <button
          type="button"
          onClick={() => void startRefresh()}
          disabled={
            isBusy ||
            !isSignedIn ||
            !usage ||
            usage.remainingRefreshes <= 0
          }
          title={
            usage
              ? `Refresh ${displayedTimeframe}. ${usage.remainingRefreshes} of ${usage.limit} refreshes remain.`
              : `Refresh ${displayedTimeframe}`
          }
          aria-label={`Refresh ${displayedTimeframe} Currency Strength`}
          className="flex h-7 w-7 shrink-0 items-center justify-center bg-cyan-400 text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-600"
        >
          {isStartingRefresh ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {activeJob ? (
        <div
          className={
            isCurrentUsersJob
              ? "mt-2 border border-cyan-400/30 bg-cyan-400/10 p-2"
              : "mt-2 border border-yellow-400/30 bg-yellow-400/10 p-2"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-bold text-white">
              {activeJob.timeframe} · {activeProgress}/28 pairs
            </p>
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-300" />
          </div>
          <div className="mt-1.5 h-1 overflow-hidden bg-gray-900">
            <div
              className="h-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${(activeProgress / 28) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-2 border border-emerald-400/30 bg-emerald-400/10 px-2 py-1.5 text-[10px] text-emerald-200">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="mt-2 flex items-start gap-2 border border-red-400/30 bg-red-400/10 px-2 py-1.5 text-[10px] text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="mt-2 flex flex-1 flex-col">
        {isLoadingSnapshots ? (
          <div className="flex min-h-[170px] flex-1 items-center justify-center border border-gray-800 bg-black">
            <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" />
          </div>
        ) : !displayedSnapshot ? (
          <div className="flex min-h-[170px] flex-1 items-center justify-center border border-gray-800 bg-black p-4 text-center">
            <div>
              <BarChart3 className="mx-auto h-6 w-6 text-gray-700" />
              <p className="mt-2 font-mono text-xs font-bold text-white">
                No saved {displayedTimeframe} result
              </p>
              <p className="mt-1 text-[10px] text-gray-600">
                Use the refresh icon above.
              </p>
            </div>
          </div>
        ) : viewMode === "analog" ? (
          <div className="grid flex-1 grid-cols-4 gap-1.5 border border-gray-800 bg-black p-2">
            {sortedReadings.map((reading, index) => {
              const position = getReadingPosition(reading);

              return (
                <div
                  key={reading.currency}
                  className="min-w-0 border border-gray-800 bg-[#080808] p-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-mono text-[10px] font-black text-white">
                      {index + 1}. {reading.currency}
                    </span>
                    <span className="truncate font-mono text-[9px] font-bold text-yellow-300">
                      {formatReading(reading)}
                    </span>
                  </div>

                  <div className="relative mt-2 h-1.5 bg-gray-900">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-gray-700" />
                    <div
                      className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 bg-cyan-300"
                      style={{ left: `${position}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-4 gap-1.5 border border-gray-800 bg-black p-2">
            {sortedReadings.map((reading, index) => (
              <div
                key={reading.currency}
                className="min-w-0 border border-gray-800 bg-[#080808] p-2"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[9px] text-gray-600">
                    {index + 1}
                  </span>
                  <span className="truncate font-mono text-[11px] font-black text-white">
                    {reading.currency}
                  </span>
                  <span className="truncate text-right font-mono text-[9px] font-bold text-yellow-300">
                    {formatReading(reading)}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden bg-gray-900">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${getReadingPosition(reading)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[9px] text-gray-600">
        <span>
          {isLoadingStatus
            ? "Allowance loading…"
            : usage
              ? `${usage.remainingRefreshes}/${usage.limit} refreshes`
              : isSignedIn
                ? "Allowance unavailable"
                : "Sign in to refresh"}
        </span>
        {providerUsage ? (
          <span>
            {providerUsage.creditsRemaining}/{providerUsage.limit} credits
          </span>
        ) : null}
      </div>
    </section>
  );
}