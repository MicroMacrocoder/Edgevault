import { NextResponse } from "next/server";

export type FundamentalData = {
  currency: string;
  indicator: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  impact: "High" | "Medium" | "Low";
  unit: string;
  releaseDate: string;
};

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  "US": "USD",
  "EU": "EUR",
  "EZ": "EUR",
  "EMU": "EUR",
  "GB": "GBP",
  "UK": "GBP",
  "JP": "JPY",
  "CA": "CAD",
  "CH": "CHF",
  "AU": "AUD",
};

export async function GET() {
  if (!FINNHUB_API_KEY) {
    return NextResponse.json(
      { error: true, message: "Missing FINNHUB_API_KEY" },
      { status: 500 }
    );
  }

  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 7);
  const toDate = new Date(today);
  toDate.setDate(today.getDate() + 7);

  const from = fromDate.toISOString().split("T")[0];
  const to = toDate.toISOString().split("T")[0];

  const url = "https://finnhub.io/api/v1/calendar/economic?from=" + from + "&to=" + to + "&token=" + FINNHUB_API_KEY;

  try {
    const response = await fetch(url, { next: { revalidate: 60 } } ); // Refresh every 60 seconds
    const rawJson = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: true, message: "API Error" },
        { status: response.status }
      );
    }

    const events = rawJson.economicCalendar || [];

    const fundamentalData: FundamentalData[] = events
      .filter(function (event: any) {
        return COUNTRY_TO_CURRENCY[event.country] !== undefined;
      })
      .map(function (event: any) {
        let releaseDate = "";
        if (typeof event.time === "string") {
          const parsed = Date.parse(event.time);
          releaseDate = !isNaN(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
        } else if (typeof event.time === "number") {
          releaseDate = new Date(event.time * 1000).toISOString();
        } else {
          releaseDate = new Date().toISOString();
        }

        let finalImpact: "High" | "Medium" | "Low" = "Low";
        const lowerImpact = (event.impact || "").toLowerCase();
        if (lowerImpact === "high") finalImpact = "High";
        else if (lowerImpact === "medium") finalImpact = "Medium";

        return {
          currency: COUNTRY_TO_CURRENCY[event.country],
          indicator: event.event || "Economic Release",
          actual: event.actual ?? null,
          forecast: event.estimate ?? null,
          previous: event.prev ?? null,
          impact: finalImpact,
          unit: event.unit || "",
          releaseDate: releaseDate,
        };
      })
      .sort(function (a, b) {
        return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
      });

    return NextResponse.json(fundamentalData);
  } catch (error) {
    return NextResponse.json(
      { error: true, message: "Fetch failed" },
      { status: 500 }
    );
  }
}
