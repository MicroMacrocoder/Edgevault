"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  supabase,
  getUserTradeLogsWithRows,
  getUserJournalEntries,
  getUserTradeLogTemplates,
} from "@/lib/supabase";
import {
  calculatePerformanceMetrics,
  formatMoney,
  formatPercent,
  type PerformanceChartMode,
  type PerformanceDateRange,
  type TradeLogWithRows,
} from "@/lib/performanceMetrics";
import FundamentalsWorkspace from "@/components/dashboard/FundamentalsWorkspace";
import RiskManagementWorkspace from "@/components/dashboard/RiskManagementWorkspace";
import ConnectPlatformWorkspace from "@/components/dashboard/ConnectPlatformWorkspace";
import NewEntryWorkspace from "@/components/dashboard/NewEntryWorkspace";
import JournalWorkspace from "@/components/dashboard/JournalWorkspace";
import PerformanceWorkspace from "@/components/dashboard/PerformanceWorkspace";
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
  Calculator,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  Globe,
  Grid2X2,
  LineChartIcon,
  Lock,
  LogOut,
  Moon,
  PieChartIcon,
  PlusCircle,
  RadioTower,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";

type DashboardSection =
  | "overview"
  | "journal"
  | "trade-log"
  | "new-entry"
  | "saved-trade-logs"
  | "fundamentals"
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

