import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          status: "error",
          service: "edgevault-api",
          supabase: "missing_env",
          timestamp,
        },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const { error } = await supabase
      .from("health_checks")
      .select("id")
      .eq("id", 1)
      .single();

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          service: "edgevault-api",
          supabase: "unhealthy",
          timestamp,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        service: "edgevault-api",
        supabase: "connected",
        timestamp,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        service: "edgevault-api",
        supabase: "failed",
        timestamp,
      },
      { status: 500 }
    );
  }
}