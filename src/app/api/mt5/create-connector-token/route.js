import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured for MT5 connector');
}

const supabaseAdmin = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

function createRandomToken() {
  const randomPart = crypto.randomUUID();
  return `mt5_connector_${randomPart}`;
}

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "Supabase credentials not configured. Please set SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const userId = String(body?.userId || "").trim();
    const tradeLogId = String(body?.tradeLogId || "").trim();

    if (!userId || !tradeLogId) {
      return NextResponse.json(
        { success: false, message: "userId and tradeLogId are required." },
        { status: 400 }
      );
    }

    const token = createRandomToken();

    const { error } = await supabaseAdmin.from("mt5_connector_tokens").insert({
      user_id: userId,
      trade_log_id: tradeLogId,
      token,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Could not create connector token.",
      },
      { status: 500 }
    );
  }
}
