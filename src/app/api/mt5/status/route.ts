import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";

const SAFE_ACCOUNT_FIELDS = [
  "id",
  "login",
  "server",
  "company",
  "account_name",
  "currency",
  "balance",
  "equity",
  "trade_allowed",
  "status",
  "status_message",
  "last_error",
  "terminal_slot",
  "last_connected_at",
  "updated_at",
].join(",");

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, message: authError ?? "Unauthorized." },
        { status: 401 },
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

    return NextResponse.json({
      success: true,
      account: data ?? null,
    });
  } catch (error: any) {
    console.error("MT5 STATUS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message ?? "Could not read MT5 connection status.",
      },
      { status: 500 },
    );
  }
}
