import { createClient } from "@supabase/supabase-js";

export type MarketIntelligenceReportType =
  | "weekly_baseline"
  | "daily_update";

export type MarketIntelligenceTrend =
  | "rising"
  | "sideways"
  | "falling";

export type MarketIntelligenceNarrativeSource =
  | "template"
  | "ai";

export type MarketIntelligenceJson =
  | Record<string, unknown>
  | unknown[];

export type MarketIntelligenceReportInput = {
  symbol: string;
  analysis_date: string;
  report_type: MarketIntelligenceReportType;

  previous_report_id?: string | null;

  engine_version?: string;
  narrative_source?: MarketIntelligenceNarrativeSource;
  narrative_model?: string | null;

  cot_as_of?: string | null;
  price_as_of?: string | null;
  oi_as_of?: string | null;
  volume_as_of?: string | null;

  price_trend?: MarketIntelligenceTrend | null;
  oi_trend?: MarketIntelligenceTrend | null;
  volume_trend?: MarketIntelligenceTrend | null;

  market_condition_id?: number | null;
  market_condition_key?: string | null;
  market_condition_label?: string | null;

  leveraged_funds_state?: string | null;
  asset_managers_state?: string | null;
  cot_relationship?: string | null;
  combined_state_key?: string | null;

  story_development?: string | null;
  change_from_previous?: string | null;

  technical_meaning?: string | null;
  dashboard_summary?: string | null;
  detailed_analysis?: string | null;
  continuation_outlook?: string | null;
  reversal_outlook?: string | null;

  cot_window?: MarketIntelligenceJson;
  market_window?: MarketIntelligenceJson;
  analysis_state?: Record<string, unknown>;
  source_snapshot?: Record<string, unknown>;
};

export type StoredMarketIntelligenceReport =
  MarketIntelligenceReportInput & {
    id: string;
    engine_version: string;
    narrative_source: MarketIntelligenceNarrativeSource;
    narrative_model: string | null;

    previous_report_id: string | null;

    cot_as_of: string | null;
    price_as_of: string | null;
    oi_as_of: string | null;
    volume_as_of: string | null;

    price_trend: MarketIntelligenceTrend | null;
    oi_trend: MarketIntelligenceTrend | null;
    volume_trend: MarketIntelligenceTrend | null;

    market_condition_id: number | null;
    market_condition_key: string | null;
    market_condition_label: string | null;

    leveraged_funds_state: string | null;
    asset_managers_state: string | null;
    cot_relationship: string | null;
    combined_state_key: string | null;

    story_development: string | null;
    change_from_previous: string | null;

    technical_meaning: string | null;
    dashboard_summary: string | null;
    detailed_analysis: string | null;
    continuation_outlook: string | null;
    reversal_outlook: string | null;

    cot_window: MarketIntelligenceJson;
    market_window: MarketIntelligenceJson;
    analysis_state: Record<string, unknown>;
    source_snapshot: Record<string, unknown>;

    generated_at: string;
    created_at: string;
    updated_at: string;
  };

