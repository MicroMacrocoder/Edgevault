import { NextResponse } from "next/server";
import { fetchBeaCalendarEvents } from "@/lib/beaEconomicData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || !process.env.BEA_API_KEY) {
    console.error("BEA CALENDAR SYNC ERROR: Missing CRON_SECRET or BEA_API_KEY.");
    return NextResponse.json(
      { message: "BEA calendar synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const sourceEvents = await fetchBeaCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("BEA CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official BEA calendar." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "U.S. Bureau of Economic Analysis",
      fetched: sourceEvents.length,
      synced: result.synced,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("BEA CALENDAR SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official BEA calendar." },
      { status: 502 }
    );
  }
}
