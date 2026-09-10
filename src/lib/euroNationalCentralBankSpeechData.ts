import type { EconomicSourceEvent } from "@/types/economic";
import {
  EURO_CENTRAL_BANK_SOURCES,
  type EuroCentralBankSource,
} from "@/lib/euroCentralBankSources";

export const EURO_NATIONAL_CENTRAL_BANK_SOURCE_NAME =
  "Euro-area National Central Banks";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PAGE_LENGTH = 2_000_000;

const MONTHS: Record<string, number> = {
  january: 1,
  januar: 1,
  janvier: 1,
  gennaio: 1,
  february: 2,
  februar: 2,
  février: 2,
  febbraio: 2,
  march: 3,
  märz: 3,
  mars: 3,
  marzo: 3,
  april: 4,
  avril: 4,
  aprile: 4,
  may: 5,
  mai: 5,
  maggio: 5,
  june: 6,
  juni: 6,
  juin: 6,
  giugno: 6,
  july: 7,
  juli: 7,
  juillet: 7,
  luglio: 7,
  august: 8,
  augusti: 8,
  août: 8,
  agosto: 8,
  september: 9,
  septembre: 9,
  settembre: 9,
  october: 10,
  oktober: 10,
  octobre: 10,
  ottobre: 10,
  november: 11,
  novembre: 11,
  december: 12,
  dezember: 12,
  décembre: 12,
  dicembre: 12,
};

const SPEECH_TERMS = [
  "speech",
  "speeches",
  "speech by",
  "intervention",
  "interventions",
  "address",
  "remarks",
  "keynote",
  "lecture",
  "hearing",
  "testimony",
  "opening",
  "closing",
  "presentation",
  "interview",
  "discours",
  "allocution",
  "interventi",
  "discorso",
  "rede",
  "vortrag",
  "ansprache",
  "conferencia",
  "intervenciones",
  "comparecencia",
];

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
    .replace(/&mdash;/gi, "—")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&agrave;/gi, "à")
    .replace(/&ocirc;/gi, "ô");
}

