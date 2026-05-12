"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  supabase,
  getUserTradeLogTemplates,
  saveTradeLogTemplateToSupabase,
} from "@/lib/supabase";

type MT5ConnectWorkspaceProps = {
  onBack?: () => void;
};

type TradeLogTemplate = {
  id: string;
  logName?: string;
  headers?: unknown[];
};

type CurrentUser = {
  id: string;
} | null;

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

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
      {children}
    </label>
  );
}

export default function MT5ConnectWorkspace({
  onBack,
}: MT5ConnectWorkspaceProps) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [tradeLogs, setTradeLogs] = useState<TradeLogTemplate[]>([]);
  const [selectedTradeLogId, setSelectedTradeLogId] = useState("");
  const [appOrigin, setAppOrigin] = useState("");
  const [message, setMessage] = useState("");
  const [isCreatingTradeLog, setIsCreatingTradeLog] = useState(false);
  const [isPreparingConnector, setIsPreparingConnector] = useState(false);

  const mt5DefaultHeaders = [
    { id: "sn", name: "S/N", group: "Basic" },
    { id: "symbol", name: "Symbol", group: "Trade" },
    { id: "direction", name: "Direction", group: "Trade" },
    { id: "volume", name: "Volume", group: "Trade" },
    { id: "entry-time", name: "Entry Time", group: "Entry" },
    { id: "entry-price", name: "Entry Price", group: "Entry" },
    { id: "stop-loss", name: "Stop Loss", group: "Risk" },
    { id: "take-profit", name: "Take Profit", group: "Risk" },
    { id: "exit-time", name: "Exit Time", group: "Exit" },
    { id: "exit-price", name: "Exit Price", group: "Exit" },
    { id: "profit-loss-amount", name: "Profit/Loss Amount", group: "Result" },
    { id: "live-price", name: "Live Price", group: "Live" },
    { id: "floating-pl", name: "Floating P/L", group: "Live" },
    { id: "swap", name: "Swap", group: "Cost" },
    { id: "commission", name: "Commission", group: "Cost" },
    { id: "trade-comment", name: "Trade Comment", group: "Notes" },
    { id: "sl-tp-source", name: "SL/TP Source", group: "System" },
  ];

  useEffect(() => {
    async function loadPageData() {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      setCurrentUser(user ? { id: user.id } : null);

      if (typeof window !== "undefined") {
        setAppOrigin(window.location.origin);
      }

      if (!user) {
        return;
      }

      await loadTradeLogs(user.id);
    }

    loadPageData();
  }, []);

  async function loadTradeLogs(userId: string) {
    const { templates } = await getUserTradeLogTemplates(userId);
    const safeTemplates = (templates || []) as TradeLogTemplate[];

    setTradeLogs(safeTemplates);

    if (safeTemplates.length > 0) {
      setSelectedTradeLogId(safeTemplates[0].id);
    } else {
      setSelectedTradeLogId("");
    }
  }

  async function handleCreateMt5TradeLog() {
    setIsCreatingTradeLog(true);
    setMessage("");

    try {
      if (!currentUser?.id) {
        setMessage("You need to log in before creating an MT5 trade log.");
        return;
      }

      const newTradeLogId = `mt5-log-${Date.now()}`;

      const newTradeLog = {
        id: newTradeLogId,
        logName: "MT5 Auto Sync Log",
        headers: mt5DefaultHeaders,
      };

      const result = await saveTradeLogTemplateToSupabase(
        currentUser.id,
        newTradeLog
      );

      if (result?.error) {
        setMessage("Could not create MT5 trade log.");
        return;
      }

      await loadTradeLogs(currentUser.id);
      setSelectedTradeLogId(newTradeLogId);

      setMessage("MT5 trade log created. Now prepare the connector.");
    } catch (error) {
      console.log("CREATE MT5 TRADE LOG ERROR:", error);
      setMessage("Error creating MT5 trade log.");
    } finally {
      setIsCreatingTradeLog(false);
    }
  }

  async function handlePrepareConnectorAutomatically() {
    setIsPreparingConnector(true);
    setMessage("");

    try {
      if (!currentUser?.id) {
        setMessage("You need to log in before preparing the connector.");
        return;
      }

      if (!selectedTradeLogId) {
        setMessage("Create or select an MT5 trade log first.");
        return;
      }

      if (!appOrigin) {
        setMessage("App origin is not ready yet. Refresh and try again.");
        return;
      }

      const configResponse = await fetch("/api/mt5/get-connector-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser.id,
          tradeLogId: selectedTradeLogId,
          appOrigin,
        }),
      });

      const configData = await configResponse.json();

      if (!configData?.success) {
        setMessage(configData?.message || "Could not prepare connector config.");
        return;
      }

      const setupResponse = await fetch("http://127.0.0.1:5001/setup-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser.id,
          tradeLogId: selectedTradeLogId,
          appOrigin,
          syncUrl: configData.syncUrl,
          connectorToken: configData.connectorToken,
          tradeLogUrl: configData.tradeLogUrl,
        }),
      });

      const setupData = await setupResponse.json();

      if (!setupData?.success) {
        setMessage(setupData?.message || "Connector setup failed.");
        return;
      }

      setMessage(
        "Connector prepared successfully. Open the connector, enter only MT5 login/server/password, then sync."
      );
    } catch (error) {
      console.log("PREPARE CONNECTOR ERROR:", error);
      setMessage(
        "Could not reach the local connector. Open MT5Connector.exe first, then click Prepare Connector Automatically."
      );
    } finally {
      setIsPreparingConnector(false);
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-5 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
            >
              ← Back to Platform Selection
            </button>
          ) : null}

          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-400">
            MetaTrader 5 Connector
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Connect MT5
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Download/open the MT5 connector, create or select an MT5-ready trade
            log, prepare the connector automatically, then enter only your MT5
            login details inside the connector.
          </p>

          {!currentUser ? (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-300">
                You need to log in before connecting MT5.
              </p>
            </div>
          ) : null}

          {message ? (
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/80 p-4">
              <p className="text-sm font-medium text-slate-200">{message}</p>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-lg font-black text-emerald-400">
            1
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">
              Step 1: Download/Open Connector
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Open the connector app on the same laptop where MT5 is installed.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/mt5-connector/MT5Connector.exe"
                download
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400"
              >
                Download MT5 Connector
              </a>

              <a
                href="http://127.0.0.1:5001"
                target="_blank"
                className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                Open Connector
              </a>
            </div>

            <div className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-sm font-semibold text-yellow-300">
                Important Download Instructions:
              </p>

              <p className="mt-2 text-sm text-yellow-200">
                After downloading, open File Explorer and go to your Downloads
                folder.
              </p>

              <p className="mt-2 text-sm text-yellow-200">
                Locate the downloaded MT5 connector file.
              </p>

              <p className="mt-2 text-sm text-yellow-200">
                If the file ends with{" "}
                <span className="font-semibold">.crdownload</span>, rename it
                to:
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-yellow-500/30 bg-slate-950 px-4 py-3">
                <code className="text-sm font-semibold text-white">
                  MT5Connector.exe
                </code>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("MT5Connector.exe");
                  }}
                  className="rounded-md bg-yellow-400 px-3 py-1 text-xs font-bold text-black hover:bg-yellow-300"
                >
                  Copy
                </button>
              </div>

              <p className="mt-3 text-sm text-yellow-200">
                After renaming, double-click the file to open the connector.
              </p>

              <p className="mt-2 text-sm text-yellow-200">
                If Open Connector says the page cannot be reached, open
                MT5Connector.exe first.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-lg font-black text-cyan-400">
            2
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">
              Step 2: Choose Trade Log
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Select an existing trade log or create a new MT5 auto-sync trade
              log.
            </p>

            <div className="mt-5">
              <FieldLabel>Trade Log</FieldLabel>
              <select
                value={selectedTradeLogId}
                onChange={(event) => setSelectedTradeLogId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              >
                {tradeLogs.length === 0 ? (
                  <option value="">No trade logs found</option>
                ) : (
                  tradeLogs.map((tradeLog) => (
                    <option key={tradeLog.id} value={tradeLog.id}>
                      {(tradeLog.logName || "Untitled Trade Log") +
                        " — " +
                        tradeLog.id}
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={handleCreateMt5TradeLog}
              disabled={isCreatingTradeLog || !currentUser}
              className="mt-5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingTradeLog
                ? "Creating MT5 Trade Log..."
                : "Create MT5 Trade Log"}
            </button>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-lg font-black text-purple-400">
            3
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">
              Step 3: Prepare Connector Automatically
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              After the connector app is open, click this button. The connector
              will be prepared without you copying any Trade Log ID.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePrepareConnectorAutomatically}
                disabled={
                  isPreparingConnector || !currentUser || !selectedTradeLogId
                }
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPreparingConnector
                  ? "Preparing Connector..."
                  : "Prepare Connector Automatically"}
              </button>

              <a
                href="http://127.0.0.1:5001"
                target="_blank"
                className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                Open Connector
              </a>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15 text-lg font-black text-yellow-400">
            4
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">
              Step 4: Start Sync
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              In the connector page, enter only your MT5 login, server, and
              password. Then click Sync Once Now or Start Auto Sync.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
