"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  supabase,
  getUserTradeLogTemplates,
  deleteTradeLogTemplateFromSupabase,
} from "../../lib/supabase";

export default function SavedTradeLogsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");

  useEffect(() => {
    let mounted = true;

    async function loadLogs() {
      if (mounted) {
        setIsLoading(true);
        setMessage("");
      }

      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      if (mounted) {
        setCurrentUser(user);
      }

      if (user) {
        const { error, templates } = await getUserTradeLogTemplates(user.id);

        if (error) {
          if (mounted) {
            setLogs([]);
            setMessage("Error loading trade logs.");
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          setLogs(templates || []);
          setIsLoading(false);
        }

        return;
      }

      const guestLogs =
        JSON.parse(localStorage.getItem("guestTradeLogs")) || [];

      if (mounted) {
        setLogs(guestLogs);
        setIsLoading(false);
      }
    }

    loadLogs();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setCurrentUser(session?.user ?? null);
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
        const guestLogs =
          JSON.parse(localStorage.getItem("guestTradeLogs")) || [];

        const updatedGuestLogs = guestLogs.filter(
          (log) => String(log.id) !== String(logId)
        );

        localStorage.setItem(
          "guestTradeLogs",
          JSON.stringify(updatedGuestLogs)
        );

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
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/trade-log"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Trade Log Builder
          </Link>

          <Link
            href="/journal"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Journal
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="app-page-title text-3xl md:text-4xl">
                  Saved Trade Logs
                </h1>

                <p className="mt-2 text-sm text-gray-700 md:text-base">
                  Open, continue, or delete any saved trade log.
                </p>

                <p className="mt-2 text-sm font-medium text-gray-800">
                  {currentUser
                    ? `Logged in as ${currentUser.email}`
                    : "Viewing guest saved trade logs"}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/connect-platform"
                  className="cursor-pointer rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Connect Trading Platform
                </Link>

                <Link
                  href="/trade-log"
                  className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Create New Trade Log
                </Link>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700">
                Total Logs: {logs.length}
              </p>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-800">
                  Sort by
                </label>

                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name-az">Name A - Z</option>
                  <option value="name-za">Name Z - A</option>
                </select>
              </div>
            </div>

            {message && (
              <p className="mt-4 text-sm font-medium text-gray-800">
                {message}
              </p>
            )}

            {isLoading ? (
              <p className="mt-6 text-sm text-gray-700">Loading...</p>
            ) : sortedLogs.length === 0 ? (
              <p className="mt-6 text-sm text-gray-700">
                No saved trade logs yet.
              </p>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {sortedLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-lg font-semibold text-gray-900">
                      {log.logName || "Untitled Log"}
                    </h2>

                    <p className="mt-2 text-sm text-gray-600">
                      Headers: {Array.isArray(log.headers) ? log.headers.length : 0}
                    </p>

                    <p className="mt-1 text-sm text-gray-600">
                      Created: {formatLogDate(log.createdAt)}
                    </p>

                    <p className="mt-1 text-sm text-gray-600">
                      Updated: {formatLogDate(log.updatedAt || log.createdAt)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/trade-log/${log.id}`}
                        className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                      >
                        Open
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDelete(log.id)}
                        className="cursor-pointer rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
