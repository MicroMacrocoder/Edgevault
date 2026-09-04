import { NextResponse } from "next/server";
import { getStoredEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function validIsoDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") || "500");
    const { error, events } = await getStoredEconomicEvents({
      currency: (url.searchParams.get("currency") || "USD").toUpperCase(),
      from: validIsoDate(url.searchParams.get("from")),
      to: validIsoDate(url.searchParams.get("to")),
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 500,
    });

    if (error) {
      console.error("ECONOMIC EVENTS READ ERROR:", error.message);
      return NextResponse.json(
        { message: "Failed to load economic events." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        events,
        lastUpdated: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("ECONOMIC EVENTS ROUTE ERROR:", error);

    return NextResponse.json(
      { message: "Failed to load economic events." },
      { status: 500 }
    );
  }
}
