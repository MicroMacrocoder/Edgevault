import AdmZip from "adm-zip";

const CFTC_TFF_ZIP_BASE_URL =
  "https://www.cftc.gov/files/dea/history/";

export const COT_TFF_SYMBOLS = [
  {
    label: "U.S. Dollar Index",
    symbol: "DXY",
    currency: "USD",
    market_name: "USD INDEX - ICE FUTURES U.S.",
    cftc_code: "098662",
  },
  {
    label: "Euro FX",
    symbol: "EUR",
    currency: "EUR",
    market_name: "EURO FX - CHICAGO MERCANTILE EXCHANGE",
    cftc_code: "099741",
  },
  {
    label: "British Pound",
    symbol: "GBP",
    currency: "GBP",
    market_name: "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE",
    cftc_code: "096742",
  },
  {
    label: "Japanese Yen",
    symbol: "JPY",
    currency: "JPY",
    market_name: "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",
    cftc_code: "097741",
  },
  {
    label: "Canadian Dollar",
    symbol: "CAD",
    currency: "CAD",
    market_name: "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
    cftc_code: "090741",
  },
  {
    label: "Swiss Franc",
    symbol: "CHF",
    currency: "CHF",
    market_name: "SWISS FRANC - CHICAGO MERCANTILE EXCHANGE",
    cftc_code: "092741",
  },
  {
    label: "Australian Dollar",
    symbol: "AUD",
    currency: "AUD",
    market_name: "AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
    cftc_code: "232741",
  },
  {
    label: "New Zealand Dollar",
    symbol: "NZD",
    currency: "NZD",
    market_name: "NZ DOLLAR - CHICAGO MERCANTILE EXCHANGE",
    cftc_code: "112741",
  },
] as const;

export type COTTFFParticipantName =
  | "dealer"
  | "asset_manager"
  | "leveraged_funds"
  | "other_reportables";

export type COTTFFExternalReport = {
  symbol: string;
  currency: string;
  market_name: string;
  cftc_code: string;

  report_date: string;
  participant: COTTFFParticipantName;

  open_interest: number;
  change_open_interest: number;

  long_position: number;
  short_position: number;
  spreading_position: number;

  change_long: number;
  change_short: number;
  change_spreading: number;

  pct_oi_long: number;
  pct_oi_short: number;
  pct_oi_spreading: number;

  net_position: number;
  net_change: number;
  net_pct_oi: number;

  source: string;
};

type ParsedParticipant = {
  long: number;
  short: number;
  spreading: number;

  changeLong: number;
  changeShort: number;
  changeSpreading: number;

  pctOiLong: number;
  pctOiShort: number;
  pctOiSpreading: number;
};

type ParsedTFFRow = {
  marketName: string;
  cftcCode: string;
  reportDate: string;

  openInterest: number;
  changeOpenInterest: number;

  dealer: ParsedParticipant;
  assetManager: ParsedParticipant;
  leveragedFunds: ParsedParticipant;
  otherReportables: ParsedParticipant;
};

