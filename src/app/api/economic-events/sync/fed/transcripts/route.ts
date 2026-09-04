import { NextResponse } from "next/server";
import { syncOfficialSpeechTranscripts } from "@/lib/federalReserveSpeechTranscripts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Speech synchronization is not configured." }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const months = Number(url.searchParams.get("months") || "12");
    const limit = Number(url.searchParams.get("limit") || "100");
    const result = await syncOfficialSpeechTranscripts({ months, limit });
    return NextResponse.json({ ...result, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("FED SPEECH TRANSCRIPT SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize official Fed speech transcripts." },
      { status: 502 },
    );
  }
}
