import type { EconomicEventRow } from "@/types/economic";
import { createClient } from "@supabase/supabase-js";

const FED_SOURCE_NAME = "Board of Governors of the Federal Reserve System";

export type EconomicSpeechTranscriptRow = {
  id: string;
  economic_event_id: string;
  external_id: string;
  currency: string;
  source_agency: string;
  speaker: string | null;
  title: string;
  transcript_type: "official";
  transcript_status: "published" | "unavailable";
  transcript_text: string | null;
  source_url: string;
  live_url: string | null;
  source_published_at: string | null;
  fetched_at: string;
  metadata: Record<string, unknown>;
};

export type SpeechArchiveItem = {
  event: EconomicEventRow;
  transcript: EconomicSpeechTranscriptRow | null;
  reportSummary: string | null;
};

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code: string) => {
      const numeric = code.toLowerCase().startsWith("x")
        ? parseInt(code.slice(1), 16)
        : parseInt(code, 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—");
}

function htmlToText(value: string): string {
  return decodeHtml(
    value
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n\n")
      .replace(/<\/h[1-6]\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildReportSummary(transcriptText: string | null): string | null {
  if (!transcriptText) return null;

  const paragraphs = transcriptText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length >= 80);
  const paragraph = paragraphs[0] || transcriptText.replace(/\s+/g, " ").trim();
  if (!paragraph) return null;

  return paragraph.length > 420
    ? `${paragraph.slice(0, 417).trimEnd()}...`
    : paragraph;
}

function extractFirst(html: string, expression: RegExp): string | null {
  return html.match(expression)?.[1]
    ? htmlToText(html.match(expression)![1])
    : null;
}

async function extractPdfTranscriptText(buffer: ArrayBuffer): Promise<string> {
  // pdfjs-dist expects this browser geometry global during module
  // initialization. Text extraction does not need a rendering canvas, so use
  // a small identity matrix polyfill that remains safe in a server bundle.
  const runtime = globalThis as typeof globalThis & {
    DOMMatrix?: unknown;
  };
  if (!runtime.DOMMatrix) {
    class ServerDOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;

      constructor(init?: string | number[]) {
        if (Array.isArray(init) && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }
    }
    Object.defineProperty(globalThis, "DOMMatrix", {
      value: ServerDOMMatrix,
      configurable: true,
    });
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
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    if (pageText) pages.push(pageText);
  }

  return pages.join("\n\n").trim();
}

function getFomcTranscriptPdfUrl(
  sourceUrl: string,
  eventTitle?: string,
  eventTime?: string,
): string | null {
  const match = sourceUrl.match(
    /\/monetarypolicy\/fomc(?:pres|press)conf(\d{8})\.htm/i,
  );
  if (match) {
    return `https://www.federalreserve.gov/mediacenter/files/FOMCpresconf${match[1]}.pdf`;
  }

  if (eventTitle !== "FOMC Press Conference" || !eventTime) return null;
  const date = new Date(eventTime);
  if (Number.isNaN(date.getTime())) return null;
  const dateKey = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `https://www.federalreserve.gov/mediacenter/files/FOMCpresconf${dateKey}.pdf`;
}

export function extractOfficialSpeechTranscript(
  html: string,
  sourceUrl: string,
): {
  title: string | null;
  speaker: string | null;
  transcriptText: string | null;
  liveUrl: string | null;
  transcriptPdfUrl: string | null;
  metadata: Record<string, unknown>;
} {
  const article = html.match(/<div id=["']article["']>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1] || html;
  const title = extractFirst(article, /<h3[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i);
  const speaker = extractFirst(article, /<p[^>]*class=["'][^"']*speaker[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  const livePath = article.match(
    /href=["']([^"']+)["'][^>]*class=["'][^"']*watchLive/i,
  )?.[1] || article.match(
    /class=["'][^"']*watchLive[^"']*["'][^>]*href=["']([^"']+)["']/i,
  )?.[1] || null;
  const transcriptPdfPath = html.match(
    /href=["']([^"']*\/mediacenter\/files\/FOMCpresconf\d{8}\.pdf(?:\?[^"']*)?)["']/i,
  )?.[1] || null;
  const bodyMarker = '<div class="col-xs-12 col-sm-8 col-md-8">';
  const bodyStart = article.indexOf(bodyMarker);
  const attachmentStart = bodyStart >= 0
    ? article.indexOf('<div class="panel panel-attachments', bodyStart)
    : -1;
  const body = bodyStart >= 0
    ? article.slice(
        bodyStart + bodyMarker.length,
        attachmentStart >= 0 ? attachmentStart : article.length,
      )
    : null;
  const transcriptText = body ? htmlToText(body) : null;

  return {
    title,
    speaker,
    transcriptText: transcriptText && transcriptText.length > 80 ? transcriptText : null,
    liveUrl: livePath ? new URL(livePath, sourceUrl).toString() : null,
    transcriptPdfUrl: transcriptPdfPath
      ? new URL(transcriptPdfPath, sourceUrl).toString()
      : null,
    metadata: {
      source_url: sourceUrl,
      extraction_method: "federal-reserve-article-body",
    },
  };
}

async function fetchTranscript(event: EconomicEventRow) {
  if (!event.source_url) return null;
  const response = await fetch(event.source_url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/pdf",
      "User-Agent": "EdgeVault-Economic-Calendar/1.0",
    },
  });
  if (!response.ok) {
    return {
      event,
      transcriptText: null,
      title: event.title,
      speaker: null,
      liveUrl: null,
      officialTranscriptUrl: null,
      metadata: { http_status: response.status },
    };
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("application/pdf") || /\.pdf(?:$|\?)/i.test(event.source_url)) {
    try {
      const transcriptText = await extractPdfTranscriptText(await response.arrayBuffer());
      return {
        event,
        transcriptText: transcriptText.length > 80 ? transcriptText : null,
        title: event.title,
        speaker: null,
        liveUrl: null,
        officialTranscriptUrl: event.source_url,
        metadata: {
          source_url: event.source_url,
          extraction_method: "federal-reserve-pdf",
        },
      };
    } catch (error) {
      return {
        event,
        transcriptText: null,
        title: event.title,
        speaker: null,
        liveUrl: null,
        officialTranscriptUrl: event.source_url,
        metadata: {
          source_url: event.source_url,
          extraction_method: "federal-reserve-pdf",
          extraction_error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  const parsed = extractOfficialSpeechTranscript(
    await response.text(),
    event.source_url,
  );

  const transcriptPdfUrl =
    parsed.transcriptPdfUrl ||
    getFomcTranscriptPdfUrl(event.source_url, event.title, event.event_time);

  if (transcriptPdfUrl) {
    try {
      const transcriptResponse = await fetch(transcriptPdfUrl, {
        cache: "no-store",
        headers: {
          Accept: "application/pdf",
          "User-Agent": "EdgeVault-Economic-Calendar/1.0",
        },
      });
      if (transcriptResponse.ok) {
        const transcriptText = await extractPdfTranscriptText(
          await transcriptResponse.arrayBuffer(),
        );
        return {
          event,
          title: parsed.title || event.title,
          speaker: parsed.speaker,
          transcriptText: transcriptText.length > 80 ? transcriptText : null,
          liveUrl: parsed.liveUrl,
          officialTranscriptUrl: transcriptPdfUrl,
          metadata: {
            ...parsed.metadata,
            extraction_method: "federal-reserve-fomc-pdf",
            official_transcript_url: transcriptPdfUrl,
          },
        };
      }

      return {
        event,
        title: parsed.title || event.title,
        speaker: parsed.speaker,
        transcriptText: null,
        liveUrl: parsed.liveUrl,
        officialTranscriptUrl: transcriptPdfUrl,
        metadata: {
          ...parsed.metadata,
          extraction_method: "federal-reserve-fomc-pdf",
          official_transcript_url: transcriptPdfUrl,
          pdf_http_status: transcriptResponse.status,
        },
      };
    } catch (error) {
      return {
        event,
        title: parsed.title || event.title,
        speaker: parsed.speaker,
        transcriptText: null,
        liveUrl: parsed.liveUrl,
        officialTranscriptUrl: transcriptPdfUrl,
        metadata: {
          ...parsed.metadata,
          extraction_method: "federal-reserve-fomc-pdf",
          official_transcript_url: transcriptPdfUrl,
          extraction_error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  return {
    event,
    ...parsed,
    officialTranscriptUrl: null,
  };
}

export async function getSpeechArchive(
  currency = "USD",
  eventId?: string,
): Promise<SpeechArchiveItem[]> {
  const supabase = getSupabaseServer();
  let eventQuery = supabase
    .from("economic_events")
    .select("*")
    .eq("currency", currency.toUpperCase())
    .eq("event_kind", "speech")
    .eq("source_agency", FED_SOURCE_NAME);
  if (eventId) eventQuery = eventQuery.eq("id", eventId);
  const { data: eventData, error: eventError } = await eventQuery
    .order("event_time", { ascending: false })
    .limit(2000);
  if (eventError) throw eventError;

  const events = (eventData || []) as EconomicEventRow[];
  if (events.length === 0) return [];

  const transcriptData: EconomicSpeechTranscriptRow[] = [];
  for (const eventIdBatch of chunks(
    events.map((event) => event.id),
    50,
  )) {
    const { data, error } = await supabase
      .from("economic_speech_transcripts")
      .select("*")
      .in("economic_event_id", eventIdBatch);
    if (error) throw error;
    transcriptData.push(...((data || []) as EconomicSpeechTranscriptRow[]));
  }

  const transcripts = new Map(
    transcriptData.map((row) => [
      row.economic_event_id,
      row,
    ]),
  );
  return events.map((event) => ({
    event,
    transcript: transcripts.get(event.id) || null,
    reportSummary: buildReportSummary(
      transcripts.get(event.id)?.transcript_status === "published"
        ? transcripts.get(event.id)?.transcript_text || null
        : null,
    ),
  }));
}

export async function syncOfficialSpeechTranscripts(options?: {
  months?: number;
  limit?: number;
}) {
  const supabase = getSupabaseServer();
  const months = Math.max(options?.months || 12, 1);
  const limit = Math.min(Math.max(options?.limit || 100, 1), 2000);
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - months);

  const { data: eventData, error: eventError } = await supabase
    .from("economic_events")
    .select("*")
    .eq("currency", "USD")
    .eq("event_kind", "speech")
    .eq("source_agency", FED_SOURCE_NAME)
    .gte("event_time", from.toISOString())
    .order("event_time", { ascending: false })
    .limit(limit);
  if (eventError) throw eventError;

  const events = (eventData || []) as EconomicEventRow[];
  const results: Array<Record<string, unknown>> = [];
  for (let index = 0; index < events.length; index += 6) {
    const batch = events.slice(index, index + 6);
    const parsed = await Promise.all(batch.map(fetchTranscript));
    const rows = parsed.filter(Boolean).map((item) => ({
      economic_event_id: item!.event.id,
      external_id: item!.event.external_id,
      currency: item!.event.currency || "USD",
      source_agency: FED_SOURCE_NAME,
      speaker: item!.speaker,
      title: item!.title || item!.event.title,
      transcript_type: "official" as const,
      transcript_status: item!.transcriptText ? "published" : "unavailable",
      transcript_text: item!.transcriptText,
      source_url: item!.officialTranscriptUrl || item!.event.source_url,
      live_url:
        item!.event.release_status === "scheduled" ? item!.liveUrl : null,
      source_published_at: item!.event.source_published_at,
      fetched_at: new Date().toISOString(),
      metadata: item!.metadata,
    }));
    if (rows.length === 0) continue;
    const { data, error } = await supabase
      .from("economic_speech_transcripts")
      .upsert(rows, { onConflict: "external_id" })
      .select("*");
    if (error) throw error;
    results.push(...((data || []) as Record<string, unknown>[]));
  }

  return {
    source: FED_SOURCE_NAME,
    checked: events.length,
    published: results.filter((row) => row.transcript_status === "published").length,
    unavailable: results.filter((row) => row.transcript_status === "unavailable").length,
    synced: results.length,
  };
}
