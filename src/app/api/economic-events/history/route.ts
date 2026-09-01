import { NextResponse } from "next/server";
import { getEconomicSeriesHistory } from "@/lib/supabase/economicSeriesObservations";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seriesId = url.searchParams.get("seriesId")?.trim() || "";
    const requestedLimit = Number(url.searchParams.get("limit") || "24");

    if (!UUID_PATTERN.test(seriesId)) {
      return NextResponse.json(
        { message: "A valid economic series ID is required." },
        { status: 400 }
      );
    }

    const result = await getEconomicSeriesHistory({
      seriesId,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 24,
    });

    if (result.error) {
      const notFound = result.error.message === "Economic series not found.";
      console.error("ECONOMIC SERIES HISTORY ERROR:", result.error.message);
      return NextResponse.json(
        { message: notFound ? result.error.message : "Failed to load economic history." },
        { status: notFound ? 404 : 500 }
      );
    }

    return NextResponse.json({
      series: result.series,
      observations: result.observations,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ECONOMIC SERIES HISTORY ROUTE ERROR:", error);
    return NextResponse.json(
      { message: "Failed to load economic history." },
      { status: 500 }
    );
  }
}
