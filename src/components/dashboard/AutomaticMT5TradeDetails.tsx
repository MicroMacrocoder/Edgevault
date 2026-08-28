"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateAutomaticMt5HeaderValues,
  type AutomaticMt5Header,
} from "@/lib/automaticMt5TradeLog";
import { deleteChartImage, supabase, uploadChartImage } from "@/lib/supabase";

type ScreenshotValue = { url: string; path: string; name: string };
type CustomValue = string | ScreenshotValue;

export type AutomaticMt5DetailTrade = {
  id: string;
  account_id: string;
  position_identifier: string;
  trade_cycle: number;
  symbol: string;
  status: "open" | "win" | "loss" | "breakeven";
  direction: "buy" | "sell";
  entry_at_utc: string;
  exit_at_utc: string | null;
  entry_broker_time_text: string | null;
  exit_broker_time_text: string | null;
  total_entry_lots: number | string;
  weighted_entry_price: number | string | null;
  weighted_exit_price: number | string | null;
  stop_loss?: number | string | null;
  take_profit?: number | string | null;
  trade_comment?: string | null;
  net_profit: number | string;
  pl_percentage: number | string | null;
  commission?: number | string | null;
  swap?: number | string | null;
  fees?: number | string | null;
  entry_deal_tickets?: string[];
  exit_deal_tickets?: string[];
  all_deal_tickets?: string[];
  custom_fields?: Record<string, CustomValue> | null;
};

type Account = {
  login: string;
  server: string;
  company?: string | null;
  account_name?: string | null;
  currency?: string | null;
};

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function displayNumber(value: unknown, decimals = 8) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString(undefined, { maximumFractionDigits: decimals })
    : String(value);
}

function money(value: unknown, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numberValue(value));
  } catch {
    return `$${numberValue(value).toFixed(2)}`;
  }
}

function DetailValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">{label}</p>
      <div className="mt-2 break-words text-sm font-semibold text-slate-100">{value || "—"}</div>
    </div>
  );
}

