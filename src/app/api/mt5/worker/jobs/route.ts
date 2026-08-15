import { NextRequest, NextResponse } from "next/server";
import {
  decryptMt5Password,
  getSupabaseAdmin,
  isAuthorizedMt5Worker,
} from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedMt5Worker(request)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized worker." },
        { status: 401 },
      );
    }

    const workerId =
      request.nextUrl.searchParams.get("workerId")?.trim() || "windows-vps";
    const supabaseAdmin = getSupabaseAdmin();

    const { data: pendingJob, error: pendingError } = await supabaseAdmin
      .from("mt5_connection_jobs")
      .select("id, account_id, user_id, attempts, action")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      throw pendingError;
    }

    if (!pendingJob) {
      return NextResponse.json({ success: true, job: null });
    }

    const now = new Date().toISOString();

    const { data: claimedJob, error: claimError } = await supabaseAdmin
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
      .select("id, account_id, user_id, attempts, action")
      .maybeSingle();

    if (claimError) {
      throw claimError;
    }

    if (!claimedJob) {
      return NextResponse.json({ success: true, job: null });
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

      return NextResponse.json({ success: true, job: null });
    }

    return NextResponse.json({
      success: true,
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
  } catch (error: any) {
    console.error("MT5 WORKER JOB ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message ?? "Could not claim an MT5 worker job.",
      },
      { status: 500 },
    );
  }
}
