export type AutomaticMt5Header = {
  id: string;
  name: string;
  group: "required" | "manual" | "automatic" | "custom_automatic";
  type: "text" | "number" | "datetime" | "image" | "auto" | "custom_auto";
  formulaKey?: string;
  sourceField?: string;
  defaultValue?: string;
  rules?: Array<Record<string, any>>;
  locked?: boolean;
  lockedPosition?: boolean;
};

export const AUTOMATIC_MT5_REQUIRED_HEADERS: AutomaticMt5Header[] = [
  { id: "required-sn", name: "S/N", group: "required", type: "number", locked: true, lockedPosition: true },
  { id: "required-entry-date", name: "Ent Date", group: "required", type: "datetime", locked: true },
  { id: "required-exit-date", name: "Ext Date", group: "required", type: "datetime", locked: true },
  { id: "required-symbol", name: "Symbol", group: "required", type: "text", locked: true },
  { id: "required-status", name: "Status", group: "required", type: "text", locked: true },
  { id: "required-direction", name: "Direction", group: "required", type: "text", locked: true },
  { id: "required-lot", name: "Lot", group: "required", type: "number", locked: true },
  { id: "required-entry", name: "Entry", group: "required", type: "number", locked: true },
  { id: "required-stop-loss", name: "Stop Loss", group: "required", type: "number", locked: true },
  { id: "required-take-profit", name: "Take Profit", group: "required", type: "number", locked: true },
  { id: "required-exit", name: "Exit", group: "required", type: "number", locked: true },
  { id: "required-profit-loss-dollar", name: "P/L($)", group: "required", type: "number", locked: true },
  { id: "required-profit-loss-percent", name: "P/L(%)", group: "required", type: "number", locked: true },
];

export const AUTOMATIC_MT5_MANUAL_HEADERS: AutomaticMt5Header[] = [
  { id: "manual-notes", name: "Notes", group: "manual", type: "text" },
  { id: "manual-setup-type", name: "Setup Type", group: "manual", type: "text" },
  { id: "manual-trade-comment", name: "Trade Comment", group: "manual", type: "text" },
  { id: "manual-before-trade-screenshot", name: "Before Trade Screenshot", group: "manual", type: "image" },
  { id: "manual-after-trade-screenshot", name: "After Trade Screenshot", group: "manual", type: "image" },
  { id: "manual-entry-model", name: "Entry Model", group: "manual", type: "text" },
  { id: "manual-exit-reason", name: "Exit Reason", group: "manual", type: "text" },
];

export const AUTOMATIC_MT5_CALCULATED_HEADERS: AutomaticMt5Header[] = [
  { id: "auto-entry-market-session", name: "Entry Market Session", group: "automatic", type: "auto", formulaKey: "entry_market_session" },
  { id: "auto-exit-market-session", name: "Exit Market Session", group: "automatic", type: "auto", formulaKey: "exit_market_session" },
  { id: "auto-entry-ict-session", name: "Entry ICT Session", group: "automatic", type: "auto", formulaKey: "entry_ict_session" },
  { id: "auto-exit-ict-session", name: "Exit ICT Session", group: "automatic", type: "auto", formulaKey: "exit_ict_session" },
  { id: "auto-trade-duration", name: "Trade Duration", group: "automatic", type: "auto", formulaKey: "trade_duration" },
  { id: "auto-sl-pips", name: "SL Pips", group: "automatic", type: "auto", formulaKey: "sl_pips" },
  { id: "auto-tp-pips", name: "TP Pips", group: "automatic", type: "auto", formulaKey: "tp_pips" },
  { id: "auto-result-pips", name: "Result Pips", group: "automatic", type: "auto", formulaKey: "result_pips" },
  { id: "auto-planned-rr", name: "Planned R:R", group: "automatic", type: "auto", formulaKey: "planned_rr" },
  { id: "auto-actual-rr", name: "Actual R:R", group: "automatic", type: "auto", formulaKey: "actual_rr" },
];

export const DEFAULT_AUTOMATIC_MT5_OPTIONAL_HEADERS = [
  ...AUTOMATIC_MT5_MANUAL_HEADERS,
  ...AUTOMATIC_MT5_CALCULATED_HEADERS,
];

