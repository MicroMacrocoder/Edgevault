import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SAFE_ACCOUNT_FIELDS =
  "id,login,server,company,account_name,currency,balance,equity,trade_allowed,status,status_message,last_error,terminal_slot,last_connected_at,updated_at" as const;

type HostedMt5Account = {
  id: string;
  login: string;
  server: string;
  company: string | null;
  account_name: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  trade_allowed: boolean | null;
  status: string;
  status_message: string | null;
  last_error: string | null;
  terminal_slot: string | null;
  last_connected_at: string | null;
  updated_at: string;
};

type Mt5Snapshot = {
  login?: string;
  server?: string;
  company?: string;
  name?: string;
  currency?: string;
  balance?: number;
  equity?: number;
  tradeAllowed?: boolean;
  positions?: unknown[];
};

type Mt5JobResult = {
  status: string;
  result_json: Mt5Snapshot | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (!user) {
      return jsonNoStore(
        { success: false, message: authError ?? "Unauthorized." },
        401,
      );
    }

    const accountId = request.nextUrl.searchParams.get("accountId")?.trim();
    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from("mt5_accounts")
      .select(SAFE_ACCOUNT_FIELDS)
      .eq("user_id", user.id);

    if (accountId) {
      query = query.eq("id", accountId);
    } else {
      query = query.order("updated_at", { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    const account = (data ?? null) as unknown as HostedMt5Account | null;

    if (!account) {
      return jsonNoStore({ success: true, account: null });
    }

    const { data: latestJobData, error: latestJobError } = await supabaseAdmin
      .from("mt5_connection_jobs")
      .select("status,result_json,error_message,created_at,updated_at")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestJobError) {
      throw latestJobError;
    }

    const latestJob = (latestJobData ?? null) as unknown as Mt5JobResult | null;
    const snapshot = latestJob?.result_json ?? null;
    const positions = Array.isArray(snapshot?.positions)
      ? snapshot.positions
      : [];

    if (latestJob?.status === "completed" && snapshot) {
      return jsonNoStore({
        success: true,
        account: {
          ...account,
          login: snapshot.login ? String(snapshot.login) : account.login,
          server: snapshot.server || account.server,
          company: snapshot.company || account.company,
          account_name: snapshot.name || account.account_name,
          currency: snapshot.currency || account.currency,
          balance:
            typeof snapshot.balance === "number"
              ? snapshot.balance
              : account.balance,
          equity:
            typeof snapshot.equity === "number"
              ? snapshot.equity
              : account.equity,
          trade_allowed:
            typeof snapshot.tradeAllowed === "boolean"
              ? snapshot.tradeAllowed
              : account.trade_allowed,
          status: "connected",
          status_message:
            "MT5 account connected through the EdgeVault hosted worker.",
          last_error: null,
          terminal_slot: account.terminal_slot,
          last_connected_at: latestJob.updated_at,
          updated_at: latestJob.updated_at,
          positions,
        },
      });
    }

    if (latestJob?.status === "failed") {
      const failureMessage =
        latestJob.error_message ||
        account.last_error ||
        "MT5 connection failed.";

      return jsonNoStore({
        success: true,
        account: {
          ...account,
          status: "error",
          status_message: failureMessage,
          last_error: failureMessage,
          positions,
        },
      });
    }

    if (
      latestJob?.status === "pending" ||
      latestJob?.status === "processing"
    ) {
      return jsonNoStore({
        success: true,
        account: {
          ...account,
          status: "connecting",
          status_message:
            latestJob.status === "processing"
              ? "The hosted MT5 worker is connecting this account."
              : "Waiting for the hosted MT5 worker.",
          last_error: null,
          positions: [],
        },
      });
    }

    return jsonNoStore({
      success: true,
      account: { ...account, positions },
    });
  } catch (error: any) {
    console.error("MT5 STATUS ERROR:", error);

    return jsonNoStore(
      {
        success: false,
        message: error?.message ?? "Could not read MT5 connection status.",
      },
      500,
    );
  }
}