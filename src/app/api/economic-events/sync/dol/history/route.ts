import { NextResponse } from "next/server";
import { fetchDolHistoricalObservations } from "@/lib/dolUnemploymentData";
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
      { message: "DOL synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const history = await fetchDolHistoricalObservations();
    const result = await upsertEconomicSeriesObservations(history.observations);
    if (result.error) {
      console.error("DOL HISTORY UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store official DOL history." },
        { status: 500 }
      );
    }

    const eventResult = await applyObservationsToEconomicEvents({
      sourceConnector: "dol",
      historicalValueSource:
        "U.S. Department of Labor UI weekly claims report",
    });
    if (eventResult.error) {
      console.error("DOL EVENT VALUE LINK ERROR:", eventResult.error);
      return NextResponse.json(
        { message: "DOL history was stored, but calendar values were not linked." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "U.S. Department of Labor, Employment and Training Administration",
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
    console.error("DOL HISTORY SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize official DOL history." },
      { status: 502 }
    );
  }
}
