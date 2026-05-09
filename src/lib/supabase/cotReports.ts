import { createClient } from "@supabase/supabase-js";
import type { COTExternalReport, COTReport } from "@/types/cot";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export async function upsertCOTReports(reports: COTExternalReport[]) {
  const supabaseServer = getSupabaseServerClient();

  const rows = reports.map((report) => ({
    symbol: report.symbol,
    currency: report.currency,
    market_name: report.market_name,

    report_date: report.report_date,

    commercial_long: report.commercial_long,
    commercial_short: report.commercial_short,
    commercial_net: report.commercial_net,

    noncommercial_long: report.noncommercial_long,
    noncommercial_short: report.noncommercial_short,
    noncommercial_net: report.noncommercial_net,

    nonreportable_long: report.nonreportable_long,
    nonreportable_short: report.nonreportable_short,
    nonreportable_net: report.nonreportable_net,

    open_interest: report.open_interest,

    source: report.source,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseServer.from("cot_reports").upsert(rows, {
    onConflict: "symbol,report_date",
  });

  if (error) {
    console.error("UPSERT COT REPORTS ERROR:", error.message);
    return { error };
  }

  return { error: null };
}

export async function getStoredCOTReports(symbol?: string) {
  const supabaseServer = getSupabaseServerClient();

  let query = supabaseServer
    .from("cot_reports")
    .select("*")
    .order("report_date", { ascending: true });

  if (symbol && symbol !== "all") {
    query = query.eq("symbol", symbol);
  }

  const { data, error } = await query;

  if (error) {
    console.error("GET STORED COT REPORTS ERROR:", error.message);
    return { error, reports: [] as COTReport[] };
  }

  return {
    error: null,
    reports: (data || []) as COTReport[],
  };
}
