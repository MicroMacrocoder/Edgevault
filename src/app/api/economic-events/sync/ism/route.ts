import { NextResponse } from "next/server";
import { fetchIsmCalendarEvents } from "@/lib/ismEconomicData";
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
      { message: "ISM synchronization is not configured." },
      { status: 503 }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const sourceEvents = await fetchIsmCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("ISM CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official ISM calendar." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      source: "Institute for Supply Management",
      fetched: sourceEvents.length,
      synced: result.synced,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ISM CALENDAR SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official ISM calendar." },
      { status: 502 }
    );
  }
}
