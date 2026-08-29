import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_ACTIVE_ACCOUNTS_PER_USER = 3;
const ACTIVE_STATUSES = ["connecting", "connected", "disconnecting"];
const SAFE_ACCOUNT_FIELDS =
  "id,login,server,company,account_name,currency,balance,equity,trade_allowed,status,status_message,last_error,terminal_slot,worker_id,pending_deletion,last_connected_at,disconnected_at,created_at,updated_at";

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

async function cancelOpenJobs(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  accountId: string,
  now: string,
) {
  const { error } = await supabaseAdmin
    .from("mt5_connection_jobs")
    .update({ status: "cancelled", completed_at: now, updated_at: now })
    .eq("account_id", accountId)
    .in("status", ["pending", "processing"]);
  if (error) throw error;
}

async function activeAccountCount(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  excludingAccountId?: string,
) {
  let query = supabaseAdmin
    .from("mt5_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES);
  if (excludingAccountId) query = query.neq("id", excludingAccountId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (!user) {
      return jsonNoStore(
        { success: false, message: authError || "Unauthorized." },
        401,
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: accounts, error } = await supabaseAdmin
      .from("mt5_accounts")
      .select(SAFE_ACCOUNT_FIELDS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const activeCount = (accounts ?? []).filter((account: any) =>
      ACTIVE_STATUSES.includes(String(account.status || "")),
    ).length;

    return jsonNoStore({
      success: true,
      accounts: accounts ?? [],
      limits: {
        active: activeCount,
        maximumActive: MAX_ACTIVE_ACCOUNTS_PER_USER,
        remaining: Math.max(0, MAX_ACTIVE_ACCOUNTS_PER_USER - activeCount),
      },
    });
  } catch (error: any) {
    console.error("MT5 SAVED ACCOUNTS ERROR:", error);
    return jsonNoStore(
      {
        success: false,
        message: error?.message || "Could not load saved MT5 accounts.",
      },
      500,
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (!user) {
      return jsonNoStore(
        { success: false, message: authError || "Unauthorized." },
        401,
      );
    }

    const body = await request.json();
    const accountId = String(body?.accountId || "").trim();
    const shouldConnect = body?.connected === true;
    if (!accountId) {
      return jsonNoStore(
        { success: false, message: "accountId is required." },
        400,
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: account, error: accountError } = await supabaseAdmin
      .from("mt5_accounts")
      .select("id,status,encrypted_password")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) {
      return jsonNoStore(
        { success: false, message: "Saved MT5 account was not found." },
        404,
      );
    }

    const now = new Date().toISOString();

    if (shouldConnect) {
      if (account.status === "connected") {
        return jsonNoStore({
          success: true,
          accountId,
          status: "connected",
          message: "This MT5 account is already connected.",
        });
      }
      if (!account.encrypted_password) {
        return jsonNoStore(
          {
            success: false,
            message:
              "This saved account has no investor password. Add it again using the connection form.",
          },
          409,
        );
      }

      const otherActiveCount = await activeAccountCount(
        supabaseAdmin,
        user.id,
        accountId,
      );
      if (otherActiveCount >= MAX_ACTIVE_ACCOUNTS_PER_USER) {
        return jsonNoStore(
          {
            success: false,
            message:
              "You already have three active or connecting MT5 accounts. Disconnect one before connecting another.",
          },
          409,
        );
      }

      await cancelOpenJobs(supabaseAdmin, accountId, now);
      const { data: job, error: jobError } = await supabaseAdmin
        .from("mt5_connection_jobs")
        .insert({
          user_id: user.id,
          account_id: accountId,
          action: "connect",
          status: "pending",
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (jobError) throw jobError;

      const { error: updateError } = await supabaseAdmin
        .from("mt5_accounts")
        .update({
          status: "connecting",
          status_message: "Waiting for the hosted MT5 worker.",
          last_error: null,
          terminal_slot: null,
          worker_id: null,
          pending_deletion: false,
          disconnected_at: null,
          updated_at: now,
        })
        .eq("id", accountId)
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      return jsonNoStore({
        success: true,
        accountId,
        jobId: job.id,
        status: "connecting",
        message: "Saved MT5 account queued for connection.",
      });
    }

    if (account.status === "disconnected") {
      return jsonNoStore({
        success: true,
        accountId,
        status: "disconnected",
        message: "This MT5 account is already disconnected.",
      });
    }

    await cancelOpenJobs(supabaseAdmin, accountId, now);
    const { data: job, error: jobError } = await supabaseAdmin
      .from("mt5_connection_jobs")
      .insert({
        user_id: user.id,
        account_id: accountId,
        action: "disconnect",
        status: "pending",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (jobError) throw jobError;

    const { error: updateError } = await supabaseAdmin
      .from("mt5_accounts")
      .update({
        status: "disconnecting",
        status_message: "Releasing the hosted MT5 slot.",
        last_error: null,
        updated_at: now,
      })
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return jsonNoStore({
      success: true,
      accountId,
      jobId: job.id,
      status: "disconnecting",
      message:
        "Disconnect requested. The saved account and Trade Log will remain available.",
    });
  } catch (error: any) {
    console.error("MT5 ACCOUNT SWITCH ERROR:", error);
    return jsonNoStore(
      {
        success: false,
        message: error?.message || "Could not update the MT5 connection.",
      },
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (!user) {
      return jsonNoStore(
        { success: false, message: authError || "Unauthorized." },
        401,
      );
    }

    const body = await request.json();
    const accountId = String(body?.accountId || "").trim();
    if (!accountId) {
      return jsonNoStore(
        { success: false, message: "accountId is required." },
        400,
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: account, error: accountError } = await supabaseAdmin
      .from("mt5_accounts")
      .select("id,login,status,pending_deletion")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) {
      return jsonNoStore(
        { success: false, message: "Saved MT5 account was not found." },
        404,
      );
    }

    if (account.pending_deletion) {
      return jsonNoStore({
        success: true,
        accountId,
        status: "disconnecting",
        message: "This MT5 account is already being removed.",
      });
    }

    const now = new Date().toISOString();
    await cancelOpenJobs(supabaseAdmin, accountId, now);

    const { data: job, error: jobError } = await supabaseAdmin
      .from("mt5_connection_jobs")
      .insert({
        user_id: user.id,
        account_id: accountId,
        action: "disconnect",
        status: "pending",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (jobError) throw jobError;

    const { error: updateError } = await supabaseAdmin
      .from("mt5_accounts")
      .update({
        status: "disconnecting",
        status_message: "Releasing its VPS slot before permanent removal.",
        last_error: null,
        pending_deletion: true,
        updated_at: now,
      })
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return jsonNoStore({
      success: true,
      accountId,
      jobId: job.id,
      status: "disconnecting",
      message: `Removing MT5 login ${account.login}. Its VPS slot will be released first.`,
    });
  } catch (error: any) {
    console.error("MT5 ACCOUNT REMOVE ERROR:", error);
    return jsonNoStore(
      {
        success: false,
        message: error?.message || "Could not remove the MT5 account.",
      },
      500,
    );
  }
}
