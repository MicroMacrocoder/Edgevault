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

// Demo data for Economic Calendar when API key is not available
const DEMO_FUNDAMENTALS: FundamentalData[] = [
  {
    currency: "USD",
    indicator: "Non-Farm Payroll",
    actual: 206000,
    forecast: 210000,
    previous: 272000,
    impact: "High",
    unit: "K",
    releaseDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "USD",
    indicator: "Unemployment Rate",
    actual: 4.0,
    forecast: 4.1,
    previous: 4.0,
    impact: "High",
    unit: "%",
    releaseDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "EUR",
    indicator: "ECB Interest Rate Decision",
    actual: 4.25,
    forecast: 4.25,
    previous: 4.5,
    impact: "High",
    unit: "%",
    releaseDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "GBP",
    indicator: "BoE Interest Rate",
    actual: 5.25,
    forecast: 5.25,
    previous: 5.25,
    impact: "High",
    unit: "%",
    releaseDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "JPY",
    indicator: "BoJ Interest Rate Decision",
    actual: 0.25,
    forecast: 0.25,
    previous: 0.1,
    impact: "High",
    unit: "%",
    releaseDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "USD",
    indicator: "CPI (Core)",
    actual: 3.4,
    forecast: 3.3,
    previous: 3.5,
    impact: "High",
    unit: "% YoY",
    releaseDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "EUR",
    indicator: "Eurozone CPI",
    actual: 2.4,
    forecast: 2.3,
    previous: 2.6,
    impact: "High",
    unit: "% YoY",
    releaseDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "GBP",
    indicator: "UK Retail Sales",
    actual: 2.1,
    forecast: 1.8,
    previous: 1.5,
    impact: "Medium",
    unit: "% MoM",
    releaseDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "AUD",
    indicator: "RBA Interest Rate",
    actual: 4.35,
    forecast: 4.35,
    previous: 4.35,
    impact: "High",
    unit: "%",
    releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    currency: "USD",
    indicator: "ISM Manufacturing PMI",
    actual: 48.7,
    forecast: 49.2,
    previous: 48.3,
    impact: "Medium",
    unit: "pts",
    releaseDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET() {
  // Use demo data if API key is not available
  if (!FINNHUB_API_KEY) {
    return NextResponse.json(DEMO_FUNDAMENTALS);
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
    // Fall back to demo data on error
    return NextResponse.json(DEMO_FUNDAMENTALS);
  }
}
