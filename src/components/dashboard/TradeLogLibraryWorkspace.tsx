"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  deleteTradeLogTemplateFromSupabase,
  getUserTradeLogTemplates,
  supabase,
} from "@/lib/supabase";

type TradeLogLibraryWorkspaceProps = {
  onBack: () => void;
  onCreateNewLog: () => void;
  onOpenManualLog: (logId: string) => void;
  onOpenAutomaticLog: (accountId: string) => void;
};

type ManualLog = {
  id: string;
  logName?: string;
  headers?: unknown[];
  createdAt?: string;
  updatedAt?: string;
};

type Mt5Account = {
  id: string;
  login: string;
  server: string;
  company?: string | null;
  account_name?: string | null;
  currency?: string | null;
  balance?: number | string | null;
  equity?: number | string | null;
  status?: string | null;
  terminal_slot?: string | null;
  last_connected_at?: string | null;
};

type LibraryFilter = "all" | "automatic" | "manual";
type SortOrder = "newest" | "oldest" | "name-az" | "name-za";

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-cyan-400/10 bg-[#111827]/70 shadow-[0_0_40px_rgba(34,211,238,0.06)] ${className}`}>
      {children}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(value: unknown, currency?: string | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "USD"}`;
  }
}

function statusClasses(status?: string | null) {
  if (status === "connected") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "connecting" || status === "disconnecting") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  if (status === "error") return "border-red-400/30 bg-red-400/10 text-red-200";
  return "border-slate-700 bg-slate-900 text-slate-300";
}

export default function TradeLogLibraryWorkspace({
  onBack,
  onCreateNewLog,
  onOpenManualLog,
  onOpenAutomaticLog,
}: TradeLogLibraryWorkspaceProps) {
  const [manualLogs, setManualLogs] = useState<ManualLog[]>([]);
  const [mt5Accounts, setMt5Accounts] = useState<Mt5Account[]>([]);
  const [tradeCounts, setTradeCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [search, setSearch] = useState("");

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) {
        const guestLogs = JSON.parse(localStorage.getItem("guestTradeLogs") || "[]");
        setManualLogs(Array.isArray(guestLogs) ? guestLogs : []);
        setMt5Accounts([]);
        setTradeCounts({});
        return;
      }

      const [manualResult, automaticResponse] = await Promise.all([
        getUserTradeLogTemplates(session.user.id),
        fetch("/api/mt5/trades?accountId=all", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        }),
      ]);

      if (manualResult?.error) {
        setMessage("Manual Trade Logs could not be loaded.");
        setManualLogs([]);
      } else {
        setManualLogs(manualResult?.templates ?? []);
      }

      const automaticResult = await automaticResponse.json();
      if (!automaticResponse.ok || !automaticResult?.success) {
        throw new Error(automaticResult?.message || "Automatic MT5 Trade Logs could not be loaded.");
      }
      setMt5Accounts(automaticResult.accounts ?? []);
      const counts: Record<string, number> = {};
      for (const trade of automaticResult.trades ?? []) {
        const accountId = String(trade.account_id || "");
        if (accountId) counts[accountId] = (counts[accountId] ?? 0) + 1;
      }
      setTradeCounts(counts);
    } catch (error: any) {
      setMessage(error?.message || "Could not load the Trade Log Library.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  async function deleteManualLog(log: ManualLog) {
    if (!window.confirm(`Delete “${log.logName || "Untitled Log"}”? This cannot be undone.`)) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      const nextLogs = manualLogs.filter((item) => String(item.id) !== String(log.id));
      localStorage.setItem("guestTradeLogs", JSON.stringify(nextLogs));
      localStorage.removeItem(`rows-${log.id}`);
      setManualLogs(nextLogs);
      return;
    }
    const result = await deleteTradeLogTemplateFromSupabase(data.session.user.id, log.id);
    if (result?.error) {
      setMessage("Could not delete the manual Trade Log.");
      return;
    }
    setManualLogs((current) => current.filter((item) => String(item.id) !== String(log.id)));
  }

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const automaticItems = mt5Accounts.map((account) => ({
      kind: "automatic" as const,
      id: account.id,
      name: account.account_name || account.company || `MT5 ${account.login}`,
      searchText: `${account.account_name || ""} ${account.company || ""} ${account.login} ${account.server}`.toLowerCase(),
      createdAt: account.last_connected_at || "",
      updatedAt: account.last_connected_at || "",
      account,
    }));
    const manualItems = manualLogs.map((log) => ({
      kind: "manual" as const,
      id: String(log.id),
      name: log.logName || "Untitled Log",
      searchText: String(log.logName || "Untitled Log").toLowerCase(),
      createdAt: log.createdAt || "",
      updatedAt: log.updatedAt || log.createdAt || "",
      log,
    }));
    const visible = [...automaticItems, ...manualItems].filter((item) => {
      if (filter !== "all" && item.kind !== filter) return false;
      return !query || item.searchText.includes(query);
    });
    return visible.sort((left, right) => {
      if (sortOrder === "name-az") return left.name.localeCompare(right.name);
      if (sortOrder === "name-za") return right.name.localeCompare(left.name);
      const leftTime = new Date(sortOrder === "oldest" ? left.createdAt : left.updatedAt).getTime() || 0;
      const rightTime = new Date(sortOrder === "oldest" ? right.createdAt : right.updatedAt).getTime() || 0;
      return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [filter, manualLogs, mt5Accounts, search, sortOrder]);

  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <button type="button" onClick={onBack} className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200">← Back to Trade Log</button>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">EdgeVault Library</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white lg:text-5xl">Trade Log Library</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">Open every saved manual or automatic MT5 Trade Log. Disconnected MT5 accounts remain available here.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onCreateNewLog} className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-black text-black">Create Manual Log</button>
              <button type="button" onClick={() => void loadLibrary()} className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-200">Refresh</button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search account, login, server or log name" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
          <select value={filter} onChange={(event) => setFilter(event.target.value as LibraryFilter)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white">
            <option value="all">All Logs</option>
            <option value="automatic">Automatic MT5</option>
            <option value="manual">Manual</option>
          </select>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name-az">Name A–Z</option>
            <option value="name-za">Name Z–A</option>
          </select>
        </div>
        <p className="mt-4 text-sm text-slate-400">{items.length} saved {items.length === 1 ? "Trade Log" : "Trade Logs"}</p>
        {message ? <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">{message}</p> : null}

        {isLoading ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">Loading Trade Log Library...</p>
        ) : items.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">No saved Trade Logs match this view.</p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => item.kind === "automatic" ? (
              <div key={`automatic:${item.id}`} className="rounded-xl border border-emerald-400/15 bg-slate-950/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">Automatic MT5</span>
                    <h2 className="mt-2 text-lg font-black text-white">{item.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">Login {item.account.login} · {item.account.server}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClasses(item.account.status)}`}>{item.account.status || "disconnected"}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-500">Trades</p><p className="mt-1 font-bold text-white">{tradeCounts[item.account.id] ?? 0}</p></div>
                  <div><p className="text-xs text-slate-500">VPS Slot</p><p className="mt-1 font-bold text-white">{item.account.terminal_slot || "Saved offline"}</p></div>
                  <div><p className="text-xs text-slate-500">Balance</p><p className="mt-1 font-bold text-white">{formatMoney(item.account.balance, item.account.currency)}</p></div>
                  <div><p className="text-xs text-slate-500">Equity</p><p className="mt-1 font-bold text-white">{formatMoney(item.account.equity, item.account.currency)}</p></div>
                </div>
                <p className="mt-4 text-xs text-slate-500">Last connected: {formatDate(item.account.last_connected_at)}</p>
                <button type="button" onClick={() => onOpenAutomaticLog(item.account.id)} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-sm font-black text-black">Open Trade Log</button>
              </div>
            ) : (
              <div key={`manual:${item.id}`} className="rounded-xl border border-cyan-400/15 bg-slate-950/70 p-5">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Manual</span>
                <h2 className="mt-2 text-lg font-black text-white">{item.name}</h2>
                <p className="mt-4 text-sm text-slate-400">Headers: {Array.isArray(item.log.headers) ? item.log.headers.length : 0}</p>
                <p className="mt-1 text-xs text-slate-500">Updated: {formatDate(item.log.updatedAt || item.log.createdAt)}</p>
                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={() => onOpenManualLog(item.log.id)} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-sm font-black text-black">Open</button>
                  <button type="button" onClick={() => void deleteManualLog(item.log)} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
