import { NextResponse } from "next/server";
import { fetchEurostatCalendarEvents } from "@/lib/eurostatEconomicData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Eurostat synchronization is not configured." }, { status: 503 });
  }
  if (!isAuthorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  try {
    const sourceEvents = await fetchEurostatCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("EUROSTAT CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json({ message: "Failed to store the official Eurostat calendar." }, { status: 500 });
    }
    return NextResponse.json({
      source: "Eurostat",
      fetched: sourceEvents.length,
      synced: result.synced,
      valueBacked: sourceEvents.filter((event) => event.actual != null || event.previous != null).length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("EUROSTAT CALENDAR SYNC ERROR:", error);
    return NextResponse.json({ message: "Failed to synchronize the official Eurostat calendar." }, { status: 502 });
  }
}
