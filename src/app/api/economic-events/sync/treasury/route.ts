import { NextResponse } from "next/server";
import { fetchTreasuryCalendarEvents } from "@/lib/treasuryEconomicData";
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
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { message: "Treasury synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const sourceEvents = await fetchTreasuryCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("TREASURY CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official Treasury calendar." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "U.S. Department of the Treasury",
      fetched: sourceEvents.length,
      synced: result.synced,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("TREASURY CALENDAR SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official Treasury calendar." },
      { status: 502 }
    );
  }
}
