import { NextResponse } from "next/server";
import { fetchConferenceBoardCalendarEvents } from "@/lib/conferenceBoardEconomicData";
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
      { message: "Conference Board synchronization is not configured." },
      { status: 503 }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const sourceEvents = await fetchConferenceBoardCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("CONFERENCE BOARD CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official Conference Board calendar." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      source: "The Conference Board",
      fetched: sourceEvents.length,
      synced: result.synced,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("CONFERENCE BOARD CALENDAR SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official Conference Board calendar." },
      { status: 502 }
    );
  }
}
