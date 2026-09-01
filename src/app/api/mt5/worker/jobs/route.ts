import { NextRequest, NextResponse } from "next/server";
import {
  decryptMt5Password,
  getSupabaseAdmin,
  isAuthorizedMt5Worker,
} from "@/lib/mt5Hosted";
import { getMt5BrokerByServer } from "@/lib/mt5ServerCatalog";

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

async function claimNextJob(
  request: NextRequest,
  workerIdInput?: string,
  hasFreeSlot = true,
  activeAccountIds: string[] = [],
) {
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

  const now = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { error: expireError } = await supabaseAdmin
    .from("mt5_connection_jobs")
    .update({
      status: "failed",
      error_message: "The hosted MT5 worker job expired after repeated attempts.",
      completed_at: now,
      updated_at: now,
    })
    .eq("status", "processing")
    .lt("claimed_at", staleCutoff)
    .gte("attempts", 3);

  if (expireError) {
    throw expireError;
  }

  const { error: recoverError } = await supabaseAdmin
    .from("mt5_connection_jobs")
    .update({
      status: "pending",
      worker_id: null,
      claimed_at: null,
      updated_at: now,
    })
    .eq("status", "processing")
    .lt("claimed_at", staleCutoff)
    .lt("attempts", 3);

  if (recoverError) {
    throw recoverError;
  }

  const activeAccountIdSet = new Set(
    activeAccountIds.map((value) => String(value).trim()).filter(Boolean),
  );

  const staleDisconnectCutoff = new Date(
    Date.now() - 10 * 60 * 1000,
  ).toISOString();
  const { data: expiredDisconnectJobs, error: expireDisconnectError } =
    await supabaseAdmin
      .from("mt5_connection_jobs")
      .update({
        status: "cancelled",
        error_message:
          "The disconnect request expired before a worker could process it.",
        completed_at: now,
        updated_at: now,
      })
      .eq("action", "disconnect")
      .eq("status", "pending")
      .lt("created_at", staleDisconnectCutoff)
      .select("account_id");

  if (expireDisconnectError) {
    throw expireDisconnectError;
  }

  const expiredAccountIds = Array.from(
    new Set(
      (expiredDisconnectJobs || [])
        .map((job: any) => String(job.account_id || "").trim())
        .filter(Boolean),
    ),
  );

  const expiredRunningAccountIds = expiredAccountIds.filter((accountId) =>
    activeAccountIdSet.has(accountId),
  );
  const expiredInactiveAccountIds = expiredAccountIds.filter(
    (accountId) => !activeAccountIdSet.has(accountId),
  );

  if (expiredRunningAccountIds.length > 0) {
    const { error: restoreAccountError } = await supabaseAdmin
      .from("mt5_accounts")
      .update({
        status: "connected",
        status_message:
          "A stale disconnect request was cancelled; the MT5 session remains active.",
        last_error: null,
        pending_deletion: false,
        updated_at: now,
      })
      .in("id", expiredRunningAccountIds)
      .eq("status", "disconnecting");

    if (restoreAccountError) {
      throw restoreAccountError;
    }
  }

  if (expiredInactiveAccountIds.length > 0) {
    const { error: markInactiveError } = await supabaseAdmin
      .from("mt5_accounts")
      .update({
        status: "error",
        status_message:
          "A stale disconnect request was cancelled, but no active MT5 session was found.",
        last_error: "Reconnect this saved account to resume synchronization.",
        pending_deletion: false,
        terminal_slot: null,
        worker_id: null,
        updated_at: now,
      })
      .in("id", expiredInactiveAccountIds)
      .eq("status", "disconnecting");

    if (markInactiveError) {
      throw markInactiveError;
    }
  }

  const normalizedActiveAccountIds = Array.from(activeAccountIdSet);

  if (!hasFreeSlot && normalizedActiveAccountIds.length === 0) {
    return jsonNoStore({ success: true, job: null, pendingCount: 0 });
  }

  // Count first so the VPS can tell us whether Production can actually see
  // the pending rows. This also makes diagnosis obvious instead of silently
  // returning "no job".
  let countQuery = supabaseAdmin
    .from("mt5_connection_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  let pendingQuery = supabaseAdmin
    .from("mt5_connection_jobs")
    .select("id, account_id, user_id, attempts, action, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (!hasFreeSlot) {
    countQuery = countQuery.in("account_id", normalizedActiveAccountIds);
    pendingQuery = pendingQuery.in("account_id", normalizedActiveAccountIds);
  }

  const { count: pendingCount, error: countError } = await countQuery;

  if (countError) {
    throw countError;
  }

  const { data: pendingJobs, error: pendingError } = await pendingQuery;

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
    const claimTime = new Date().toISOString();

    const { data: claimedRows, error: claimError } = await supabaseAdmin
      .from("mt5_connection_jobs")
      .update({
        status: "processing",
        worker_id: workerId,
        claimed_at: claimTime,
        attempts: Number(pendingJob.attempts || 0) + 1,
        updated_at: claimTime,
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
          completed_at: claimTime,
          updated_at: claimTime,
        })
        .eq("id", claimedJob.id);

      continue;
    }

    if (claimedJob.action === "disconnect") {
      return jsonNoStore({
        success: true,
        pendingCount: pendingCount ?? 1,
        job: {
          id: claimedJob.id,
          action: "disconnect",
          accountId: account.id,
          terminalSlot: account.terminal_slot ?? null,
        },
      });
    }

    const broker = getMt5BrokerByServer(account.server);
    if (!broker) {
      await supabaseAdmin
        .from("mt5_connection_jobs")
        .update({
          status: "failed",
          error_message: `Unsupported MT5 server: ${account.server}`,
          completed_at: claimTime,
          updated_at: claimTime,
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
        broker: broker.name,
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
    let hasFreeSlot = true;
    let activeAccountIds: string[] = [];

    try {
      const body = await request.json();
      workerId = String(body?.workerId ?? "").trim();
      hasFreeSlot = body?.hasFreeSlot !== false;
      activeAccountIds = Array.isArray(body?.activeAccountIds)
        ? body.activeAccountIds.map((value: unknown) => String(value))
        : [];
    } catch {
      // Empty/invalid JSON is fine; fall back to query/default worker id.
    }

    return await claimNextJob(
      request,
      workerId,
      hasFreeSlot,
      activeAccountIds,
    );
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
