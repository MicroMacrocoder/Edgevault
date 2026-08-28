"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import NewEntryWorkspace from "@/components/dashboard/NewEntryWorkspace";
import ReviewJournalWorkspace from "@/components/dashboard/ReviewJournalWorkspace";
import TradeLogWorkspace from "@/components/dashboard/TradeLogWorkspace";

type JournalView = "hub" | "new-entry" | "review-journal" | "trade-log";

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-cyan-400/10 bg-[#111827]/70 shadow-[0_0_40px_rgba(34,211,238,0.06)] " +
        className
      }
    >
      {children}
    </div>
  );
}

function IconBox({
  children,
  tone = "cyan",
}: {
  children: ReactNode;
  tone?: "cyan" | "green" | "slate";
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
      : tone === "green"
        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
        : "border-slate-700 bg-slate-900 text-slate-400";

  return (
    <div
      className={
        "flex h-14 w-14 items-center justify-center rounded-2xl border text-xl font-black " +
        toneClass
      }
    >
      {children}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-5 rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/80 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
    >
      ← Back to Journal Hub
    </button>
  );
}

function JournalHub({
  onOpenView,
}: {
  onOpenView: (view: JournalView) => void;
}) {
  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
            EdgeVault Journal Hub
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Journal
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Manage your full trading journal workflow from one place. Create new
            analysis entries, review saved journal entries, and manage your
            trade logs without leaving the dashboard.
          </p>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => onOpenView("new-entry")}
          className="group rounded-2xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-6 text-left transition hover:border-cyan-400/50 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,211,238,0.12)]"
        >
          <div className="flex items-start justify-between gap-4">
            <IconBox tone="cyan">+</IconBox>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/10 text-slate-500 transition group-hover:border-cyan-400/40 group-hover:text-cyan-300">
              →
            </div>
          </div>

          <h2 className="mt-6 text-2xl font-bold text-white">New Entry</h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Create analysis workspaces for pairs, setups, ideas, and strategy
            reviews.
          </p>

          <p className="mt-6 text-sm font-semibold text-cyan-300">
            Open New Entry →
          </p>
        </button>

        <button
          type="button"
          onClick={() => onOpenView("review-journal")}
          className="group rounded-2xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-6 text-left transition hover:border-emerald-400/50 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,197,94,0.12)]"
        >
          <div className="flex items-start justify-between gap-4">
            <IconBox tone="green">J</IconBox>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/10 text-slate-500 transition group-hover:border-emerald-400/40 group-hover:text-emerald-300">
              →
            </div>
          </div>

          <h2 className="mt-6 text-2xl font-bold text-white">
            Review Journal Entries
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Open saved journal entries, review past analysis, and continue
            improving your trading records.
          </p>

          <p className="mt-6 text-sm font-semibold text-emerald-300">
            Review Entries →
          </p>
        </button>

        <button
          type="button"
          onClick={() => onOpenView("trade-log")}
          className="group rounded-2xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-6 text-left transition hover:border-cyan-400/50 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,211,238,0.12)]"
        >
          <div className="flex items-start justify-between gap-4">
            <IconBox tone="cyan">TL</IconBox>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/10 text-slate-500 transition group-hover:border-cyan-400/40 group-hover:text-cyan-300">
              →
            </div>
          </div>

          <h2 className="mt-6 text-2xl font-bold text-white">Trade Log</h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Create new trade logs, review taken trades, and prepare for MT5
            synced trade records.
          </p>

          <p className="mt-6 text-sm font-semibold text-cyan-300">
            Open Trade Log →
          </p>
        </button>
      </div>

      <Panel className="p-6">
        <h2 className="text-xl font-bold text-white">Journal Workflow</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-4">
            <p className="text-sm font-bold text-cyan-300">1. Plan</p>
            <p className="mt-2 text-sm text-slate-400">
              Use New Entry to build your analysis before or after a trade.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-400/10 bg-[#0F0F1F]/70 p-4">
            <p className="text-sm font-bold text-emerald-300">2. Review</p>
            <p className="mt-2 text-sm text-slate-400">
              Use Review Journal Entries to study saved analysis and lessons.
            </p>
          </div>

          <div className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-4">
            <p className="text-sm font-bold text-cyan-300">3. Track</p>
            <p className="mt-2 text-sm text-slate-400">
              Use Trade Log to track taken trades and performance records.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default function JournalWorkspace({
  initialView = "hub",
}: {
  initialView?: JournalView;
}) {
  const [activeView, setActiveView] = useState<JournalView>(initialView);

  if (activeView === "new-entry") {
    return (
      <div className="space-y-5">
        <Panel className="relative overflow-hidden p-6">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative">
            <BackButton onBack={() => setActiveView("hub")} />

            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
              Journal / New Entry
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
              New Entry
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Create or open an analysis workspace inside your journal flow.
            </p>
          </div>
        </Panel>

        <NewEntryWorkspace />
      </div>
    );
  }

  if (activeView === "review-journal") {
    return <ReviewJournalWorkspace onBack={() => setActiveView("hub")} />;
  }

  if (activeView === "trade-log") {
    return (
      <div className="space-y-5">
        <Panel className="relative overflow-hidden p-6">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative">
            <BackButton onBack={() => setActiveView("hub")} />

            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
              Journal / Trade Log
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
              Trade Log
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              Create trade log templates and review saved trade logs from inside
              the journal workflow.
            </p>
          </div>
        </Panel>

        <TradeLogWorkspace />
      </div>
    );
  }

  return <JournalHub onOpenView={setActiveView} />;
}
