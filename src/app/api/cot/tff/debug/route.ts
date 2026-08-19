import { NextResponse } from "next/server";
import AdmZip from "adm-zip";

const CFTC_TFF_ZIP_BASE_URL =
  "https://www.cftc.gov/files/dea/history/";

const TFF_SYMBOLS = [
  { symbol: "DXY", label: "U.S. Dollar Index", cftcCode: "098662" },
  { symbol: "EUR", label: "Euro FX", cftcCode: "099741" },
  { symbol: "GBP", label: "British Pound", cftcCode: "096742" },
  { symbol: "JPY", label: "Japanese Yen", cftcCode: "097741" },
  { symbol: "CAD", label: "Canadian Dollar", cftcCode: "090741" },
  { symbol: "CHF", label: "Swiss Franc", cftcCode: "092741" },
  { symbol: "AUD", label: "Australian Dollar", cftcCode: "232741" },
  { symbol: "NZD", label: "New Zealand Dollar", cftcCode: "112741" },
] as const;

type TffParticipant = {
  long: number;
  short: number;
  spreading: number;

  changeLong: number;
  changeShort: number;
  changeSpreading: number;

  pctOiLong: number;
  pctOiShort: number;
  pctOiSpreading: number;

  net: number;
  netChange: number;
  netPctOi: number;
};

type ParsedTffRow = {
  marketName: string;
  cftcCode: string;
  reportDate: string;
  openInterest: number;
  changeOpenInterest: number;

  dealer: TffParticipant;
  assetManager: TffParticipant;
  leveragedFunds: TffParticipant;
  otherReportables: TffParticipant;

  nonReportableLong: number;
  nonReportableShort: number;
};

