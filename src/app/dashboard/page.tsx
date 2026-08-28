"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  supabase,
  getUserJournalEntries,
  getUserTradeLogTemplates,
} from "@/lib/supabase";
import {
  getCombinedPerformanceTradeLogs,
  type AutomaticMt5Account,
  type AutomaticMt5Trade,
} from "@/lib/mt5Performance";
import {
  calculatePerformanceMetrics,
  formatMoney,
  formatPercent,
  type PerformanceChartMode,
  type PerformanceDateRange,
  type TradeLogWithRows,
} from "@/lib/performanceMetrics";
import FundamentalsWorkspace from "@/components/dashboard/FundamentalsWorkspace";
import TechnicalsWorkspace, {
  type TechnicalsTab,
} from "@/components/dashboard/TechnicalsWorkspace";
import CurrencyStrengthDashboardWidget from "@/components/dashboard/CurrencyStrengthDashboardWidget";
import MomentumStrengthDashboardWidget from "@/components/dashboard/MomentumStrengthDashboardWidget";
import MarketSnapshotDashboardWidget from "@/components/dashboard/MarketSnapshotDashboardWidget";
import MarketIntelligenceDashboardWidget from "@/components/dashboard/MarketIntelligenceDashboardWidget";
import ReportsWorkspace, {
  type ReportsMarketIntelligenceSymbol,
  type ReportsWorkspaceView,
} from "@/components/dashboard/ReportsWorkspace";
import DashboardPreferencesProvider, {
  type DashboardWidgetId,
  type DashboardWidgetVisibility,
  useDashboardPreferences,
} from "@/components/dashboard/DashboardPreferencesProvider";
import CompactCycleSelect from "@/components/dashboard/CompactCycleSelect";
import RiskManagementWorkspaceEnhanced from "@/components/dashboard/RiskManagementWorkspaceEnhanced";
import ConnectPlatformWorkspace from "@/components/dashboard/ConnectPlatformWorkspace";
import NewEntryWorkspace from "@/components/dashboard/NewEntryWorkspace";
import JournalWorkspace from "@/components/dashboard/JournalWorkspace";
import PerformanceWorkspace from "@/components/dashboard/PerformanceWorkspace";
import EconomicCalendar from "@/components/fundamentals/EconomicCalendar";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BookOpen,
  Check,
  Calculator,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Grid2X2,
  Gauge,
  LineChartIcon,
  Lock,
  LogOut,
  Moon,
  PieChartIcon,
  PlusCircle,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Settings,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";

type DashboardSection =
  | "overview"
  | "journal"
  | "trade-log"
  | "new-entry"
  | "saved-trade-logs"
  | "fundamentals"
  | "technicals"
  | "risk-management"
  | "connect-platform"
  | "reports"
  | "performance"
  | "settings";

const performanceData = [
  { month: "Jan '24", return: -12 },
  { month: "Jan '24", return: -5 },
  { month: "Feb '24", return: 4 },
  { month: "Feb '24", return: 1 },
  { month: "Mar '24", return: 12 },
  { month: "Mar '24", return: 10 },
  { month: "Apr '24", return: 28 },
  { month: "Apr '24", return: 33 },
  { month: "May '24", return: 47 },
  { month: "May '24", return: 56.7 },
];

const equityData = [
  { date: "Jan", equity: 76000, volume: 18 },
  { date: "Feb", equity: 83000, volume: 22 },
  { date: "Mar", equity: 101000, volume: 32 },
  { date: "Apr", equity: 98000, volume: 26 },
  { date: "May", equity: 115450, volume: 39 },
];

const smallSparkData = [
  { value: 10 },
  { value: 13 },
  { value: 12 },
  { value: 18 },
  { value: 16 },
  { value: 25 },
  { value: 23 },
  { value: 31 },
];

const profitBars = [
  { value: 8 },
  { value: 12 },
  { value: 18 },
  { value: 15 },
  { value: 26 },
  { value: 22 },
  { value: 31 },
  { value: 19 },
  { value: 40 },
  { value: 28 },
];

const tradePerformanceData = [
  { name: "Win", value: 193 },
  { name: "Loss", value: 55 },
];

const sidebarItems = [
  {
    label: "Dashboard",
    section: "overview" as DashboardSection,
    icon: Grid2X2,
  },
  { label: "Journal", section: "journal" as DashboardSection, icon: BookOpen },
  {
    label: "Fundamentals",
    section: "fundamentals" as DashboardSection,
    icon: BarChart3,
  },
  {
    label: "Technicals",
    section: "technicals" as DashboardSection,
    icon: Gauge,
  },
  {
    label: "Risk Management",
    section: "risk-management" as DashboardSection,
    icon: ShieldCheck,
  },
  {
    label: "Connect Platform",
    section: "connect-platform" as DashboardSection,
    icon: RadioTower,
  },
  { label: "Reports", section: "reports" as DashboardSection, icon: FileText },
  {
    label: "Performance",
    section: "performance" as DashboardSection,
    icon: LineChartIcon,
  },
  {
    label: "Settings",
    section: "settings" as DashboardSection,
    icon: Settings,
  },
];

const sectionDetails: Record<
  DashboardSection,
  {
    title: string;
    subtitle: string;
    description: string;
    actions: string[];
  }
> = {
  overview: {
    title: "Performance Overview",
    subtitle: "Your trading command center.",
    description: "Monitor account performance, recent trades, and key metrics.",
    actions: [],
  },
  journal: {
    title: "Journal",
    subtitle: "Review your trading thoughts and lessons.",
    description:
      "This area displays the Journal Hub with New Entry, Review Journal Entries, and Trade Log.",
    actions: ["New Entry", "Review Journal Entries", "Trade Log"],
  },
  "trade-log": {
    title: "Trade Log",
    subtitle: "Track your executed trades.",
    description:
      "This area will display your trade log without leaving the dashboard.",
    actions: ["View trades", "Filter pairs", "Export log"],
  },
  "new-entry": {
    title: "New Entry",
    subtitle: "Create a new trading record.",
    description:
      "This area shows the new trade entry workspace inside the dashboard.",
    actions: ["Add setup", "Upload chart", "Save trade"],
  },
  "saved-trade-logs": {
    title: "Saved Trade Logs",
    subtitle: "Access saved logs and grouped reports.",
    description:
      "This area will display saved trade logs and archived trading reviews.",
    actions: ["Open saved logs", "Compare reports", "Download data"],
  },
  fundamentals: {
    title: "Fundamentals",
    subtitle: "Macro, COT, Volume/OI and calendar tools.",
    description:
      "This area contains the fundamentals workspace, including COT, Volume/OI, and economic calendar modules.",
    actions: ["COT reports", "Volume/OI", "Economic calendar"],
  },
  technicals: {
    title: "Technicals",
    subtitle: "Currency strength and momentum tools.",
    description:
      "This area contains the technical-analysis workspace, including Currency Strength and Currency Momentum meters.",
    actions: ["Currency strength", "Currency momentum"],
  },
  "risk-management": {
    title: "Risk Management",
    subtitle: "Control position sizing and exposure.",
    description:
      "This area contains position sizing, risk rules, and account protection tools.",
    actions: ["Position size", "Risk calculator", "Drawdown control"],
  },
  "connect-platform": {
    title: "Connect Platform",
    subtitle: "Link your broker or MT5 workspace.",
    description:
      "This area contains connection tools for importing trades and platform data.",
    actions: ["Connect MT5", "Import data", "Sync account"],
  },
  reports: {
    title: "Reports",
    subtitle: "Generate trading reports.",
    description:
      "This area will display monthly, quarterly, and custom report exports.",
    actions: ["Monthly report", "CSV export", "Performance review"],
  },
  performance: {
    title: "Performance",
    subtitle: "Real trade log metrics and account performance.",
    description:
      "This area displays performance metrics calculated from your selected trade log or your general overview.",
    actions: ["Trade log metrics", "Equity curve", "Win rate"],
  },
  settings: {
    title: "Settings",
    subtitle: "Manage your account and preferences.",
    description:
      "This area will contain profile settings, app preferences, and platform controls.",
    actions: ["Profile", "Security", "Preferences"],
  },
};

function DashboardCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "border border-gray-800 bg-[#111111] shadow-[0_0_35px_rgba(250,204,21,0.04)] " +
        className
      }
    >
      {children}
    </div>
  );
}

function MiniMetricCard({
  icon,
  title,
  value,
  subtitle,
  chartType,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  subtitle: string;
  chartType: "spark" | "ring" | "bars";
}) {
  return (
    <DashboardCard className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-400/10 text-yellow-400">
            {icon}
          </div>

          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              {title}
            </p>
            <p className="mt-1 font-mono text-3xl font-bold text-white">
              {value}
            </p>
            <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
          </div>
        </div>

        <div className="h-16 w-28">
          {chartType === "spark" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={smallSparkData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#facc15"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : null}

          {chartType === "ring" ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-cyan-400 font-mono text-sm font-bold text-white">
                78%
              </div>
            </div>
          ) : null}

          {chartType === "bars" ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitBars}>
                <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>
    </DashboardCard>
  );
}

function getGuestTradeLogsWithRows(): TradeLogWithRows[] {
  if (typeof window === "undefined") {
    return [];
  }

  const guestLogs = JSON.parse(localStorage.getItem("guestTradeLogs") || "[]");

  return (guestLogs || []).map((log: any) => {
    const rows = JSON.parse(localStorage.getItem(`rows-${log.id}`) || "[]");

    return {
      id: String(log.id),
      logName: log.logName || "Untitled Trade Log",
      headers: Array.isArray(log.headers) ? log.headers : [],
      initialBalance: Number(log.initialBalance || 0),
      accountCurrency: log.accountCurrency || "USD",
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
      rows: rows || [],
    };
  });
}

const overviewDateRanges: PerformanceDateRange[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "YTD",
  "ALL",
];

const cotMarkets = [
  "DXY",
  "EUR",
  "GBP",
  "AUD",
  "JPY",
  "CAD",
  "CHF",
  "NZD",
  "GOLD",
];

type CotPreviewPoint = {
  week: string;
  commercials: number;
  largeSpecs: number;
  netPosition: number;
};

const cotPreviewData: Record<string, CotPreviewPoint[]> = {
  DXY: [
    { week: "W1", commercials: 18, largeSpecs: -12, netPosition: 30 },
    { week: "W2", commercials: 22, largeSpecs: -14, netPosition: 36 },
    { week: "W3", commercials: 19, largeSpecs: -10, netPosition: 29 },
    { week: "W4", commercials: 25, largeSpecs: -18, netPosition: 43 },
    { week: "W5", commercials: 28, largeSpecs: -20, netPosition: 48 },
    { week: "W6", commercials: 31, largeSpecs: -24, netPosition: 55 },
    { week: "W7", commercials: 26, largeSpecs: -19, netPosition: 45 },
    { week: "W8", commercials: 34, largeSpecs: -27, netPosition: 61 },
    { week: "W9", commercials: 38, largeSpecs: -29, netPosition: 67 },
    { week: "W10", commercials: 35, largeSpecs: -25, netPosition: 60 },
    { week: "W11", commercials: 41, largeSpecs: -33, netPosition: 74 },
    { week: "W12", commercials: 44, largeSpecs: -36, netPosition: 80 },
  ],
  EUR: [
    { week: "W1", commercials: -42, largeSpecs: 31, netPosition: -73 },
    { week: "W2", commercials: -39, largeSpecs: 34, netPosition: -73 },
    { week: "W3", commercials: -36, largeSpecs: 39, netPosition: -75 },
    { week: "W4", commercials: -32, largeSpecs: 42, netPosition: -74 },
    { week: "W5", commercials: -28, largeSpecs: 47, netPosition: -75 },
    { week: "W6", commercials: -25, largeSpecs: 52, netPosition: -77 },
    { week: "W7", commercials: -20, largeSpecs: 55, netPosition: -75 },
    { week: "W8", commercials: -18, largeSpecs: 59, netPosition: -77 },
    { week: "W9", commercials: -14, largeSpecs: 63, netPosition: -77 },
    { week: "W10", commercials: -17, largeSpecs: 58, netPosition: -75 },
    { week: "W11", commercials: -11, largeSpecs: 66, netPosition: -77 },
    { week: "W12", commercials: -8, largeSpecs: 69, netPosition: -77 },
  ],
  GBP: [
    { week: "W1", commercials: -26, largeSpecs: 18, netPosition: -44 },
    { week: "W2", commercials: -31, largeSpecs: 22, netPosition: -53 },
    { week: "W3", commercials: -29, largeSpecs: 26, netPosition: -55 },
    { week: "W4", commercials: -24, largeSpecs: 29, netPosition: -53 },
    { week: "W5", commercials: -21, largeSpecs: 32, netPosition: -53 },
    { week: "W6", commercials: -17, largeSpecs: 35, netPosition: -52 },
    { week: "W7", commercials: -20, largeSpecs: 31, netPosition: -51 },
    { week: "W8", commercials: -15, largeSpecs: 38, netPosition: -53 },
    { week: "W9", commercials: -12, largeSpecs: 41, netPosition: -53 },
    { week: "W10", commercials: -10, largeSpecs: 43, netPosition: -53 },
    { week: "W11", commercials: -8, largeSpecs: 45, netPosition: -53 },
    { week: "W12", commercials: -6, largeSpecs: 48, netPosition: -54 },
  ],
  AUD: [
    { week: "W1", commercials: 12, largeSpecs: -18, netPosition: 30 },
    { week: "W2", commercials: 15, largeSpecs: -20, netPosition: 35 },
    { week: "W3", commercials: 13, largeSpecs: -17, netPosition: 30 },
    { week: "W4", commercials: 19, largeSpecs: -24, netPosition: 43 },
    { week: "W5", commercials: 21, largeSpecs: -27, netPosition: 48 },
    { week: "W6", commercials: 17, largeSpecs: -22, netPosition: 39 },
    { week: "W7", commercials: 24, largeSpecs: -30, netPosition: 54 },
    { week: "W8", commercials: 27, largeSpecs: -32, netPosition: 59 },
    { week: "W9", commercials: 25, largeSpecs: -29, netPosition: 54 },
    { week: "W10", commercials: 29, largeSpecs: -34, netPosition: 63 },
    { week: "W11", commercials: 31, largeSpecs: -36, netPosition: 67 },
    { week: "W12", commercials: 28, largeSpecs: -33, netPosition: 61 },
  ],
  JPY: [
    { week: "W1", commercials: 36, largeSpecs: -42, netPosition: 78 },
    { week: "W2", commercials: 39, largeSpecs: -45, netPosition: 84 },
    { week: "W3", commercials: 33, largeSpecs: -39, netPosition: 72 },
    { week: "W4", commercials: 41, largeSpecs: -48, netPosition: 89 },
    { week: "W5", commercials: 44, largeSpecs: -51, netPosition: 95 },
    { week: "W6", commercials: 48, largeSpecs: -54, netPosition: 102 },
    { week: "W7", commercials: 43, largeSpecs: -49, netPosition: 92 },
    { week: "W8", commercials: 51, largeSpecs: -58, netPosition: 109 },
    { week: "W9", commercials: 55, largeSpecs: -61, netPosition: 116 },
    { week: "W10", commercials: 52, largeSpecs: -59, netPosition: 111 },
    { week: "W11", commercials: 57, largeSpecs: -64, netPosition: 121 },
    { week: "W12", commercials: 60, largeSpecs: -66, netPosition: 126 },
  ],
  CAD: [
    { week: "W1", commercials: 5, largeSpecs: -8, netPosition: 13 },
    { week: "W2", commercials: 8, largeSpecs: -12, netPosition: 20 },
    { week: "W3", commercials: 11, largeSpecs: -15, netPosition: 26 },
    { week: "W4", commercials: 9, largeSpecs: -11, netPosition: 20 },
    { week: "W5", commercials: 14, largeSpecs: -18, netPosition: 32 },
    { week: "W6", commercials: 17, largeSpecs: -22, netPosition: 39 },
    { week: "W7", commercials: 12, largeSpecs: -15, netPosition: 27 },
    { week: "W8", commercials: 19, largeSpecs: -25, netPosition: 44 },
    { week: "W9", commercials: 21, largeSpecs: -28, netPosition: 49 },
    { week: "W10", commercials: 18, largeSpecs: -24, netPosition: 42 },
    { week: "W11", commercials: 23, largeSpecs: -30, netPosition: 53 },
    { week: "W12", commercials: 26, largeSpecs: -33, netPosition: 59 },
  ],
  CHF: [
    { week: "W1", commercials: 16, largeSpecs: -11, netPosition: 27 },
    { week: "W2", commercials: 18, largeSpecs: -14, netPosition: 32 },
    { week: "W3", commercials: 13, largeSpecs: -9, netPosition: 22 },
    { week: "W4", commercials: 20, largeSpecs: -17, netPosition: 37 },
    { week: "W5", commercials: 23, largeSpecs: -19, netPosition: 42 },
    { week: "W6", commercials: 21, largeSpecs: -16, netPosition: 37 },
    { week: "W7", commercials: 25, largeSpecs: -21, netPosition: 46 },
    { week: "W8", commercials: 28, largeSpecs: -25, netPosition: 53 },
    { week: "W9", commercials: 24, largeSpecs: -20, netPosition: 44 },
    { week: "W10", commercials: 30, largeSpecs: -27, netPosition: 57 },
    { week: "W11", commercials: 33, largeSpecs: -29, netPosition: 62 },
    { week: "W12", commercials: 31, largeSpecs: -26, netPosition: 57 },
  ],
  NZD: [
    { week: "W1", commercials: -8, largeSpecs: 4, netPosition: -12 },
    { week: "W2", commercials: -11, largeSpecs: 6, netPosition: -17 },
    { week: "W3", commercials: -13, largeSpecs: 9, netPosition: -22 },
    { week: "W4", commercials: -9, largeSpecs: 8, netPosition: -17 },
    { week: "W5", commercials: -15, largeSpecs: 11, netPosition: -26 },
    { week: "W6", commercials: -18, largeSpecs: 13, netPosition: -31 },
    { week: "W7", commercials: -14, largeSpecs: 10, netPosition: -24 },
    { week: "W8", commercials: -20, largeSpecs: 15, netPosition: -35 },
    { week: "W9", commercials: -22, largeSpecs: 18, netPosition: -40 },
    { week: "W10", commercials: -19, largeSpecs: 14, netPosition: -33 },
    { week: "W11", commercials: -24, largeSpecs: 20, netPosition: -44 },
    { week: "W12", commercials: -27, largeSpecs: 23, netPosition: -50 },
  ],
  GOLD: [
    { week: "W1", commercials: -58, largeSpecs: 44, netPosition: -102 },
    { week: "W2", commercials: -54, largeSpecs: 48, netPosition: -102 },
    { week: "W3", commercials: -50, largeSpecs: 52, netPosition: -102 },
    { week: "W4", commercials: -47, largeSpecs: 56, netPosition: -103 },
    { week: "W5", commercials: -44, largeSpecs: 60, netPosition: -104 },
    { week: "W6", commercials: -41, largeSpecs: 64, netPosition: -105 },
    { week: "W7", commercials: -39, largeSpecs: 67, netPosition: -106 },
    { week: "W8", commercials: -35, largeSpecs: 70, netPosition: -105 },
    { week: "W9", commercials: -31, largeSpecs: 75, netPosition: -106 },
    { week: "W10", commercials: -34, largeSpecs: 71, netPosition: -105 },
    { week: "W11", commercials: -29, largeSpecs: 79, netPosition: -108 },
    { week: "W12", commercials: -25, largeSpecs: 84, netPosition: -109 },
  ],
};


function DashboardWidgetHeader({
  title,
  label,
  onOpen,
}: {
  title: string;
  label: string;
  onOpen?: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-yellow-400">
          {label}
        </p>
        <h2 className="mt-1 font-mono text-lg font-bold text-white">{title}</h2>
      </div>

      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="border border-gray-800 px-3 py-2 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          Open
        </button>
      ) : null}
    </div>
  );
}


