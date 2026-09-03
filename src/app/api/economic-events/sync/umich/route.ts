import { NextResponse } from "next/server";
import { fetchUniversityMichiganCalendarEvents } from "@/lib/universityMichiganEconomicData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

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
      { message: "University of Michigan synchronization is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const sourceEvents = await fetchUniversityMichiganCalendarEvents();
    const result = await upsertOfficialEconomicEvents(sourceEvents);
    if (result.error) {
      console.error("UMICH CALENDAR UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official University of Michigan calendar." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "University of Michigan Surveys of Consumers",
      fetched: sourceEvents.length,
      synced: result.synced,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("UMICH CALENDAR SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official University of Michigan calendar." },
      { status: 502 }
    );
  }
}
