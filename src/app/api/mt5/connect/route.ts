import { NextRequest, NextResponse } from "next/server";
import {
  encryptMt5Password,
  getAuthenticatedUser,
  getSupabaseAdmin,
} from "@/lib/mt5Hosted";
import {
  getMt5Broker,
  isMt5AccountType,
  isMt5BrokerServer,
} from "@/lib/mt5ServerCatalog";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_ACCOUNTS_PER_USER = 3;
const ACTIVE_STATUSES = ["connecting", "connected", "disconnecting"];

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
    const accountType = String(body?.accountType ?? "").trim().toLowerCase();
    const brokerId = String(body?.broker ?? "").trim().toLowerCase();
    const login = normalizeLogin(body?.login);
    const server = normalizeServer(body?.server);
    const password = String(body?.password ?? "");

    if (!isMt5AccountType(accountType)) {
      return NextResponse.json(
        { success: false, message: "Select Broker or Prop Firm." },
        { status: 400 },
      );
    }

    const broker = getMt5Broker(brokerId);
    if (!broker || broker.accountType !== accountType) {
      return NextResponse.json(
        {
          success: false,
          message: `Select a supported ${accountType === "prop_firm" ? "prop firm" : "broker"}.`,
        },
        { status: 400 },
      );
    }

    if (!/^\d{4,20}$/.test(login)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid MT5 login number." },
        { status: 400 },
      );
    }

    if (!server || !isMt5BrokerServer(brokerId, server)) {
      return NextResponse.json(
        { success: false, message: `Select a valid ${broker.name} MT5 server.` },
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
      .select("id,status")
      .eq("user_id", user.id)
      .eq("login", login)
      .eq("server", server)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    let accountId = existingAccount?.id as string | undefined;

    let activeQuery = supabaseAdmin
      .from("mt5_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ACTIVE_STATUSES);
    if (accountId) activeQuery = activeQuery.neq("id", accountId);
    const { count: activeCount, error: activeCountError } = await activeQuery;
    if (activeCountError) throw activeCountError;
    if ((activeCount ?? 0) >= MAX_ACTIVE_ACCOUNTS_PER_USER) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You already have three active or connecting MT5 accounts. Disconnect one before connecting another.",
        },
        { status: 409 },
      );
    }

    if (accountId) {
      const { error: updateError } = await supabaseAdmin
        .from("mt5_accounts")
        .update({
          encrypted_password: encryptedPassword,
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
      accountType,
      broker: { id: broker.id, name: broker.name },
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
