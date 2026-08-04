import { createClient } from "@supabase/supabase-js";

export const STOOQ_DXY_URL = "https://stooq.com/q/d/?s=dx.f&i=d";

const VOLUME_OI_TABLE = "volume_oi_data";

export type StooqDxyVolumeOiRow = {
  symbol: "DXY";
  currency: "USD";
  market_name: "US DOLLAR INDEX";
  exchange: "ICE";
  trade_date: string;
  volume: number;
  open_interest: number;
  source: "Stooq DX.F Daily Futures";
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8211;/gi, "-")
    .replace(/&minus;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string) {
  const cleaned = value
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/%/g, "")
    .replace(/−/g, "-")
    .trim();

  if (!cleaned || cleaned === "-") {
    return 0;
  }

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function parseStooqDate(value: string) {
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const parts = value.trim().split(/\s+/);

  if (parts.length !== 3) {
    throw new Error(`Invalid Stooq date format: ${value}`);
  }

  const day = parts[0].padStart(2, "0");
  const month = months[parts[1]];
  const year = parts[2];

  if (!month) {
    throw new Error(`Invalid Stooq month: ${parts[1]}`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Parses the rendered Stooq HTML table.
 *
 * This function does not fetch Stooq itself. That allows the same parser
 * to be reused by the Playwright browser collector after the browser has
 * completed Stooq's JavaScript verification.
 */
export function parseStooqDxyVolumeOiRows(
  html: string
): StooqDxyVolumeOiRow[] {
  if (!html || !html.includes("Open Interest")) {
    throw new Error(
      "The rendered Stooq page does not contain the Open Interest table."
    );
  }

  const tableRows = [
    ...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi),
  ];

  const rowsByTradeDate = new Map<
    string,
    StooqDxyVolumeOiRow
  >();

  for (const tableRow of tableRows) {
    const rowHtml = tableRow[1];

    const cells = [
      ...rowHtml.matchAll(
        /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      ),
    ]
      .map((cell) => cleanHtml(cell[1]))
      .filter(Boolean);

    /**
     * Expected Stooq table format:
     *
     * No. | Date | Open | High | Low | Close |
     * Change % | Change | Volume | Open Interest
     */
    if (cells.length < 10) {
      continue;
    }

    const dateCell = cells[1];

    if (
      !/\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}/.test(dateCell)
    ) {
      continue;
    }

    const tradeDate = parseStooqDate(dateCell);
    const volume = parseNumber(cells[8]);
    const openInterest = parseNumber(cells[9]);

    rowsByTradeDate.set(tradeDate, {
      symbol: "DXY",
      currency: "USD",
      market_name: "US DOLLAR INDEX",
      exchange: "ICE",
      trade_date: tradeDate,
      volume,
      open_interest: openInterest,
      source: "Stooq DX.F Daily Futures",
    });
  }

  const parsedRows = [...rowsByTradeDate.values()].sort(
    (a, b) => a.trade_date.localeCompare(b.trade_date)
  );

  if (parsedRows.length === 0) {
    throw new Error(
      "No DXY Volume/OI rows were found in the rendered Stooq page."
    );
  }

  return parsedRows;
}

/**
 * Retained for diagnostics and backwards compatibility.
 *
 * A normal server fetch may fail when Stooq requires JavaScript browser
 * verification. The scheduled Playwright collector will use the parser
 * above instead.
 */
export async function fetchStooqDxyVolumeOiRows(): Promise<
  StooqDxyVolumeOiRow[]
> {
  const response = await fetch(STOOQ_DXY_URL, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/151.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Stooq request failed with status ${response.status}.`
    );
  }

  const html = await response.text();

  return parseStooqDxyVolumeOiRows(html);
}

/**
 * Saves already-parsed Stooq rows to Supabase.
 *
 * Rows where Volume or Open Interest is zero are treated as incomplete
 * and are not saved.
 */
export async function syncStooqDxyVolumeOiRows(
  rows: StooqDxyVolumeOiRow[]
) {
  const completeRows = rows.filter(
    (row) => row.volume > 0 && row.open_interest > 0
  );

  if (completeRows.length === 0) {
    throw new Error(
      "No complete DXY Volume/OI rows are available to sync."
    );
  }

  const supabase = getSupabaseAdminClient();
  const updatedAt = new Date().toISOString();

  const payload = completeRows.map((row) => ({
    symbol: row.symbol,
    currency: row.currency,
    market_name: row.market_name,
    exchange: row.exchange,
    trade_date: row.trade_date,
    volume: row.volume,
    open_interest: row.open_interest,
    source: row.source,
    updated_at: updatedAt,
  }));

  const { data, error } = await supabase
    .from(VOLUME_OI_TABLE)
    .upsert(payload, {
      onConflict: "symbol,trade_date",
    })
    .select();

  if (error) {
    throw new Error(
      `Failed to sync DXY Volume/OI: ${error.message}`
    );
  }

  return {
    synced: data?.length || 0,
    latestComplete: completeRows[completeRows.length - 1],
    updatedAt,
  };
}

/**
 * Original server-fetch workflow retained for diagnostic routes.
 *
 * The automated collector will call syncStooqDxyVolumeOiRows() after
 * Playwright provides the rendered HTML.
 */
export async function syncStooqDxyVolumeOiReports() {
  const rows = await fetchStooqDxyVolumeOiRows();

  return syncStooqDxyVolumeOiRows(rows);
}