function toNumber(value: string | undefined) {
  if (!value) return 0;

  const cleaned = value
    .replace(/,/g, "")
    .trim();

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
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

function normalizeCftcCode(
  value: string | undefined
) {
  if (!value) return "";

  return value
    .replace(/\D/g, "")
    .padStart(6, "0");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

function getColumnIndex(
  headers: string[],
  possibleNames: string[]
) {
  const normalizedHeaders =
    headers.map(normalizeHeader);

  for (const possibleName of possibleNames) {
    const target =
      normalizeHeader(possibleName);

    const index =
      normalizedHeaders.findIndex(
        (header) => header === target
      );

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function convertCftcDateToIso(
  value: string | undefined
) {
  if (!value) return "";

  const cleaned = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    const [month, day, year] =
      cleaned.split("/");

    return `${year}-${month}-${day}`;
  }

  if (/^\d{6}$/.test(cleaned)) {
    const prefix =
      Number(cleaned.slice(0, 2)) >= 80
        ? "19"
        : "20";

    return (
      prefix +
      cleaned.slice(0, 2) +
      "-" +
      cleaned.slice(2, 4) +
      "-" +
      cleaned.slice(4, 6)
    );
  }

  const parsed = new Date(cleaned);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed
    .toISOString()
    .split("T")[0];
}

function buildParticipant(
  values: string[],
  indexes: {
    long: number;
    short: number;
    spread: number;
    changeLong: number;
    changeShort: number;
    changeSpread: number;
    pctLong: number;
    pctShort: number;
    pctSpread: number;
  }
): TffParticipant {
  const long = toNumber(
    values[indexes.long]
  );

  const short = toNumber(
    values[indexes.short]
  );

  const spreading = toNumber(
    values[indexes.spread]
  );

  const changeLong = toNumber(
    values[indexes.changeLong]
  );

  const changeShort = toNumber(
    values[indexes.changeShort]
  );

  const changeSpreading = toNumber(
    values[indexes.changeSpread]
  );

  const pctOiLong = toNumber(
    values[indexes.pctLong]
  );

  const pctOiShort = toNumber(
    values[indexes.pctShort]
  );

  const pctOiSpreading = toNumber(
    values[indexes.pctSpread]
  );

  return {
    long,
    short,
    spreading,

    changeLong,
    changeShort,
    changeSpreading,

    pctOiLong,
    pctOiShort,
    pctOiSpreading,

    net: long - short,
    netChange:
      changeLong - changeShort,
    netPctOi:
      pctOiLong - pctOiShort,
  };
}

function parseTffCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(
      "CFTC TFF ZIP contained no usable rows."
    );
  }

  const headers =
    parseCsvLine(lines[0]);

  const marketIndex = getColumnIndex(
    headers,
    ["Market_and_Exchange_Names"]
  );

  const cftcCodeIndex = getColumnIndex(
    headers,
    [
      "CFTC_Contract_Market_Code",
      "CFTC_Contract_Market_Code_Quotes",
    ]
  );

  const reportDateIndex =
    getColumnIndex(headers, [
      "Report_Date_as_MM_DD_YYYY",
      "As_of_Date_In_Form_YYMMDD",
    ]);

  const openInterestIndex =
    getColumnIndex(headers, [
      "Open_Interest_All",
    ]);

  const changeOpenInterestIndex =
    getColumnIndex(headers, [
      "Change_in_Open_Interest_All",
    ]);

  const requiredIndexes = {
    dealer: {
      long: getColumnIndex(headers, [
        "Dealer_Positions_Long_All",
      ]),
      short: getColumnIndex(headers, [
        "Dealer_Positions_Short_All",
      ]),
      spread: getColumnIndex(headers, [
        "Dealer_Positions_Spread_All",
      ]),
      changeLong: getColumnIndex(headers, [
        "Change_in_Dealer_Long_All",
      ]),
      changeShort: getColumnIndex(headers, [
        "Change_in_Dealer_Short_All",
      ]),
      changeSpread: getColumnIndex(headers, [
        "Change_in_Dealer_Spread_All",
      ]),
      pctLong: getColumnIndex(headers, [
        "Pct_of_OI_Dealer_Long_All",
      ]),
      pctShort: getColumnIndex(headers, [
        "Pct_of_OI_Dealer_Short_All",
      ]),
      pctSpread: getColumnIndex(headers, [
        "Pct_of_OI_Dealer_Spread_All",
      ]),
    },

    assetManager: {
      long: getColumnIndex(headers, [
        "Asset_Mgr_Positions_Long_All",
      ]),
      short: getColumnIndex(headers, [
        "Asset_Mgr_Positions_Short_All",
      ]),
      spread: getColumnIndex(headers, [
        "Asset_Mgr_Positions_Spread_All",
      ]),
      changeLong: getColumnIndex(headers, [
        "Change_in_Asset_Mgr_Long_All",
      ]),
      changeShort: getColumnIndex(headers, [
        "Change_in_Asset_Mgr_Short_All",
      ]),
      changeSpread: getColumnIndex(headers, [
        "Change_in_Asset_Mgr_Spread_All",
      ]),
      pctLong: getColumnIndex(headers, [
        "Pct_of_OI_Asset_Mgr_Long_All",
      ]),
      pctShort: getColumnIndex(headers, [
        "Pct_of_OI_Asset_Mgr_Short_All",
      ]),
      pctSpread: getColumnIndex(headers, [
        "Pct_of_OI_Asset_Mgr_Spread_All",
      ]),
    },

    leveragedFunds: {
      long: getColumnIndex(headers, [
        "Lev_Money_Positions_Long_All",
      ]),
      short: getColumnIndex(headers, [
        "Lev_Money_Positions_Short_All",
      ]),
      spread: getColumnIndex(headers, [
        "Lev_Money_Positions_Spread_All",
      ]),
      changeLong: getColumnIndex(headers, [
        "Change_in_Lev_Money_Long_All",
      ]),
      changeShort: getColumnIndex(headers, [
        "Change_in_Lev_Money_Short_All",
      ]),
      changeSpread: getColumnIndex(headers, [
        "Change_in_Lev_Money_Spread_All",
      ]),
      pctLong: getColumnIndex(headers, [
        "Pct_of_OI_Lev_Money_Long_All",
      ]),
      pctShort: getColumnIndex(headers, [
        "Pct_of_OI_Lev_Money_Short_All",
      ]),
      pctSpread: getColumnIndex(headers, [
        "Pct_of_OI_Lev_Money_Spread_All",
      ]),
    },

    otherReportables: {
      long: getColumnIndex(headers, [
        "Other_Rept_Positions_Long_All",
      ]),
      short: getColumnIndex(headers, [
        "Other_Rept_Positions_Short_All",
      ]),
      spread: getColumnIndex(headers, [
        "Other_Rept_Positions_Spread_All",
      ]),
      changeLong: getColumnIndex(headers, [
        "Change_in_Other_Rept_Long_All",
      ]),
      changeShort: getColumnIndex(headers, [
        "Change_in_Other_Rept_Short_All",
      ]),
      changeSpread: getColumnIndex(headers, [
        "Change_in_Other_Rept_Spread_All",
      ]),
      pctLong: getColumnIndex(headers, [
        "Pct_of_OI_Other_Rept_Long_All",
      ]),
      pctShort: getColumnIndex(headers, [
        "Pct_of_OI_Other_Rept_Short_All",
      ]),
      pctSpread: getColumnIndex(headers, [
        "Pct_of_OI_Other_Rept_Spread_All",
      ]),
    },
  };

  const nonReportableLongIndex =
    getColumnIndex(headers, [
      "NonRept_Positions_Long_All",
    ]);

  const nonReportableShortIndex =
    getColumnIndex(headers, [
      "NonRept_Positions_Short_All",
    ]);

  const allParticipantIndexes =
    Object.values(requiredIndexes)
      .flatMap((participant) =>
        Object.values(participant)
      );

  if (
    marketIndex === -1 ||
    cftcCodeIndex === -1 ||
    reportDateIndex === -1 ||
    openInterestIndex === -1 ||
    changeOpenInterestIndex === -1 ||
    nonReportableLongIndex === -1 ||
    nonReportableShortIndex === -1 ||
    allParticipantIndexes.some(
      (index) => index === -1
    )
  ) {
    throw new Error(
      "CFTC TFF CSV headers were not recognized. Headers found: " +
        headers.join(" | ")
    );
  }

  const rows: ParsedTffRow[] =
    lines.slice(1).map((line) => {
      const values =
        parseCsvLine(line);

      return {
        marketName:
          values[marketIndex] || "",

        cftcCode:
          normalizeCftcCode(
            values[cftcCodeIndex]
          ),

        reportDate:
          convertCftcDateToIso(
            values[reportDateIndex]
          ),

        openInterest:
          toNumber(
            values[openInterestIndex]
          ),

        changeOpenInterest:
          toNumber(
            values[
              changeOpenInterestIndex
            ]
          ),

        dealer: buildParticipant(
          values,
          requiredIndexes.dealer
        ),

        assetManager: buildParticipant(
          values,
          requiredIndexes.assetManager
        ),

        leveragedFunds:
          buildParticipant(
            values,
            requiredIndexes.leveragedFunds
          ),

        otherReportables:
          buildParticipant(
            values,
            requiredIndexes.otherReportables
          ),

        nonReportableLong:
          toNumber(
            values[
              nonReportableLongIndex
            ]
          ),

        nonReportableShort:
          toNumber(
            values[
              nonReportableShortIndex
            ]
          ),
      };
    });

  return {
    headers,
    rows,
  };
}

export async function GET() {
  try {
    const year =
      new Date().getUTCFullYear();

    const zipUrl =
      CFTC_TFF_ZIP_BASE_URL +
      `fut_fin_txt_${year}.zip`;

    const response =
      await fetch(zipUrl, {
        cache: "no-store",
        headers: {
          "User-Agent":
            "EdgeVault/1.0",
        },
      });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Failed to fetch official CFTC TFF ZIP.",
          status: response.status,
          zipUrl,
        },
        { status: response.status }
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    const zip = new AdmZip(
      Buffer.from(arrayBuffer)
    );

    const entries =
      zip.getEntries();

    const textEntry =
      entries.find((entry) => {
        const name =
          entry.entryName.toLowerCase();

        return (
          name.endsWith(".txt") ||
          name.endsWith(".csv")
        );
      });

    if (!textEntry) {
      throw new Error(
        "No text/CSV file found inside official CFTC TFF ZIP."
      );
    }

    const csvText =
      textEntry
        .getData()
        .toString("utf8");

    const { headers, rows } =
      parseTffCsv(csvText);

    const results =
      TFF_SYMBOLS.map(
        (symbolConfig) => {
          const matchingRows =
            rows
              .filter(
                (row) =>
                  row.cftcCode ===
                  symbolConfig.cftcCode
              )
              .sort((a, b) =>
                b.reportDate.localeCompare(
                  a.reportDate
                )
              );

          return {
            symbol:
              symbolConfig.symbol,
            label:
              symbolConfig.label,
            cftcCode:
              symbolConfig.cftcCode,

            rowCount:
              matchingRows.length,

            latest:
              matchingRows[0] || null,

            previous:
              matchingRows[1] || null,
          };
        }
      );

    return NextResponse.json(
      {
        error: false,

        message:
          "Official CFTC TFF Futures-Only ZIP diagnostic completed. No EdgeVault data was changed.",

        source:
          "CFTC Historical Compressed - Traders in Financial Futures, Futures Only",

        year,
        zipUrl,

        zipEntries:
          entries.map(
            (entry) =>
              entry.entryName
          ),

        headerCount:
          headers.length,

        headers,

        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "CFTC TFF ZIP DEBUG ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to inspect CFTC TFF ZIP.",
      },
      { status: 500 }
    );
  }
}