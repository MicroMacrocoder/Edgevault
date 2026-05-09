import AdmZip from "adm-zip";
import type { COTExternalReport, COTSymbol } from "@/types/cot";

const CFTC_LEGACY_ZIP_BASE_URL = "https://www.cftc.gov/files/dea/history/";

export const COT_SYMBOLS: COTSymbol[] = [
  {
    label: "U.S. Dollar Index",
    symbol: "DXY",
    currency: "USD",
    market_name: "U.S. DOLLAR INDEX - ICE FUTURES U.S.",
  },
  {
    label: "Euro FX",
    symbol: "EUR",
    currency: "EUR",
    market_name: "EURO FX - CHICAGO MERCANTILE EXCHANGE",
  },
  {
    label: "British Pound",
    symbol: "GBP",
    currency: "GBP",
    market_name: "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE",
  },
  {
    label: "Japanese Yen",
    symbol: "JPY",
    currency: "JPY",
    market_name: "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",
  },
  {
    label: "Canadian Dollar",
    symbol: "CAD",
    currency: "CAD",
    market_name: "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
  },
  {
    label: "Swiss Franc",
    symbol: "CHF",
    currency: "CHF",
    market_name: "SWISS FRANC - CHICAGO MERCANTILE EXCHANGE",
  },
  {
    label: "Australian Dollar",
    symbol: "AUD",
    currency: "AUD",
    market_name: "AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
  },
];

type ParsedLegacyRow = {
  marketName: string;
  reportDate: string;

  openInterest: number;

  noncommercialLong: number;
  noncommercialShort: number;

  commercialLong: number;
  commercialShort: number;

  nonreportableLong: number;
  nonreportableShort: number;
};

function toNumber(value: string | undefined) {
  if (!value) return 0;

  const cleanedValue = value.replace(/,/g, "").trim();
  const parsedValue = Number(cleanedValue);

  if (Number.isNaN(parsedValue)) {
    return 0;
  }

  return parsedValue;
}

function normalizeHeader(value: string) {
  return value
    .replace(/"/g, "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\//g, "_")
    .trim()
    .toLowerCase();
}

function normalizeMarketName(value: string) {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function parseCSVLine(line: string) {
  const values: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue.trim());

  return values;
}

function getColumnIndex(headers: string[], possibleNames: string[]) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  for (const possibleName of possibleNames) {
    const normalizedPossibleName = normalizeHeader(possibleName);
    const index = normalizedHeaders.findIndex(
      (header) => header === normalizedPossibleName
    );

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function convertCFTCDateToISO(value: string | undefined) {
  if (!value) return "";

  const cleanedValue = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanedValue)) {
    return cleanedValue;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanedValue)) {
    const [month, day, year] = cleanedValue.split("/");
    return year + "-" + month.padStart(2, "0") + "-" + day.padStart(2, "0");
  }

  if (/^\d{6}$/.test(cleanedValue)) {
    const yearPrefix = Number(cleanedValue.slice(0, 2)) >= 80 ? "19" : "20";
    const year = yearPrefix + cleanedValue.slice(0, 2);
    const month = cleanedValue.slice(2, 4);
    const day = cleanedValue.slice(4, 6);

    return year + "-" + month + "-" + day;
  }

  const parsedDate = new Date(cleanedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().split("T")[0];
}

