export type PerformanceDateRange = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL";

export type PerformanceChartMode = "balance" | "percentage";

export type TradeLogRowData = Record<string, any>;

export interface TradeLogRow {
  id: string;
  databaseRowId?: string;
  rowData?: TradeLogRowData;
  createdAt?: string;
  updatedAt?: string;
}

export interface TradeLogWithRows {
  id: string;
  databaseTemplateId?: string;
  logName?: string;
  headers?: any[];
  initialBalance?: number;
  accountCurrency?: string;
  createdAt?: string;
  updatedAt?: string;
  rows?: TradeLogRow[];
}

export interface NormalizedTrade {
  id: string;
  tradeLogId: string;
  tradeLogName: string;
  symbol: string;
  direction: string;
  volume: number;
  entryTime: string;
  exitTime: string;
  tradeDate: Date | null;
  entryPrice: number | null;
  exitPrice: number | null;
  profitLoss: number;
  rowData: TradeLogRowData;
}

export interface EquityCurvePoint {
  label: string;
  date: string;
  tradeNumber: number;
  profitLoss: number;
  cumulativeProfit: number;
  balance: number;
  returnPercent: number;
}

export interface BreakdownItem {
  name: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
}

export interface PerformanceMetricsResult {
  selectedTradeLogId: string;
  selectedTradeLogName: string;
  dateRange: PerformanceDateRange;
  accountCurrency: string;
  initialBalance: number;
  currentBalance: number;
  netProfit: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  bestTrade: NormalizedTrade | null;
  worstTrade: NormalizedTrade | null;
  totalVolume: number;
  buyTrades: number;
  sellTrades: number;
  buyNetProfit: number;
  sellNetProfit: number;
  equityCurve: EquityCurvePoint[];
  recentTrades: NormalizedTrade[];
  pairPerformance: BreakdownItem[];
  monthlyPerformance: BreakdownItem[];
  winLossData: { name: string; value: number }[];
}

const DEFAULT_CURRENCY = "USD";

function normalizeHeaderName(headerName: string) {
  if (headerName === "Lot Size" || headerName === "Volume") return "Lot";
  if (headerName === "Entry Date" || headerName === "Entry Time") return "Ent Date";
  if (headerName === "Exit Date" || headerName === "Exit Time") return "Ext Date";
  if (headerName === "Entry Price") return "Entry";
  if (headerName === "Exit Price") return "Exit";
  if (
    headerName === "Profit" ||
    headerName === "Profit/Loss" ||
    headerName === "P/L" ||
    headerName === "Profi" ||
    headerName === "Profit/Loss Amount"
  ) return "P/L($)";
  return headerName;
}

function getPossibleRowValue(rowData: TradeLogRowData, name: string) {
  const normalizedName = normalizeHeaderName(name);

  if (rowData?.[normalizedName] !== undefined && rowData?.[normalizedName] !== "") {
    return rowData[normalizedName];
  }

  if (rowData?.[name] !== undefined && rowData?.[name] !== "") {
    return rowData[name];
  }

  return "";
}