type GetMarketIntelligenceHistoryOptions = {
  symbol: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
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

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export async function createMarketIntelligenceReport(
  report: MarketIntelligenceReportInput
) {
  const supabaseServer =
    getSupabaseServerClient();

  const symbol = normalizeSymbol(
    report.symbol
  );

  /*
   * Historical safety rule:
   * one saved report per symbol + analysis date.
   *
   * If the scheduled job is retried, return the already-saved
   * report instead of overwriting the historical analysis.
   * This preserves exactly what EdgeVault concluded for that day.
   */
  const existing =
    await getMarketIntelligenceReportByDate(
      symbol,
      report.analysis_date
    );

  if (existing.error) {
    return {
      error: existing.error,
      report: null as StoredMarketIntelligenceReport | null,
      created: false,
    };
  }

  if (existing.report) {
    return {
      error: null,
      report: existing.report,
      created: false,
    };
  }

  const now =
    new Date().toISOString();

  const row = {
    symbol,
    analysis_date:
      report.analysis_date,
    report_type:
      report.report_type,

    previous_report_id:
      report.previous_report_id ?? null,

    engine_version:
      report.engine_version ?? "v1",
    narrative_source:
      report.narrative_source ?? "template",
    narrative_model:
      report.narrative_model ?? null,

    cot_as_of:
      report.cot_as_of ?? null,
    price_as_of:
      report.price_as_of ?? null,
    oi_as_of:
      report.oi_as_of ?? null,
    volume_as_of:
      report.volume_as_of ?? null,

    price_trend:
      report.price_trend ?? null,
    oi_trend:
      report.oi_trend ?? null,
    volume_trend:
      report.volume_trend ?? null,

    market_condition_id:
      report.market_condition_id ?? null,
    market_condition_key:
      report.market_condition_key ?? null,
    market_condition_label:
      report.market_condition_label ?? null,

    leveraged_funds_state:
      report.leveraged_funds_state ?? null,
    asset_managers_state:
      report.asset_managers_state ?? null,
    cot_relationship:
      report.cot_relationship ?? null,
    combined_state_key:
      report.combined_state_key ?? null,

    story_development:
      report.story_development ?? null,
    change_from_previous:
      report.change_from_previous ?? null,

    technical_meaning:
      report.technical_meaning ?? null,
    dashboard_summary:
      report.dashboard_summary ?? null,
    detailed_analysis:
      report.detailed_analysis ?? null,
    continuation_outlook:
      report.continuation_outlook ?? null,
    reversal_outlook:
      report.reversal_outlook ?? null,

    cot_window:
      report.cot_window ?? [],
    market_window:
      report.market_window ?? [],
    analysis_state:
      report.analysis_state ?? {},
    source_snapshot:
      report.source_snapshot ?? {},

    generated_at: now,
    updated_at: now,
  };

  const { data, error } =
    await supabaseServer
      .from(
        "market_intelligence_reports"
      )
      .insert(row)
      .select("*")
      .single();

  if (error) {
    console.error(
      "CREATE MARKET INTELLIGENCE REPORT ERROR:",
      error.message
    );

    return {
      error,
      report: null as StoredMarketIntelligenceReport | null,
      created: false,
    };
  }

  return {
    error: null,
    report:
      data as StoredMarketIntelligenceReport,
    created: true,
  };
}

export async function getLatestMarketIntelligenceReport(
  symbol: string
) {
  const supabaseServer =
    getSupabaseServerClient();

  const { data, error } =
    await supabaseServer
      .from(
        "market_intelligence_reports"
      )
      .select("*")
      .eq(
        "symbol",
        normalizeSymbol(symbol)
      )
      .order(
        "analysis_date",
        { ascending: false }
      )
      .order(
        "generated_at",
        { ascending: false }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "GET LATEST MARKET INTELLIGENCE REPORT ERROR:",
      error.message
    );

    return {
      error,
      report: null as StoredMarketIntelligenceReport | null,
    };
  }

  return {
    error: null,
    report:
      (data as StoredMarketIntelligenceReport | null) ??
      null,
  };
}

export async function getPreviousMarketIntelligenceReport(
  symbol: string,
  beforeAnalysisDate: string
) {
  const supabaseServer =
    getSupabaseServerClient();

  const { data, error } =
    await supabaseServer
      .from(
        "market_intelligence_reports"
      )
      .select("*")
      .eq(
        "symbol",
        normalizeSymbol(symbol)
      )
      .lt(
        "analysis_date",
        beforeAnalysisDate
      )
      .order(
        "analysis_date",
        { ascending: false }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "GET PREVIOUS MARKET INTELLIGENCE REPORT ERROR:",
      error.message
    );

    return {
      error,
      report: null as StoredMarketIntelligenceReport | null,
    };
  }

  return {
    error: null,
    report:
      (data as StoredMarketIntelligenceReport | null) ??
      null,
  };
}

export async function getMarketIntelligenceReportByDate(
  symbol: string,
  analysisDate: string
) {
  const supabaseServer =
    getSupabaseServerClient();

  const { data, error } =
    await supabaseServer
      .from(
        "market_intelligence_reports"
      )
      .select("*")
      .eq(
        "symbol",
        normalizeSymbol(symbol)
      )
      .eq(
        "analysis_date",
        analysisDate
      )
      .maybeSingle();

  if (error) {
    console.error(
      "GET MARKET INTELLIGENCE REPORT BY DATE ERROR:",
      error.message
    );

    return {
      error,
      report: null as StoredMarketIntelligenceReport | null,
    };
  }

  return {
    error: null,
    report:
      (data as StoredMarketIntelligenceReport | null) ??
      null,
  };
}

export async function getMarketIntelligenceHistory(
  options: GetMarketIntelligenceHistoryOptions
) {
  const supabaseServer =
    getSupabaseServerClient();

  const {
    symbol,
    startDate,
    endDate,
    limit = 120,
  } = options;

  let query =
    supabaseServer
      .from(
        "market_intelligence_reports"
      )
      .select("*")
      .eq(
        "symbol",
        normalizeSymbol(symbol)
      )
      .order(
        "analysis_date",
        { ascending: false }
      )
      .limit(limit);

  if (startDate) {
    query = query.gte(
      "analysis_date",
      startDate
    );
  }

  if (endDate) {
    query = query.lte(
      "analysis_date",
      endDate
    );
  }

  const { data, error } =
    await query;

  if (error) {
    console.error(
      "GET MARKET INTELLIGENCE HISTORY ERROR:",
      error.message
    );

    return {
      error,
      reports:
        [] as StoredMarketIntelligenceReport[],
    };
  }

  return {
    error: null,
    reports:
      (data || []) as StoredMarketIntelligenceReport[],
  };
}