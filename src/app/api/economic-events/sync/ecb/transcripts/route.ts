import { NextResponse } from "next/server";
import { syncEcbSpeechTranscripts } from "@/lib/ecbSpeechTranscripts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ message: "ECB transcript synchronization is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const result = await syncEcbSpeechTranscripts({
      months: Number(params.get("months") || "12"),
      limit: Number(params.get("limit") || "200"),
    });
    return NextResponse.json({ ...result, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("ECB SPEECH TRANSCRIPT SYNC ERROR:", error);
    return NextResponse.json({ message: "Failed to synchronize official ECB speech transcripts." }, { status: 502 });
  }
}