function pickValue(rowData: TradeLogRowData, names: string[]) {
  for (const name of names) {
    const value = getPossibleRowValue(rowData, name);

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function hasOwnNonEmptyValue(rowData: TradeLogRowData, names: string[]) {
  return names.some((name) => {
    const value = getPossibleRowValue(rowData, name);
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

// This parser handles MT5/browser number formats more safely:
// - 1,234.56 -> 1234.56
// - 1 234.56 -> 1234.56
// - 1 234,56 -> 1234.56
// - -1 234,56 -> -1234.56
// - −1 234,56 -> -1234.56
// - (1,234.56) -> -1234.56
// - 1234.56- -> -1234.56
export function cleanNumber(value: any): number | null {
  if (value === "" || value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let rawValue = String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/[−–—]/g, "-")
    .replace(/[₦$€£¥]/g, "")
    .replace(/%/g, "")
    .trim();

  if (!rawValue) return null;

  let isNegative = false;

  if (/^\(.+\)$/.test(rawValue)) {
    isNegative = true;
    rawValue = rawValue.slice(1, -1).trim();
  }

  if (rawValue.endsWith("-")) {
    isNegative = true;
    rawValue = rawValue.slice(0, -1).trim();
  }

  if (rawValue.startsWith("-")) {
    isNegative = true;
    rawValue = rawValue.slice(1).trim();
  }

  rawValue = rawValue.replace(/[^0-9.,\s]/g, "").trim();

  if (!rawValue) return null;

  // Remove regular and non-breaking spaces used as thousand separators.
  rawValue = rawValue.replace(/\s+/g, "");

  const lastCommaIndex = rawValue.lastIndexOf(",");
  const lastDotIndex = rawValue.lastIndexOf(".");

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
    // The last separator is treated as the decimal separator.
    if (lastCommaIndex > lastDotIndex) {
      rawValue = rawValue.replace(/\./g, "").replace(",", ".");
    } else {
      rawValue = rawValue.replace(/,/g, "");
    }
  } else if (lastCommaIndex !== -1) {
    const commaParts = rawValue.split(",");
    const decimals = commaParts[commaParts.length - 1] || "";

    // If the comma has 1 or 2 digits after it, treat it as decimal comma.
    // Otherwise treat commas as thousand separators.
    if (commaParts.length === 2 && decimals.length > 0 && decimals.length <= 2) {
      rawValue = rawValue.replace(",", ".");
    } else {
      rawValue = rawValue.replace(/,/g, "");
    }
  } else if (lastDotIndex !== -1) {
    const dotParts = rawValue.split(".");
    const decimals = dotParts[dotParts.length - 1] || "";

    // Multiple dots are usually thousand separators except the final decimal dot.
    if (dotParts.length > 2) {
      rawValue = dotParts.slice(0, -1).join("") + "." + decimals;
    }
  }

  const numberValue = Number(rawValue);

  if (Number.isNaN(numberValue)) return null;

  return isNegative ? -Math.abs(numberValue) : numberValue;
}

function getProfitLossValue(rowData: TradeLogRowData) {
  // Prioritize actual closed trade result fields. Do not use account balance/equity fields.
  const value = pickValue(rowData, [
    "P/L($)",
    "Profit/Loss Amount",
    "Profit/Loss",
    "P/L",
    "Net Profit",
    "Profit",
    "Profi",
  ]);

  return cleanNumber(value) || 0;
}

function normalizeDirectionValue(value: any) {
  const direction = String(value || "").trim().toUpperCase();

  if (direction.includes("BUY")) return "BUY";
  if (direction.includes("SELL")) return "SELL";

  return direction;
}

function isBalanceOperationRow(rowData: TradeLogRowData) {
  const typeText = String(
    pickValue(rowData, ["Type", "Direction", "Side", "Operation", "Action"])
  )
    .trim()
    .toLowerCase();

  const commentText = String(pickValue(rowData, ["Comment", "Trade Comment", "Description"]))
    .trim()
    .toLowerCase();

  const combinedText = `${typeText} ${commentText}`;

  return [
    "balance",
    "deposit",
    "withdrawal",
    "withdraw",
    "credit",
    "rebate",
    "transfer",
    "correction",
  ].some((keyword) => combinedText.includes(keyword));
}

function isRealTradeRow(rowData: TradeLogRowData) {
  if (!rowData || isBalanceOperationRow(rowData)) return false;

  const symbol = String(
    pickValue(rowData, ["Symbol", "symbol", "Item", "Pair", "Instrument"])
  ).trim();

  const direction = normalizeDirectionValue(pickValue(rowData, ["Direction", "Type", "Side"]));

  const hasTradeDirection = direction === "BUY" || direction === "SELL";

  const hasTradePrice = hasOwnNonEmptyValue(rowData, [
    "Entry",
    "Entry Price",
    "Open Price",
    "Exit",
    "Exit Price",
    "Close Price",
  ]);

  const hasTradeTime = hasOwnNonEmptyValue(rowData, [
    "Ent Date",
    "Entry Time",
    "Open Time",
    "Ext Date",
    "Exit Time",
    "Close Time",
    "Time",
  ]);

  // This prevents account-balance rows from being counted as trades.
  return Boolean(symbol) && hasTradeDirection && (hasTradePrice || hasTradeTime);
}

export function parseTradeDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const rawValue = String(value).trim();

  if (!rawValue) return null;

  const directDate = new Date(rawValue);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const mt5Match = rawValue.match(
    /^(\d{4})[.-](\d{2})[.-](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (mt5Match) {
    const year = Number(mt5Match[1]);
    const month = Number(mt5Match[2]) - 1;
    const day = Number(mt5Match[3]);
    const hour = Number(mt5Match[4]);
    const minute = Number(mt5Match[5]);
    const second = Number(mt5Match[6] || 0);

    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  return null;
}

function formatPointDate(date: Date | null) {
  if (!date) return "Unknown";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function formatMonthKey(date: Date | null) {
  if (!date) return "Unknown";

  return date.toLocaleDateString([], {
    month: "short",
    year: "numeric",
  });
}

function getDateRangeStart(dateRange: PerformanceDateRange, now = new Date()) {
  const startDate = new Date(now);

  if (dateRange === "ALL") return null;

  if (dateRange === "1D") {
    startDate.setDate(startDate.getDate() - 1);
    return startDate;
  }

  if (dateRange === "1W") {
    startDate.setDate(startDate.getDate() - 7);
    return startDate;
  }

  if (dateRange === "1M") {
    startDate.setMonth(startDate.getMonth() - 1);
    return startDate;
  }

  if (dateRange === "3M") {
    startDate.setMonth(startDate.getMonth() - 3);
    return startDate;
  }

  if (dateRange === "6M") {
    startDate.setMonth(startDate.getMonth() - 6);
    return startDate;
  }

  if (dateRange === "YTD") {
    return new Date(now.getFullYear(), 0, 1);
  }

  return null;
}

export function normalizeTradeRows(tradeLogs: TradeLogWithRows[]): NormalizedTrade[] {
  return (tradeLogs || []).flatMap((tradeLog) => {
    const rows = Array.isArray(tradeLog.rows) ? tradeLog.rows : [];

    return rows.flatMap((row) => {
      const rowData = row.rowData || {};

      if (!isRealTradeRow(rowData)) {
        return [];
      }

      const symbol = String(
        pickValue(rowData, ["Symbol", "symbol", "Item", "Pair", "Instrument"])
      ).trim();

      const direction = normalizeDirectionValue(
        pickValue(rowData, ["Direction", "Type", "Side"])
      );

      const volume = cleanNumber(pickValue(rowData, ["Lot", "Volume", "Lot Size", "Lots", "Size"])) || 0;
      const entryTime = String(pickValue(rowData, ["Ent Date", "Entry Time", "Open Time", "Time"])).trim();
      const exitTime = String(pickValue(rowData, ["Ext Date", "Exit Time", "Close Time"])).trim();

      const tradeDate =
        parseTradeDate(exitTime) ||
        parseTradeDate(entryTime) ||
        parseTradeDate(row.updatedAt) ||
        parseTradeDate(row.createdAt);

      const entryPrice = cleanNumber(pickValue(rowData, ["Entry", "Entry Price", "Open Price"]));
      const exitPrice = cleanNumber(pickValue(rowData, ["Exit", "Exit Price", "Close Price"]));
      const profitLoss = getProfitLossValue(rowData);

      return [
        {
          id: String(row.id),
          tradeLogId: String(tradeLog.id),
          tradeLogName: tradeLog.logName || "Untitled Trade Log",
          symbol,
          direction,
          volume,
          entryTime,
          exitTime,
          tradeDate,
          entryPrice,
          exitPrice,
          profitLoss,
          rowData,
        },
      ];
    });
  });
}

function createBreakdownItem(name: string, trades: NormalizedTrade[]): BreakdownItem {
  const winningTrades = trades.filter((trade) => trade.profitLoss > 0).length;
  const losingTrades = trades.filter((trade) => trade.profitLoss < 0).length;
  const netProfit = trades.reduce((sum, trade) => sum + trade.profitLoss, 0);

  return {
    name,
    trades: trades.length,
    wins: winningTrades,
    losses: losingTrades,
    winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
    netProfit,
  };
}

function createBreakdownByField(
  trades: NormalizedTrade[],
  getName: (trade: NormalizedTrade) => string
) {
  const groups = new Map<string, NormalizedTrade[]>();

  trades.forEach((trade) => {
    const groupName = getName(trade) || "Unknown";
    const currentGroup = groups.get(groupName) || [];
    currentGroup.push(trade);
    groups.set(groupName, currentGroup);
  });

  return Array.from(groups.entries())
    .map(([name, groupTrades]) => createBreakdownItem(name, groupTrades))
    .sort((a, b) => Math.abs(b.netProfit) - Math.abs(a.netProfit));
}

export function calculatePerformanceMetrics({
  tradeLogs,
  selectedTradeLogId = "all",
  dateRange = "ALL",
}: {
  tradeLogs: TradeLogWithRows[];
  selectedTradeLogId?: string;
  dateRange?: PerformanceDateRange;
}): PerformanceMetricsResult {
  const selectedLogs =
    selectedTradeLogId === "all"
      ? tradeLogs || []
      : (tradeLogs || []).filter(
          (tradeLog) => String(tradeLog.id) === String(selectedTradeLogId)
        );

  const selectedTradeLogName =
    selectedTradeLogId === "all"
      ? "General Overview"
      : selectedLogs[0]?.logName || "Selected Trade Log";

  const accountCurrency =
    selectedTradeLogId === "all"
      ? selectedLogs[0]?.accountCurrency || DEFAULT_CURRENCY
      : selectedLogs[0]?.accountCurrency || DEFAULT_CURRENCY;

  const initialBalance = selectedLogs.reduce(
    (sum, tradeLog) => sum + Number(tradeLog.initialBalance || 0),
    0
  );

  const startDate = getDateRangeStart(dateRange);

  const normalizedTrades = normalizeTradeRows(selectedLogs).filter((trade) => {
    if (!startDate) return true;
    if (!trade.tradeDate) return true;
    return trade.tradeDate.getTime() >= startDate.getTime();
  });

  const sortedTrades = [...normalizedTrades].sort((a, b) => {
    const aTime = a.tradeDate?.getTime() || 0;
    const bTime = b.tradeDate?.getTime() || 0;
    return aTime - bTime;
  });

  const totalTrades = sortedTrades.length;
  const winningTrades = sortedTrades.filter((trade) => trade.profitLoss > 0);
  const losingTrades = sortedTrades.filter((trade) => trade.profitLoss < 0);
  const breakevenTrades = sortedTrades.filter((trade) => trade.profitLoss === 0);

  const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
  const grossLoss = losingTrades.reduce((sum, trade) => sum + Math.abs(trade.profitLoss), 0);
  const netProfit = sortedTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);

  const averageWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const averageLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0;
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

  const bestTrade =
    sortedTrades.length > 0
      ? [...sortedTrades].sort((a, b) => b.profitLoss - a.profitLoss)[0]
      : null;

  const worstTrade =
    sortedTrades.length > 0
      ? [...sortedTrades].sort((a, b) => a.profitLoss - b.profitLoss)[0]
      : null;

  const totalVolume = sortedTrades.reduce((sum, trade) => sum + trade.volume, 0);
  const buyTrades = sortedTrades.filter((trade) => trade.direction === "BUY");
  const sellTrades = sortedTrades.filter((trade) => trade.direction === "SELL");
  const buyNetProfit = buyTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
  const sellNetProfit = sellTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);

  let cumulativeProfit = 0;

  const equityCurve = sortedTrades.map((trade, index) => {
    cumulativeProfit += trade.profitLoss;
    const balance = initialBalance + cumulativeProfit;
    const returnPercent = initialBalance > 0 ? (cumulativeProfit / initialBalance) * 100 : 0;

    return {
      label: formatPointDate(trade.tradeDate),
      date: trade.tradeDate ? trade.tradeDate.toISOString() : "",
      tradeNumber: index + 1,
      profitLoss: trade.profitLoss,
      cumulativeProfit,
      balance,
      returnPercent,
    };
  });

  const currentBalance = initialBalance + netProfit;
  const totalReturnPercent = initialBalance > 0 ? (netProfit / initialBalance) * 100 : 0;

  const recentTrades = [...sortedTrades]
    .sort((a, b) => (b.tradeDate?.getTime() || 0) - (a.tradeDate?.getTime() || 0))
    .slice(0, 8);

  const pairPerformance = createBreakdownByField(
    sortedTrades,
    (trade) => trade.symbol || "Unknown"
  );

  const monthlyPerformance = createBreakdownByField(sortedTrades, (trade) =>
    formatMonthKey(trade.tradeDate)
  );

  return {
    selectedTradeLogId,
    selectedTradeLogName,
    dateRange,
    accountCurrency,
    initialBalance,
    currentBalance,
    netProfit,
    totalReturnPercent,
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    breakevenTrades: breakevenTrades.length,
    winRate,
    grossProfit,
    grossLoss,
    averageWin,
    averageLoss,
    profitFactor,
    bestTrade,
    worstTrade,
    totalVolume,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    buyNetProfit,
    sellNetProfit,
    equityCurve,
    recentTrades,
    pairPerformance,
    monthlyPerformance,
    winLossData: [
      { name: "Win", value: winningTrades.length },
      { name: "Loss", value: losingTrades.length },
      { name: "Break Even", value: breakevenTrades.length },
    ],
  };
}

export function formatMoney(value: number, currency = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || DEFAULT_CURRENCY,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export function formatNumber(value: number, decimals = 2) {
  return Number(value || 0).toFixed(decimals);
}
