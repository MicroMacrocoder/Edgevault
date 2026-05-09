// src/lib/supabase/economicEvents.ts
import { createClient } from "@supabase/supabase-js";
import type { EconomicEvent } from "@/types/economic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Sync economic events to Supabase
 */
export async function upsertEconomicEvents(events: EconomicEvent[]) {
  const rows = events.map((event) => ({
    external_id: event.id,
    title: event.indicator,
    country: null,
    currency: event.currency,
    impact: event.impact,
    event_time: event.releaseDate,
    forecast: event.forecast,
    previous: event.previous,
    actual: event.actual,
    unit: event.unit,
    source: event.source,
  }));

  const { error } = await supabaseServer
    .from("economic_events")
    .upsert(rows, {
      onConflict: "external_id",
    });

  if (error) {
    console.error("UPSERT ECONOMIC EVENTS ERROR:", error.message);
    return { error };
  }

  return { error: null };
}

/**
 * Retrieve stored events from Supabase
 */
export async function getStoredEconomicEvents() {
  const { data, error } = await supabaseServer
    .from("economic_events")
    .select("*")
    .order("event_time", { ascending: true });

  if (error) {
    console.error("GET STORED ECONOMIC EVENTS ERROR:", error.message);
    return { error, events: [] };
  }

  return { error: null, events: data || [] };
}
