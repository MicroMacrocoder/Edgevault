"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  supabase,
  getUserTradeLogTemplates,
  saveTradeLogTemplateToSupabase,
} from "../../../../lib/supabase";

export default function MT5ConnectPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tradeLogs, setTradeLogs] = useState([]);
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

      setCurrentUser(user);

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

  async function loadTradeLogs(userId) {
    const { templates } = await getUserTradeLogTemplates(userId);
    setTradeLogs(templates || []);

    if (templates?.length > 0) {
      setSelectedTradeLogId(templates[0].id);
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
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/connect-platform"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Platforms
          </Link>

          <Link
            href="/connect-platform/metatrader"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            MetaTrader
          </Link>

          <Link
            href="/saved-trade-logs"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Saved Trade Logs
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="app-page-title text-3xl md:text-4xl">
              Connect MT5
            </h1>

            <p className="mt-3 text-sm text-gray-700 md:text-base">
              Download/open the MT5 connector, create or select an MT5-ready
              trade log, prepare the connector automatically, then enter only
              your MT5 login details inside the connector.
            </p>

            {!currentUser && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-700">
                  You need to log in before connecting MT5.
                </p>
              </div>
            )}

            {message && (
              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-800">{message}</p>
              </div>
            )}
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">
              Step 1: Download/Open Connector
            </h2>

            <p className="mt-2 text-sm text-gray-700">
              Open the connector app on the same laptop where MT5 is installed.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/mt5-connector/MT5Connector.exe"
                download
                className="cursor-pointer rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                Download MT5 Connector
              </a>

              <a
                href="http://127.0.0.1:5001"
                target="_blank"
                className="cursor-pointer rounded-lg border border-blue-300 bg-white px-5 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
              >
                Open Connector
              </a>
            </div>

            <div className="mt-5 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
  <p className="text-sm font-semibold text-yellow-900">
    Important Download Instructions:
  </p>

  <p className="mt-2 text-sm text-yellow-800">
    After downloading, open File Explorer and go to your Downloads folder.
  </p>

  <p className="mt-2 text-sm text-yellow-800">
    Locate the downloaded MT5 connector file.
  </p>

  <p className="mt-2 text-sm text-yellow-800">
    If the file ends with <span className="font-semibold">.crdownload</span>,
    rename it to:
  </p>

  <div className="mt-3 flex items-center gap-3 rounded-lg border border-yellow-300 bg-white px-4 py-3">
    <code className="text-sm font-semibold text-gray-900">
      MT5Connector.exe
    </code>

    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText("MT5Connector.exe");
      }}
      className="rounded-md bg-black px-3 py-1 text-xs text-white hover:opacity-90"
    >
      Copy
    </button>
  </div>

  <p className="mt-3 text-sm text-yellow-800">
    After renaming, double-click the file to open the connector.
  </p>

  <p className="mt-2 text-sm text-yellow-800">
    The connector will start a local server and open automatically.
  </p>

  <p className="mt-2 text-sm text-yellow-800">
    If Open Connector says the page cannot be reached, open
    MT5Connector.exe first.
  </p>
</div>

          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">
              Step 2: Choose Trade Log
            </h2>

            <p className="mt-2 text-sm text-gray-700">
              Select an existing trade log or create a new MT5 auto-sync trade
              log.
            </p>

            <select
              value={selectedTradeLogId}
              onChange={(event) => setSelectedTradeLogId(event.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-black"
            >
              {tradeLogs.length === 0 ? (
                <option value="">No trade logs found</option>
              ) : (
                tradeLogs.map((tradeLog) => (
                  <option key={tradeLog.id} value={tradeLog.id}>
                    {tradeLog.logName || "Untitled Trade Log"} — {tradeLog.id}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={handleCreateMt5TradeLog}
              disabled={isCreatingTradeLog || !currentUser}
              className="mt-5 cursor-pointer rounded-lg border border-blue-300 bg-white px-5 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingTradeLog
                ? "Creating MT5 Trade Log..."
                : "Create MT5 Trade Log"}
            </button>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">
              Step 3: Prepare Connector Automatically
            </h2>

            <p className="mt-2 text-sm text-gray-700">
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
                className="cursor-pointer rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPreparingConnector
                  ? "Preparing Connector..."
                  : "Prepare Connector Automatically"}
              </button>

              <a
                href="http://127.0.0.1:5001"
                target="_blank"
                className="cursor-pointer rounded-lg border border-blue-300 bg-white px-5 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
              >
                Open Connector
              </a>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">Step 4: Start Sync</h2>

            <p className="mt-2 text-sm text-gray-700">
              In the connector page, enter only your MT5 login, server, and
              password. Then click Sync Once Now or Start Auto Sync.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
