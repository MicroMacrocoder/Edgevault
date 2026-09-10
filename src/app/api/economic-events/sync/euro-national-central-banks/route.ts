import { NextResponse } from "next/server";
import {
  EURO_NATIONAL_CENTRAL_BANK_SOURCE_NAME,
  fetchEuroNationalCentralBankSpeechEvents,
} from "@/lib/euroNationalCentralBankSpeechData";
import { upsertOfficialEconomicEvents } from "@/lib/supabase/economicEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { message: "National central-bank EUR synchronization is not configured." },
      { status: 503 },
    );
  }
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  try {
    const sync = await fetchEuroNationalCentralBankSpeechEvents();
    const result = await upsertOfficialEconomicEvents(sync.events, {
      clearUnsetValues: true,
    });
    if (result.error) {
      console.error("EURO NATIONAL CENTRAL BANK UPSERT ERROR:", result.error);
      return NextResponse.json(
        { message: "Failed to store the official national central-bank EUR speeches." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      source: EURO_NATIONAL_CENTRAL_BANK_SOURCE_NAME,
      countries: 4,
      availableCountries: sync.availableSources,
      unavailableCountries: sync.unavailableSources,
      fetched: sync.events.length,
      synced: result.synced,
      linkBacked: sync.events.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("EURO NATIONAL CENTRAL BANK SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize the official national central-bank EUR speeches." },
      { status: 502 },
    );
  }
}
