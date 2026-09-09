import { NextResponse } from "next/server";
import { fetchEuropeanCommissionHistoricalObservations } from "@/lib/europeanCommissionEconomicData";
import {
  applyObservationsToEconomicEvents,
  upsertEconomicSeriesObservations,
} from "@/lib/supabase/economicSeriesObservations";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ message: "European Commission history synchronization is not configured." }, { status: 503 });
  }
  if (!isAuthorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  try {
    const history = await fetchEuropeanCommissionHistoricalObservations();
    const result = await upsertEconomicSeriesObservations(history.observations);
    if (result.error) {
      console.error("ECFIN HISTORY UPSERT ERROR:", result.error);
      return NextResponse.json({ message: "Failed to store official European Commission history." }, { status: 500 });
    }
    const eventResult = await applyObservationsToEconomicEvents({
      sourceConnector: "european-commission",
      historicalValueSource: "European Commission DG ECFIN BCS time series",
    });
    if (eventResult.error) {
      console.error("ECFIN EVENT VALUE LINK ERROR:", eventResult.error);
      return NextResponse.json({ message: "European Commission history was stored, but calendar values were not linked." }, { status: 500 });
    }
    return NextResponse.json({
      source: "European Commission DG ECFIN Business and Consumer Surveys",
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
    console.error("ECFIN HISTORY SYNC ERROR:", error);
    return NextResponse.json({ message: "Failed to synchronize official European Commission history." }, { status: 502 });
  }
}
