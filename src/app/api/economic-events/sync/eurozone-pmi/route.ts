import { NextResponse } from "next/server";
import { fetchEurozonePmiCalendarEvents, EUROZONE_PMI_SOURCE_NAME } from "@/lib/eurozonePmiEconomicData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ message: "Eurozone PMI synchronization is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  try {
    const sourceEvents = await fetchEurozonePmiCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("EUROZONE PMI UPSERT ERROR:", result.error);
      return NextResponse.json({ message: "Failed to store the official Eurozone PMI calendar." }, { status: 500 });
    }
    return NextResponse.json({
      source: EUROZONE_PMI_SOURCE_NAME,
      fetched: sourceEvents.length,
      synced: result.synced,
      valueBacked: 0,
      flash: sourceEvents.filter((event) => event.seriesKey.includes("flash")).length,
      final: sourceEvents.filter((event) => event.seriesKey.includes("final")).length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("EUROZONE PMI CALENDAR SYNC ERROR:", error);
    return NextResponse.json({ message: "Failed to synchronize the official Eurozone PMI calendar." }, { status: 502 });
  }
}
