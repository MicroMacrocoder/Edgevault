// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  supabase,
  getUserTradeLogTemplates,
  deleteTradeLogTemplateFromSupabase,
} from "@/lib/supabase";

type SavedTradeLogsWorkspaceProps = {
  onBack?: () => void;
  onCreateNewLog?: () => void;
  onOpenLog?: (logId: string) => void;
};

function Panel({ children, className = "" }) {
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

export default function SavedTradeLogsWorkspace({
  onBack,
  onCreateNewLog,
  onOpenLog,
}: SavedTradeLogsWorkspaceProps) {
  const [currentUser, setCurrentUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");

  async function loadLogs() {
    setIsLoading(true);
    setMessage("");

    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user ?? null;

    setCurrentUser(user);

    if (user) {
      const { error, templates } = await getUserTradeLogTemplates(user.id);

      if (error) {
        setLogs([]);
        setMessage("Error loading trade logs.");
        setIsLoading(false);
        return;
      }

      setLogs(templates || []);
      setIsLoading(false);
      return;
    }

    const guestLogs = JSON.parse(localStorage.getItem("guestTradeLogs") || "[]");

    setLogs(guestLogs);
    setIsLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    async function loadInitialLogs() {
      if (!mounted) {
        return;
      }

      await loadLogs();
    }

    loadInitialLogs();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setCurrentUser(session?.user ?? null);
        loadLogs();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleDelete(logId) {
    try {
      if (!currentUser) {
        const guestLogs = JSON.parse(
          localStorage.getItem("guestTradeLogs") || "[]"
        );

        const updatedGuestLogs = guestLogs.filter(
          (log) => String(log.id) !== String(logId)
        );

        localStorage.setItem("guestTradeLogs", JSON.stringify(updatedGuestLogs));
        localStorage.removeItem(`rows-${logId}`);

        setLogs(updatedGuestLogs);
        setMessage("Deleted successfully.");
        return;
      }

      const result = await deleteTradeLogTemplateFromSupabase(
        currentUser.id,
        logId
      );

      if (result?.error) {
        setMessage("Error deleting log.");
        return;
      }

      setLogs((previousLogs) =>
        previousLogs.filter((log) => String(log.id) !== String(logId))
      );

      setMessage("Deleted successfully.");
    } catch (error) {
      console.log("DELETE SAVED TRADE LOG ERROR:", error);
      setMessage("Something went wrong.");
    }
  }

  function formatLogDate(dateValue) {
    if (!dateValue) {
      return "Unknown date";
    }

    const parsedDate = new Date(dateValue);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Unknown date";
    }

    return parsedDate.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const sortedLogs = useMemo(() => {
    const logsCopy = [...logs];

    if (sortOrder === "newest") {
      return logsCopy.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    }

    if (sortOrder === "oldest") {
      return logsCopy.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return aTime - bTime;
      });
    }

    if (sortOrder === "name-az") {
      return logsCopy.sort((a, b) =>
        String(a.logName || "").localeCompare(String(b.logName || ""))
      );
    }

    if (sortOrder === "name-za") {
      return logsCopy.sort((a, b) =>
        String(b.logName || "").localeCompare(String(a.logName || ""))
      );
    }

    return logsCopy;
  }, [logs, sortOrder]);

  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-5 rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/80 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
            >
              ← Back to Trade Log Hub
            </button>
          ) : null}

          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
            EdgeVault Saved Trade Logs
          </p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white lg:text-5xl">
                Saved Trade Logs
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
                Open, continue, or delete any saved trade log inside the
                dashboard.
              </p>

              <p className="mt-5 text-sm font-medium text-slate-300">
                {currentUser
                  ? `Logged in as ${currentUser.email}`
                  : "Viewing guest saved trade logs"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onCreateNewLog}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-bold text-black transition hover:opacity-90"
              >
                Create New Trade Log
              </button>

              <button
                type="button"
                onClick={loadLogs}
                className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-300">
            Total Logs: {logs.length}
          </p>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Sort by
            </label>

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="rounded-xl border border-slate-700 bg-[#0F0F1F] px-4 py-2 text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-az">Name A - Z</option>
              <option value="name-za">Name Z - A</option>
            </select>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 px-4 py-3 text-sm font-medium text-slate-300">
            {message}
          </p>
        ) : null}

        {isLoading ? (
          <div className="mt-6 rounded-xl border border-dashed border-cyan-400/20 bg-[#0F0F1F]/70 px-6 py-10 text-center">
            <h3 className="text-xl font-bold text-white">Loading...</h3>
            <p className="mt-2 text-sm text-slate-400">
              Please wait while your saved trade logs are loading.
            </p>
          </div>
        ) : sortedLogs.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-cyan-400/20 bg-[#0F0F1F]/70 px-6 py-10 text-center">
            <h3 className="text-xl font-bold text-white">
              No Saved Trade Logs Yet
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Create your first trade log from the builder.
            </p>

            <button
              type="button"
              onClick={onCreateNewLog}
              className="mt-5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-bold text-black transition hover:opacity-90"
            >
              Create Trade Log
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {sortedLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-cyan-400/10 bg-[#0F0F1F]/70 p-5 transition hover:border-cyan-400/40 hover:bg-[#111827] hover:shadow-[0_0_35px_rgba(34,211,238,0.10)]"
              >
                <h2 className="text-lg font-bold text-white">
                  {log.logName || "Untitled Log"}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Headers: {Array.isArray(log.headers) ? log.headers.length : 0}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Created: {formatLogDate(log.createdAt)}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Updated: {formatLogDate(log.updatedAt || log.createdAt)}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenLog?.(log.id)}
                    className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-bold text-black transition hover:opacity-90"
                  >
                    Open
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(log.id)}
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