export type AutomaticMt5FormulaTrade = {
  symbol: string;
  direction: "buy" | "sell";
  entry_at_utc: string;
  exit_at_utc: string | null;
  weighted_entry_price: number | string | null;
  weighted_exit_price: number | string | null;
  stop_loss?: number | string | null;
  take_profit?: number | string | null;
};

function finiteNullable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number | null) {
  return value === null ? "" : Number(value.toFixed(2)).toString();
}

function pipMultiplier(symbol: string) {
  const clean = symbol.toUpperCase();
  if (clean.includes("JPY")) return 100;
  if (clean.includes("XAU") || clean.includes("GOLD")) return 10;
  if (clean.includes("XAG") || clean.includes("SILVER")) return 100;
  if (["US30", "NAS", "SPX", "GER", "UK100"].some((name) => clean.includes(name))) return 1;
  return 10000;
}

function minutesInTimezone(value: string | null, timezone: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
  } catch {
    return null;
  }
}

function insideRange(current: number | null, start: number, end: number) {
  if (current === null) return false;
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function regularSession(value: string | null, timezone: string) {
  const minutes = minutesInTimezone(value, timezone);
  return [
    { name: "Sydney", start: 17 * 60, end: 2 * 60 },
    { name: "Asia", start: 19 * 60, end: 4 * 60 },
    { name: "London", start: 3 * 60, end: 12 * 60 },
    { name: "New York", start: 8 * 60, end: 17 * 60 },
  ].filter((session) => insideRange(minutes, session.start, session.end))
    .map((session) => session.name)
    .join("/");
}

function ictSession(value: string | null, timezone: string) {
  const minutes = minutesInTimezone(value, timezone);
  return [
    { name: "ICT Asia", start: 19 * 60, end: 0 },
    { name: "ICT London", start: 2 * 60, end: 5 * 60 },
    { name: "ICT New York", start: 7 * 60, end: 16 * 60 },
  ].find((session) => insideRange(minutes, session.start, session.end))?.name || "";
}

function duration(entryValue: string, exitValue: string | null) {
  if (!exitValue) return "Open";
  const milliseconds = new Date(exitValue).getTime() - new Date(entryValue).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "";
  const secondsTotal = Math.floor(milliseconds / 1000);
  const days = Math.floor(secondsTotal / 86400);
  const hours = Math.floor((secondsTotal % 86400) / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = secondsTotal % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function calculateAutomaticMt5HeaderValues(
  trade: AutomaticMt5FormulaTrade,
  timezone = "UTC",
) {
  const entry = finiteNullable(trade.weighted_entry_price);
  const exit = finiteNullable(trade.weighted_exit_price);
  const stopLoss = finiteNullable(trade.stop_loss);
  const takeProfit = finiteNullable(trade.take_profit);
  const multiplier = pipMultiplier(trade.symbol);
  const direction = trade.direction;
  const slPips = entry === null || stopLoss === null
    ? null
    : (direction === "buy" ? entry - stopLoss : stopLoss - entry) * multiplier;
  const tpPips = entry === null || takeProfit === null
    ? null
    : (direction === "buy" ? takeProfit - entry : entry - takeProfit) * multiplier;
  const resultPips = entry === null || exit === null
    ? null
    : (direction === "buy" ? exit - entry : entry - exit) * multiplier;

  return {
    entry_market_session: regularSession(trade.entry_at_utc, timezone),
    exit_market_session: regularSession(trade.exit_at_utc, timezone),
    entry_ict_session: ictSession(trade.entry_at_utc, timezone),
    exit_ict_session: ictSession(trade.exit_at_utc, timezone),
    trade_duration: duration(trade.entry_at_utc, trade.exit_at_utc),
    sl_pips: formatNumber(slPips),
    tp_pips: formatNumber(tpPips),
    result_pips: formatNumber(resultPips),
    planned_rr:
      slPips && tpPips !== null ? `1:${formatNumber(tpPips / slPips)}` : "",
    actual_rr:
      slPips && resultPips !== null ? formatNumber(resultPips / slPips) : "",
  } as Record<string, string>;
}
