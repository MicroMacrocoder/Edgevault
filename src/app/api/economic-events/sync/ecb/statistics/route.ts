import { NextResponse } from "next/server";
import { fetchEcbStatisticalCalendarEvents, ECB_STATISTICAL_SOURCE_NAME } from "@/lib/ecbStatisticalEconomicData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ message: "ECB statistics synchronization is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  try {
    const sourceEvents = await fetchEcbStatisticalCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("ECB STATISTICS UPSERT ERROR:", result.error);
      return NextResponse.json({ message: "Failed to store the official ECB statistical calendar." }, { status: 500 });
    }
    return NextResponse.json({
      source: ECB_STATISTICAL_SOURCE_NAME,
      fetched: sourceEvents.length,
      synced: result.synced,
      valueBacked: sourceEvents.filter((event) => event.actual != null || event.previous != null).length,
      families: [...new Set(sourceEvents.map((event) => event.seriesKey))].length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ECB STATISTICS CALENDAR SYNC ERROR:", error);
    return NextResponse.json({ message: "Failed to synchronize the official ECB statistical calendar." }, { status: 502 });
  }
}
