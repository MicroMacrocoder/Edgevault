"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { MT5_BROKERS, type Mt5AccountType } from "@/lib/mt5ServerCatalog";

type MT5ConnectWorkspaceProps = {
  onBack?: () => void;
  onOpenTradeLog?: (accountId: string) => void;
};

type Mt5Account = {
  id: string;
  login: string;
  server: string;
  company?: string | null;
  account_name?: string | null;
  currency?: string | null;
  balance?: number | null;
  equity?: number | null;
  trade_allowed?: boolean | null;
  status: "connecting" | "connected" | "disconnecting" | "disconnected" | "error" | string;
  status_message?: string | null;
  last_error?: string | null;
  terminal_slot?: string | null;
  worker_id?: string | null;
  pending_deletion?: boolean | null;
  last_connected_at?: string | null;
  disconnected_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AccountLimits = {
  active: number;
  maximumActive: number;
  remaining: number;
};

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800/90 bg-slate-950/80 shadow-[0_0_35px_rgba(15,23,42,0.55)] ${className}`}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{children}</label>;
}

function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)}${currency ? ` ${currency}` : ""}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isActiveStatus(status: string) {
  return ["connecting", "connected", "disconnecting"].includes(status);
}

function statusLabel(status: string) {
  if (status === "connected") return "Connected";
  if (status === "connecting") return "Connecting";
  if (status === "disconnecting") return "Disconnecting";
  if (status === "error") return "Connection error";
  return "Disconnected";
}

function statusTone(status: string) {
  if (status === "connected") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "error") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "connecting" || status === "disconnecting") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-300";
}

export default function MT5ConnectWorkspace({ onBack, onOpenTradeLog }: MT5ConnectWorkspaceProps) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accounts, setAccounts] = useState<Mt5Account[]>([]);
  const [limits, setLimits] = useState<AccountLimits>({ active: 0, maximumActive: 3, remaining: 3 });
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [actionAccountId, setActionAccountId] = useState("");
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [accountType, setAccountType] = useState<Mt5AccountType | "">("");
  const [brokerId, setBrokerId] = useState("");
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const availableBrokers = useMemo(
    () => MT5_BROKERS.filter((broker) => broker.accountType === accountType),
    [accountType],
  );
  const selectedBroker = useMemo(
    () => MT5_BROKERS.find((broker) => broker.id === brokerId) ?? null,
    [brokerId],
  );
  const activeLimitReached = limits.active >= limits.maximumActive;

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? "";
  }, []);

  const loadAccounts = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setIsSignedIn(false);
      setAccounts([]);
      setLoadingAccounts(false);
      return;
    }
    setIsSignedIn(true);
    const response = await fetch("/api/mt5/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Could not load saved MT5 accounts.");
    }
    setAccounts(result.accounts ?? []);
    setLimits(result.limits ?? { active: 0, maximumActive: 3, remaining: 3 });
    setLoadingAccounts(false);
  }, [getAccessToken]);

  useEffect(() => {
    loadAccounts().catch((error) => {
      setMessage(error?.message || "Could not load saved MT5 accounts.");
      setLoadingAccounts(false);
    });
  }, [loadAccounts]);

  useEffect(() => {
    if (!isSignedIn) return;
    const interval = window.setInterval(() => loadAccounts().catch(() => undefined), 5000);
    return () => window.clearInterval(interval);
  }, [isSignedIn, loadAccounts]);

  async function handleConnectNewAccount() {
    setMessage("");
    if (!accountType || !brokerId || !login.trim() || !server || !password) {
      setMessage("Select the account type, company and server, then enter your MT5 login and investor password.");
      return;
    }
    if (activeLimitReached) {
      setMessage("You already have three active or connecting accounts. Disconnect one before connecting another.");
      return;
    }

    setIsSubmitting(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Log in before connecting MT5.");
      const response = await fetch("/api/mt5/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ accountType, broker: brokerId, login: login.trim(), server: server.trim(), password }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || "Could not connect MT5.");

      setPassword("");
      setLogin("");
      setServer("");
      setBrokerId("");
      setAccountType("");
      setShowConnectionForm(false);
      setMessage(result.message || "MT5 account queued for connection.");
      await loadAccounts();
    } catch (error: any) {
      setMessage(error?.message || "Could not connect MT5.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConnectionSwitch(account: Mt5Account) {
    const shouldConnect = !isActiveStatus(account.status);
    if (shouldConnect && activeLimitReached) {
      setMessage("You already have three active or connecting accounts. Disconnect one before connecting this account.");
      return;
    }

    if (!shouldConnect) {
      const confirmed = window.confirm(
        `Disconnect MT5 login ${account.login}?\n\nIts VPS slot will be released, but its saved account and complete Trade Log will remain available.`,
      );
      if (!confirmed) return;
    }

    setActionAccountId(account.id);
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Log in to manage MT5 accounts.");
      const response = await fetch("/api/mt5/accounts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          accountId: account.id,
          connected: shouldConnect,
          confirmation: shouldConnect ? undefined : "disconnect-account",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || "Could not update this account.");
      setMessage(result.message || "MT5 account updated.");
      await loadAccounts();
    } catch (error: any) {
      setMessage(error?.message || "Could not update this account.");
    } finally {
      setActionAccountId("");
    }
  }

  async function handleRemoveAccount(account: Mt5Account) {
    const confirmed = window.confirm(
      `Permanently remove MT5 login ${account.login}?\n\nThis deletes its imported trades, Trade Log details, notes and screenshots. This cannot be undone.`,
    );
    if (!confirmed) return;

    setActionAccountId(account.id);
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Log in to manage MT5 accounts.");
      const response = await fetch("/api/mt5/accounts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ accountId: account.id }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Could not remove this account.");
      }
      setMessage(result.message || "MT5 account removal started.");
      await loadAccounts();
    } catch (error: any) {
      setMessage(error?.message || "Could not remove this account.");
    } finally {
      setActionAccountId("");
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative">
          {onBack ? (
            <button type="button" onClick={onBack} className="mb-5 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300">
              ← Back to Platform Selection
            </button>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-400">Hosted MetaTrader 5</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">Saved MT5 Accounts</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Keep every account and its Trade Log in EdgeVault. Up to three of your saved accounts can synchronize simultaneously; disconnecting an account frees its VPS slot without deleting its history.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">
              {limits.active} / {limits.maximumActive} active
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300">
              {accounts.length} saved {accounts.length === 1 ? "account" : "accounts"}
            </span>
            <button type="button" onClick={() => setShowConnectionForm((current) => !current)} disabled={!isSignedIn || activeLimitReached} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              {showConnectionForm ? "Close form" : "+ Connect another account"}
            </button>
          </div>

          {activeLimitReached ? <p className="mt-3 text-xs text-amber-300">Your three active-account slots are occupied. Disconnect one to connect a different saved or new account.</p> : null}
          {!isSignedIn ? <p className="mt-4 text-sm font-semibold text-red-300">Log in to manage MT5 accounts.</p> : null}
          {message ? <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm font-medium text-slate-200">{message}</div> : null}
        </div>
      </Panel>

      {showConnectionForm ? (
        <Panel className="p-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-white">Connect another MT5 account</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Use only the investor/read-only password. After its first connection, this account stays saved and can be reconnected with its switch.</p>
            <div className="mt-6 space-y-5">
              <div>
                <FieldLabel>Account Type</FieldLabel>
                <select value={accountType} onChange={(event) => { setAccountType(event.target.value as Mt5AccountType | ""); setBrokerId(""); setServer(""); }} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400">
                  <option value="">Select account type</option>
                  <option value="broker">Broker</option>
                  <option value="prop_firm">Prop Firm</option>
                </select>
              </div>
              <div>
                <FieldLabel>{accountType === "prop_firm" ? "Prop Firm" : "Broker"}</FieldLabel>
                <select value={brokerId} onChange={(event) => { setBrokerId(event.target.value); setServer(""); }} disabled={!accountType} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400 disabled:opacity-50">
                  <option value="">{accountType ? "Select company" : "Select account type first"}</option>
                  {availableBrokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>MT5 Server</FieldLabel>
                <select value={server} onChange={(event) => setServer(event.target.value)} disabled={!selectedBroker} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400 disabled:opacity-50">
                  <option value="">{selectedBroker ? "Select server" : "Select company first"}</option>
                  {selectedBroker?.servers.map((serverName) => <option key={serverName} value={serverName}>{serverName}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>MT5 Login</FieldLabel>
                <input value={login} onChange={(event) => setLogin(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="e.g. 12345678" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400" />
              </div>
              <div>
                <FieldLabel>Read-only / Investor Password</FieldLabel>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Investor password" onKeyDown={(event) => { if (event.key === "Enter" && !isSubmitting) void handleConnectNewAccount(); }} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400" />
              </div>
            </div>
            <button type="button" onClick={() => void handleConnectNewAccount()} disabled={!isSignedIn || isSubmitting || activeLimitReached} className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "Connecting MT5..." : "Save and connect"}
            </button>
          </div>
        </Panel>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white">Account library</h2>
            <p className="mt-1 text-sm text-slate-400">Disconnected accounts and their Trade Logs remain available here.</p>
          </div>
          <button type="button" onClick={() => void loadAccounts()} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:border-cyan-400 hover:text-cyan-300">Refresh</button>
        </div>

        {loadingAccounts ? (
          <Panel className="p-8 text-center text-sm text-slate-500">Loading saved MT5 accounts...</Panel>
        ) : accounts.length === 0 ? (
          <Panel className="p-8 text-center">
            <p className="font-bold text-white">No saved MT5 accounts yet</p>
            <p className="mt-2 text-sm text-slate-500">Connect your first account to create its automatic Trade Log.</p>
          </Panel>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {accounts.map((account) => {
              const active = isActiveStatus(account.status);
              const changing = actionAccountId === account.id || account.status === "connecting" || account.status === "disconnecting";
              const connectDisabled = changing || (!active && activeLimitReached);
              return (
                <Panel key={account.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-white">{account.account_name || account.company || account.server}</p>
                      <p className="mt-1 text-xs text-slate-500">Login {account.login} · {account.server}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${statusTone(account.status)}`}>{account.pending_deletion ? "Removing" : statusLabel(account.status)}</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Balance</p>
                      <p className="mt-2 text-sm font-bold text-white">{formatMoney(account.balance, account.currency)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Equity</p>
                      <p className="mt-2 text-sm font-bold text-white">{formatMoney(account.equity, account.currency)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">VPS Slot</p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {account.status === "connecting"
                          ? "Pending assignment"
                          : account.terminal_slot || "Not assigned"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-slate-500">Last connected: {formatDate(account.last_connected_at)}</p>
                  {account.status_message || account.last_error ? <p className={`mt-2 text-xs ${account.last_error ? "text-red-300" : "text-slate-400"}`}>{account.last_error || account.status_message}</p> : null}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => onOpenTradeLog?.(account.id)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-200 hover:border-cyan-400">Open Trade Log</button>
                      <button type="button" disabled={actionAccountId === account.id || account.pending_deletion === true} onClick={() => void handleRemoveAccount(account)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-200 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50">Remove Account</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-400">
                        {changing ? (account.status === "disconnecting" ? "Disconnecting..." : "Connecting...") : active ? "Connected" : "Disconnected"}
                      </span>
                      <button type="button" role="switch" aria-checked={active} aria-label={`${active ? "Disconnect" : "Connect"} MT5 login ${account.login}`} disabled={connectDisabled} onClick={() => void handleConnectionSwitch(account)} className={`relative h-7 w-12 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-emerald-400 bg-emerald-500/30" : "border-slate-700 bg-slate-900"}`}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full transition ${active ? "left-6 bg-emerald-300" : "left-1 bg-slate-500"}`} />
                      </button>
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
