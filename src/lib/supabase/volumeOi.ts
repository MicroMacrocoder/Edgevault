import { createClient } from "@supabase/supabase-js";
import type {
  VolumeOIExternalReport,
  VolumeOIReport,
} from "@/types/volumeOi";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey
  );
}

function dedupeVolumeOIReports(
  reports: VolumeOIExternalReport[]
) {
  const uniqueReports = new Map<
    string,
    VolumeOIExternalReport
  >();

  const duplicateKeys = new Set<string>();

  for (const report of reports) {
    const key = `${report.symbol}:${report.trade_date}`;

    if (uniqueReports.has(key)) {
      duplicateKeys.add(key);
    }

    uniqueReports.set(key, report);
  }

  if (duplicateKeys.size) {
    console.warn(
      "DUPLICATE VOLUME OI REPORT KEYS REMOVED BEFORE UPSERT:",
      Array.from(duplicateKeys)
    );
  }

  return Array.from(uniqueReports.values());
}

export async function upsertVolumeOIReports(
  reports: VolumeOIExternalReport[]
) {
  const supabaseServer =
    getSupabaseServerClient();

  const uniqueReports =
    dedupeVolumeOIReports(reports);

  const updatedAt = new Date().toISOString();

  const rows = uniqueReports.map((report) => ({
    symbol: report.symbol,
    currency: report.currency,
    market_name: report.market_name,
    exchange: report.exchange,

    trade_date: report.trade_date,

    volume: report.volume,
    open_interest: report.open_interest,

    source: report.source,
    updated_at: updatedAt,
  }));

  if (!rows.length) {
    return { error: null };
  }

  const { error } = await supabaseServer
    .from("volume_oi_data")
    .upsert(rows, {
      onConflict: "symbol,trade_date",
    });

  if (error) {
    console.error(
      "UPSERT VOLUME OI REPORTS ERROR:",
      error.message
    );

    return { error };
  }

  return { error: null };
}

export async function getStoredVolumeOIReports(
  symbol?: string
) {
  const supabaseServer =
    getSupabaseServerClient();

  let query = supabaseServer
    .from("volume_oi_data")
    .select("*")
    .order("trade_date", { ascending: true });

  if (symbol && symbol !== "all") {
    query = query.eq("symbol", symbol);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "GET STORED VOLUME OI REPORTS ERROR:",
      error.message
    );

    return {
      error,
      reports: [] as VolumeOIReport[],
    };
  }

  return {
    error: null,
    reports: (data || []) as VolumeOIReport[],
  };
}

export async function getLatestVolumeOIUpdatedAt(
  symbol?: string
) {
  const supabaseServer =
    getSupabaseServerClient();

  let query = supabaseServer
    .from("volume_oi_data")
    .select("updated_at")
    .not("updated_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (symbol && symbol !== "all") {
    query = query.eq("symbol", symbol);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "GET LATEST VOLUME OI UPDATED AT ERROR:",
      error.message
    );

    return {
      error,
      updatedAt: null as string | null,
    };
  }

  const latestRow =
    Array.isArray(data) && data.length
      ? data[0]
      : null;

  return {
    error: null,
    updatedAt:
      latestRow?.updated_at || null,
  };
}

export async function getLatestVolumeOITradeDate(
  symbol?: string
) {
  const supabaseServer =
    getSupabaseServerClient();

  let query = supabaseServer
    .from("volume_oi_data")
    .select("trade_date")
    .not("trade_date", "is", null)
    .order("trade_date", { ascending: false })
    .limit(1);

  if (symbol && symbol !== "all") {
    query = query.eq("symbol", symbol);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "GET LATEST VOLUME OI TRADE DATE ERROR:",
      error.message
    );

    return {
      error,
      tradeDate: null as string | null,
    };
  }

  const latestRow =
    Array.isArray(data) && data.length
      ? data[0]
      : null;

  return {
    error: null,
    tradeDate:
      latestRow?.trade_date || null,
  };
}