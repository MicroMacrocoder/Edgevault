import { createClient } from "@supabase/supabase-js";
import type {
  COTTFFExternalReport,
  COTTFFParticipantName,
} from "@/lib/cot/tff";

export type StoredCOTTFFReport =
  COTTFFExternalReport & {
    id: string;
    created_at: string;
    updated_at: string;
  };

type GetStoredCOTTFFReportsOptions = {
  symbol?: string;
  participant?: COTTFFParticipantName | "all";
  startDate?: string;
  endDate?: string;
};

function getSupabaseServerClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL"
    );
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey
  );
}

function dedupeCOTTFFReports(
  reports: COTTFFExternalReport[]
) {
  const uniqueReports = new Map<
    string,
    COTTFFExternalReport
  >();

  for (const report of reports) {
    const key = [
      report.symbol,
      report.report_date,
      report.participant,
    ].join("|");

    uniqueReports.set(key, report);
  }

  return Array.from(
    uniqueReports.values()
  );
}

export async function upsertCOTTFFReports(
  reports: COTTFFExternalReport[]
) {
  const supabaseServer =
    getSupabaseServerClient();

  const uniqueReports =
    dedupeCOTTFFReports(reports);

  if (!uniqueReports.length) {
    return {
      error: null,
      count: 0,
    };
  }

  const updatedAt =
    new Date().toISOString();

  const rows = uniqueReports.map(
    (report) => ({
      symbol: report.symbol,
      currency: report.currency,
      market_name: report.market_name,
      cftc_code: report.cftc_code,

      report_date: report.report_date,
      participant: report.participant,

      open_interest:
        report.open_interest,
      change_open_interest:
        report.change_open_interest,

      long_position:
        report.long_position,
      short_position:
        report.short_position,
      spreading_position:
        report.spreading_position,

      change_long:
        report.change_long,
      change_short:
        report.change_short,
      change_spreading:
        report.change_spreading,

      pct_oi_long:
        report.pct_oi_long,
      pct_oi_short:
        report.pct_oi_short,
      pct_oi_spreading:
        report.pct_oi_spreading,

      net_position:
        report.net_position,
      net_change:
        report.net_change,
      net_pct_oi:
        report.net_pct_oi,

      source: report.source,

      updated_at: updatedAt,
    })
  );

  const batchSize = 500;

  for (
    let index = 0;
    index < rows.length;
    index += batchSize
  ) {
    const batch = rows.slice(
      index,
      index + batchSize
    );

    const { error } =
      await supabaseServer
        .from(
          "cot_tff_participant_reports"
        )
        .upsert(batch, {
          onConflict:
            "symbol,report_date,participant",
        });

    if (error) {
      console.error(
        "UPSERT COT TFF REPORTS ERROR:",
        error.message
      );

      return {
        error,
        count: index,
      };
    }
  }

  return {
    error: null,
    count: rows.length,
  };
}

export async function getStoredCOTTFFReports(
  options: GetStoredCOTTFFReportsOptions = {}
) {
  const supabaseServer =
    getSupabaseServerClient();

  const {
    symbol = "all",
    participant = "all",
    startDate,
    endDate,
  } = options;

  let query = supabaseServer
    .from(
      "cot_tff_participant_reports"
    )
    .select("*")
    .order("report_date", {
      ascending: true,
    });

  if (symbol !== "all") {
    query = query.eq(
      "symbol",
      symbol
    );
  }

  if (participant !== "all") {
    query = query.eq(
      "participant",
      participant
    );
  }

  if (startDate) {
    query = query.gte(
      "report_date",
      startDate
    );
  }

  if (endDate) {
    query = query.lte(
      "report_date",
      endDate
    );
  }

  const { data, error } =
    await query;

  if (error) {
    console.error(
      "GET STORED COT TFF REPORTS ERROR:",
      error.message
    );

    return {
      error,
      reports:
        [] as StoredCOTTFFReport[],
    };
  }

  return {
    error: null,
    reports:
      (data || []) as StoredCOTTFFReport[],
  };
}

export async function getLatestCOTTFFUpdatedAt() {
  const supabaseServer =
    getSupabaseServerClient();

  const { data, error } =
    await supabaseServer
      .from(
        "cot_tff_participant_reports"
      )
      .select("updated_at")
      .not("updated_at", "is", null)
      .order("updated_at", {
        ascending: false,
      })
      .limit(1);

  if (error) {
    console.error(
      "GET LATEST COT TFF UPDATED AT ERROR:",
      error.message
    );

    return {
      error,
      updatedAt:
        null as string | null,
    };
  }

  const latestRow =
    Array.isArray(data) &&
    data.length
      ? data[0]
      : null;

  return {
    error: null,
    updatedAt:
      latestRow?.updated_at || null,
  };
}

export async function getLatestCOTTFFReportDate() {
  const supabaseServer =
    getSupabaseServerClient();

  const { data, error } =
    await supabaseServer
      .from(
        "cot_tff_participant_reports"
      )
      .select("report_date")
      .not("report_date", "is", null)
      .order("report_date", {
        ascending: false,
      })
      .limit(1);

  if (error) {
    console.error(
      "GET LATEST COT TFF REPORT DATE ERROR:",
      error.message
    );

    return {
      error,
      reportDate:
        null as string | null,
    };
  }

  const latestRow =
    Array.isArray(data) &&
    data.length
      ? data[0]
      : null;

  return {
    error: null,
    reportDate:
      latestRow?.report_date || null,
  };
}