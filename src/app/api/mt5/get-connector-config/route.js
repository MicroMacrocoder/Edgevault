import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function createRandomToken() {
  return `mt5_connector_${crypto.randomUUID()}`;
}

export async function POST(request) {
  try {
    const body = await request.json();

    const userId = String(body?.userId || "").trim();
    const tradeLogId = String(body?.tradeLogId || "").trim();
    const appOrigin = String(body?.appOrigin || "").trim();

    if (!userId || !tradeLogId || !appOrigin) {
      return NextResponse.json(
        {
          success: false,
          message: "userId, tradeLogId, and appOrigin are required.",
        },
        { status: 400 }
      );
    }

    const { data: tradeLogTemplate, error: templateError } =
      await supabaseAdmin
        .from("trade_log_templates")
        .select("id, user_id, client_id")
        .eq("user_id", userId)
        .eq("client_id", tradeLogId)
        .maybeSingle();

    if (templateError) {
      return NextResponse.json(
        { success: false, message: templateError.message },
        { status: 500 }
      );
    }

    if (!tradeLogTemplate) {
      return NextResponse.json(
        { success: false, message: "Trade log template not found." },
        { status: 404 }
      );
    }

    const token = createRandomToken();

    const { error: tokenError } = await supabaseAdmin
      .from("mt5_connector_tokens")
      .insert({
        user_id: userId,
        trade_log_id: tradeLogId,
        token,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (tokenError) {
      return NextResponse.json(
        { success: false, message: tokenError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      syncUrl: `${appOrigin}/api/mt5/sync`,
      connectorToken: token,
      tradeLogUrl: `${appOrigin}/trade-log/${tradeLogId}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Could not create connector config.",
      },
      { status: 500 }
    );
  }
}
