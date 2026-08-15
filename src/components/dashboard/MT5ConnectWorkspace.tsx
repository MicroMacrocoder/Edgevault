"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type MT5ConnectWorkspaceProps = {
  onBack?: () => void;
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
  status: "connecting" | "connected" | "error" | string;
  status_message?: string | null;
  last_error?: string | null;
  last_connected_at?: string | null;
};

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

function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

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

export default function MT5ConnectWorkspace({
  onBack,
}: MT5ConnectWorkspaceProps) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState<Mt5Account | null>(null);
  const [activeAccountId, setActiveAccountId] = useState("");

  const isConnecting = account?.status === "connecting" || isSubmitting;
  const isConnected = account?.status === "connected";

  const statusTone = useMemo(() => {
    if (isConnected) {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    }

    if (account?.status === "error") {
      return "border-red-500/30 bg-red-500/10 text-red-200";
    }

    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  }, [account?.status, isConnected]);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? "";
  }, []);

  const loadStatus = useCallback(
    async (accountId?: string) => {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setIsSignedIn(false);
        return null;
      }

      setIsSignedIn(true);

      const query = accountId
        ? `?accountId=${encodeURIComponent(accountId)}`
        : "";

      const response = await fetch(`/api/mt5/status${query}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Could not read MT5 status.");
      }

      const nextAccount = (data?.account ?? null) as Mt5Account | null;
      setAccount(nextAccount);

      if (nextAccount?.id) {
        setActiveAccountId(nextAccount.id);
      }

      return nextAccount;
    },
    [getAccessToken],
  );

  useEffect(() => {
    loadStatus().catch((error) => {
      console.log("LOAD MT5 STATUS ERROR:", error);
    });
  }, [loadStatus]);

  useEffect(() => {
    if (!activeAccountId || account?.status !== "connecting") {
      return;
    }

    const interval = window.setInterval(() => {
      loadStatus(activeAccountId).catch((error) => {
        console.log("POLL MT5 STATUS ERROR:", error);
      });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [account?.status, activeAccountId, loadStatus]);

  async function handleConnect() {
    setMessage("");

    if (!login.trim() || !server.trim() || !password) {
      setMessage("Enter your MT5 login, exact server, and investor password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setIsSignedIn(false);
        setMessage("You need to log in before connecting MT5.");
        return;
      }

      setIsSignedIn(true);

      const response = await fetch("/api/mt5/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          login: login.trim(),
          server: server.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setMessage(data?.message || "Could not start the MT5 connection.");
        return;
      }

      setPassword("");
      setActiveAccountId(data.accountId);
      setAccount({
        id: data.accountId,
        login: login.trim(),
        server: server.trim(),
        status: "connecting",
        status_message: data.message,
      });
      setMessage(data.message || "Connecting to MT5...");
    } catch (error: any) {
      console.log("HOSTED MT5 CONNECT ERROR:", error);
      setMessage(error?.message || "Could not connect MT5.");
    } finally {
      setIsSubmitting(false);
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
            Hosted MetaTrader 5
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Connect MT5
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Enter your MT5 account details below. EdgeVault handles the MT5
            connection in the background. No connector, MT5 installation, VPS,
            or broker/company selection is required on your device.
          </p>

          {!isSignedIn ? (
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
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-white">MT5 account details</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Use the exact server name shown by your broker. Only use your
            read-only / investor password.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <FieldLabel>MT5 Login</FieldLabel>
              <input
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 12345678"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>

            <div>
              <FieldLabel>Exact MT5 Server</FieldLabel>
              <input
                value={server}
                onChange={(event) => setServer(event.target.value)}
                autoComplete="off"
                placeholder="e.g. Broker-MT5Real"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>

            <div>
              <FieldLabel>Read-only / Investor Password</FieldLabel>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Investor password"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !isConnecting) {
                    handleConnect();
                  }
                }}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={!isSignedIn || isConnecting}
            className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnecting ? "Connecting MT5..." : "Connect"}
          </button>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            EdgeVault does not ask for your master/trading password. Use only
            investor/read-only access.
          </p>
        </div>
      </Panel>

      {account ? (
        <Panel className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Connection status
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {account.company || account.server || "MT5 account"}
              </h2>
            </div>

            <div className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] ${statusTone}`}>
              {account.status === "connected"
                ? "Connected"
                : account.status === "error"
                  ? "Connection failed"
                  : "Connecting"}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Login</p>
              <p className="mt-2 font-semibold text-white">{account.login}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Server</p>
              <p className="mt-2 break-words font-semibold text-white">{account.server}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Balance</p>
              <p className="mt-2 font-semibold text-white">{formatMoney(account.balance, account.currency)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Equity</p>
              <p className="mt-2 font-semibold text-white">{formatMoney(account.equity, account.currency)}</p>
            </div>
          </div>

          {account.status_message || account.last_error ? (
            <p className="mt-4 text-sm text-slate-400">
              {account.last_error || account.status_message}
            </p>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
