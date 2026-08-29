import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TRADE_FIELDS =
  "id,account_id,position_identifier,trade_cycle,symbol,status,direction,entry_time_msc,exit_time_msc,entry_at_utc,exit_at_utc,entry_broker_time_text,exit_broker_time_text,entry_broker_utc_offset_minutes,exit_broker_utc_offset_minutes,total_entry_lots,total_exit_lots,open_lots,weighted_entry_price,weighted_exit_price,stop_loss,take_profit,trade_comment,gross_profit,commission,swap,fees,realized_net_profit,floating_profit,open_position_swap,net_profit,account_balance_at_entry,pl_percentage,entry_deal_count,exit_deal_count,entry_deal_tickets,exit_deal_tickets,all_deal_tickets,first_deal_ticket,last_deal_ticket,custom_fields,updated_at";
const BALANCE_EVENT_FIELDS =
  "account_id,deal_ticket,time_msc,executed_at_utc,broker_time_text,broker_utc_offset_minutes,deal_type_code,deal_type,profit,commission,swap,fee,comment";
const BALANCE_EVENT_TYPE_CODES = [2, 3, 4, 5, 6, 12, 15, 16, 17];

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

function optionalIso(value: string | null, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid timestamp.`);
  }
  return date.toISOString();
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

    const requestedAccount =
      request.nextUrl.searchParams.get("accountId")?.trim() || "all";
    const from = optionalIso(
      request.nextUrl.searchParams.get("from"),
      "from",
    );
    const to = optionalIso(request.nextUrl.searchParams.get("to"), "to");
    const supabaseAdmin = getSupabaseAdmin();

    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("mt5_accounts")
      .select(
        "id,login,server,company,account_name,currency,balance,equity,status,terminal_slot,last_connected_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (accountsError) throw accountsError;

    const accountIds = (accounts ?? []).map((account) => String(account.id));
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("mt5_trade_log_settings")
      .select("optional_headers,session_timezone")
      .eq("user_id", user.id)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (
      requestedAccount !== "all" &&
      !accountIds.includes(requestedAccount)
    ) {
      return jsonNoStore(
        { success: false, message: "Saved MT5 account was not found." },
        404,
      );
    }

    const selectedAccountIds =
      requestedAccount === "all" ? accountIds : [requestedAccount];
    if (!selectedAccountIds.length) {
      return jsonNoStore({
        success: true,
        accounts: [],
        trades: [],
        balanceEvents: [],
        settings,
      });
    }

    const rows: unknown[] = [];
    const balanceEvents: any[] = [];
    const pageSize = 1000;
    for (let rangeStart = 0; ; rangeStart += pageSize) {
      let query = supabaseAdmin
        .from("mt5_trade_records")
        .select(TRADE_FIELDS)
        .in("account_id", selectedAccountIds)
        .order("entry_at_utc", { ascending: false })
        .order("position_identifier", { ascending: false })
        .range(rangeStart, rangeStart + pageSize - 1);
      if (from) query = query.gte("entry_at_utc", from);
      if (to) query = query.lte("entry_at_utc", to);

      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    for (let rangeStart = 0; ; rangeStart += pageSize) {
      let query = supabaseAdmin
        .from("mt5_deals")
        .select(BALANCE_EVENT_FIELDS)
        .in("account_id", selectedAccountIds)
        .in("deal_type_code", BALANCE_EVENT_TYPE_CODES)
        .order("time_msc", { ascending: true })
        .order("deal_ticket", { ascending: true })
        .range(rangeStart, rangeStart + pageSize - 1);
      if (from) query = query.gte("executed_at_utc", from);
      if (to) query = query.lte("executed_at_utc", to);

      const { data, error } = await query;
      if (error) throw error;
      balanceEvents.push(
        ...(data ?? []).map((event: any) => ({
          ...event,
          amount:
            Number(event.profit || 0) +
            Number(event.commission || 0) +
            Number(event.swap || 0) +
            Number(event.fee || 0),
        })),
      );
      if (!data || data.length < pageSize) break;
    }

    const accountsWithBrokerTime = await Promise.all(
      (accounts ?? []).map(async (account) => {
        const { data: latestSnapshot, error: snapshotError } =
          await supabaseAdmin
            .from("mt5_account_snapshots")
            .select("broker_utc_offset_minutes")
            .eq("account_id", account.id)
            .not("broker_utc_offset_minutes", "is", null)
            .order("captured_at_utc", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (snapshotError) throw snapshotError;

        return {
          ...account,
          broker_utc_offset_minutes:
            latestSnapshot?.broker_utc_offset_minutes ?? null,
        };
      }),
    );

    return jsonNoStore({
      success: true,
      selectedAccountId: requestedAccount,
      accounts: accountsWithBrokerTime,
      trades: rows,
      balanceEvents,
      settings,
    });
  } catch (error: any) {
    console.error("MT5 TRADES ERROR:", error);
    return jsonNoStore(
      {
        success: false,
        message: error?.message ?? "Could not load automatic MT5 trades.",
      },
      500,
    );
  }
}
