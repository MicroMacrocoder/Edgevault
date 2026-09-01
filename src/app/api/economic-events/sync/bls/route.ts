import { NextResponse } from "next/server";
import { fetchBlsCalendarEvents } from "@/lib/economicCalendar";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("BLS CALENDAR SYNC ERROR: Missing CRON_SECRET.");
    return NextResponse.json(
      { message: "Calendar synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const sourceEvents = await fetchBlsCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);

    if (result.error) {
      console.error("BLS CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official BLS calendar." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "U.S. Bureau of Labor Statistics",
      fetched: sourceEvents.length,
      synced: result.synced,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("BLS CALENDAR SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official BLS calendar." },
      { status: 502 }
    );
  }
}
