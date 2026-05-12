"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import TradeLogBuilderWorkspace from "@/components/dashboard/TradeLogBuilderWorkspace";
import SavedTradeLogsWorkspace from "@/components/dashboard/SavedTradeLogsWorkspace";
import TradeLogTableWorkspace from "@/components/dashboard/TradeLogTableWorkspace";

type TradeLogView = "hub" | "builder" | "saved-logs" | "open-log";

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
  tone?: "cyan" | "green";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";

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

function TradeLogHub({
  onOpenBuilder,
  onOpenSavedLogs,
}: {
  onOpenBuilder: () => void;
  onOpenSavedLogs: () => void;
}) {
  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
            EdgeVault Trade Log Hub
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Trade Log
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Create trade log templates, open saved trade logs, and review taken
            trades from one place inside the dashboard.
          </p>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <button
          type="button"
          onClick={onOpenBuilder}
          className="group rounded-2xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-6 text-left transition hover:border-cyan-400/50 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,211,238,0.12)]"
        >
          <div className="flex items-start justify-between gap-4">
            <IconBox tone="cyan">+</IconBox>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/10 text-slate-500 transition group-hover:border-cyan-400/40 group-hover:text-cyan-300">
              →
            </div>
          </div>

          <h2 className="mt-6 text-2xl font-bold text-white">
            Trade Log Builder
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Create a new trade log template, customize headers, and prepare the
            structure for manual or synced trades.
          </p>

          <p className="mt-6 text-sm font-semibold text-cyan-300">
            Create New Trade Log →
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenSavedLogs}
          className="group rounded-2xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-6 text-left transition hover:border-emerald-400/50 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,197,94,0.12)]"
        >
          <div className="flex items-start justify-between gap-4">
            <IconBox tone="green">TL</IconBox>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/10 text-slate-500 transition group-hover:border-emerald-400/40 group-hover:text-emerald-300">
              →
            </div>
          </div>

          <h2 className="mt-6 text-2xl font-bold text-white">
            Saved Trade Logs
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Open saved trade logs, review taken trades, and manage trade log
            records.
          </p>

          <p className="mt-6 text-sm font-semibold text-emerald-300">
            View Saved Trade Logs →
          </p>
        </button>
      </div>

      <Panel className="p-6">
        <h2 className="text-xl font-bold text-white">Trade Log Workflow</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-4">
            <p className="text-sm font-bold text-cyan-300">1. Build</p>
            <p className="mt-2 text-sm text-slate-400">
              Use Trade Log Builder to create the table structure and choose the
              fields you want to track.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-400/10 bg-[#0F0F1F]/70 p-4">
            <p className="text-sm font-bold text-emerald-300">2. Track</p>
            <p className="mt-2 text-sm text-slate-400">
              Use Saved Trade Logs to open the real trade log and review taken
              trades.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default function TradeLogWorkspace() {
  const [activeView, setActiveView] = useState<TradeLogView>("hub");
  const [selectedLogId, setSelectedLogId] = useState("");
  const [builderEditLogId, setBuilderEditLogId] = useState("");

  function openNewBuilder() {
    setBuilderEditLogId("");
    setActiveView("builder");
  }

  function openSavedLogs() {
    setBuilderEditLogId("");
    setActiveView("saved-logs");
  }

  function openLog(logId: string) {
    setSelectedLogId(logId);
    setBuilderEditLogId("");
    setActiveView("open-log");
  }

  function openHeaderEditor(logId: string) {
    setSelectedLogId(logId);
    setBuilderEditLogId(logId);
    setActiveView("builder");
  }

  if (activeView === "builder") {
    return (
      <TradeLogBuilderWorkspace
        editLogIdFromDashboard={builderEditLogId}
        onBack={() => {
          if (builderEditLogId && selectedLogId) {
            setActiveView("open-log");
            return;
          }

          setActiveView("hub");
        }}
        onSavedLog={(logId) => {
          setSelectedLogId(logId);
          setBuilderEditLogId("");
          setActiveView("open-log");
        }}
      />
    );
  }

  if (activeView === "saved-logs") {
    return (
      <SavedTradeLogsWorkspace
        onBack={() => setActiveView("hub")}
        onCreateNewLog={openNewBuilder}
        onOpenLog={openLog}
      />
    );
  }

  if (activeView === "open-log") {
    return (
      <TradeLogTableWorkspace
        tradeLogIdFromDashboard={selectedLogId}
        onBack={() => setActiveView("saved-logs")}
        onUpdateHeaders={openHeaderEditor}
      />
    );
  }

  return (
    <TradeLogHub
      onOpenBuilder={openNewBuilder}
      onOpenSavedLogs={openSavedLogs}
    />
  );
}