function parseLegacyCSV(csvText: string): ParsedLegacyRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0]).map((header) => header.trim());

  const marketIndex = getColumnIndex(headers, [
    "Market_and_Exchange_Names",
    "Market and Exchange Names",
  ]);

  const reportDateIndex = getColumnIndex(headers, [
    "Report_Date_as_YYYY-MM-DD",
    "Report Date as YYYY-MM-DD",
    "Report_Date_as_MM_DD_YYYY",
    "Report Date as MM DD YYYY",
    "Report Date as MM/DD/YYYY",
    "As_of_Date_In_Form_YYMMDD",
    "As of Date in Form YYMMDD",
  ]);

  const openInterestIndex = getColumnIndex(headers, [
    "Open_Interest_All",
    "Open Interest All",
    "Open Interest (All)",
  ]);

  const noncommercialLongIndex = getColumnIndex(headers, [
    "Noncommercial_Positions_Long_All",
    "Noncommercial Positions Long All",
    "Noncommercial Positions-Long (All)",
    "NonComm_Positions_Long_All",
  ]);

  const noncommercialShortIndex = getColumnIndex(headers, [
    "Noncommercial_Positions_Short_All",
    "Noncommercial Positions Short All",
    "Noncommercial Positions-Short (All)",
    "NonComm_Positions_Short_All",
  ]);

  const commercialLongIndex = getColumnIndex(headers, [
    "Commercial_Positions_Long_All",
    "Commercial Positions Long All",
    "Commercial Positions-Long (All)",
    "Comm_Positions_Long_All",
  ]);

  const commercialShortIndex = getColumnIndex(headers, [
    "Commercial_Positions_Short_All",
    "Commercial Positions Short All",
    "Commercial Positions-Short (All)",
    "Comm_Positions_Short_All",
  ]);

  const nonreportableLongIndex = getColumnIndex(headers, [
    "Nonreportable_Positions_Long_All",
    "Nonreportable Positions Long All",
    "Nonreportable Positions-Long (All)",
    "NonRept_Positions_Long_All",
  ]);

  const nonreportableShortIndex = getColumnIndex(headers, [
    "Nonreportable_Positions_Short_All",
    "Nonreportable Positions Short All",
    "Nonreportable Positions-Short (All)",
    "NonRept_Positions_Short_All",
  ]);

  if (
    marketIndex === -1 ||
    reportDateIndex === -1 ||
    openInterestIndex === -1 ||
    noncommercialLongIndex === -1 ||
    noncommercialShortIndex === -1 ||
    commercialLongIndex === -1 ||
    commercialShortIndex === -1 ||
    nonreportableLongIndex === -1 ||
    nonreportableShortIndex === -1
  ) {
    console.error("CFTC CSV headers were not recognized:", headers);

    throw new Error(
      "CFTC CSV format was not recognized. Headers found: " +
        headers.join(" | ")
    );
  }

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);

    return {
      marketName: values[marketIndex] || "",
      reportDate: convertCFTCDateToISO(values[reportDateIndex]),

      openInterest: toNumber(values[openInterestIndex]),

      noncommercialLong: toNumber(values[noncommercialLongIndex]),
      noncommercialShort: toNumber(values[noncommercialShortIndex]),

      commercialLong: toNumber(values[commercialLongIndex]),
      commercialShort: toNumber(values[commercialShortIndex]),

      nonreportableLong: toNumber(values[nonreportableLongIndex]),
      nonreportableShort: toNumber(values[nonreportableShortIndex]),
    };
  });
}

async function fetchLegacyRowsForYear(year: number) {
  const url = CFTC_LEGACY_ZIP_BASE_URL + "deacot" + year + ".zip";

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "EdgeVault/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      "Failed to fetch CFTC ZIP for " + year + ": " + response.statusText
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = new AdmZip(Buffer.from(arrayBuffer));
  const entries = zip.getEntries();

  const textEntry = entries.find((entry) => {
    const entryName = entry.entryName.toLowerCase();

    return entryName.endsWith(".txt") || entryName.endsWith(".csv");
  });

  if (!textEntry) {
    throw new Error("No text file found inside CFTC ZIP for " + year + ".");
  }

  const csvText = textEntry.getData().toString("utf8");

  return parseLegacyCSV(csvText);
}

function normalizeCFTCRow(
  row: ParsedLegacyRow,
  symbolConfig: COTSymbol
): COTExternalReport {
  return {
    symbol: symbolConfig.symbol,
    currency: symbolConfig.currency,
    market_name: symbolConfig.market_name,

    report_date: row.reportDate,

    commercial_long: row.commercialLong,
    commercial_short: row.commercialShort,
    commercial_net: row.commercialLong - row.commercialShort,

    noncommercial_long: row.noncommercialLong,
    noncommercial_short: row.noncommercialShort,
    noncommercial_net: row.noncommercialLong - row.noncommercialShort,

    nonreportable_long: row.nonreportableLong,
    nonreportable_short: row.nonreportableShort,
    nonreportable_net: row.nonreportableLong - row.nonreportableShort,

    open_interest: row.openInterest,

    source: "CFTC Legacy Futures Only",
  };
}

function getYearsFromStartDate(startDate: string) {
  const startYear = new Date(startDate).getFullYear();
  const currentYear = new Date().getFullYear();

  const years: number[] = [];

  for (let year = startYear; year <= currentYear; year += 1) {
    years.push(year);
  }

  return years;
}

export async function fetchCOTReportsFromCFTC(startDate = "2025-01-01") {
  const years = getYearsFromStartDate(startDate);
  const allRowsByYear = await Promise.all(
    years.map((year) => fetchLegacyRowsForYear(year))
  );

  const allRows = allRowsByYear.flat();

  const normalizedReports = COT_SYMBOLS.flatMap((symbolConfig) => {
    const targetMarketName = normalizeMarketName(symbolConfig.market_name);

    return allRows
      .filter((row) => {
        const rowMarketName = normalizeMarketName(row.marketName);

        return rowMarketName === targetMarketName && row.reportDate >= startDate;
      })
      .map((row) => normalizeCFTCRow(row, symbolConfig));
  });

  return normalizedReports.sort((a, b) => {
    if (a.symbol === b.symbol) {
      return a.report_date.localeCompare(b.report_date);
    }

    return a.symbol.localeCompare(b.symbol);
  });
}
