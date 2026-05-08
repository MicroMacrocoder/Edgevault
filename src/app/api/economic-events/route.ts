import { NextResponse } from "next/server";
import { getEconomicEvents } from "../../../lib/economicCalendar";
import {
  getStoredEconomicEvents,
  upsertEconomicEvents,
} from "../../../lib/supabase/economicEvents";

export async function GET() {
  try {
    const economicEvents = await getEconomicEvents();

    const { error: saveError } = await upsertEconomicEvents(economicEvents);

    if (saveError) {
      return NextResponse.json(
        { message: "Failed to save economic events" },
        { status: 500 }
      );
    }

    const { error: loadError, events } = await getStoredEconomicEvents();

    if (loadError) {
      return NextResponse.json(
        { message: "Failed to load economic events" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error syncing economic events:", error);

    return NextResponse.json(
      { message: "Failed to sync economic events" },
      { status: 500 }
    );
  }
}
