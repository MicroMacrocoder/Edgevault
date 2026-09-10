import { NextResponse } from "next/server";
import { syncEuroNationalCentralBankSpeechTranscripts } from "@/lib/euroNationalCentralBankSpeechTranscripts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { message: "National central-bank EUR transcript synchronization is not configured." },
      { status: 503 },
    );
  }
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  try {
    const params = new URL(request.url).searchParams;
    const months = Number(params.get("months") || 60);
    const limit = Number(params.get("limit") || 500);
    const result = await syncEuroNationalCentralBankSpeechTranscripts({ months, limit });
    return NextResponse.json({ ...result, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("EURO NATIONAL CENTRAL BANK TRANSCRIPT SYNC ERROR:", error);
    return NextResponse.json(
      { message: "Failed to synchronize national central-bank EUR transcripts." },
      { status: 502 },
    );
  }
}