type FundamentalsTab = "hub" | "calendar" | "cot" | "volume-oi";

type DashboardCOTReport = {
  id?: string;
  report_date: string;
  commercial_net: number;
  noncommercial_net: number;
  nonreportable_net: number;
  open_interest: number;
};

type DashboardCOTChartPoint = {
  reportDate: string;
  formattedDate: string;
  commercial_net: number;
  noncommercial_net: number;
  nonreportable_net: number;
  open_interest: number;
};


type DashboardJournalPreview = {
  id: string;
  title: string;
  instrument: string;
  createdAt: string;
};

type DashboardTradeLogPreview = {
  id: string;
  logName: string;
  initialBalance: number;
  accountCurrency: string;
  createdAt: string;
};

type DashboardRecentMt5Trade = {
  id: string;
  accountId: string;
  accountName: string;
  accountCurrency: string;
  symbol: string;
  direction: string;
  status: string;
  exitTime: string;
  profitLoss: number;
};

const dashboardCOTMarkets = [
  { label: "U.S. Dollar Index", symbol: "DXY" },
  { label: "Euro FX", symbol: "EUR" },
  { label: "British Pound", symbol: "GBP" },
  { label: "Australian Dollar", symbol: "AUD" },
  { label: "Japanese Yen", symbol: "JPY" },
  { label: "Canadian Dollar", symbol: "CAD" },
  { label: "Swiss Franc", symbol: "CHF" },
  { label: "New Zealand Dollar", symbol: "NZD" },
];

function formatDashboardNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDashboardDate(dateValue?: string | null) {
  if (!dateValue) {
    return "No date";
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "No date";
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function formatDashboardTradeDate(dateValue?: string | null) {
  if (!dateValue) return "—";
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return "—";
  return parsedDate.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}


const dashboardWidgetOptions: {
  id: DashboardWidgetId;
  label: string;
  description: string;
}[] = [
  {
    id: "cot",
    label: "COT Chart",
    description: "Full-width Commitment of Traders chart.",
  },
  {
    id: "market-intelligence",
    label: "Market Intelligence",
    description: "Saved fundamental market context and report summary.",
  },
  {
    id: "currency-strength",
    label: "Currency Strength",
    description: "Compact strength readings and refresh controls.",
  },
  {
    id: "momentum-strength",
    label: "Momentum Strength",
    description: "DXY-first momentum tracker and future currency templates.",
  },
  {
    id: "performance",
    label: "Performance Chart",
    description: "Full-width equity and return chart.",
  },
  {
    id: "recent-mt5-trades",
    label: "Recent MT5 Trades",
    description: "Latest five automatic trades with an MT5 account filter.",
  },
  {
    id: "economic-calendar",
    label: "Economic Calendar",
    description: "Upcoming economic events and releases.",
  },
  {
    id: "market-snapshot",
    label: "Market Snapshot",
    description: "Current DXY and major USD-pair prices.",
  },
  {
    id: "saved-trade-logs",
    label: "Saved Trade Logs",
    description: "Recent trade-log templates.",
  },
  {
    id: "journal-library",
    label: "Journal Entries",
    description: "Recent analysis and journal entries.",
  },
];

function OverviewSection({
  onSelectSection,
  onOpenFundamentalsTab,
  onOpenTechnicalsTab,
  onOpenMarketIntelligence,
}: {
  onSelectSection: (section: DashboardSection) => void;
  onOpenFundamentalsTab: (tab: FundamentalsTab) => void;
  onOpenTechnicalsTab: (tab: TechnicalsTab) => void;
  onOpenMarketIntelligence: (symbol: ReportsMarketIntelligenceSymbol) => void;
}) {
  const {
    preferences,
    isReady: arePreferencesReady,
    isSignedIn: arePreferencesSignedIn,
    syncStatus: preferenceSyncStatus,
    syncError: preferenceSyncError,
    updateSection: updatePreferenceSection,
  } = useDashboardPreferences();

  const visibleWidgets = preferences.widgetVisibility;
  const selectedTradeLogId = preferences.overview.selectedTradeLogId;
  const selectedRecentMt5AccountId =
    preferences.overview.recentMt5AccountId;
  const dateRange = preferences.overview.performanceDateRange;
  const chartMode = preferences.overview.performanceChartMode;
  const selectedCotMarket = preferences.overview.selectedCotMarket;

  const [tradeLogs, setTradeLogs] = useState<TradeLogWithRows[]>([]);
  const [recentMt5Accounts, setRecentMt5Accounts] = useState<
    AutomaticMt5Account[]
  >([]);
  const [recentMt5TradeRows, setRecentMt5TradeRows] = useState<
    AutomaticMt5Trade[]
  >([]);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);
  const [performanceMessage, setPerformanceMessage] = useState("");

  const [cotChartRows, setCotChartRows] = useState<DashboardCOTChartPoint[]>([]);
  const [isLoadingCot, setIsLoadingCot] = useState(true);
  const [cotMessage, setCotMessage] = useState("");

  const [journalPreview, setJournalPreview] =
    useState<DashboardJournalPreview[]>([]);
  const [tradeLogPreview, setTradeLogPreview] =
    useState<DashboardTradeLogPreview[]>([]);

  const [draftVisibleWidgets, setDraftVisibleWidgets] =
    useState<DashboardWidgetVisibility>({
      ...preferences.widgetVisibility,
    });
  const [isEditingDashboard, setIsEditingDashboard] = useState(false);

  async function loadDashboardPerformance() {
    setIsLoadingPerformance(true);
    setPerformanceMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session ?? null;
      const user = session?.user ?? null;

      if (user && session?.access_token) {
        const result = await getCombinedPerformanceTradeLogs({
          userId: user.id,
          accessToken: session.access_token,
        });

        setTradeLogs(result.tradeLogs);
        setRecentMt5Accounts(result.automaticAccounts);
        setRecentMt5TradeRows(result.automaticTrades);
        setPerformanceMessage(result.warnings.join(" "));
        setIsLoadingPerformance(false);
        return;
      }

      setTradeLogs(getGuestTradeLogsWithRows());
      setRecentMt5Accounts([]);
      setRecentMt5TradeRows([]);
      setIsLoadingPerformance(false);
    } catch (error) {
      console.log("LOAD DASHBOARD PERFORMANCE ERROR:", error);
      setTradeLogs([]);
      setRecentMt5Accounts([]);
      setRecentMt5TradeRows([]);
      setPerformanceMessage(
        "Something went wrong while loading dashboard data.",
      );
      setIsLoadingPerformance(false);
    }
  }

  async function loadDashboardCot() {
    setIsLoadingCot(true);
    setCotMessage("");

    try {
      const response = await fetch("/api/cot?symbol=" + selectedCotMarket, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || result?.error) {
        throw new Error(result?.message || "Could not load COT data.");
      }

      const reports = Array.isArray(result?.reports) ? result.reports : [];

      const rows = reports
        .map((report: DashboardCOTReport) => ({
          reportDate: report.report_date,
          formattedDate: formatDashboardDate(report.report_date),
          commercial_net: Number(report.commercial_net || 0),
          noncommercial_net: Number(report.noncommercial_net || 0),
          nonreportable_net: Number(report.nonreportable_net || 0),
          open_interest: Number(report.open_interest || 0),
        }))
        .sort((a: DashboardCOTChartPoint, b: DashboardCOTChartPoint) =>
          a.reportDate.localeCompare(b.reportDate),
        )
        .slice(-8);

      setCotChartRows(rows);
    } catch (error) {
      console.log("LOAD DASHBOARD COT ERROR:", error);
      setCotChartRows([]);
      setCotMessage("Could not load the latest COT preview.");
    } finally {
      setIsLoadingCot(false);
    }
  }

  async function loadDashboardJournalWidgets() {
    try {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      if (user) {
        const { entries } = await getUserJournalEntries(user.id);
        const { templates } = await getUserTradeLogTemplates(user.id);

        setJournalPreview(
          (entries || []).slice(0, 3).map((entry: any) => ({
            id: String(entry.id),
            title: entry.entryTitle || "Untitled Analysis",
            instrument: entry.instrument || "No instrument",
            createdAt: entry.createdAt || entry.entryDate || "",
          })),
        );

        setTradeLogPreview(
          (templates || []).slice(0, 3).map((template: any) => ({
            id: String(template.id),
            logName: template.logName || "Untitled Trade Log",
            initialBalance: Number(template.initialBalance || 0),
            accountCurrency: template.accountCurrency || "USD",
            createdAt: template.createdAt || "",
          })),
        );

        return;
      }

      const guestEntries = JSON.parse(
        localStorage.getItem("journalEntries") || "[]",
      );
      const guestLogs = JSON.parse(
        localStorage.getItem("guestTradeLogs") || "[]",
      );

      setJournalPreview(
        (guestEntries || []).slice(0, 3).map((entry: any) => ({
          id: String(entry.id),
          title: entry.entryTitle || "Untitled Analysis",
          instrument: entry.instrument || "No instrument",
          createdAt: entry.createdAt || entry.entryDate || "",
        })),
      );

      setTradeLogPreview(
        (guestLogs || []).slice(0, 3).map((log: any) => ({
          id: String(log.id),
          logName: log.logName || "Untitled Trade Log",
          initialBalance: Number(log.initialBalance || 0),
          accountCurrency: log.accountCurrency || "USD",
          createdAt: log.createdAt || "",
        })),
      );
    } catch (error) {
      console.log("LOAD DASHBOARD JOURNAL WIDGETS ERROR:", error);
      setJournalPreview([]);
      setTradeLogPreview([]);
    }
  }

  useEffect(() => {
    void loadDashboardPerformance();
    void loadDashboardJournalWidgets();

    const performanceInterval = window.setInterval(() => {
      void loadDashboardPerformance();
    }, 30_000);

    return () => window.clearInterval(performanceInterval);
  }, []);

  useEffect(() => {
    if (!arePreferencesReady) {
      return;
    }

    void loadDashboardCot();
  }, [arePreferencesReady, selectedCotMarket]);

  const metrics = useMemo(
    () =>
      calculatePerformanceMetrics({
        tradeLogs,
        selectedTradeLogId,
        dateRange,
      }),
    [tradeLogs, selectedTradeLogId, dateRange],
  );

  const effectiveRecentMt5AccountId = useMemo(
    () =>
      selectedRecentMt5AccountId === "all" ||
      recentMt5Accounts.some(
        (account) => account.id === selectedRecentMt5AccountId,
      )
        ? selectedRecentMt5AccountId
        : "all",
    [recentMt5Accounts, selectedRecentMt5AccountId],
  );

  const recentMt5Trades = useMemo<DashboardRecentMt5Trade[]>(() => {
    const accountMap = new Map(
      recentMt5Accounts.map((account) => [account.id, account]),
    );

    return recentMt5TradeRows
      .filter(
        (trade) =>
          effectiveRecentMt5AccountId === "all" ||
          trade.account_id === effectiveRecentMt5AccountId,
      )
      .map((trade) => {
        const account = accountMap.get(trade.account_id);
        return {
          id: trade.id,
          accountId: trade.account_id,
          accountName:
            account?.account_name ||
            account?.company ||
            `MT5 ${account?.login || "account"}`,
          accountCurrency: account?.currency || "USD",
          symbol: trade.symbol,
          direction: trade.direction,
          status: trade.status,
          exitTime:
            trade.status === "open"
              ? trade.entry_at_utc
              : trade.exit_at_utc || trade.updated_at || trade.entry_at_utc,
          profitLoss: Number(trade.net_profit || 0),
        };
      })
      .sort(
        (left, right) =>
          new Date(right.exitTime).getTime() -
          new Date(left.exitTime).getTime(),
      )
      .slice(0, 5);
  }, [effectiveRecentMt5AccountId, recentMt5Accounts, recentMt5TradeRows]);

  const performanceChartData = useMemo(() => {
    if (metrics.equityCurve.length > 0) {
      return metrics.equityCurve.map((point) => ({
        label: point.label,
        value: chartMode === "percentage" ? point.returnPercent : point.balance,
      }));
    }

    return [
      {
        label: "Start",
        value: chartMode === "percentage" ? 0 : metrics.initialBalance,
      },
      {
        label: "Now",
        value:
          chartMode === "percentage"
            ? metrics.totalReturnPercent
            : metrics.currentBalance,
      },
    ];
  }, [metrics, chartMode]);

  const chartValueText =
    chartMode === "percentage"
      ? formatPercent(metrics.totalReturnPercent)
      : formatMoney(metrics.currentBalance, metrics.accountCurrency);

  const chartSubText =
    chartMode === "percentage"
      ? `${formatMoney(metrics.netProfit, metrics.accountCurrency)} net result`
      : `${formatPercent(metrics.totalReturnPercent)} total return`;

  const selectedMarketLabel =
    dashboardCOTMarkets.find((market) => market.symbol === selectedCotMarket)
      ?.label || selectedCotMarket;

  const visibleWidgetCount = Object.values(visibleWidgets).filter(Boolean).length;

  function openDashboardEditor() {
    setDraftVisibleWidgets({ ...visibleWidgets });
    setIsEditingDashboard(true);
  }

  function toggleDraftWidget(widgetId: DashboardWidgetId) {
    setDraftVisibleWidgets((current) => ({
      ...current,
      [widgetId]: !current[widgetId],
    }));
  }

  function updateOverviewPreferences(
    patch: Partial<typeof preferences.overview>,
  ) {
    void updatePreferenceSection("overview", {
      ...preferences.overview,
      ...patch,
    });
  }

  function saveDashboardPreferences() {
    void updatePreferenceSection("widgetVisibility", {
      ...draftVisibleWidgets,
    });
    setIsEditingDashboard(false);
  }

  function resetDashboardPreferences() {
    setDraftVisibleWidgets({
      cot: true,
      "currency-strength": true,
      "momentum-strength": true,
      performance: true,
      "recent-mt5-trades": true,
      "economic-calendar": true,
      "market-snapshot": true,
      "market-intelligence": true,
      "saved-trade-logs": true,
      "journal-library": true,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border border-gray-800 bg-[#111111] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Dashboard overview
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {visibleWidgetCount} of {dashboardWidgetOptions.length} widgets are visible.
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
            {!arePreferencesReady
              ? "Loading dashboard settings"
              : preferenceSyncStatus === "saving"
                ? "Saving to Supabase"
                : preferenceSyncStatus === "synced"
                  ? "Synced across devices"
                  : preferenceSyncStatus === "local"
                    ? "Saved on this device"
                    : `Sync issue${preferenceSyncError ? `: ${preferenceSyncError}` : ""}`}
          </p>
        </div>

        <button
          type="button"
          onClick={openDashboardEditor}
          className="inline-flex w-fit items-center gap-2 border border-gray-800 px-3 py-2 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          <Settings2 className="h-4 w-4" />
          Edit dashboard
        </button>
      </div>

      {visibleWidgets["market-intelligence"] ? (
        <MarketIntelligenceDashboardWidget
          onOpen={onOpenMarketIntelligence}
        />
      ) : null}

      {visibleWidgets.cot ? (
        <DashboardCard className="p-5">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
                COT
              </p>
              <h1 className="mt-1 font-mono text-lg font-bold text-white">
                {selectedMarketLabel}
              </h1>
              <p className="mt-1 text-xs text-gray-500">
                Full-width chart preview for clearer positioning context.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[220px_auto] sm:items-end">
              <CompactCycleSelect<string>
                label="Market"
                value={selectedCotMarket}
                options={dashboardCOTMarkets.map((market) => ({
                  value: market.symbol,
                  label: market.symbol,
                }))}
                onChange={(value) =>
                  updateOverviewPreferences({ selectedCotMarket: value })}
                accent="cyan"
              />

              <button
                type="button"
                onClick={() => onOpenFundamentalsTab("cot")}
                className="min-h-9 border border-gray-800 px-4 py-2 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                Open COT
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenFundamentalsTab("cot")}
            className="block w-full border border-gray-800 bg-black p-4 text-left transition hover:border-yellow-400/60"
          >
            <div className="h-[260px]">
              {isLoadingCot ? (
                <div className="flex h-full items-center justify-center font-mono text-sm text-gray-500">
                  Loading COT chart...
                </div>
              ) : cotMessage ? (
                <div className="flex h-full items-center justify-center font-mono text-sm text-red-400">
                  {cotMessage}
                </div>
              ) : cotChartRows.length === 0 ? (
                <div className="flex h-full items-center justify-center font-mono text-sm text-gray-500">
                  No COT data found.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cotChartRows}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="formattedDate"
                      stroke="#9ca3af"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) =>
                        formatDashboardNumber(Number(value))
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111111",
                        border: "1px solid #374151",
                        borderRadius: "0px",
                        color: "#e5e7eb",
                      }}
                      formatter={(value) =>
                        formatDashboardNumber(Number(value))
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="noncommercial_net"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="commercial_net"
                      stroke="#facc15"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="nonreportable_net"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </button>
        </DashboardCard>
      ) : null}

      {visibleWidgets["currency-strength"] ||
      visibleWidgets["momentum-strength"] ? (
        <div
          className={
            visibleWidgets["currency-strength"] &&
            visibleWidgets["momentum-strength"]
              ? "grid items-stretch gap-4 lg:grid-cols-2"
              : "grid items-stretch gap-4"
          }
        >
          {visibleWidgets["currency-strength"] ? (
            <CurrencyStrengthDashboardWidget
              onOpen={() => onOpenTechnicalsTab("currency-strength")}
            />
          ) : null}

          {visibleWidgets["momentum-strength"] ? (
            <MomentumStrengthDashboardWidget
              onOpen={() => onOpenTechnicalsTab("currency-momentum")}
            />
          ) : null}
        </div>
      ) : null}

      {visibleWidgets.performance ? (
        <DashboardCard className="p-5">
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-yellow-400">
                Performance
              </p>
              <h2 className="mt-1 font-mono text-lg font-bold text-white">
                Account Performance
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Full-width chart with compact account, period and display controls.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[650px]">
              <CompactCycleSelect<string>
                label="Trade log"
                value={selectedTradeLogId}
                options={[
                  { value: "all", label: "General Overview" },
                  ...tradeLogs.map((log) => ({
                    value: log.id,
                    label: log.logName || "Untitled Trade Log",
                  })),
                ]}
                onChange={(value) =>
                  updateOverviewPreferences({ selectedTradeLogId: value })}
                accent="yellow"
              />

              <CompactCycleSelect<PerformanceDateRange>
                label="Date range"
                value={dateRange}
                options={overviewDateRanges.map((range) => ({
                  value: range,
                  label: range,
                }))}
                onChange={(value) =>
                  updateOverviewPreferences({ performanceDateRange: value })}
                accent="cyan"
              />

              <CompactCycleSelect<PerformanceChartMode>
                label="Chart display"
                value={chartMode}
                options={[
                  { value: "percentage", label: "Percentage" },
                  { value: "balance", label: "Balance" },
                ]}
                onChange={(value) =>
                  updateOverviewPreferences({ performanceChartMode: value })}
                accent="yellow"
              />
            </div>
          </div>

          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-end gap-5">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-gray-500">
                  Total Return
                </p>
                <p
                  className={
                    metrics.totalReturnPercent >= 0
                      ? "mt-1 font-mono text-3xl font-black text-green-400"
                      : "mt-1 font-mono text-3xl font-black text-red-400"
                  }
                >
                  {isLoadingPerformance ? "..." : chartValueText}
                </p>
              </div>

              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-gray-500">
                  Net Profit
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-cyan-400">
                  {formatMoney(metrics.netProfit, metrics.accountCurrency)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadDashboardPerformance()}
                className="inline-flex items-center gap-2 border border-gray-800 px-3 py-2 font-mono text-xs font-bold text-gray-300 transition hover:border-cyan-400 hover:text-cyan-300"
              >
                <RefreshCw className="h-4 w-4" />
                Reload
              </button>
              <button
                type="button"
                onClick={() => onSelectSection("performance")}
                className="border border-gray-800 px-3 py-2 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                Open Performance
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectSection("performance")}
            className="block w-full border border-gray-800 bg-black p-4 text-left transition hover:border-yellow-400/60"
          >
            <div className="h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceChartData}>
                  <defs>
                    <linearGradient
                      id="dashboardPerformanceFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#facc15"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="#22d3ee"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    orientation="right"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111111",
                      border: "1px solid #374151",
                      borderRadius: "0px",
                      color: "#e5e7eb",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#facc15"
                    strokeWidth={3}
                    fill="url(#dashboardPerformanceFill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </button>

          {performanceMessage ? (
            <p className="mt-3 text-sm font-medium text-red-400">
              {performanceMessage}
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-500">{chartSubText}</p>
          )}
        </DashboardCard>
      ) : null}

      {visibleWidgets["recent-mt5-trades"] ? (
        <DashboardCard className="p-5">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
                Trade Log
              </p>
              <h2 className="mt-1 font-mono text-lg font-bold text-white">
                Recent MT5 Trades
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Your five most recent open or closed automatic trades.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[240px_auto] sm:items-end">
              <CompactCycleSelect<string>
                label="MT5 account"
                value={effectiveRecentMt5AccountId}
                options={[
                  { value: "all", label: "All MT5 accounts" },
                  ...recentMt5Accounts.map((account) => ({
                    value: account.id,
                    label:
                      account.account_name ||
                      account.company ||
                      `MT5 ${account.login}`,
                  })),
                ]}
                onChange={(value) =>
                  updateOverviewPreferences({ recentMt5AccountId: value })}
                accent="cyan"
              />

              <button
                type="button"
                onClick={() => onSelectSection("trade-log")}
                className="min-h-9 border border-gray-800 px-4 py-2 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                Open Trade Log
              </button>
            </div>
          </div>

          {isLoadingPerformance ? (
            <div className="border border-gray-800 bg-black p-8 text-center font-mono text-sm text-gray-500">
              Loading recent MT5 trades...
            </div>
          ) : recentMt5Trades.length === 0 ? (
            <div className="border border-gray-800 bg-black p-8 text-center text-sm text-gray-500">
              No MT5 trades found for this account.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-800 bg-black">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-[#080b14]">
                  <tr className="border-b border-gray-800 font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ext Date</th>
                    <th className="px-4 py-3 text-right">P/L($)</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMt5Trades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="cursor-pointer border-b border-gray-800/80 text-sm text-gray-300 transition last:border-b-0 hover:bg-cyan-400/5"
                      onClick={() => onSelectSection("trade-log")}
                    >
                      <td className="max-w-[220px] truncate px-4 py-3 text-xs text-gray-500">
                        {trade.accountName}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        {trade.symbol}
                      </td>
                      <td className={`px-4 py-3 font-mono font-bold capitalize ${trade.direction.toLowerCase() === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                        {trade.direction}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-400">
                        {trade.status}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                        {trade.status === "open"
                          ? "Open"
                          : formatDashboardTradeDate(trade.exitTime)}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-mono font-black ${trade.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatMoney(
                          trade.profitLoss,
                          trade.accountCurrency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>
      ) : null}

      {visibleWidgets["economic-calendar"] ||
      visibleWidgets["market-snapshot"] ? (
        <div
          className={
            visibleWidgets["economic-calendar"] &&
            visibleWidgets["market-snapshot"]
              ? "grid items-stretch gap-4 lg:grid-cols-2"
              : "grid items-stretch gap-4"
          }
        >
          {visibleWidgets["economic-calendar"] ? (
            <DashboardCard className="h-full p-5">
              <DashboardWidgetHeader
                label="Fundamentals"
                title="Today's Economic Calendar"
                onOpen={() => onOpenFundamentalsTab("calendar")}
              />
              <EconomicCalendar compact />
            </DashboardCard>
          ) : null}

          {visibleWidgets["market-snapshot"] ? (
            <MarketSnapshotDashboardWidget />
          ) : null}
        </div>
      ) : null}

      {visibleWidgets["saved-trade-logs"] ||
      visibleWidgets["journal-library"] ? (
        <div
          className={
            visibleWidgets["saved-trade-logs"] &&
            visibleWidgets["journal-library"]
              ? "grid items-start gap-4 lg:grid-cols-2"
              : "grid items-start gap-4"
          }
        >
          {visibleWidgets["saved-trade-logs"] ? (
            <DashboardCard className="p-5">
              <DashboardWidgetHeader
                label="Trade Log"
                title="Saved Trade Logs"
                onOpen={() => onSelectSection("journal")}
              />

              <div className="space-y-3">
                {tradeLogPreview.length === 0 ? (
                  <div className="border border-gray-800 bg-black p-5 text-sm text-gray-500">
                    No saved trade logs yet.
                  </div>
                ) : (
                  tradeLogPreview.slice(0, 4).map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => onSelectSection("journal")}
                      className="w-full border border-gray-800 bg-black p-3 text-left transition hover:border-yellow-400"
                    >
                      <p className="truncate font-mono text-sm font-bold text-white">
                        {log.logName}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Initial: {formatMoney(log.initialBalance, log.accountCurrency)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </DashboardCard>
          ) : null}

          {visibleWidgets["journal-library"] ? (
            <DashboardCard className="p-5">
              <DashboardWidgetHeader
                label="Journal"
                title="Recent Journal Entries"
                onOpen={() => onSelectSection("journal")}
              />

              <div className="space-y-3">
                {journalPreview.length === 0 ? (
                  <div className="border border-gray-800 bg-black p-5 text-sm text-gray-500">
                    No saved analysis yet.
                  </div>
                ) : (
                  journalPreview.slice(0, 4).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onSelectSection("journal")}
                      className="w-full border border-gray-800 bg-black p-3 text-left transition hover:border-yellow-400"
                    >
                      <p className="truncate font-mono text-sm font-bold text-white">
                        {entry.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {entry.instrument} • {formatDashboardDate(entry.createdAt)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </DashboardCard>
          ) : null}
        </div>
      ) : null}

      {visibleWidgetCount === 0 ? (
        <DashboardCard className="p-8 text-center">
          <EyeOff className="mx-auto h-8 w-8 text-gray-600" />
          <p className="mt-4 font-mono text-sm font-bold text-white">
            Your dashboard is empty
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Open Edit dashboard and select the widgets you want to see.
          </p>
        </DashboardCard>
      ) : null}

      {isEditingDashboard ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-gray-700 bg-[#111111] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-800 bg-[#111111] p-5">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400">
                  Dashboard settings
                </p>
                <h2 className="mt-1 font-mono text-xl font-black text-white">
                  Choose what you want to see
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  Hidden widgets stay available in their main EdgeVault workspaces.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingDashboard(false)}
                aria-label="Close dashboard settings"
                className="border border-gray-800 p-2 text-gray-400 transition hover:border-red-400 hover:text-red-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {dashboardWidgetOptions.map((widget) => {
                const isVisible = draftVisibleWidgets[widget.id];

                return (
                  <button
                    key={widget.id}
                    type="button"
                    onClick={() => toggleDraftWidget(widget.id)}
                    className={
                      isVisible
                        ? "flex items-start gap-3 border border-cyan-400/40 bg-cyan-400/10 p-4 text-left"
                        : "flex items-start gap-3 border border-gray-800 bg-black p-4 text-left transition hover:border-gray-700"
                    }
                  >
                    <span
                      className={
                        isVisible
                          ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-cyan-400 text-black"
                          : "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-gray-700 text-gray-500"
                      }
                    >
                      {isVisible ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </span>

                    <span>
                      <span className="block font-mono text-sm font-bold text-white">
                        {widget.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                        {widget.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-gray-800 bg-[#111111] p-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={resetDashboardPreferences}
                className="inline-flex items-center justify-center gap-2 border border-gray-800 px-4 py-3 font-mono text-xs font-bold text-gray-300 transition hover:border-gray-600 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Reset default
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditingDashboard(false)}
                  className="border border-gray-800 px-4 py-3 font-mono text-xs font-bold text-gray-400 transition hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDashboardPreferences}
                  className="inline-flex items-center gap-2 bg-yellow-400 px-5 py-3 font-mono text-xs font-black text-black transition hover:bg-yellow-300"
                >
                  <Eye className="h-4 w-4" />
                  Save dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkspacePlaceholder({
  selectedSection,
}: {
  selectedSection: DashboardSection;
}) {
  const details = sectionDetails[selectedSection];

  return (
    <div className="space-y-5">
      <DashboardCard className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.26em] text-cyan-400">
            EdgeVault Workspace
          </p>
          <h1 className="mt-3 font-mono text-3xl font-black tracking-tight text-white lg:text-5xl">
            {details.title}
          </h1>
          <p className="mt-3 text-lg font-medium text-gray-300">
            {details.subtitle}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-400">
            {details.description}
          </p>
        </div>
      </DashboardCard>

      <div className="grid gap-4 lg:grid-cols-3">
        {details.actions.map((action) => (
          <DashboardCard key={action} className="p-5">
            <div className="flex h-11 w-11 items-center justify-center bg-yellow-400 text-black">
              <ChevronRight className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-mono text-lg font-bold text-white">
              {action}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              This module will be connected to the real {details.title} feature
              in the next step.
            </p>
          </DashboardCard>
        ))}
      </div>

      <DashboardCard className="p-5">
        <h2 className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-white">
          Next Connection Step
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400">
          The sidebar switching is working inside the dashboard. The next
          upgrade is to bring the existing page content into this workspace so
          users do not leave the dashboard layout when they open this section.
        </p>
      </DashboardCard>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [selectedSection, setSelectedSection] =
    useState<DashboardSection>("overview");
  const [selectedFundamentalsTab, setSelectedFundamentalsTab] =
    useState<FundamentalsTab>("hub");
  const [selectedTechnicalsTab, setSelectedTechnicalsTab] =
    useState<TechnicalsTab>("hub");
  const [selectedReportsView, setSelectedReportsView] =
    useState<ReportsWorkspaceView>("hub");
  const [
    selectedReportsMarketIntelligenceSymbol,
    setSelectedReportsMarketIntelligenceSymbol,
  ] = useState<ReportsMarketIntelligenceSymbol>("EUR");

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkDashboardAccess() {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      if (!isMounted) {
        return;
      }

      if (!user) {
        router.replace("/");
        return;
      }

      setCurrentUserEmail(user.email || "");
      setIsCheckingSession(false);
    }

    checkDashboardAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      const user = session?.user ?? null;

      if (!user) {
        router.replace("/");
        return;
      }

      setCurrentUserEmail(user.email || "");
      setIsCheckingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  function handleOpenFundamentalsTab(tab: FundamentalsTab) {
    setSelectedFundamentalsTab(tab);
    setSelectedSection("fundamentals");
  }

  function handleOpenTechnicalsTab(tab: TechnicalsTab) {
    setSelectedTechnicalsTab(tab);
    setSelectedSection("technicals");
  }

  function handleOpenMarketIntelligence(
    symbol: ReportsMarketIntelligenceSymbol,
  ) {
    setSelectedReportsMarketIntelligenceSymbol(symbol);
    setSelectedReportsView("market-intelligence");
    setSelectedSection("reports");
  }

  function handleSidebarSectionSelect(section: DashboardSection) {
    if (section === "reports") {
      setSelectedReportsView("hub");
    }

    setSelectedSection(section);
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <img
            src="/edgevault-logo.png"
            alt="EdgeVault"
            className="mx-auto h-24 w-auto object-contain"
          />

          <p className="mt-6 font-mono text-sm uppercase tracking-[0.3em] text-yellow-400">
            Checking Dashboard Access
          </p>

          <p className="mt-3 text-sm text-gray-400">
            Please wait while EdgeVault prepares your workspace.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <DashboardPreferencesProvider>
      <div className="min-h-screen lg:flex">
        <aside className="hidden w-60 shrink-0 border-r border-gray-800 bg-black px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
          <Link href="/dashboard" className="mb-6 flex items-center px-0">
            <Image
              src="/edgevault-logo.png"
              alt="EdgeVault"
              width={360}
              height={160}
              className="h-20 w-full object-contain"
              priority
            />
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = selectedSection === item.section;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSidebarSectionSelect(item.section)}
                  className={
                    isActive
                      ? "flex w-full items-center gap-3 border border-yellow-400 bg-yellow-400 px-4 py-3 text-left font-mono text-sm font-bold text-black shadow-[0_0_25px_rgba(250,204,21,0.18)]"
                      : "flex w-full items-center gap-3 border border-transparent px-4 py-3 text-left font-mono text-sm font-medium text-gray-400 transition hover:border-gray-800 hover:bg-[#111111] hover:text-yellow-400"
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 border border-red-500/30 bg-red-500/10 px-4 py-3 text-left font-mono text-sm font-bold text-red-300 transition hover:bg-red-500/20 hover:text-red-200"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>

          <div className="mt-auto space-y-4 pt-8">
            <div className="border border-gray-800 bg-[#111111] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-yellow-400/40 bg-yellow-400/10 font-mono text-sm font-bold text-yellow-400">
                  EV
                </div>

                <div>
                  <p className="font-mono text-sm font-semibold text-white">
                    EdgeTrader
                  </p>
                  <p className="text-xs text-gray-400">
                    {currentUserEmail || "Signed in"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border border-gray-800 bg-[#111111] px-4 py-3">
              <div className="flex items-center gap-3 font-mono text-sm text-gray-300">
                <Moon className="h-4 w-4 text-cyan-400" />
                Dark Mode
              </div>

              <div className="h-6 w-11 rounded-full bg-gradient-to-r from-yellow-400 to-cyan-400 p-1">
                <div className="ml-auto h-4 w-4 rounded-full bg-black" />
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-x-hidden px-3 py-3 sm:px-4 lg:px-5 xl:px-6">
          <div className="mb-4 border border-gray-800 bg-[#0b0b0b] lg:hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <Link href="/dashboard" className="min-w-0">
                <Image
                  src="/edgevault-logo.png"
                  alt="EdgeVault"
                  width={220}
                  height={80}
                  className="h-12 w-auto max-w-[180px] object-contain"
                  priority
                />
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex shrink-0 items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs font-bold text-red-300 transition hover:bg-red-500/20"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>

            <nav className="flex gap-2 overflow-x-auto border-t border-gray-800 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = selectedSection === item.section;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSidebarSectionSelect(item.section)}
                    className={
                      isActive
                        ? "flex min-w-max items-center gap-2 border border-yellow-400 bg-yellow-400 px-3 py-2 font-mono text-xs font-bold text-black"
                        : "flex min-w-max items-center gap-2 border border-gray-800 bg-black px-3 py-2 font-mono text-xs font-medium text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="min-w-0">
            {selectedSection === "overview" ? (
              <OverviewSection
                onSelectSection={setSelectedSection}
                onOpenFundamentalsTab={handleOpenFundamentalsTab}
                onOpenTechnicalsTab={handleOpenTechnicalsTab}
                onOpenMarketIntelligence={handleOpenMarketIntelligence}
              />
            ) : selectedSection === "journal" ? (
              <JournalWorkspace />
            ) : selectedSection === "trade-log" ? (
              <JournalWorkspace initialView="trade-log" />
            ) : selectedSection === "performance" ? (
              <PerformanceWorkspace />
            ) : selectedSection === "fundamentals" ? (
              <FundamentalsWorkspace initialTab={selectedFundamentalsTab} />
            ) : selectedSection === "technicals" ? (
              <TechnicalsWorkspace initialTab={selectedTechnicalsTab} />
            ) : selectedSection === "reports" ? (
              <ReportsWorkspace
                initialView={selectedReportsView}
                initialMarketIntelligenceSymbol={
                  selectedReportsMarketIntelligenceSymbol
                }
              />
            ) : selectedSection === "risk-management" ? (
              <RiskManagementWorkspaceEnhanced />
            ) : selectedSection === "connect-platform" ? (
              <ConnectPlatformWorkspace />
            ) : selectedSection === "new-entry" ? (
              <NewEntryWorkspace />
            ) : (
              <WorkspacePlaceholder selectedSection={selectedSection} />
            )}

          </div>
        </section>
      </div>
      </DashboardPreferencesProvider>
    </main>
  );
}