function htmlToText(value: string): string {
  return decodeHtml(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n\n")
      .replace(/<\/h[1-6]\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function absoluteUrl(value: string, base: string): string | null {
  try {
    const url = new URL(decodeHtml(value), base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseDate(value: string): string | null {
  const text = decodeHtml(value).replace(/\s+/g, " ").trim();
  let match = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  match = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+([A-Za-zÀ-ÿ]+)\s+(20\d{2})\b/i,
  );
  if (!match) {
    match = text.match(/\b([A-Za-zÀ-ÿ]+)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
    if (match) {
      const month = MONTHS[match[1].toLowerCase()];
      if (!month) return null;
      const date = new Date(Date.UTC(Number(match[3]), month - 1, Number(match[2]), 12));
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  }

  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  const date = new Date(Date.UTC(Number(match[3]), month - 1, Number(match[1]), 12));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function findDate(snippet: string): string | null {
  const matches = [
    ...snippet.matchAll(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g),
    ...snippet.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-]20\d{2}\b/g),
    ...snippet.matchAll(/\b\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+[A-Za-zÀ-ÿ]+\s+20\d{2}\b/gi),
    ...snippet.matchAll(/\b[A-Za-zÀ-ÿ]+\s+\d{1,2},?\s+20\d{2}\b/gi),
  ];
  return matches
    .map((match) => parseDate(match[0]))
    .find((value): value is string => Boolean(value)) || null;
}

function linkLooksLikeSpeech(title: string, context: string, source: EuroCentralBankSource): boolean {
  const combined = normalized(`${title} ${context}`);
  if (!SPEECH_TERMS.some((term) => combined.includes(normalized(term)))) return false;

  const urlPath = normalized(source.archiveUrl);
  const normalizedTitle = normalized(title);
  if (!normalizedTitle || normalizedTitle.length < 12) return false;
  if (normalizedTitle === normalized(urlPath)) return false;
  return true;
}

function parseArchive(source: EuroCentralBankSource, html: string, archiveUrl: string): EconomicSourceEvent[] {
  const events: EconomicSourceEvent[] = [];
  const seenUrls = new Set<string>();
  const anchorExpression = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorExpression.exec(html))) {
    const href = absoluteUrl(match[1], archiveUrl);
    if (!href || seenUrls.has(href)) continue;
    const title = htmlToText(match[2]);
    if (!title || !linkLooksLikeSpeech(title, html.slice(Math.max(0, match.index - 1200), match.index + match[0].length + 1200), source)) {
      continue;
    }
    const date = findDate(html.slice(Math.max(0, match.index - 1500), match.index + match[0].length + 900));
    if (!date) continue;
    if (href === archiveUrl) continue;

    seenUrls.add(href);
    const dateKey = date.slice(0, 10);
    const titleKey = normalized(title);
    events.push({
      externalId: `eur-national-cb-${source.key}-${dateKey}-${stableHash(titleKey)}`,
      seriesKey: source.seriesKey,
      title: `${source.country}: ${title}`,
      country: source.country,
      currency: "EUR",
      eventTime: date,
      eventKind: "speech",
      category: "Central Bank Communication",
      referencePeriod: "Official national central-bank speech",
      sourceAgency: source.sourceAgency,
      sourceUrl: href,
      sourceEventId: href,
      sourcePublishedAt: date,
      releaseStatus: "released",
      rawPayload: {
        country_code: source.countryCode,
        country: source.country,
        currency: "EUR",
        source_agency: source.sourceAgency,
        archive_url: archiveUrl,
        official_source_url: source.officialUrl,
        direct_release_url: href,
        link_refresh_policy: "The direct official publication URL is refreshed on every synchronization for the same dated release.",
        parser: "official-national-central-bank-speech-archive",
      },
    });
  }

  return events;
}

async function fetchOfficialPage(source: EuroCentralBankSource, archiveUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(archiveUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "EdgeVault-Economic-Calendar/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Official national central-bank speech archive returned HTTP ${response.status}: ${archiveUrl}`);
    }
    const html = await response.text();
    return html.slice(0, MAX_PAGE_LENGTH);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Official national central-bank speech archive timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${archiveUrl}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchEuroNationalCentralBankSpeechEvents(): Promise<{
  events: EconomicSourceEvent[];
  availableSources: string[];
  unavailableSources: string[];
}> {
  const results = await Promise.allSettled(
    EURO_CENTRAL_BANK_SOURCES.map(async (source) => {
      const archiveUrls = [source.archiveUrl, ...(source.additionalArchiveUrls || [])];
      const pageResults = await Promise.allSettled(archiveUrls.map(async (archiveUrl) => ({
        archiveUrl,
        html: await fetchOfficialPage(source, archiveUrl),
      })));
      const pages = pageResults
        .filter((result): result is PromiseFulfilledResult<{ archiveUrl: string; html: string }> => result.status === "fulfilled")
        .map((result) => result.value);
      if (pages.length === 0) {
        const firstFailure = pageResults.find((result) => result.status === "rejected");
        throw firstFailure && firstFailure.status === "rejected"
          ? firstFailure.reason
          : new Error(`No official archive page was available for ${source.sourceAgency}.`);
      }
      return {
        source,
        events: pages.flatMap((page) => parseArchive(source, page.html, page.archiveUrl)),
      };
    }),
  );
  const events: EconomicSourceEvent[] = [];
  const availableSources: string[] = [];
  const unavailableSources: string[] = [];
  results.forEach((result, index) => {
    const source = EURO_CENTRAL_BANK_SOURCES[index];
    if (result.status === "fulfilled") {
      availableSources.push(source.country);
      events.push(...result.value.events);
    } else {
      unavailableSources.push(source.country);
      console.error(`EURO NATIONAL CENTRAL BANK WARNING [${source.country}]:`, result.reason);
    }
  });
  return { events, availableSources, unavailableSources };
}
