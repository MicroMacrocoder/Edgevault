"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import MT5ConnectWorkspace from "@/components/dashboard/MT5ConnectWorkspace";

type ConnectView = "platforms" | "metatrader" | "mt5";

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
        "rounded-2xl border border-slate-800/90 bg-slate-950/80 shadow-[0_0_35px_rgba(15,23,42,0.55)] " +
        className
      }
    >
      {children}
    </div>
  );
}

function IconBox({
  children,
  tone = "emerald",
}: {
  children: ReactNode;
  tone?: "emerald" | "cyan" | "yellow" | "purple" | "slate";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-400"
      : tone === "cyan"
        ? "bg-cyan-500/15 text-cyan-400"
        : tone === "yellow"
          ? "bg-yellow-500/15 text-yellow-400"
          : tone === "purple"
            ? "bg-purple-500/15 text-purple-400"
            : "bg-slate-800 text-slate-400";

  return (
    <div
      className={
        "flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black " +
        toneClass
      }
    >
      {children}
    </div>
  );
}

function PlatformSelection({
  onOpenMetaTrader,
}: {
  onOpenMetaTrader: () => void;
}) {
  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-400">
            EdgeVault Platform Sync
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Connect Platform
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Choose the trading platform you want to connect to EdgeVault for
            automated trade logging, trade syncing, and future performance
            analytics.
          </p>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <button
          type="button"
          onClick={onOpenMetaTrader}
          className="group rounded-2xl border border-slate-800/90 bg-slate-950/80 p-6 text-left shadow-[0_0_35px_rgba(15,23,42,0.55)] transition hover:border-emerald-500/50 hover:bg-slate-900/80"
        >
          <div className="flex items-start justify-between gap-4">
            <IconBox tone="emerald">MT</IconBox>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 text-slate-500 transition group-hover:border-emerald-500/40 group-hover:text-emerald-400">
              →
            </div>
          </div>

          <h2 className="mt-6 text-2xl font-bold text-white">MetaTrader</h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Connect MT5 now. MT4 support will be added later.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              MT5 Available
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-400">
              MT4 Coming Soon
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              Trade Sync
            </span>
          </div>

          <p className="mt-6 text-sm font-semibold text-emerald-400">
            Open MetaTrader →
          </p>
        </button>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-6 opacity-80 shadow-[0_0_35px_rgba(15,23,42,0.55)]">
          <IconBox tone="slate">+</IconBox>

          <h2 className="mt-6 text-2xl font-bold text-white">
            Other Platforms
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            More platform connections will be added later, including broker
            imports, CSV uploads, and direct account integrations.
          </p>

          <p className="mt-6 text-sm font-semibold text-slate-500">
            Coming soon
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-5">
          <IconBox tone="cyan">S</IconBox>

          <h3 className="mt-5 text-lg font-bold text-white">Live Sync Ready</h3>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Prepare your account for future automated syncing from connected
            platforms.
          </p>
        </Panel>

        <Panel className="p-5">
          <IconBox tone="emerald">DB</IconBox>

          <h3 className="mt-5 text-lg font-bold text-white">
            Central Trade Storage
          </h3>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Synced trades will eventually feed your journal, trade log,
            dashboard metrics, and analytics.
          </p>
        </Panel>

        <Panel className="p-5">
          <IconBox tone="yellow">✓</IconBox>

          <h3 className="mt-5 text-lg font-bold text-white">
            Controlled Access
          </h3>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The connector workflow will be handled safely so your trading data
            stays tied to your authenticated EdgeVault account.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function MetaTraderSelection({
  onBack,
  onOpenMT5,
}: {
  onBack: () => void;
  onOpenMT5: () => void;
}) {
  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative">
          <button
            type="button"
            onClick={onBack}
            className="mb-5 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
          >
            ← Back to Platform Selection
          </button>

          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-400">
            MetaTrader
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Choose MetaTrader Version
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Choose the MetaTrader version you want to connect to your trading
            journal. MT5 is available now. MT4 will be supported later.
          </p>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <button
          type="button"
          onClick={onOpenMT5}
          className="group rounded-2xl border border-slate-800/90 bg-slate-950/80 p-6 text-left shadow-[0_0_35px_rgba(15,23,42,0.55)] transition hover:border-emerald-500/50 hover:bg-slate-900/80"
        >
          <div className="flex items-start justify-between gap-4">
            <IconBox tone="emerald">5</IconBox>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 text-slate-500 transition group-hover:border-emerald-500/40 group-hover:text-emerald-400">
              →
            </div>
          </div>

          <h2 className="mt-6 text-2xl font-bold text-white">
            MetaTrader 5 (MT5)
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Connect your MT5 account for automatic trade logging, live trade
            syncing, and performance tracking.
          </p>

          <p className="mt-6 text-sm font-semibold text-emerald-400">
            Connect MT5 →
          </p>
        </button>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-6 opacity-70 shadow-[0_0_35px_rgba(15,23,42,0.55)]">
          <IconBox tone="slate">4</IconBox>

          <h2 className="mt-6 text-2xl font-bold text-white">
            MetaTrader 4 (MT4)
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            MT4 connector will be supported later.
          </p>

          <p className="mt-6 text-sm font-semibold text-slate-500">
            Coming soon
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ConnectPlatformWorkspace({
  onOpenTradeLog,
}: {
  onOpenTradeLog?: (accountId: string) => void;
}) {
  const [activeView, setActiveView] = useState<ConnectView>("platforms");

  if (activeView === "mt5") {
    return (
      <MT5ConnectWorkspace
        onBack={() => setActiveView("metatrader")}
        onOpenTradeLog={onOpenTradeLog}
      />
    );
  }

  if (activeView === "metatrader") {
    return (
      <MetaTraderSelection
        onBack={() => setActiveView("platforms")}
        onOpenMT5={() => setActiveView("mt5")}
      />
    );
  }

  return <PlatformSelection onOpenMetaTrader={() => setActiveView("metatrader")} />;
}
