import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isAuthorizedMt5Worker,
} from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";

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
      .select("id, account_id, created_at")
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
          worker_id: workerId,
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