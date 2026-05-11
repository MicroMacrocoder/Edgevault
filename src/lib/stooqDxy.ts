import { createClient } from "@supabase/supabase-js";

const STOOQ_DXY_URL = "https://stooq.com/q/d/?s=dx.f&i=d";
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

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function cleanHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "-")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseNumber(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/%/g, "").trim();

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

export async function fetchStooqDxyVolumeOiRows(): Promise<
  StooqDxyVolumeOiRow[]
> {
  const response = await fetch(STOOQ_DXY_URL, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; EdgeVault/1.0; +https://edgevault.app)",
      Accept: "text/html,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Stooq request failed with status ${response.status}`);
  }

  const html = await response.text();

  if (!html || !html.includes("Open Interest")) {
    throw new Error("Stooq returned an empty or invalid HTML response.");
  }

  const tableRows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  const parsedRows: StooqDxyVolumeOiRow[] = [];

  for (const tableRow of tableRows) {
    const rowHtml = tableRow[1];

    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cleanHtml(cell[1]))
      .filter(Boolean);

    /**
     * Stooq table format:
     * No. | Date | Open | High | Low | Close | Change % | Change | Volume | Open Interest
     */
    if (cells.length < 10) {
      continue;
    }

    const dateCell = cells[1];

    if (!/\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}/.test(dateCell)) {
      continue;
    }

    const volume = parseNumber(cells[8]);
    const openInterest = parseNumber(cells[9]);

    parsedRows.push({
      symbol: "DXY",
      currency: "USD",
      market_name: "US DOLLAR INDEX",
      exchange: "ICE",
      trade_date: parseStooqDate(dateCell),
      volume,
      open_interest: openInterest,
      source: "Stooq DX.F Daily Futures",
    });
  }

  parsedRows.sort((a, b) => a.trade_date.localeCompare(b.trade_date));

  if (parsedRows.length === 0) {
    throw new Error("No DXY Volume/OI rows were found from Stooq.");
  }

  return parsedRows;
}

export async function syncStooqDxyVolumeOiReports() {
  const supabase = getSupabaseAdminClient();

  const rows = await fetchStooqDxyVolumeOiRows();

  /**
   * Sometimes Stooq shows today's row with Open Interest = 0.
   * We do not save incomplete Open Interest rows.
   */
  const completeRows = rows.filter(
    (row) => row.volume > 0 && row.open_interest > 0
  );

  if (completeRows.length === 0) {
    throw new Error("No complete DXY Volume/OI rows available to sync.");
  }

  const payload = completeRows.map((row) => ({
    symbol: row.symbol,
    currency: row.currency,
    market_name: row.market_name,
    exchange: row.exchange,
    trade_date: row.trade_date,
    volume: row.volume,
    open_interest: row.open_interest,
    source: row.source,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from(VOLUME_OI_TABLE)
    .upsert(payload, {
      onConflict: "symbol,trade_date",
    })
    .select();

  if (error) {
    throw new Error(`Failed to sync DXY Volume/OI: ${error.message}`);
  }

  return {
    synced: data?.length || 0,
    latestComplete: completeRows[completeRows.length - 1],
  };
}
