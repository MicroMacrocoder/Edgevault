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

export async function upsertEconomicEvents(events: EconomicEvent[]) {
  const rows = events.map((event) => ({
    external_id: event.id,
    title: event.name,
    country: event.region,
    currency: event.currency,
    impact: event.impactLevel,
    event_time: event.timestamp,
    forecast: event.forecastValue,
    previous: event.previousValue,
    actual: event.actualValue,
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
