"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Gauge,
  Grid2X2,
} from "lucide-react";
import CurrencyStrengthMeter from "@/components/technicals/CurrencyStrengthMeter";

export type TechnicalsTab =
  | "hub"
  | "currency-strength"
  | "currency-momentum";

const technicalTabs = [
  {
    label: "Hub",
    value: "hub" as TechnicalsTab,
    icon: Grid2X2,
    description: "Overview of EdgeVault technical analysis tools.",
  },
  {
    label: "Currency Strength",
    value: "currency-strength" as TechnicalsTab,
    icon: Gauge,
    description:
      "Compare the relative strength of the eight major currencies.",
  },
  {
    label: "Currency Momentum",
    value: "currency-momentum" as TechnicalsTab,
    icon: Activity,
    description:
      "Monitor immediate short-term momentum across the major currencies.",
  },
];

export default function TechnicalsWorkspace({
  initialTab = "hub",
}: {
  initialTab?: TechnicalsTab;
}) {
  const [activeTab, setActiveTab] = useState<TechnicalsTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5 shadow-[0_0_35px_rgba(15,23,42,0.55)] sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-violet-400">
          EdgeVault Technicals
        </p>

        <div className="mt-3">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Technical Analysis
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Measure relative currency strength and short-term currency momentum
            across multiple market timeframes.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {technicalTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  isActive
                    ? "border-violet-400/70 bg-violet-500/10"
                    : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/70",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    isActive
                      ? "bg-violet-500/20 text-violet-300"
                      : "bg-slate-800 text-slate-400",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <p className="mt-4 font-semibold text-white">{tab.label}</p>

                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "hub" ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Gauge className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-xl font-bold text-white">
              Currency Strength Meter
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Rank USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD from strongest to
              weakest using price movement across the 28 major currency pairs.
            </p>

            <button
              type="button"
              onClick={() => setActiveTab("currency-strength")}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-300"
            >
              Open Currency Strength
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <Activity className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-xl font-bold text-white">
              Currency Momentum Meter
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Track faster short-term currency movement for scalping and
              immediate market-momentum analysis.
            </p>

            <button
              type="button"
              onClick={() => setActiveTab("currency-momentum")}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"
            >
              Open Currency Momentum
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === "currency-strength" ? (
        <section className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-400">
                Technical Tool
              </p>

              <h2 className="mt-2 text-2xl font-bold text-white">
                Currency Strength Meter
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                Compare the relative strength of USD, EUR, GBP, JPY, CHF, CAD,
                AUD and NZD across selectable timeframes.
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Gauge className="h-6 w-6" />
            </div>
          </div>

          <CurrencyStrengthMeter />
        </section>
      ) : null}

      {activeTab === "currency-momentum" ? (
        <section className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
              Future Technical Tool
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Currency Momentum Meter
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              This workspace will be developed after the Currency Strength
              Meter is completed.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
            <Activity className="mx-auto h-9 w-9 text-slate-500" />

            <p className="mt-4 font-semibold text-white">
              Currency Momentum is reserved
            </p>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              It will later provide a faster short-term ranking using the same
              eight currencies and related display styles.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}