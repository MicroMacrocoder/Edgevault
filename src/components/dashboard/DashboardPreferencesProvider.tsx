"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type DashboardWidgetId =
  | "cot"
  | "currency-strength"
  | "momentum-strength"
  | "performance"
  | "recent-mt5-trades"
  | "economic-calendar"
  | "journal-library"
  | "market-snapshot"
  | "market-intelligence";

export type DashboardWidgetVisibility = Record<DashboardWidgetId, boolean>;

export type DashboardTimeframe =
  | "M1"
  | "M5"
  | "M15"
  | "M30"
  | "H1"
  | "H4"
  | "D1"
  | "W1";

export type MomentumCurrency =
  | "DXY"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CHF"
  | "CAD"
  | "AUD"
  | "NZD";

export type DashboardPreferences = {
  version: 1;
  widgetVisibility: DashboardWidgetVisibility;
  overview: {
    selectedCotMarket: string;
    selectedTradeLogId: string;
    recentMt5AccountId: string;
    performanceDateRange: "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL";
    performanceChartMode: "percentage" | "balance";
  };
  currencyStrength: {
    timeframe: DashboardTimeframe;
    sort: "strongest" | "weakest";
    output: "percentage" | "raw";
    view: "analog" | "digital";
  };
  momentum: {
    currency: MomentumCurrency;
    timeframe: DashboardTimeframe;
  };
  tradeLog: {
    timezoneMode: "broker" | "device" | "utc" | "custom";
    customTimezone: string;
  };
};

export type DashboardPreferenceSection =
  | "widgetVisibility"
  | "overview"
  | "currencyStrength"
  | "momentum"
  | "tradeLog";

export type DashboardPreferenceSyncStatus =
  | "loading"
  | "synced"
  | "saving"
  | "local"
  | "error";

export const defaultDashboardPreferences: DashboardPreferences = {
  version: 1,
  widgetVisibility: {
    cot: true,
    "currency-strength": true,
    "momentum-strength": true,
    performance: true,
    "recent-mt5-trades": true,
    "economic-calendar": true,
    "market-snapshot": true,
    "market-intelligence": true,
    "journal-library": true,
  },
  overview: {
    selectedCotMarket: "DXY",
    selectedTradeLogId: "all",
    recentMt5AccountId: "all",
    performanceDateRange: "ALL",
    performanceChartMode: "percentage",
  },
  currencyStrength: {
    timeframe: "H1",
    sort: "strongest",
    output: "percentage",
    view: "analog",
  },
  momentum: {
    currency: "DXY",
    timeframe: "H1",
  },
  tradeLog: {
    timezoneMode: "broker",
    customTimezone: "UTC",
  },
};

type DashboardPreferencesContextValue = {
  preferences: DashboardPreferences;
  isReady: boolean;
  isSignedIn: boolean;
  syncStatus: DashboardPreferenceSyncStatus;
  syncError: string;
  updateSection: <Section extends DashboardPreferenceSection>(
    section: Section,
    value: DashboardPreferences[Section],
  ) => Promise<void>;
};

const DashboardPreferencesContext =
  createContext<DashboardPreferencesContextValue | null>(null);

const dashboardTimeframes: DashboardTimeframe[] = [
  "M1",
  "M5",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
  "W1",
];

const momentumCurrencies: MomentumCurrency[] = [
  "DXY",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
];