export default function AutomaticMT5TradeDetails({
  trade,
  serialNumber,
  account,
  optionalHeaders,
  sessionTimezone,
  formatTradeDate,
  onBack,
  onSaveFields,
}: {
  trade: AutomaticMt5DetailTrade;
  serialNumber: number;
  account?: Account;
  optionalHeaders: AutomaticMt5Header[];
  sessionTimezone: string;
  formatTradeDate: (trade: AutomaticMt5DetailTrade, kind: "entry" | "exit") => string;
  onBack: () => void;
  onSaveFields: (tradeId: string, fields: Record<string, CustomValue>) => Promise<boolean>;
}) {
  const [fields, setFields] = useState<Record<string, CustomValue>>(trade.custom_fields || {});
  const [saving, setSaving] = useState(false);
  const [uploadingHeaderId, setUploadingHeaderId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFields(trade.custom_fields || {});
    setMessage("");
  }, [trade.id, trade.custom_fields]);

  const calculatedValues = useMemo(
    () => calculateAutomaticMt5HeaderValues(trade, sessionTimezone),
    [sessionTimezone, trade],
  );
  const manualHeaders = optionalHeaders.filter((header) => header.group === "manual");
  const calculatedHeaders = optionalHeaders.filter(
    (header) => header.group === "automatic" || header.group === "custom_automatic",
  );

  const saveFields = async (nextFields: Record<string, CustomValue>, successMessage: string) => {
    setSaving(true);
    setMessage("");
    const saved = await onSaveFields(trade.id, nextFields);
    setSaving(false);
    setMessage(saved ? successMessage : "Could not save the Trade Details.");
    if (saved) setFields(nextFields);
    return saved;
  };

  const uploadScreenshot = async (header: AutomaticMt5Header, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("Screenshots must be 10 MB or smaller.");
      return;
    }

    setUploadingHeaderId(header.id);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) throw new Error("Log in to upload screenshots.");
      const uploaded = await uploadChartImage(
        file,
        user.id,
        `mt5-trades/${trade.id}`,
        header.id,
      );
      if (uploaded.error || !uploaded.url || !uploaded.path) {
        throw new Error(uploaded.error?.message || "Screenshot upload failed.");
      }

      const previous = fields[header.id] as ScreenshotValue | undefined;
      const nextFields = {
        ...fields,
        [header.id]: { url: uploaded.url, path: uploaded.path, name: file.name },
      };
      const saved = await saveFields(nextFields, `${header.name} saved.`);
      if (saved && previous?.path) await deleteChartImage(previous.path);
      if (!saved) await deleteChartImage(uploaded.path);
    } catch (error: any) {
      setMessage(error?.message || "Screenshot upload failed.");
    } finally {
      setUploadingHeaderId("");
    }
  };

  const removeScreenshot = async (header: AutomaticMt5Header) => {
    const previous = fields[header.id] as ScreenshotValue | undefined;
    const nextFields = { ...fields, [header.id]: "" };
    const saved = await saveFields(nextFields, `${header.name} removed.`);
    if (saved && previous?.path) await deleteChartImage(previous.path);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-cyan-400/10 bg-[#111827]/80 p-6">
        <button type="button" onClick={onBack} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:border-cyan-400 hover:text-cyan-200">
          ← Back to Trade Log
        </button>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Trade Details</p>
            <h1 className="mt-2 text-3xl font-black text-white">{trade.symbol} · {trade.direction.toUpperCase()}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {account?.account_name || account?.company || "MT5"} · {account?.login || "—"} · {account?.server || "—"}
            </p>
          </div>
          <span className={`rounded-full border px-4 py-2 text-sm font-black uppercase ${trade.status === "win" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : trade.status === "loss" ? "border-red-400/30 bg-red-400/10 text-red-300" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"}`}>
            {trade.status}
          </span>
        </div>
      </div>

      <section className="rounded-2xl border border-cyan-400/10 bg-[#111827]/70 p-6">
        <h2 className="text-lg font-black text-white">Required MT5 Details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailValue label="S/N" value={serialNumber} />
          <DetailValue label="Ent Date" value={formatTradeDate(trade, "entry")} />
          <DetailValue label="Ext Date" value={formatTradeDate(trade, "exit")} />
          <DetailValue label="Symbol" value={trade.symbol} />
          <DetailValue label="Status" value={<span className="capitalize">{trade.status}</span>} />
          <DetailValue label="Direction" value={<span className="capitalize">{trade.direction}</span>} />
          <DetailValue label="Lot" value={displayNumber(trade.total_entry_lots, 2)} />
          <DetailValue label="Entry" value={displayNumber(trade.weighted_entry_price)} />
          <DetailValue label="Stop Loss" value={displayNumber(trade.stop_loss)} />
          <DetailValue label="Take Profit" value={displayNumber(trade.take_profit)} />
          <DetailValue label="Exit" value={displayNumber(trade.weighted_exit_price)} />
          <DetailValue label="P/L($)" value={money(trade.net_profit, account?.currency || "USD")} />
          <DetailValue label="P/L(%)" value={`${numberValue(trade.pl_percentage).toFixed(2)}%`} />
        </div>
      </section>

      {manualHeaders.length ? (
        <section className="rounded-2xl border border-cyan-400/10 bg-[#111827]/70 p-6">
          <h2 className="text-lg font-black text-white">Manual Trade Details</h2>
          <p className="mt-1 text-xs text-slate-400">These values belong to this trade and will not be overwritten by MT5 synchronization.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {manualHeaders.map((header) => {
              if (header.type === "image") {
                const screenshot = fields[header.id] as ScreenshotValue | undefined;
                return (
                  <div key={header.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{header.name}</p>
                    {screenshot?.url ? (
                      <a href={screenshot.url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg border border-slate-700">
                        <img src={screenshot.url} alt={header.name} className="h-52 w-full object-contain" />
                      </a>
                    ) : <div className="mt-3 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-600">No screenshot uploaded</div>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200">
                        {uploadingHeaderId === header.id ? "Uploading..." : screenshot?.url ? "Replace image" : "Upload image"}
                        <input type="file" accept="image/*" disabled={Boolean(uploadingHeaderId)} onChange={(event) => void uploadScreenshot(header, event.target.files?.[0])} className="hidden" />
                      </label>
                      {screenshot?.url ? <button type="button" onClick={() => void removeScreenshot(header)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">Remove</button> : null}
                    </div>
                  </div>
                );
              }

              const fallback = header.id === "manual-trade-comment" ? trade.trade_comment || "" : "";
              return (
                <label key={header.id} className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{header.name}</span>
                  <textarea
                    value={typeof fields[header.id] === "string" ? String(fields[header.id]) : fallback}
                    onChange={(event) => setFields((current) => ({ ...current, [header.id]: event.target.value }))}
                    rows={header.id === "manual-notes" ? 5 : 3}
                    maxLength={10000}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                  />
                </label>
              );
            })}
          </div>
          <button type="button" disabled={saving} onClick={() => void saveFields(fields, "Manual Trade Details saved.")} className="mt-5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-black text-black disabled:opacity-50">
            {saving ? "Saving..." : "Save Trade Details"}
          </button>
        </section>
      ) : null}

      {calculatedHeaders.length ? (
        <section className="rounded-2xl border border-cyan-400/10 bg-[#111827]/70 p-6">
          <h2 className="text-lg font-black text-white">Automatic Calculations</h2>
          <p className="mt-1 text-xs text-slate-400">Calculated using {sessionTimezone}.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {calculatedHeaders.map((header) => (
              <DetailValue
                key={header.id}
                label={header.name}
                value={header.formulaKey ? calculatedValues[header.formulaKey] : header.defaultValue || "—"}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-sm font-black text-white">MT5 Reference</h2>
        <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-3">
          <p>Position: <span className="text-slate-200">{trade.position_identifier}</span></p>
          <p>Cycle: <span className="text-slate-200">{trade.trade_cycle}</span></p>
          <p>Deals: <span className="text-slate-200">{trade.all_deal_tickets?.join(", ") || "—"}</span></p>
        </div>
      </section>

      {message ? <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">{message}</p> : null}
    </div>
  );
}
