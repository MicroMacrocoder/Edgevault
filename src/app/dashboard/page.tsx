"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import FundamentalsWorkspace from "@/components/dashboard/FundamentalsWorkspace";
import RiskManagementWorkspace from "@/components/dashboard/RiskManagementWorkspace";
import ConnectPlatformWorkspace from "@/components/dashboard/ConnectPlatformWorkspace";
import NewEntryWorkspace from "@/components/dashboard/NewEntryWorkspace";
import JournalWorkspace from "@/components/dashboard/JournalWorkspace";
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
  CalendarDays,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  Grid2X2,
  LineChartIcon,
  Lock,
  LogOut,
  Moon,
  PieChartIcon,
  PlusCircle,
  RadioTower,
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
  | "analytics"
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
  { label: "Dashboard", section: "overview" as DashboardSection, icon: Grid2X2 },
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
    label: "Analytics",
    section: "analytics" as DashboardSection,
    icon: LineChartIcon,
  },
  { label: "Settings", section: "settings" as DashboardSection, icon: Settings },
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
  analytics: {
    title: "Analytics",
    subtitle: "Deeper statistics and trading intelligence.",
    description:
      "This area will contain advanced analytics, equity curves, filters, and strategy breakdowns.",
    actions: ["Strategy stats", "Pair analysis", "Session analysis"],
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

function OverviewSection({
  onSelectSection,
}: {
  onSelectSection: (section: DashboardSection) => void;
}) {
  return (
    <div className="space-y-5">
      <DashboardCard className="p-5">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-white">
              Performance Overview
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              All Time <span className="mx-2">•</span> Jan 1, 2024 - May 28,
              2024
            </p>
          </div>

          <div className="flex overflow-hidden border border-gray-800 font-mono text-xs font-medium text-gray-400">
            {["1D", "1W", "1M", "3M", "6M", "YTD", "ALL"].map((item) => (
              <button
                key={item}
                className={
                  item === "ALL"
                    ? "bg-yellow-400 px-4 py-2 text-black"
                    : "border-r border-gray-800 px-4 py-2 hover:bg-[#111111] hover:text-yellow-400"
                }
              >
                {item}
              </button>
            ))}

            <button className="px-3 py-2 hover:bg-[#111111] hover:text-yellow-400">
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="flex flex-col justify-center">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
              Total Return
            </p>
            <p className="mt-3 font-mono text-6xl font-black tracking-tight text-green-400">
              +56.7%
            </p>
            <p className="mt-3 font-mono text-xl font-semibold text-yellow-400">
              +$15,450.00
            </p>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient
                    id="performanceFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.35} />
                    <stop
                      offset="100%"
                      stopColor="#22d3ee"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  stroke="#9ca3af"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  orientation="right"
                  stroke="#9ca3af"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
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
                  dataKey="return"
                  stroke="#facc15"
                  strokeWidth={3}
                  fill="url(#performanceFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </DashboardCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <MiniMetricCard
          icon={<BarChart3 className="h-8 w-8" />}
          title="Total Trades"
          value="248"
          subtitle="Total Executed Trades"
          chartType="spark"
        />
        <MiniMetricCard
          icon={<PieChartIcon className="h-8 w-8" />}
          title="Win Rate"
          value="78%"
          subtitle="Winning Trades"
          chartType="ring"
        />
        <MiniMetricCard
          icon={<DollarSign className="h-8 w-8" />}
          title="Net Profit"
          value="$15,450"
          subtitle="Total Profit"
          chartType="bars"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr_1.1fr]">
        <DashboardCard className="p-5">
          <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white">
            Equity Curve
          </h2>

          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.32} />
                    <stop
                      offset="100%"
                      stopColor="#22c55e"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fontSize: 12 }}
                />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
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
                  dataKey="equity"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill="url(#equityFill)"
                />
                <Bar dataKey="volume" fill="#facc15" opacity={0.35} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        <DashboardCard className="p-5">
          <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white">
            Trade Performance
          </h2>

          <div className="flex h-[260px] items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tradePerformanceData}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={92}
                  paddingAngle={0}
                >
                  {tradePerformanceData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === "Win" ? "#facc15" : "#ef4444"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111111",
                    border: "1px solid #374151",
                    borderRadius: "0px",
                    color: "#e5e7eb",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="-mt-32 flex flex-col items-center justify-center">
            <p className="font-mono text-3xl font-bold text-white">248</p>
            <p className="text-xs text-gray-400">Total Trades</p>
          </div>
        </DashboardCard>

        <DashboardCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-white">
              Recent Trades
            </h2>

            <button
              type="button"
              onClick={() => onSelectSection("journal")}
              className="font-mono text-xs font-semibold text-yellow-400"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {recentTrades.map((trade) => (
              <div
                key={trade.pair}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg">
                    {trade.flag}
                  </div>

                  <div>
                    <p className="font-mono text-sm font-semibold text-white">
                      {trade.pair}
                    </p>
                    <p
                      className={
                        trade.side === "Long"
                          ? "text-xs text-green-400"
                          : "text-xs text-red-400"
                      }
                    >
                      {trade.side}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={
                      trade.positive
                        ? "font-mono text-sm font-semibold text-green-400"
                        : "font-mono text-sm font-semibold text-red-400"
                    }
                  >
                    {trade.profit}
                  </p>
                  <p className="text-xs text-gray-500">{trade.time}</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      <DashboardCard className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ["Account Balance", "$115,450.00", "text-white"],
          ["Initial Balance", "$99,999.99", "text-white"],
          ["Total Return", "+56.7%", "text-green-400"],
          ["Best Day", "+$2,450.00", "text-green-400"],
          ["Worst Day", "-$980.00", "text-red-400"],
          ["Profit Factor", "2.35", "text-white"],
          ["Total Trades", "248", "text-white"],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className="border-gray-800 lg:border-r lg:last:border-r-0"
          >
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-gray-500">
              {label}
            </p>
            <p className={"mt-2 font-mono text-lg font-bold " + color}>
              {value}
            </p>
          </div>
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
    <aside className="hidden space-y-5 2xl:block">
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
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-gray-800 bg-black px-5 py-5 xl:flex xl:flex-col">
          <Link href="/dashboard" className="mb-10 flex items-center px-0">
            <Image
              src="/edgevault-logo.png"
              alt="EdgeVault"
              width={360}
              height={160}
              className="h-32 w-full object-contain"
              priority
            />
          </Link>

          <nav className="space-y-1">
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

        <section className="flex-1 overflow-hidden px-4 py-4 lg:px-6">
          <div className="grid gap-5 2xl:grid-cols-[1fr_270px]">
            {selectedSection === "overview" ? (
              <OverviewSection onSelectSection={setSelectedSection} />
            ) : selectedSection === "journal" ? (
              <JournalWorkspace />
            ) : selectedSection === "fundamentals" ? (
              <FundamentalsWorkspace />
            ) : selectedSection === "risk-management" ? (
              <RiskManagementWorkspace />
            ) : selectedSection === "connect-platform" ? (
              <ConnectPlatformWorkspace />
            ) : selectedSection === "new-entry" ? (
              <NewEntryWorkspace />
            ) : (
              <WorkspacePlaceholder selectedSection={selectedSection} />
            )}

            <RightPanel onSelectSection={setSelectedSection} />
          </div>
        </section>
      </div>
    </main>
  );
}