const performanceDateRanges = ["1D", "1W", "1M", "3M", "6M", "YTD", "ALL"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function cloneDefaultPreferences(): DashboardPreferences {
  return {
    ...defaultDashboardPreferences,
    widgetVisibility: {
      ...defaultDashboardPreferences.widgetVisibility,
    },
    overview: { ...defaultDashboardPreferences.overview },
    currencyStrength: { ...defaultDashboardPreferences.currencyStrength },
    momentum: { ...defaultDashboardPreferences.momentum },
    tradeLog: { ...defaultDashboardPreferences.tradeLog },
  };
}

function normalizeDashboardPreferences(value: unknown): DashboardPreferences {
  const normalized = cloneDefaultPreferences();

  if (!isRecord(value)) {
    return normalized;
  }

  const widgetVisibility = isRecord(value.widgetVisibility)
    ? value.widgetVisibility
    : null;

  if (widgetVisibility) {
    for (const widgetId of Object.keys(
      normalized.widgetVisibility,
    ) as DashboardWidgetId[]) {
      if (typeof widgetVisibility[widgetId] === "boolean") {
        normalized.widgetVisibility[widgetId] = Boolean(
          widgetVisibility[widgetId],
        );
      }
    }
  }

  const overview = isRecord(value.overview) ? value.overview : null;

  if (overview) {
    const selectedCotMarket = readString(overview.selectedCotMarket);
    const selectedTradeLogId = readString(overview.selectedTradeLogId);
    const recentMt5AccountId = readString(overview.recentMt5AccountId);
    const performanceDateRange = readString(overview.performanceDateRange);
    const performanceChartMode = readString(overview.performanceChartMode);

    if (selectedCotMarket) {
      normalized.overview.selectedCotMarket = selectedCotMarket;
    }

    if (selectedTradeLogId) {
      normalized.overview.selectedTradeLogId = selectedTradeLogId;
    }

    if (recentMt5AccountId) {
      normalized.overview.recentMt5AccountId = recentMt5AccountId;
    }

    if (
      performanceDateRange &&
      performanceDateRanges.includes(performanceDateRange)
    ) {
      normalized.overview.performanceDateRange =
        performanceDateRange as DashboardPreferences["overview"]["performanceDateRange"];
    }

    if (
      performanceChartMode === "percentage" ||
      performanceChartMode === "balance"
    ) {
      normalized.overview.performanceChartMode = performanceChartMode;
    }
  }

  const currencyStrength = isRecord(value.currencyStrength)
    ? value.currencyStrength
    : null;

  if (currencyStrength) {
    const timeframe = readString(currencyStrength.timeframe);
    const sort = readString(currencyStrength.sort);
    const output = readString(currencyStrength.output);
    const view = readString(currencyStrength.view);

    if (
      timeframe &&
      dashboardTimeframes.includes(timeframe as DashboardTimeframe)
    ) {
      normalized.currencyStrength.timeframe = timeframe as DashboardTimeframe;
    }

    if (sort === "strongest" || sort === "weakest") {
      normalized.currencyStrength.sort = sort;
    }

    if (output === "percentage" || output === "raw") {
      normalized.currencyStrength.output = output;
    }

    if (view === "analog" || view === "digital") {
      normalized.currencyStrength.view = view;
    }
  }

  const momentum = isRecord(value.momentum) ? value.momentum : null;

  if (momentum) {
    const currency = readString(momentum.currency);
    const timeframe = readString(momentum.timeframe);

    if (
      currency &&
      momentumCurrencies.includes(currency as MomentumCurrency)
    ) {
      normalized.momentum.currency = currency as MomentumCurrency;
    }

    if (
      timeframe &&
      dashboardTimeframes.includes(timeframe as DashboardTimeframe)
    ) {
      normalized.momentum.timeframe = timeframe as DashboardTimeframe;
    }
  }

  const tradeLog = isRecord(value.tradeLog) ? value.tradeLog : null;

  if (tradeLog) {
    const timezoneMode = readString(tradeLog.timezoneMode);
    const customTimezone = readString(tradeLog.customTimezone);
    if (
      timezoneMode === "broker" ||
      timezoneMode === "device" ||
      timezoneMode === "utc" ||
      timezoneMode === "custom"
    ) {
      normalized.tradeLog.timezoneMode = timezoneMode;
    }
    if (customTimezone) {
      try {
        new Intl.DateTimeFormat("en-US", {
          timeZone: customTimezone,
        }).format(new Date());
        normalized.tradeLog.customTimezone = customTimezone;
      } catch {
        normalized.tradeLog.customTimezone = "UTC";
      }
    }
  }

  return normalized;
}

function getCacheKey(owner: string) {
  return `edgevault_dashboard_preferences_cache_v1_${owner}`;
}

function readJson(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readLegacyPreferences(owner: string): DashboardPreferences {
  const preferences = cloneDefaultPreferences();

  const widgetVisibility = readJson(
    window.localStorage.getItem(`edgevault_dashboard_widgets_v1_${owner}`),
  );

  if (isRecord(widgetVisibility)) {
    preferences.widgetVisibility = normalizeDashboardPreferences({
      widgetVisibility,
    }).widgetVisibility;
  }

  const timeframe = window.localStorage.getItem(
    `edgevault_currency_strength_dashboard_timeframe_${owner}`,
  );
  const sort = window.localStorage.getItem(
    `edgevault_currency_strength_dashboard_sort_${owner}`,
  );
  const output = window.localStorage.getItem(
    `edgevault_currency_strength_dashboard_output_${owner}`,
  );
  const view = window.localStorage.getItem(
    `edgevault_currency_strength_dashboard_view_${owner}`,
  );

  preferences.currencyStrength = normalizeDashboardPreferences({
    currencyStrength: { timeframe, sort, output, view },
  }).currencyStrength;

  const momentum = readJson(
    window.localStorage.getItem("edgevault_momentum_dashboard_preferences_v3"),
  );

  if (isRecord(momentum)) {
    preferences.momentum = normalizeDashboardPreferences({ momentum }).momentum;
  }

  return preferences;
}

function readCachedPreferences(owner: string): DashboardPreferences {
  const cached = readJson(window.localStorage.getItem(getCacheKey(owner)));

  if (cached) {
    return normalizeDashboardPreferences(cached);
  }

  return readLegacyPreferences(owner);
}

function writeCachedPreferences(
  owner: string,
  preferences: DashboardPreferences,
) {
  try {
    window.localStorage.setItem(
      getCacheKey(owner),
      JSON.stringify(preferences),
    );
  } catch (error) {
    console.error("SAVE DASHBOARD PREFERENCE CACHE ERROR:", error);
  }
}

export default function DashboardPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState<DashboardPreferences>(() =>
    cloneDefaultPreferences(),
  );
  const [isReady, setIsReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [owner, setOwner] = useState("guest");
  const [syncStatus, setSyncStatus] =
    useState<DashboardPreferenceSyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      setSyncStatus("loading");
      setSyncError("");

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        const localPreferences = readCachedPreferences("guest");
        setPreferences(localPreferences);
        setOwner("guest");
        setIsSignedIn(false);
        setSyncStatus("error");
        setSyncError(sessionError.message);
        setIsReady(true);
        return;
      }

      const user = data.session?.user ?? null;
      const resolvedOwner = user?.id ?? "guest";
      const localPreferences = readCachedPreferences(resolvedOwner);

      setOwner(resolvedOwner);
      setIsSignedIn(Boolean(user));
      setPreferences(localPreferences);

      if (!user) {
        setSyncStatus("local");
        setIsReady(true);
        return;
      }

      const { data: storedRow, error: loadError } = await supabase
        .from("user_dashboard_preferences")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (loadError) {
        setSyncStatus("error");
        setSyncError(loadError.message);
        setIsReady(true);
        return;
      }

      if (storedRow?.preferences) {
        const serverPreferences = normalizeDashboardPreferences(
          storedRow.preferences,
        );

        setPreferences(serverPreferences);
        writeCachedPreferences(resolvedOwner, serverPreferences);
        setSyncStatus("synced");
        setIsReady(true);
        return;
      }

      const { error: seedError } = await supabase.rpc(
        "merge_user_dashboard_preferences",
        {
          preference_patch: localPreferences,
        },
      );

      if (!isMounted) {
        return;
      }

      if (seedError) {
        setSyncStatus("error");
        setSyncError(seedError.message);
      } else {
        writeCachedPreferences(resolvedOwner, localPreferences);
        setSyncStatus("synced");
      }

      setIsReady(true);
    }

    void loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateSection = useCallback(
    async <Section extends DashboardPreferenceSection>(
      section: Section,
      value: DashboardPreferences[Section],
    ) => {
      let nextPreferences: DashboardPreferences | null = null;

      setPreferences((current) => {
        nextPreferences = normalizeDashboardPreferences({
          ...current,
          [section]: value,
        });
        writeCachedPreferences(owner, nextPreferences);
        return nextPreferences;
      });

      if (!isSignedIn) {
        setSyncStatus("local");
        return;
      }

      setSyncStatus("saving");
      setSyncError("");

      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const { error } = await supabase.rpc(
            "merge_user_dashboard_preferences",
            {
              preference_patch: {
                version: 1,
                [section]: value,
              },
            },
          );

          if (error) {
            throw error;
          }
        })
        .then(() => {
          setSyncStatus("synced");
          setSyncError("");
        })
        .catch((error: unknown) => {
          console.error("SAVE DASHBOARD PREFERENCES ERROR:", error);
          setSyncStatus("error");
          setSyncError(
            error instanceof Error
              ? error.message
              : "Dashboard preferences could not sync.",
          );
        });

      await saveQueueRef.current;
    },
    [isSignedIn, owner],
  );

  const value = useMemo<DashboardPreferencesContextValue>(
    () => ({
      preferences,
      isReady,
      isSignedIn,
      syncStatus,
      syncError,
      updateSection,
    }),
    [
      preferences,
      isReady,
      isSignedIn,
      syncStatus,
      syncError,
      updateSection,
    ],
  );

  return (
    <DashboardPreferencesContext.Provider value={value}>
      {children}
    </DashboardPreferencesContext.Provider>
  );
}

export function useDashboardPreferences() {
  const context = useContext(DashboardPreferencesContext);

  if (!context) {
    throw new Error(
      "useDashboardPreferences must be used inside DashboardPreferencesProvider.",
    );
  }

  return context;
}
