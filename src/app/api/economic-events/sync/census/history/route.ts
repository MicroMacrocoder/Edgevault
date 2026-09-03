import { NextResponse } from "next/server";
import { fetchCensusHistoricalObservations } from "@/lib/censusEconomicData";
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
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { message: "Census synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const history = await fetchCensusHistoricalObservations();
    const result = await upsertEconomicSeriesObservations(history.observations);
    if (result.error) {
      console.error("CENSUS HISTORY UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store official Census history." },
        { status: 500 }
      );
    }

    const eventResult = await applyObservationsToEconomicEvents({
      sourceConnector: "census",
      historicalValueSource: "U.S. Census Bureau economic indicator flat files",
    });
    if (eventResult.error) {
      console.error("CENSUS EVENT VALUE LINK ERROR:", eventResult.error);
      return NextResponse.json(
        { message: "Census history was stored, but calendar values were not linked." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "U.S. Census Bureau",
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
    console.error("CENSUS HISTORY SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize official Census history." },
      { status: 502 }
    );
  }
}
