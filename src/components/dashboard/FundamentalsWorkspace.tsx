"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  LineChart,
  Newspaper,
} from "lucide-react";
import COTAnalysis from "@/components/fundamentals/COTAnalysis";
import EconomicCalendar from "@/components/fundamentals/EconomicCalendar";
import VolumeOITracker from "@/components/fundamentals/VolumeOITracker";

export type FundamentalsTab = "hub" | "calendar" | "cot" | "volume-oi";

const fundamentalTabs = [
  {
    label: "Hub",
    value: "hub" as FundamentalsTab,
    icon: Newspaper,
    description: "Overview of all fundamental intelligence modules.",
  },
  {
    label: "Economic Calendar",
    value: "calendar" as FundamentalsTab,
    icon: CalendarDays,
    description: "Track economic events, impact, forecasts, and actual data.",
  },
  {
    label: "COT",
    value: "cot" as FundamentalsTab,
    icon: LineChart,
    description: "Analyze weekly CFTC trader positioning.",
  },
  {
    label: "Volume/OI",
    value: "volume-oi" as FundamentalsTab,
    icon: BarChart3,
    description: "Monitor futures volume and open interest.",
  },
];

export default function FundamentalsWorkspace({
  initialTab = "hub",
}: {
  initialTab?: FundamentalsTab;
}) {
  const [activeTab, setActiveTab] = useState<FundamentalsTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-6 shadow-[0_0_35px_rgba(15,23,42,0.55)]">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-400">
          EdgeVault Fundamentals
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
          Fundamental Intelligence
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
          Access economic calendar data, Commitment of Traders positioning,
          volume, and open interest from inside the dashboard workspace.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {fundamentalTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={
                  isActive
                    ? "rounded-2xl border border-emerald-500/40 bg-emerald-500/15 p-4 text-left shadow-[0_0_25px_rgba(34,197,94,0.12)]"
                    : "rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900"
                }
              >
                <div
                  className={
                    isActive
                      ? "mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300"
                      : "mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-slate-400"
                  }
                >
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="text-sm font-bold text-white">{tab.label}</h3>

                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "hub" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <CalendarDays className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-xl font-bold text-white">
              Economic Calendar
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Track market-moving events, impact levels, forecast values,
              previous values, and actual releases.
            </p>

            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className="mt-6 text-sm font-semibold text-cyan-400"
            >
              Open Calendar →
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <LineChart className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-xl font-bold text-white">
              Commitment of Traders
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Analyze commercial hedgers, non-commercial speculators,
              non-reportable traders, and open interest positioning.
            </p>

            <button
              type="button"
              onClick={() => setActiveTab("cot")}
              className="mt-6 text-sm font-semibold text-emerald-400"
            >
              Open COT →
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-400">
              <BarChart3 className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-xl font-bold text-white">
              Volume & Open Interest
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Monitor daily futures participation using volume, open interest,
              numerical change, percentage change, and moving averages.
            </p>

            <button
              type="button"
              onClick={() => setActiveTab("volume-oi")}
              className="mt-6 text-sm font-semibold text-yellow-400"
            >
              Open Volume/OI →
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "calendar" ? (
        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-4">
          <EconomicCalendar />
        </div>
      ) : null}

      {activeTab === "cot" ? (
        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-4">
          <COTAnalysis />
        </div>
      ) : null}

      {activeTab === "volume-oi" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/80">
          <VolumeOITracker />
        </div>
      ) : null}
    </div>
  );
}
