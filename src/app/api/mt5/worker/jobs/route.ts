import { NextRequest, NextResponse } from "next/server";
import {
  decryptMt5Password,
  getSupabaseAdmin,
  isAuthorizedMt5Worker,
} from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

async function claimNextJob(request: NextRequest, workerIdInput?: string) {
  if (!isAuthorizedMt5Worker(request)) {
    return jsonNoStore(
      { success: false, message: "Unauthorized worker." },
      401,
    );
  }

  const workerId =
    String(workerIdInput ?? "").trim() ||
    request.nextUrl.searchParams.get("workerId")?.trim() ||
    "windows-vps";

  const supabaseAdmin = getSupabaseAdmin();

  // Count first so the VPS can tell us whether Production can actually see
  // the pending rows. This also makes diagnosis obvious instead of silently
  // returning "no job".
  const { count: pendingCount, error: countError } = await supabaseAdmin
    .from("mt5_connection_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (countError) {
    throw countError;
  }

  const { data: pendingJobs, error: pendingError } = await supabaseAdmin
    .from("mt5_connection_jobs")
    .select("id, account_id, user_id, attempts, action, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (pendingError) {
    throw pendingError;
  }

  if (!pendingJobs?.length) {
    return jsonNoStore({
      success: true,
      job: null,
      pendingCount: pendingCount ?? 0,
    });
  }

  // Multiple workers may poll at the same time. Try each visible candidate
  // and only take a row that is still pending at the instant of UPDATE.
  for (const pendingJob of pendingJobs) {
    const now = new Date().toISOString();

    const { data: claimedRows, error: claimError } = await supabaseAdmin
      .from("mt5_connection_jobs")
      .update({
        status: "processing",
        worker_id: workerId,
        claimed_at: now,
        attempts: Number(pendingJob.attempts || 0) + 1,
        updated_at: now,
      })
      .eq("id", pendingJob.id)
      .eq("status", "pending")
      .select("id, account_id, user_id, attempts, action");

    if (claimError) {
      throw claimError;
    }

    const claimedJob = claimedRows?.[0];
    if (!claimedJob) {
      continue;
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("mt5_accounts")
      .select("id, login, server, encrypted_password, terminal_slot")
      .eq("id", claimedJob.account_id)
      .eq("user_id", claimedJob.user_id)
      .maybeSingle();

    if (accountError) {
      throw accountError;
    }

    if (!account) {
      await supabaseAdmin
        .from("mt5_connection_jobs")
        .update({
          status: "failed",
          error_message: "MT5 account record was not found.",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", claimedJob.id);

      continue;
    }

    return jsonNoStore({
      success: true,
      pendingCount: pendingCount ?? 1,
      job: {
        id: claimedJob.id,
        action: claimedJob.action,
        accountId: account.id,
        login: account.login,
        server: account.server,
        password: decryptMt5Password(account.encrypted_password),
        terminalSlot: account.terminal_slot ?? null,
      },
    });
  }

  return jsonNoStore({
    success: true,
    job: null,
    pendingCount: pendingCount ?? 0,
  });
}

export async function POST(request: NextRequest) {
  try {
    let workerId = "";

    try {
      const body = await request.json();
      workerId = String(body?.workerId ?? "").trim();
    } catch {
      // Empty/invalid JSON is fine; fall back to query/default worker id.
    }

    return await claimNextJob(request, workerId);
  } catch (error: any) {
    console.error("MT5 WORKER JOB ERROR:", error);

    return jsonNoStore(
      {
        success: false,
        message: error?.message ?? "Could not claim an MT5 worker job.",
      },
      500,
    );
  }
}

// Keep GET temporarily for compatibility with any already-running old agent.
// The new VPS agent uses POST so job polling cannot be cached.
export async function GET(request: NextRequest) {
  try {
    return await claimNextJob(request);
  } catch (error: any) {
    console.error("MT5 WORKER JOB ERROR:", error);

    return jsonNoStore(
      {
        success: false,
        message: error?.message ?? "Could not claim an MT5 worker job.",
      },
      500,
    );
  }
}
