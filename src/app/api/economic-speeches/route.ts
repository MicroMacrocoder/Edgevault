import { NextResponse } from "next/server";
import { getSpeechArchive } from "@/lib/federalReserveSpeechTranscripts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const currency = params.get("currency") || "USD";
    const eventId = params.get("eventId") || undefined;
    const speeches = await getSpeechArchive(currency, eventId);
    return NextResponse.json({ currency: currency.toUpperCase(), speeches });
  } catch (error) {
    console.error("SPEECH ARCHIVE READ ERROR:", error);
    return NextResponse.json(
      { message: "Failed to load the speech archive." },
      { status: 500 },
    );
  }
}
