import { NextResponse } from "next/server";
import { fetchBeaHistoricalObservations } from "@/lib/beaEconomicData";
import {
  applyObservationsToEconomicEvents,
  upsertEconomicSeriesObservations,
} from "@/lib/supabase/economicSeriesObservations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || !process.env.BEA_API_KEY) {
    console.error("BEA HISTORY SYNC ERROR: Missing CRON_SECRET or BEA_API_KEY.");
    return NextResponse.json(
      { message: "BEA history synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const history = await fetchBeaHistoricalObservations();
    const result = await upsertEconomicSeriesObservations(history.observations);

    if (result.error) {
      console.error("BEA HISTORY UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store official BEA history." },
        { status: 500 }
      );
    }

    const eventResult = await applyObservationsToEconomicEvents({
      sourceConnector: "bea",
      historicalValueSource: "BEA Data API",
    });

    if (eventResult.error) {
      console.error("BEA EVENT VALUE LINK ERROR:", eventResult.error);
      return NextResponse.json(
        { message: "BEA history was stored, but calendar values were not linked." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "U.S. Bureau of Economic Analysis",
      startYear: history.startYear,
      endYear: history.endYear,
      derivedObservations: history.observations.length,
      synced: result.synced,
      inserted: result.inserted,
      revised: result.revised,
      calendarEventsUpdated: eventResult.updated,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("BEA HISTORY SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize official BEA history." },
      { status: 502 }
    );
  }
}
