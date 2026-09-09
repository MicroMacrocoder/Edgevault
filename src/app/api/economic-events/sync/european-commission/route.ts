import { NextResponse } from "next/server";
import { fetchEuropeanCommissionCalendarEvents } from "@/lib/europeanCommissionEconomicData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ message: "European Commission synchronization is not configured." }, { status: 503 });
  }
  if (!isAuthorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  try {
    const sourceEvents = await fetchEuropeanCommissionCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("ECFIN CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json({ message: "Failed to store the official European Commission calendar." }, { status: 500 });
    }
    return NextResponse.json({
      source: "European Commission DG ECFIN Business and Consumer Surveys",
      fetched: sourceEvents.length,
      synced: result.synced,
      valueBacked: sourceEvents.filter((event) =>
        (event.actual !== undefined && event.actual !== null) ||
        (event.previous !== undefined && event.previous !== null)
      ).length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ECFIN CALENDAR SYNC ERROR:", error);
    return NextResponse.json({ message: "Failed to synchronize the official European Commission calendar." }, { status: 502 });
  }
}
