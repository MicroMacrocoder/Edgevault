import type { VolumeOIExternalReport, VolumeOISymbol } from "@/types/volumeOi";

const CME_VOI_XSLT_URL =
  "https://www.cmegroup.com/CmeWS/mvc/xsltTransformer.do";

export const VOLUME_OI_SYMBOLS: VolumeOISymbol[] = [
  {
    label: "Euro FX",
    symbol: "EUR",
    currency: "EUR",
    market_name: "EURO FX",
    exchange: "CME",
    cme_product_code: "EC",
  },
  {
    label: "British Pound",
    symbol: "GBP",
    currency: "GBP",
    market_name: "BRITISH POUND",
    exchange: "CME",
    cme_product_code: "BP",
  },
  {
    label: "Japanese Yen",
    symbol: "JPY",
    currency: "JPY",
    market_name: "JAPANESE YEN",
    exchange: "CME",
    cme_product_code: "JY",
  },
  {
    label: "Canadian Dollar",
    symbol: "CAD",
    currency: "CAD",
    market_name: "CANADIAN DOLLAR",
    exchange: "CME",
    cme_product_code: "CD",
  },
  {
    label: "Swiss Franc",
    symbol: "CHF",
    currency: "CHF",
    market_name: "SWISS FRANC",
    exchange: "CME",
    cme_product_code: "SF",
  },
  {
    label: "Australian Dollar",
    symbol: "AUD",
    currency: "AUD",
    market_name: "AUSTRALIAN DOLLAR",
    exchange: "CME",
    cme_product_code: "AD",
  },
];

type ParsedVOIRow = {
  cells: string[];
  text: string;
};

function formatDateForCME(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return String(year) + month + day;
}

function formatDateForSupabase(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return String(year) + "-" + month + "-" + day;
}

function getRecentBusinessDays(daysToCollect = 30) {
  const dates: Date[] = [];
  const cursor = new Date();

  cursor.setHours(12, 0, 0, 0);

  while (dates.length < daysToCollect) {
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      dates.push(new Date(cursor));
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return dates.reverse();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function toNumber(value: string | undefined) {
  if (!value) return null;

  const cleanedValue = value
    .replace(/,/g, "")
    .replace(/\+/g, "")
    .replace(/−/g, "-")
    .trim();

  if (!cleanedValue) {
    return null;
  }

  const parsedValue = Number(cleanedValue);

  if (Number.isNaN(parsedValue)) {
    return null;
  }

  return parsedValue;
}

function parseHtmlRows(html: string): ParsedVOIRow[] {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  return rows
    .map((rowHtml) => {
      const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];

      const cells = cellMatches
        .map((cellHtml) => stripHtml(cellHtml))
        .filter(Boolean);

      return {
        cells,
        text: cells.join(" ").toUpperCase(),
      };
    })
    .filter((row) => row.cells.length > 1);
}

function rowMatchesSymbol(row: ParsedVOIRow, symbolConfig: VolumeOISymbol) {
  const productName = (row.cells[0] || "").toUpperCase().trim();
  const productType = (row.cells[1] || "").toUpperCase().trim();
  const targetProductName =
    symbolConfig.market_name.toUpperCase().trim() + " FUTURES";

  if (productType !== "FUTURES") {
    return false;
  }

  return productName === targetProductName;
}

function getNumericCells(cells: string[]) {
  return cells
    .map((cell) => toNumber(cell))
    .filter((value): value is number => value !== null);
}

function normalizeRowToReport(
  row: ParsedVOIRow,
  symbolConfig: VolumeOISymbol,
  tradeDate: string
): VolumeOIExternalReport | null {
  const numericCells = getNumericCells(row.cells);

  if (numericCells.length < 6) {
    return null;
  }

  const totalVolume = numericCells[3];
  const openInterest = numericCells[4];

  return {
    symbol: symbolConfig.symbol,
    currency: symbolConfig.currency,
    market_name: symbolConfig.market_name,
    exchange: symbolConfig.exchange,

    trade_date: tradeDate,

    volume: totalVolume,
    open_interest: openInterest,

    source: "CME FX Volume and Open Interest",
  };
}

async function fetchVolumeOIForDate(date: Date) {
  const cmeDate = formatDateForCME(date);
  const tradeDate = formatDateForSupabase(date);

  const sourcePath =
    "/da/VOI/V2/Totals/TradeDate/" +
    cmeDate +
    "/AssetClassId/3/ReportType/F?excluded=CEE,CEU,KCB";

  const params = new URLSearchParams({
    xlstDoc: "/XSLT/md/voi/voi_asset_class_final.xsl",
    url: sourcePath,
    hidelinks: "false",
    html: "",
  });

  const response = await fetch(CME_VOI_XSLT_URL + "?" + params.toString(), {
    cache: "no-store",
    headers: {
      "User-Agent": "EdgeVault/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml",
    },
  });

  if (!response.ok) {
    return [] as VolumeOIExternalReport[];
  }

  const html = await response.text();

  if (
    html.toLowerCase().includes("internal error") ||
    html.toLowerCase().includes("not found")
  ) {
    return [] as VolumeOIExternalReport[];
  }

  const rows = parseHtmlRows(html);
  const reports: VolumeOIExternalReport[] = [];

  for (const symbolConfig of VOLUME_OI_SYMBOLS) {
    const matchingRow = rows.find((row) => rowMatchesSymbol(row, symbolConfig));

    if (!matchingRow) {
      continue;
    }

    const report = normalizeRowToReport(matchingRow, symbolConfig, tradeDate);

    if (report) {
      reports.push(report);
    }
  }

  return reports;
}

export async function fetchVolumeOIReportsFromCME(daysToCollect = 30) {
  const dates = getRecentBusinessDays(daysToCollect);
  const results = await Promise.all(
    dates.map((date) => fetchVolumeOIForDate(date))
  );

  return results.flat().sort((a, b) => {
    if (a.symbol === b.symbol) {
      return a.trade_date.localeCompare(b.trade_date);
    }

    return a.symbol.localeCompare(b.symbol);
  });
}
