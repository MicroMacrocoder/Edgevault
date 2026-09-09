import { createClient } from "@supabase/supabase-js";
import type { EconomicEventRow } from "@/types/economic";

export const ECB_SPEECH_SOURCE_NAME = "European Central Bank";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function htmlToText(value: string): string {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const runtime = globalThis as typeof globalThis & { DOMMatrix?: unknown };
  if (!runtime.DOMMatrix) {
    class ServerDOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(init?: string | number[]) {
        if (Array.isArray(init) && init.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }
    Object.defineProperty(globalThis, "DOMMatrix", { value: ServerDOMMatrix, configurable: true });
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/[ \t]{2,}/g, " ").trim();
    if (pageText) pages.push(pageText);
  }
  return pages.join("\n\n").trim();
}

function articleText(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  return htmlToText(article || main || html);
}

async function fetchTranscript(event: EconomicEventRow) {
  if (!event.source_url) return null;
  const response = await fetch(event.source_url, {
    cache: "no-store",
    headers: { Accept: "text/html,application/pdf", "User-Agent": "EdgeVault-Economic-Calendar/1.0" },
  });
  if (!response.ok) {
    return { event, text: null, metadata: { http_status: response.status, source_url: event.source_url } };
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  try {
    const transcriptText = contentType.includes("application/pdf") || /\.pdf(?:$|\?)/i.test(event.source_url)
      ? await extractPdfText(await response.arrayBuffer())
      : articleText(await response.text());
    return {
      event,
      text: transcriptText.length > 80 ? transcriptText : null,
      metadata: {
        source_url: event.source_url,
        extraction_method: contentType.includes("application/pdf") || /\.pdf(?:$|\?)/i.test(event.source_url)
          ? "ecb-pdf"
          : "ecb-html-main",
      },
    };
  } catch (error) {
    return {
      event,
      text: null,
      metadata: {
        source_url: event.source_url,
        extraction_error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function syncEcbSpeechTranscripts(options?: { months?: number; limit?: number }) {
  const supabase = getSupabaseServer();
  const months = Math.min(Math.max(options?.months || 12, 1), 60);
  const limit = Math.min(Math.max(options?.limit || 200, 1), 2000);
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - months);
  const { data, error } = await supabase
    .from("economic_events")
    .select("*")
    .eq("currency", "EUR")
    .eq("event_kind", "speech")
    .eq("source_agency", ECB_SPEECH_SOURCE_NAME)
    .gte("event_time", from.toISOString())
    .order("event_time", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const events = (data || []) as EconomicEventRow[];
  const saved: Array<Record<string, unknown>> = [];
  for (let index = 0; index < events.length; index += 6) {
    const parsed = await Promise.all(events.slice(index, index + 6).map(fetchTranscript));
    const rows = parsed.filter(Boolean).map((item) => ({
      economic_event_id: item!.event.id,
      external_id: item!.event.external_id,
      currency: "EUR",
      source_agency: ECB_SPEECH_SOURCE_NAME,
      speaker: null,
      title: item!.event.title,
      transcript_type: "official" as const,
      transcript_status: item!.text ? "published" : "unavailable",
      transcript_text: item!.text,
      source_url: item!.event.source_url,
      live_url: item!.event.release_status === "scheduled" ? item!.event.source_url : null,
      source_published_at: item!.event.source_published_at,
      fetched_at: new Date().toISOString(),
      metadata: item!.metadata,
    }));
    if (rows.length === 0) continue;
    const result = await supabase.from("economic_speech_transcripts").upsert(rows, { onConflict: "external_id" }).select("*");
    if (result.error) throw result.error;
    saved.push(...((result.data || []) as Record<string, unknown>[]));
  }

  return {
    source: ECB_SPEECH_SOURCE_NAME,
    checked: events.length,
    published: saved.filter((row) => row.transcript_status === "published").length,
    unavailable: saved.filter((row) => row.transcript_status === "unavailable").length,
    synced: saved.length,
  };
}