function toNumber(value: string | undefined) {
  if (!value) return 0;

  const parsed = Number(
    value.replace(/,/g, "").trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function roundToThree(value: number) {
  return Math.round(
    (value + Number.EPSILON) * 1000
  ) / 1000;
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

function normalizeCFTCCode(
  value: string | undefined
) {
  if (!value) return "";

  return value
    .replace(/\D/g, "")
    .padStart(6, "0");
}

function parseCSVLine(line: string) {
  const values: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character = line[index];

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (
      character === "," &&
      !insideQuotes
    ) {
      values.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue.trim());

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

function convertCFTCDateToISO(
  value: string | undefined
) {
  if (!value) return "";

  const cleanedValue = value.trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      cleanedValue
    )
  ) {
    return cleanedValue;
  }

  if (
    /^\d{2}\/\d{2}\/\d{4}$/.test(
      cleanedValue
    )
  ) {
    const [month, day, year] =
      cleanedValue.split("/");

    return (
      year +
      "-" +
      month.padStart(2, "0") +
      "-" +
      day.padStart(2, "0")
    );
  }

  if (/^\d{6}$/.test(cleanedValue)) {
    const yearPrefix =
      Number(cleanedValue.slice(0, 2)) >=
      80
        ? "19"
        : "20";

    return (
      yearPrefix +
      cleanedValue.slice(0, 2) +
      "-" +
      cleanedValue.slice(2, 4) +
      "-" +
      cleanedValue.slice(4, 6)
    );
  }

  const parsedDate =
    new Date(cleanedValue);

  if (
    Number.isNaN(parsedDate.getTime())
  ) {
    return "";
  }

  return parsedDate
    .toISOString()
    .split("T")[0];
}

function buildParticipant(
  values: string[],
  indexes: {
    long: number;
    short: number;
    spreading: number;

    changeLong: number;
    changeShort: number;
    changeSpreading: number;

    pctOiLong: number;
    pctOiShort: number;
    pctOiSpreading: number;
  }
): ParsedParticipant {
  return {
    long: toNumber(
      values[indexes.long]
    ),
    short: toNumber(
      values[indexes.short]
    ),
    spreading: toNumber(
      values[indexes.spreading]
    ),

    changeLong: toNumber(
      values[indexes.changeLong]
    ),
    changeShort: toNumber(
      values[indexes.changeShort]
    ),
    changeSpreading: toNumber(
      values[indexes.changeSpreading]
    ),

    pctOiLong: toNumber(
      values[indexes.pctOiLong]
    ),
    pctOiShort: toNumber(
      values[indexes.pctOiShort]
    ),
    pctOiSpreading: toNumber(
      values[indexes.pctOiSpreading]
    ),
  };
}

function parseTFFCSV(
  csvText: string
): ParsedTFFRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers =
    parseCSVLine(lines[0]);

  const marketIndex =
    getColumnIndex(headers, [
      "Market_and_Exchange_Names",
    ]);

  const cftcCodeIndex =
    getColumnIndex(headers, [
      "CFTC_Contract_Market_Code",
      "CFTC_Contract_Market_Code_Quotes",
    ]);

  const reportDateIndex =
    getColumnIndex(headers, [
      "Report_Date_as_YYYY-MM-DD",
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

  const participantIndexes = {
    dealer: {
      long: getColumnIndex(headers, [
        "Dealer_Positions_Long_All",
      ]),
      short: getColumnIndex(headers, [
        "Dealer_Positions_Short_All",
      ]),
      spreading: getColumnIndex(headers, [
        "Dealer_Positions_Spread_All",
      ]),

      changeLong: getColumnIndex(headers, [
        "Change_in_Dealer_Long_All",
      ]),
      changeShort: getColumnIndex(headers, [
        "Change_in_Dealer_Short_All",
      ]),
      changeSpreading: getColumnIndex(
        headers,
        ["Change_in_Dealer_Spread_All"]
      ),

      pctOiLong: getColumnIndex(headers, [
        "Pct_of_OI_Dealer_Long_All",
      ]),
      pctOiShort: getColumnIndex(headers, [
        "Pct_of_OI_Dealer_Short_All",
      ]),
      pctOiSpreading: getColumnIndex(
        headers,
        ["Pct_of_OI_Dealer_Spread_All"]
      ),
    },

    assetManager: {
      long: getColumnIndex(headers, [
        "Asset_Mgr_Positions_Long_All",
      ]),
      short: getColumnIndex(headers, [
        "Asset_Mgr_Positions_Short_All",
      ]),
      spreading: getColumnIndex(headers, [
        "Asset_Mgr_Positions_Spread_All",
      ]),

      changeLong: getColumnIndex(headers, [
        "Change_in_Asset_Mgr_Long_All",
      ]),
      changeShort: getColumnIndex(headers, [
        "Change_in_Asset_Mgr_Short_All",
      ]),
      changeSpreading: getColumnIndex(
        headers,
        [
          "Change_in_Asset_Mgr_Spread_All",
        ]
      ),

      pctOiLong: getColumnIndex(headers, [
        "Pct_of_OI_Asset_Mgr_Long_All",
      ]),
      pctOiShort: getColumnIndex(headers, [
        "Pct_of_OI_Asset_Mgr_Short_All",
      ]),
      pctOiSpreading: getColumnIndex(
        headers,
        [
          "Pct_of_OI_Asset_Mgr_Spread_All",
        ]
      ),
    },

    leveragedFunds: {
      long: getColumnIndex(headers, [
        "Lev_Money_Positions_Long_All",
      ]),
      short: getColumnIndex(headers, [
        "Lev_Money_Positions_Short_All",
      ]),
      spreading: getColumnIndex(headers, [
        "Lev_Money_Positions_Spread_All",
      ]),

      changeLong: getColumnIndex(headers, [
        "Change_in_Lev_Money_Long_All",
      ]),
      changeShort: getColumnIndex(headers, [
        "Change_in_Lev_Money_Short_All",
      ]),
      changeSpreading: getColumnIndex(
        headers,
        [
          "Change_in_Lev_Money_Spread_All",
        ]
      ),

      pctOiLong: getColumnIndex(headers, [
        "Pct_of_OI_Lev_Money_Long_All",
      ]),
      pctOiShort: getColumnIndex(headers, [
        "Pct_of_OI_Lev_Money_Short_All",
      ]),
      pctOiSpreading: getColumnIndex(
        headers,
        [
          "Pct_of_OI_Lev_Money_Spread_All",
        ]
      ),
    },

    otherReportables: {
      long: getColumnIndex(headers, [
        "Other_Rept_Positions_Long_All",
      ]),
      short: getColumnIndex(headers, [
        "Other_Rept_Positions_Short_All",
      ]),
      spreading: getColumnIndex(headers, [
        "Other_Rept_Positions_Spread_All",
      ]),

      changeLong: getColumnIndex(headers, [
        "Change_in_Other_Rept_Long_All",
      ]),
      changeShort: getColumnIndex(headers, [
        "Change_in_Other_Rept_Short_All",
      ]),
      changeSpreading: getColumnIndex(
        headers,
        [
          "Change_in_Other_Rept_Spread_All",
        ]
      ),

      pctOiLong: getColumnIndex(headers, [
        "Pct_of_OI_Other_Rept_Long_All",
      ]),
      pctOiShort: getColumnIndex(headers, [
        "Pct_of_OI_Other_Rept_Short_All",
      ]),
      pctOiSpreading: getColumnIndex(
        headers,
        [
          "Pct_of_OI_Other_Rept_Spread_All",
        ]
      ),
    },
  };

  const allRequiredIndexes = [
    marketIndex,
    cftcCodeIndex,
    reportDateIndex,
    openInterestIndex,
    changeOpenInterestIndex,
    ...Object.values(
      participantIndexes
    ).flatMap((participant) =>
      Object.values(participant)
    ),
  ];

  if (
    allRequiredIndexes.some(
      (index) => index === -1
    )
  ) {
    throw new Error(
      "CFTC TFF CSV format was not recognized. Headers found: " +
        headers.join(" | ")
    );
  }

  return lines
    .slice(1)
    .map((line) => {
      const values =
        parseCSVLine(line);

      return {
        marketName:
          values[marketIndex] || "",

        cftcCode:
          normalizeCFTCCode(
            values[cftcCodeIndex]
          ),

        reportDate:
          convertCFTCDateToISO(
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
          participantIndexes.dealer
        ),

        assetManager:
          buildParticipant(
            values,
            participantIndexes.assetManager
          ),

        leveragedFunds:
          buildParticipant(
            values,
            participantIndexes.leveragedFunds
          ),

        otherReportables:
          buildParticipant(
            values,
            participantIndexes.otherReportables
          ),
      };
    })
    .filter(
      (row) =>
        Boolean(row.reportDate) &&
        Boolean(row.cftcCode)
    );
}

async function fetchTFFRowsForYear(
  year: number
) {
  const url =
    CFTC_TFF_ZIP_BASE_URL +
    `fut_fin_txt_${year}.zip`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "EdgeVault/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      "Failed to fetch CFTC TFF ZIP for " +
        year +
        ": " +
        response.status +
        " " +
        response.statusText
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const zip = new AdmZip(
    Buffer.from(arrayBuffer)
  );

  const textEntry = zip
    .getEntries()
    .find((entry) => {
      const entryName =
        entry.entryName.toLowerCase();

      return (
        entryName.endsWith(".txt") ||
        entryName.endsWith(".csv")
      );
    });

  if (!textEntry) {
    throw new Error(
      "No text file found inside CFTC TFF ZIP for " +
        year +
        "."
    );
  }

  const csvText = textEntry
    .getData()
    .toString("utf8");

  return parseTFFCSV(csvText);
}

function getYearsFromStartDate(
  startDate: string
) {
  const startYear =
    new Date(startDate).getFullYear();

  const currentYear =
    new Date().getFullYear();

  const years: number[] = [];

  for (
    let year = startYear;
    year <= currentYear;
    year += 1
  ) {
    years.push(year);
  }

  return years;
}

function normalizeParticipant(
  symbolConfig:
    (typeof COT_TFF_SYMBOLS)[number],
  row: ParsedTFFRow,
  participant:
    COTTFFParticipantName,
  values: ParsedParticipant
): COTTFFExternalReport {
  return {
    symbol: symbolConfig.symbol,
    currency: symbolConfig.currency,
    market_name: row.marketName,
    cftc_code: symbolConfig.cftc_code,

    report_date: row.reportDate,
    participant,

    open_interest:
      row.openInterest,
    change_open_interest:
      row.changeOpenInterest,

    long_position: values.long,
    short_position: values.short,
    spreading_position:
      values.spreading,

    change_long:
      values.changeLong,
    change_short:
      values.changeShort,
    change_spreading:
      values.changeSpreading,

    pct_oi_long:
      roundToThree(values.pctOiLong),
    pct_oi_short:
      roundToThree(values.pctOiShort),
    pct_oi_spreading:
      roundToThree(
        values.pctOiSpreading
      ),

    net_position:
      values.long - values.short,

    net_change:
      values.changeLong -
      values.changeShort,

    net_pct_oi:
      roundToThree(
        values.pctOiLong -
          values.pctOiShort
      ),

    source:
      "CFTC TFF Futures Only",
  };
}

export async function fetchCOTTFFReportsFromCFTC(
  startDate = "2025-01-01"
) {
  const years =
    getYearsFromStartDate(startDate);

  const rowsByYear =
    await Promise.all(
      years.map((year) =>
        fetchTFFRowsForYear(year)
      )
    );

  const allRows =
    rowsByYear.flat();

  const reports =
    COT_TFF_SYMBOLS.flatMap(
      (symbolConfig) => {
        const matchingRows =
          allRows.filter(
            (row) =>
              row.cftcCode ===
                symbolConfig.cftc_code &&
              row.reportDate >= startDate
          );

        return matchingRows.flatMap(
          (row) => [
            normalizeParticipant(
              symbolConfig,
              row,
              "dealer",
              row.dealer
            ),
            normalizeParticipant(
              symbolConfig,
              row,
              "asset_manager",
              row.assetManager
            ),
            normalizeParticipant(
              symbolConfig,
              row,
              "leveraged_funds",
              row.leveragedFunds
            ),
            normalizeParticipant(
              symbolConfig,
              row,
              "other_reportables",
              row.otherReportables
            ),
          ]
        );
      }
    );

  return reports.sort((a, b) => {
    if (a.symbol !== b.symbol) {
      return a.symbol.localeCompare(
        b.symbol
      );
    }

    if (
      a.report_date !== b.report_date
    ) {
      return a.report_date.localeCompare(
        b.report_date
      );
    }

    return a.participant.localeCompare(
      b.participant
    );
  });
}