import { NextResponse } from "next/server";
import { fetchBlsHistoricalObservations } from "@/lib/blsHistoricalData";
import {
  applyObservationsToEconomicEvents,
  upsertEconomicSeriesObservations,
} from "@/lib/supabase/economicSeriesObservations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || !process.env.BLS_API_KEY) {
    console.error(
      "BLS HISTORY SYNC ERROR: Missing CRON_SECRET or BLS_API_KEY."
    );
    return NextResponse.json(
      { message: "BLS history synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") === "recent" ? "recent" : "full";
    const forceLink = url.searchParams.get("forceLink") === "1";
    const currentYear = new Date().getUTCFullYear();
    const history = await fetchBlsHistoricalObservations(
      mode === "recent"
        ? { startYear: currentYear - 1, endYear: currentYear }
        : undefined
    );
    const result = await upsertEconomicSeriesObservations(history.observations);

    if (result.error) {
      console.error("BLS HISTORY UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official BLS history." },
        { status: 500 }
      );
    }

    const shouldLink =
      mode === "full" || forceLink || result.inserted > 0 || result.revised > 0;
    const eventResult = shouldLink
      ? await applyObservationsToEconomicEvents()
      : { error: null, updated: 0 };
    if (eventResult.error) {
      console.error("BLS EVENT VALUE LINK ERROR:", eventResult.error);
      return NextResponse.json(
        { message: "BLS history was stored, but calendar values were not linked." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "U.S. Bureau of Labor Statistics",
      mode,
      startYear: history.startYear,
      endYear: history.endYear,
      sourceSeries: history.sourceSeriesCount,
      derivedObservations: history.observations.length,
      synced: result.synced,
      inserted: result.inserted,
      revised: result.revised,
      calendarEventsUpdated: eventResult.updated,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("BLS HISTORY SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official BLS history." },
      { status: 502 }
    );
  }
}
