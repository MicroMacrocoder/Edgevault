import { NextResponse } from "next/server";
import {
  EURO_NATIONAL_SOURCE_NAME,
  EURO_NATIONAL_OFFICES,
  attachOfficialNationalValues,
  fetchEuroNationalCalendarSync,
} from "@/lib/euroNationalEconomicData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { message: "National EUR synchronization is not configured." },
      { status: 503 }
    );
  }
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  try {
    const sync = await fetchEuroNationalCalendarSync();
    const sourceEvents = sync.events;
    const valueBacked = await attachOfficialNationalValues(sourceEvents);
    const result = await upsertOfficialEconomicEvents(sourceEvents, {
      clearUnsetValues: true,
    });
    if (result.error) {
      console.error("NATIONAL EUR CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official national EUR calendar." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      source: EURO_NATIONAL_SOURCE_NAME,
      countries: EURO_NATIONAL_OFFICES.length,
      availableCountries: sync.availableCountries,
      unavailableCountries: sync.unavailableCountries,
      fetched: sourceEvents.length,
      synced: result.synced,
      valueBacked,
      calendarOnly: sourceEvents.filter((event) => event.actual == null && event.previous == null).length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("NATIONAL EUR CALENDAR SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official national EUR calendar." },
      { status: 502 }
    );
  }
}
