import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/mt5Hosted";

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

function cleanHeaderId(value: unknown) {
  const id = String(value || "").trim();
  if (!/^(manual|auto|custom|auto-custom)-[a-z0-9-]{2,100}$/i.test(id)) {
    throw new Error("An optional header has an invalid ID.");
  }
  return id;
}

function cleanOptionalHeaders(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Optional headers must be an array.");
  if (value.length > 30) throw new Error("You can use up to 30 optional headers.");

  const seen = new Set<string>();
  return value.map((raw: any) => {
    const id = cleanHeaderId(raw?.id);
    const name = String(raw?.name || "").trim();
    const group = String(raw?.group || "manual").trim();
    const type = String(raw?.type || "text").trim();
    if (!name || name.length > 60) throw new Error("Header names must contain 1 to 60 characters.");
    if (!new Set(["manual", "automatic", "custom_automatic"]).has(group)) {
      throw new Error("An optional header has an invalid group.");
    }
    if (!new Set(["text", "image", "auto", "custom_auto"]).has(type)) {
      throw new Error("An optional header has an invalid type.");
    }
    if (seen.has(id)) throw new Error("Optional header IDs must be unique.");
    seen.add(id);
    return {
      id,
      name,
      group,
      type,
      formulaKey: String(raw?.formulaKey || "").trim(),
      sourceField: String(raw?.sourceField || "").trim(),
      defaultValue: String(raw?.defaultValue || "").slice(0, 500),
      rules: Array.isArray(raw?.rules) ? raw.rules.slice(0, 20) : [],
    };
  });
}

function cleanCustomValue(value: unknown, userId: string) {
  if (typeof value === "string") {
    if (value.length > 10000) throw new Error("A text field cannot exceed 10,000 characters.");
    return value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const image = value as Record<string, unknown>;
  const url = String(image.url || "").trim();
  const path = String(image.path || "").trim();
  const name = String(image.name || "").trim().slice(0, 255);
  if (!url && !path) return "";
  if (url.length > 3000 || path.length > 1000) throw new Error("Screenshot metadata is too long.");
  if (url && !url.startsWith("https://")) throw new Error("Screenshot URLs must use HTTPS.");
  if (path && !path.startsWith(`${userId}/mt5-trades/`)) {
    throw new Error("Screenshot storage path does not belong to this user.");
  }
  return { url, path, name };
}

function cleanCustomFields(value: unknown, userId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Trade detail values must be an object.");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 30) throw new Error("A trade can have up to 30 detail values.");
  return Object.fromEntries(entries.map(([id, fieldValue]) => [cleanHeaderId(id), cleanCustomValue(fieldValue, userId)]));
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (!user) return jsonNoStore({ success: false, message: authError || "Unauthorized." }, 401);

    const body = await request.json();
    const optionalHeaders = cleanOptionalHeaders(body?.optionalHeaders);
    const sessionTimezone = String(body?.sessionTimezone || "UTC").trim();
    if (!sessionTimezone || sessionTimezone.length > 100) {
      return jsonNoStore({ success: false, message: "Select a valid session timezone." }, 400);
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: sessionTimezone }).format(new Date());
    } catch {
      return jsonNoStore({ success: false, message: "Select a valid session timezone." }, 400);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("mt5_trade_log_settings").upsert(
      {
        user_id: user.id,
        optional_headers: optionalHeaders,
        session_timezone: sessionTimezone,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;

    return jsonNoStore({ success: true, optionalHeaders, sessionTimezone });
  } catch (error: any) {
    console.error("MT5 TRADE LOG SETTINGS ERROR:", error);
    return jsonNoStore({ success: false, message: error?.message || "Could not save Trade Log settings." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (!user) return jsonNoStore({ success: false, message: authError || "Unauthorized." }, 401);

    const body = await request.json();
    const tradeId = String(body?.tradeId || "").trim();
    if (!tradeId) return jsonNoStore({ success: false, message: "tradeId is required." }, 400);
    const customFields = cleanCustomFields(body?.customFields, user.id);

    const supabaseAdmin = getSupabaseAdmin();
    const { data: trade, error: lookupError } = await supabaseAdmin
      .from("mt5_trade_records")
      .select("id,account_id")
      .eq("id", tradeId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!trade) return jsonNoStore({ success: false, message: "MT5 trade was not found." }, 404);

    const { data: account, error: accountError } = await supabaseAdmin
      .from("mt5_accounts")
      .select("id")
      .eq("id", trade.account_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return jsonNoStore({ success: false, message: "MT5 trade was not found." }, 404);

    const { error } = await supabaseAdmin
      .from("mt5_trade_records")
      .update({ custom_fields: customFields })
      .eq("id", tradeId);
    if (error) throw error;

    return jsonNoStore({ success: true, customFields });
  } catch (error: any) {
    console.error("MT5 TRADE DETAILS ERROR:", error);
    return jsonNoStore({ success: false, message: error?.message || "Could not save trade details." }, 500);
  }
}
