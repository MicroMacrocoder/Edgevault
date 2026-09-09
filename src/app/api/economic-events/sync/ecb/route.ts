import { NextResponse } from "next/server";
import { fetchEcbCalendarEvents, ECB_SOURCE_NAME } from "@/lib/ecbEconomicData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ message: "ECB synchronization is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  try {
    const sourceEvents = await fetchEcbCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("ECB CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json({ message: "Failed to store the official ECB calendar." }, { status: 500 });
    }
    return NextResponse.json({
      source: ECB_SOURCE_NAME,
      fetched: sourceEvents.length,
      synced: result.synced,
      decisions: sourceEvents.filter((event) => event.seriesKey === "eur-ecb-monetary-policy-decision").length,
      pressConferences: sourceEvents.filter((event) => event.seriesKey === "eur-ecb-press-conference").length,
      accounts: sourceEvents.filter((event) => event.seriesKey === "eur-ecb-monetary-policy-accounts").length,
      speeches: sourceEvents.filter((event) => event.seriesKey === "eur-ecb-central-bank-speech").length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ECB CALENDAR SYNC ERROR:", error);
    return NextResponse.json({ message: "Failed to synchronize the official ECB calendar." }, { status: 502 });
  }
}

