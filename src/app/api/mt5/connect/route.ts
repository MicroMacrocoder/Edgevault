import { NextRequest, NextResponse } from "next/server";
import {
  encryptMt5Password,
  getAuthenticatedUser,
  getSupabaseAdmin,
} from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";

function normalizeLogin(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeServer(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, message: authError ?? "Unauthorized." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const login = normalizeLogin(body?.login);
    const server = normalizeServer(body?.server);
    const password = String(body?.password ?? "");

    if (!/^\d{4,20}$/.test(login)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid MT5 login number." },
        { status: 400 },
      );
    }

    if (!server) {
      return NextResponse.json(
        { success: false, message: "Exact MT5 server is required." },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          message: "Investor / read-only password is required.",
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const encryptedPassword = encryptMt5Password(password);
    const now = new Date().toISOString();

    const { data: existingAccount, error: existingError } = await supabaseAdmin
      .from("mt5_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("login", login)
      .eq("server", server)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    let accountId = existingAccount?.id as string | undefined;

    if (accountId) {
      const { error: updateError } = await supabaseAdmin
        .from("mt5_accounts")
        .update({
          encrypted_password: encryptedPassword,
          status: "connecting",
          status_message: "Waiting for the hosted MT5 worker.",
          company: null,
          account_name: null,
          currency: null,
          balance: null,
          equity: null,
          trade_allowed: null,
          last_error: null,
          updated_at: now,
        })
        .eq("id", accountId)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      await supabaseAdmin
        .from("mt5_connection_jobs")
        .update({ status: "cancelled", updated_at: now })
        .eq("account_id", accountId)
        .in("status", ["pending", "processing"]);
    } else {
      const { data: newAccount, error: insertError } = await supabaseAdmin
        .from("mt5_accounts")
        .insert({
          user_id: user.id,
          login,
          server,
          encrypted_password: encryptedPassword,
          status: "connecting",
          status_message: "Waiting for the hosted MT5 worker.",
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      accountId = newAccount.id;
    }

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

    if (jobError) {
      throw jobError;
    }

    return NextResponse.json({
      success: true,
      accountId,
      jobId: job.id,
      status: "connecting",
      message: "Connecting to MT5 on the hosted EdgeVault worker...",
    });
  } catch (error: any) {
    console.error("MT5 CONNECT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message ?? "Could not start the MT5 connection.",
      },
      { status: 500 },
    );
  }
}