const recentTrades = [
  {
    pair: "EURUSD",
    side: "Long",
    profit: "+$560.00",
    time: "2h ago",
    flag: "🇪🇺",
    positive: true,
  },
  {
    pair: "XAUUSD",
    side: "Long",
    profit: "+$1,240.00",
    time: "4h ago",
    flag: "🟡",
    positive: true,
  },
  {
    pair: "GBPUSD",
    side: "Short",
    profit: "+$320.00",
    time: "6h ago",
    flag: "🇬🇧",
    positive: true,
  },
  {
    pair: "NAS100",
    side: "Long",
    profit: "+$780.00",
    time: "1d ago",
    flag: "🇺🇸",
    positive: true,
  },
  {
    pair: "USDJPY",
    side: "Short",
    profit: "-$230.00",
    time: "1d ago",
    flag: "🇯🇵",
    positive: false,
  },
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

const quickAccessItems = [
  {
    label: "Journal",
    section: "journal" as DashboardSection,
    icon: BookOpen,
    color: "bg-yellow-400",
  },
  {
    label: "New Entry",
    section: "new-entry" as DashboardSection,
    icon: PlusCircle,
    color: "bg-orange-400",
  },
  {
    label: "Trade Log",
    section: "trade-log" as DashboardSection,
    icon: ClipboardList,
    color: "bg-green-400",
  },
  {
    label: "Fundamentals",
    section: "fundamentals" as DashboardSection,
    icon: BarChart3,
    color: "bg-cyan-400",
  },
  {
    label: "Risk Management",
    section: "risk-management" as DashboardSection,
    icon: ShieldCheck,
    color: "bg-red-500",
  },
];

const marketSnapshot = [
  { symbol: "DXY", value: "104.28", change: "+0.32%", positive: true },
  { symbol: "VIX", value: "12.45", change: "-1.22%", positive: false },
  { symbol: "GOLD", value: "2,341.80", change: "+0.85%", positive: true },
  { symbol: "NAS100", value: "18,567.80", change: "+0.62%", positive: true },
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

const economicCalendarPreview = [
  {
    time: "Released",
    currency: "USD",
    event: "Core CPI m/m",
    impact: "High",
    status: "Actual released",
  },
  {
    time: "09:30",
    currency: "GBP",
    event: "Claimant Count Change",
    impact: "Medium",
    status: "Upcoming",
  },
  {
    time: "13:30",
    currency: "USD",
    event: "Retail Sales m/m",
    impact: "High",
    status: "Upcoming",
  },
  {
    time: "15:00",
    currency: "USD",
    event: "Fed Chair Speech",
    impact: "High",
    status: "Upcoming",
  },
  {
    time: "23:50",
    currency: "JPY",
    event: "GDP q/q",
    impact: "Medium",
    status: "Upcoming",
  },
];

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

type DashboardEconomicEvent = {
  id?: string;
  currency: string;
  title: string;
  impact: string;
  event_time: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  unit: string;
  status: string;
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

const dashboardCOTMarkets = [
  { label: "U.S. Dollar Index", symbol: "DXY" },
  { label: "Euro FX", symbol: "EUR" },
  { label: "British Pound", symbol: "GBP" },
  { label: "Australian Dollar", symbol: "AUD" },
  { label: "Japanese Yen", symbol: "JPY" },
  { label: "Canadian Dollar", symbol: "CAD" },
  { label: "Swiss Franc", symbol: "CHF" },
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

function formatDashboardTime(dateValue?: string | null) {
  if (!dateValue) {
    return "Time N/A";
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Time N/A";
  }

  return parsedDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCalendarValue(value: number | null, unit: string) {
  if (value === null || value === undefined) {
    return "Pending";
  }

  return `${value}${unit ? " " + unit : ""}`;
}

function getImpactBadgeClass(impact: string) {
  const cleanImpact = String(impact || "").toLowerCase();

  if (cleanImpact === "high") {
    return "bg-red-500/20 text-red-300";
  }

  if (cleanImpact === "medium") {
    return "bg-yellow-400/10 text-yellow-400";
  }

  return "bg-green-500/15 text-green-400";
}

function OverviewSection({
  onSelectSection,
  onOpenFundamentalsTab,
}: {
  onSelectSection: (section: DashboardSection) => void;
  onOpenFundamentalsTab: (tab: FundamentalsTab) => void;
}) {
  const [tradeLogs, setTradeLogs] = useState<TradeLogWithRows[]>([]);
  const [selectedTradeLogId, setSelectedTradeLogId] = useState("all");
  const [dateRange, setDateRange] = useState<PerformanceDateRange>("ALL");
  const [chartMode, setChartMode] =
    useState<PerformanceChartMode>("percentage");
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);
  const [performanceMessage, setPerformanceMessage] = useState("");

  const [selectedCotMarket, setSelectedCotMarket] = useState("DXY");
  const [cotChartRows, setCotChartRows] = useState<DashboardCOTChartPoint[]>([]);
  const [isLoadingCot, setIsLoadingCot] = useState(true);
  const [cotMessage, setCotMessage] = useState("");

  const [economicEvents, setEconomicEvents] = useState<DashboardEconomicEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [calendarMessage, setCalendarMessage] = useState("");

  const [journalPreview, setJournalPreview] = useState<DashboardJournalPreview[]>([]);
  const [tradeLogPreview, setTradeLogPreview] = useState<DashboardTradeLogPreview[]>([]);

  async function loadDashboardPerformance() {
    setIsLoadingPerformance(true);
    setPerformanceMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      if (user) {
        const { error, tradeLogs: loadedTradeLogs } =
          await getUserTradeLogsWithRows(user.id);

        if (error) {
          setTradeLogs([]);
          setPerformanceMessage(
            "Could not load trade log performance preview.",
          );
          setIsLoadingPerformance(false);
          return;
        }

        setTradeLogs(loadedTradeLogs || []);
        setIsLoadingPerformance(false);
        return;
      }

      setTradeLogs(getGuestTradeLogsWithRows());
      setIsLoadingPerformance(false);
    } catch (error) {
      console.log("LOAD DASHBOARD PERFORMANCE ERROR:", error);
      setTradeLogs([]);
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

  async function loadDashboardCalendar() {
    setIsLoadingCalendar(true);
    setCalendarMessage("");

    try {
      const response = await fetch("/api/fundamentals", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Could not load economic calendar.");
      }

      const data = await response.json();
      const now = Date.now();

      const mappedEvents = Array.isArray(data)
        ? data.map((item: any, index: number) => {
            const eventTime = item.releaseDate || item.event_time || "";
            const eventTimestamp = new Date(eventTime).getTime();
            const hasReleased =
              Number.isFinite(eventTimestamp) && eventTimestamp <= now;

            return {
              id: `${item.currency || "event"}-${item.indicator || item.title || index}`,
              currency: item.currency || "N/A",
              title: item.indicator || item.title || "Untitled event",
              impact: item.impact || "Low",
              event_time: eventTime,
              actual:
                item.actual === undefined || item.actual === null
                  ? null
                  : Number(item.actual),
              forecast:
                item.forecast === undefined || item.forecast === null
                  ? null
                  : Number(item.forecast),
              previous:
                item.previous === undefined || item.previous === null
                  ? null
                  : Number(item.previous),
              unit: item.unit || "",
              status: hasReleased ? "Released" : "Upcoming",
            };
          })
        : [];

      const released = mappedEvents
        .filter((event: DashboardEconomicEvent) => {
          const eventTimestamp = new Date(event.event_time).getTime();
          return Number.isFinite(eventTimestamp) && eventTimestamp <= now;
        })
        .sort(
          (a: DashboardEconomicEvent, b: DashboardEconomicEvent) =>
            new Date(b.event_time).getTime() - new Date(a.event_time).getTime(),
        )
        .slice(0, 1);

      const upcoming = mappedEvents
        .filter((event: DashboardEconomicEvent) => {
          const eventTimestamp = new Date(event.event_time).getTime();
          return Number.isFinite(eventTimestamp) && eventTimestamp > now;
        })
        .sort(
          (a: DashboardEconomicEvent, b: DashboardEconomicEvent) =>
            new Date(a.event_time).getTime() - new Date(b.event_time).getTime(),
        )
        .slice(0, 2);

      const fallbackEvents = mappedEvents
        .sort(
          (a: DashboardEconomicEvent, b: DashboardEconomicEvent) =>
            new Date(a.event_time).getTime() - new Date(b.event_time).getTime(),
        )
        .slice(0, 3);

      const previewEvents =
        released.length + upcoming.length > 0
          ? [...released, ...upcoming]
          : fallbackEvents;

      setEconomicEvents(previewEvents);
    } catch (error) {
      console.log("LOAD DASHBOARD CALENDAR ERROR:", error);
      setCalendarMessage("Could not load today's calendar preview.");
      setEconomicEvents([]);
    } finally {
      setIsLoadingCalendar(false);
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
    loadDashboardPerformance();
    loadDashboardCalendar();
    loadDashboardJournalWidgets();
  }, []);

  useEffect(() => {
    loadDashboardCot();
  }, [selectedCotMarket]);

  const metrics = useMemo(
    () =>
      calculatePerformanceMetrics({
        tradeLogs,
        selectedTradeLogId,
        dateRange,
      }),
    [tradeLogs, selectedTradeLogId, dateRange],
  );

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

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <DashboardCard className="p-5">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
                COT
              </p>
              <h1 className="mt-1 font-mono text-lg font-bold text-white">
                {selectedMarketLabel}
              </h1>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="border border-gray-800 bg-black px-4 py-3 font-mono text-xs font-bold text-yellow-400">
                Market: {selectedCotMarket}
              </div>

              <select
                value={selectedCotMarket}
                onChange={(event) => setSelectedCotMarket(event.target.value)}
                className="border border-gray-800 bg-black px-4 py-3 font-mono text-xs font-bold text-white outline-none transition focus:border-yellow-400"
              >
                {dashboardCOTMarkets.map((market) => (
                  <option key={market.symbol} value={market.symbol}>
                    {market.symbol}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => onOpenFundamentalsTab("cot")}
                className="border border-gray-800 px-4 py-3 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
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
            <div className="h-[220px]">
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
                      tickFormatter={(value) => formatDashboardNumber(Number(value))}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111111",
                        border: "1px solid #374151",
                        borderRadius: "0px",
                        color: "#e5e7eb",
                      }}
                      formatter={(value) => formatDashboardNumber(Number(value))}
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

        <DashboardCard className="p-5">
          <DashboardWidgetHeader
            label="Fundamentals"
            title="Today's Economic Calendar"
            onOpen={() => onOpenFundamentalsTab("calendar")}
          />

          <div className="space-y-2">
            {isLoadingCalendar ? (
              <div className="border border-gray-800 bg-black p-5 text-center font-mono text-sm text-gray-500">
                Loading calendar...
              </div>
            ) : calendarMessage ? (
              <div className="border border-red-500/30 bg-red-500/10 p-5 text-center font-mono text-sm text-red-300">
                {calendarMessage}
              </div>
            ) : economicEvents.length === 0 ? (
              <div className="border border-gray-800 bg-black p-5 text-center font-mono text-sm text-gray-500">
                No calendar events found.
              </div>
            ) : (
              economicEvents.map((item, index) => (
                <button
                  type="button"
                  key={`${item.currency}-${item.title}-${index}`}
                  onClick={() => onOpenFundamentalsTab("calendar")}
                  className="flex w-full items-center justify-between gap-3 border border-gray-800 bg-black px-3 py-2 text-left transition hover:border-yellow-400"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "px-2 py-1 font-mono text-[10px] font-bold " +
                          getImpactBadgeClass(item.impact)
                        }
                      >
                        {item.impact}
                      </span>
                      <span className="font-mono text-xs font-bold text-cyan-400">
                        {item.currency}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDashboardTime(item.event_time)}
                      </span>
                    </div>
                    <p className="mt-2 truncate font-mono text-sm font-semibold text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      Actual: {formatCalendarValue(item.actual, item.unit)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-gray-500">
                    {item.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <DashboardCard className="p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <select
              value={selectedTradeLogId}
              onChange={(event) => setSelectedTradeLogId(event.target.value)}
              className="border border-gray-800 bg-black px-4 py-3 font-mono text-xs font-bold text-white outline-none transition focus:border-yellow-400"
            >
              <option value="all">General Overview</option>
              {tradeLogs.map((log) => (
                <option key={log.id} value={log.id}>
                  {log.logName || "Untitled Trade Log"}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadDashboardPerformance}
                className="inline-flex items-center justify-center gap-2 border border-gray-800 px-4 py-3 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                <RefreshCw className="h-4 w-4" />
                Reload
              </button>

              <button
                type="button"
                onClick={() => onSelectSection("performance")}
                className="border border-gray-800 px-4 py-3 font-mono text-xs font-bold text-gray-300 transition hover:border-yellow-400 hover:text-yellow-400"
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
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                {overviewDateRanges.map((range) => (
                  <span
                    key={range}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDateRange(range);
                    }}
                    className={
                      dateRange === range
                        ? "cursor-pointer bg-yellow-400 px-3 py-2 font-mono text-xs font-bold text-black"
                        : "cursor-pointer border border-gray-800 px-3 py-2 font-mono text-xs font-bold text-gray-400 hover:border-yellow-400 hover:text-yellow-400"
                    }
                  >
                    {range}
                  </span>
                ))}

                <span
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setChartMode("balance");
                  }}
                  className={
                    chartMode === "balance"
                      ? "cursor-pointer bg-cyan-400 px-3 py-2 font-mono text-xs font-bold text-black"
                      : "cursor-pointer border border-gray-800 px-3 py-2 font-mono text-xs font-bold text-gray-400 hover:border-cyan-400 hover:text-cyan-400"
                  }
                >
                  Balance
                </span>

                <span
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setChartMode("percentage");
                  }}
                  className={
                    chartMode === "percentage"
                      ? "cursor-pointer bg-yellow-400 px-3 py-2 font-mono text-xs font-bold text-black"
                      : "cursor-pointer border border-gray-800 px-3 py-2 font-mono text-xs font-bold text-gray-400 hover:border-yellow-400 hover:text-yellow-400"
                  }
                >
                  %
                </span>
              </div>
            </div>

            <div className="h-[220px] border border-gray-800 bg-[#050505] p-3">
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

        <div className="grid gap-4 xl:grid-rows-2">
          <DashboardCard className="min-h-0 overflow-hidden p-5">
            <DashboardWidgetHeader
              label="Journal"
              title="Library"
              onOpen={() => onSelectSection("journal")}
            />

            <div className="space-y-3">
              {journalPreview.length === 0 ? (
                <div className="border border-gray-800 bg-black p-5 text-sm text-gray-500">
                  No saved analysis yet.
                </div>
              ) : (
                journalPreview.slice(0, 2).map((entry) => (
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

          <DashboardCard className="min-h-0 overflow-hidden p-5">
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
                tradeLogPreview.slice(0, 2).map((log) => (
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
        </div>
      </div>

      <DashboardCard className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Workspace", "Plan and save analysis", "journal"],
          ["MetaTrader", "Connect MT5 platform", "connect-platform"],
          ["MT5 Sync", "Import and sync trades", "connect-platform"],
          ["Risk", "Position sizing and rules", "risk-management"],
        ].map(([label, value, section]) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelectSection(section as DashboardSection)}
            className="border border-gray-800 bg-black p-4 text-left transition hover:border-yellow-400"
          >
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gray-500">
              {label}
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-white">
              {value}
            </p>
          </button>
        ))}
      </DashboardCard>
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

function RightPanel({
  onSelectSection,
}: {
  onSelectSection: (section: DashboardSection) => void;
}) {
  return (
    <aside className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:block 2xl:space-y-5">
      <DashboardCard className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Welcome back,</p>
            <p className="mt-1 font-mono text-lg font-bold text-white">
              EdgeTrader
            </p>
            <p className="font-mono text-xs font-semibold text-yellow-400">
              Pro Plan
            </p>
          </div>

          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-yellow-400/40 font-mono text-lg font-bold text-yellow-400">
            EV
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-400" />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5">
        <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white">
          Key Stats
        </h2>

        <div className="space-y-4 text-sm">
          {[
            ["Profit Factor", "2.35", "text-white"],
            ["Sharpe Ratio", "1.85", "text-white"],
            ["Sortino Ratio", "2.73", "text-white"],
            ["Max Drawdown", "-8.7%", "text-red-400"],
            ["Best Day", "+$2,450.00", "text-green-400"],
            ["Worst Day", "-$980.00", "text-red-400"],
          ].map(([label, value, color]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-gray-400">{label}</span>
              <span className={"font-mono font-semibold " + color}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5">
        <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white">
          Quick Access
        </h2>

        <div className="space-y-3">
          {quickAccessItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onSelectSection(item.section)}
                className="flex w-full items-center justify-between border border-gray-800 bg-black px-3 py-3 text-left transition hover:border-yellow-400 hover:bg-[#111111]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={
                      "flex h-8 w-8 items-center justify-center " + item.color
                    }
                  >
                    <Icon className="h-4 w-4 text-black" />
                  </div>
                  <span className="font-mono text-sm font-semibold text-white">
                    {item.label}
                  </span>
                </div>

                <ChevronRight className="h-4 w-4 text-gray-500" />
              </button>
            );
          })}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5">
        <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white">
          Market Snapshot
        </h2>

        <div className="space-y-4">
          {marketSnapshot.map((item) => (
            <div
              key={item.symbol}
              className="flex items-center justify-between text-sm"
            >
              <span className="font-mono font-semibold text-gray-400">
                {item.symbol}
              </span>
              <span className="text-white">{item.value}</span>
              <span
                className={
                  item.positive
                    ? "font-mono font-semibold text-green-400"
                    : "font-mono font-semibold text-red-400"
                }
              >
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-yellow-400 text-black">
            <Lock className="h-5 w-5" />
          </div>

          <div>
            <p className="font-mono text-sm font-bold text-white">
              Workspace Mode
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Sidebar clicks update the main dashboard area instead of leaving
              the dashboard page.
            </p>
          </div>
        </div>
      </DashboardCard>
    </aside>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [selectedSection, setSelectedSection] =
    useState<DashboardSection>("overview");
  const [selectedFundamentalsTab, setSelectedFundamentalsTab] =
    useState<FundamentalsTab>("hub");

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
                  onClick={() => setSelectedSection(item.section)}
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
                    onClick={() => setSelectedSection(item.section)}
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

          <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0">
            {selectedSection === "overview" ? (
              <OverviewSection
                onSelectSection={setSelectedSection}
                onOpenFundamentalsTab={handleOpenFundamentalsTab}
              />
            ) : selectedSection === "journal" ? (
              <JournalWorkspace />
            ) : selectedSection === "performance" ? (
              <PerformanceWorkspace />
            ) : selectedSection === "fundamentals" ? (
              <FundamentalsWorkspace initialTab={selectedFundamentalsTab} />
            ) : selectedSection === "risk-management" ? (
              <RiskManagementWorkspace />
            ) : selectedSection === "connect-platform" ? (
              <ConnectPlatformWorkspace />
            ) : selectedSection === "new-entry" ? (
              <NewEntryWorkspace />
            ) : (
              <WorkspacePlaceholder selectedSection={selectedSection} />
            )}

            </div>

            <RightPanel onSelectSection={setSelectedSection} />
          </div>
        </section>
      </div>
    </main>
  );
}
