import { NextResponse } from "next/server";
import {
  fetchFederalReserveCalendarEvents,
  fetchFederalReserveSpeechEvents,
} from "@/lib/federalReserveEconomicData";
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
      { message: "Federal Reserve synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const [fomcEvents, speechEvents] = await Promise.all([
      fetchFederalReserveCalendarEvents(),
      fetchFederalReserveSpeechEvents(),
    ]);
    const sourceEvents = [...fomcEvents, ...speechEvents];
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("FED CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official Federal Reserve calendar." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "Board of Governors of the Federal Reserve System",
      fetched: sourceEvents.length,
      fomcEvents: fomcEvents.length,
      speechEvents: speechEvents.length,
      synced: result.synced,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("FED CALENDAR SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official Federal Reserve calendar." },
      { status: 502 }
    );
  }
}
