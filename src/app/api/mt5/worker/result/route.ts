import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isAuthorizedMt5Worker,
} from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";

function screenshotPathsFromCustomFields(
  customFields: unknown,
  userId: string,
) {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
    return [] as string[];
  }
  return Object.values(customFields as Record<string, unknown>)
    .map((value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? String((value as Record<string, unknown>).path || "").trim()
        : "",
    )
    .filter((path) => path.startsWith(`${userId}/mt5-trades/`));
}

async function removeAccountScreenshots(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  accountId: string,
  userId: string,
) {
  const paths = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: trades, error } = await supabaseAdmin
      .from("mt5_trade_records")
      .select("custom_fields")
      .eq("account_id", accountId)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("MT5 SCREENSHOT LOOKUP ERROR:", error);
      return;
    }
    for (const trade of trades ?? []) {
      for (const path of screenshotPathsFromCustomFields(trade.custom_fields, userId)) {
        paths.add(path);
      }
    }
    if ((trades ?? []).length < pageSize) break;
  }

  const allPaths = [...paths];
  for (let index = 0; index < allPaths.length; index += 100) {
    const { error } = await supabaseAdmin.storage
      .from("chart-images")
      .remove(allPaths.slice(index, index + 100));
    if (error) console.error("MT5 SCREENSHOT REMOVE ERROR:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedMt5Worker(request)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized worker." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const jobId = String(body?.jobId ?? "").trim();
    const success = body?.success === true;
    const message = String(body?.message ?? "").trim();
    const accountInfo = body?.accountInfo ?? null;
    const terminalSlot = String(body?.terminalSlot ?? "").trim() || null;
    const workerId = String(body?.workerId ?? "").trim() || "windows-vps";

    if (!jobId) {
      return NextResponse.json(
        { success: false, message: "jobId is required." },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: job, error: jobError } = await supabaseAdmin
      .from("mt5_connection_jobs")
      .select("id, account_id, action, created_at")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      throw jobError;
    }

    if (!job) {
      return NextResponse.json(
        { success: false, message: "MT5 job was not found." },
        { status: 404 },
      );
    }

    const { data: newestJob, error: newestJobError } = await supabaseAdmin
      .from("mt5_connection_jobs")
      .select("id")
      .eq("account_id", job.account_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (newestJobError) {
      throw newestJobError;
    }

    if (newestJob?.id && newestJob.id !== jobId) {
      return NextResponse.json({
        success: true,
        ignored: true,
        message: "Ignored a snapshot from a superseded MT5 job.",
      });
    }

    const now = new Date().toISOString();

    if (job.action === "disconnect") {
      const { data: accountState, error: accountStateError } =
        await supabaseAdmin
          .from("mt5_accounts")
          .select("id,user_id,pending_deletion")
          .eq("id", job.account_id)
          .maybeSingle();
      if (accountStateError) throw accountStateError;

      if (!success) {
        const failureMessage = message || "The MT5 account could not be disconnected.";
        await supabaseAdmin
          .from("mt5_accounts")
          .update({
            status: "error",
            status_message: failureMessage,
            last_error: failureMessage,
            pending_deletion: false,
            updated_at: now,
          })
          .eq("id", job.account_id);
        await supabaseAdmin
          .from("mt5_connection_jobs")
          .update({
            status: "failed",
            error_message: failureMessage,
            completed_at: now,
            updated_at: now,
          })
          .eq("id", jobId);
        return NextResponse.json({ success: true });
      }

      if (accountState?.pending_deletion) {
        await removeAccountScreenshots(
          supabaseAdmin,
          job.account_id,
          accountState.user_id,
        );
        const { error: deleteAccountError } = await supabaseAdmin
          .from("mt5_accounts")
          .delete()
          .eq("id", job.account_id);
        if (deleteAccountError) throw deleteAccountError;
        return NextResponse.json({
          success: true,
          removed: true,
          message: "The MT5 slot was released and the saved account was removed.",
        });
      }

      const { data: disconnectedAccount, error: disconnectAccountError } =
        await supabaseAdmin
          .from("mt5_accounts")
          .update({
            status: "disconnected",
            status_message:
              message || "MT5 account disconnected. Its saved Trade Log was retained.",
            last_error: null,
            terminal_slot: null,
            worker_id: null,
            pending_deletion: false,
            disconnected_at: now,
            updated_at: now,
          })
          .eq("id", job.account_id)
          .select("id")
          .maybeSingle();
      if (disconnectAccountError) throw disconnectAccountError;
      if (!disconnectedAccount) {
        throw new Error("The MT5 account row could not be disconnected.");
      }

      const { error: disconnectJobError } = await supabaseAdmin
        .from("mt5_connection_jobs")
        .update({
          status: "completed",
          result_json: {},
          error_message: null,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", jobId);
      if (disconnectJobError) throw disconnectJobError;

      return NextResponse.json({ success: true });
    }

    if (success) {
      const { data: updatedAccount, error: accountError } = await supabaseAdmin
        .from("mt5_accounts")
        .update({
          company: accountInfo?.company ?? null,
          account_name: accountInfo?.name ?? null,
          currency: accountInfo?.currency ?? null,
          balance: accountInfo?.balance ?? null,
          equity: accountInfo?.equity ?? null,
          trade_allowed:
            typeof accountInfo?.tradeAllowed === "boolean"
              ? accountInfo.tradeAllowed
              : null,
          status: "connected",
          status_message: message || "MT5 account connected.",
          last_error: null,
          terminal_slot: terminalSlot,
          worker_id: workerId,
          pending_deletion: false,
          disconnected_at: null,
          last_connected_at: now,
          updated_at: now,
        })
        .eq("id", job.account_id)
        .select("id")
        .maybeSingle();

      if (accountError) {
        throw accountError;
      }

      if (!updatedAccount) {
        throw new Error("The MT5 account row could not be updated.");
      }

      const { data: completedJob, error: completeError } = await supabaseAdmin
        .from("mt5_connection_jobs")
        .update({
          status: "completed",
          result_json: accountInfo ?? {},
          error_message: null,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", jobId)
        .select("id")
        .maybeSingle();

      if (completeError) {
        throw completeError;
      }

      if (!completedJob) {
        throw new Error("The MT5 connection job could not be completed.");
      }
    } else {
      const failureMessage = message || "MT5 connection failed.";

      const { data: updatedAccount, error: accountError } = await supabaseAdmin
        .from("mt5_accounts")
        .update({
          status: "error",
          status_message: failureMessage,
          last_error: failureMessage,
          terminal_slot: null,
          worker_id: null,
          pending_deletion: false,
          updated_at: now,
        })
        .eq("id", job.account_id)
        .select("id")
        .maybeSingle();

      if (accountError) {
        throw accountError;
      }

      if (!updatedAccount) {
        throw new Error("The MT5 account row could not be updated.");
      }

      const { data: failedJob, error: failError } = await supabaseAdmin
        .from("mt5_connection_jobs")
        .update({
          status: "failed",
          error_message: failureMessage,
          result_json: accountInfo ?? {},
          completed_at: now,
          updated_at: now,
        })
        .eq("id", jobId)
        .select("id")
        .maybeSingle();

      if (failError) {
        throw failError;
      }

      if (!failedJob) {
        throw new Error("The MT5 connection job could not be marked failed.");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("MT5 WORKER RESULT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message ?? "Could not save the MT5 worker result.",
      },
      { status: 500 },
    );
  }
}
