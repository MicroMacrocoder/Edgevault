import { NextResponse } from "next/server";

// Define the expected structure for frontend consumption
export type FundamentalData = {
  currency: string; // e.g., "USD"
  indicator: string; // e.g., "NFP"
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  impact: "High" | "Medium" | "Low";
  unit: string;
  releaseDate: string; // ISO datetime
};

// Finnhub API response structure
interface FinnhubEconomicEvent {
  country: string;
  event: string;
  actual: number | null;
  forecast: number | null;
  prev: number | null;
  impact: "High" | "Medium" | "Low";
  unit: string;
  time: number; // Unix timestamp in seconds
}

interface FinnhubEconomicCalendarResponse {
  data: FinnhubEconomicEvent[];
}

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// DXY currencies
const DXY_CURRENCIES = ["US", "EU", "GB", "JP", "CA", "CH", "AU"];

export async function GET() {
  if (!FINNHUB_API_KEY) {
    return NextResponse.json(
      { error: true, message: "Finnhub API key not configured." },
      { status: 500 }
    );
  }

  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 7); // 7 days back
  const toDate = new Date(today);
  toDate.setDate(today.getDate() + 7); // 7 days ahead

  const from = fromDate.toISOString().split("T")[0];
  const to = toDate.toISOString().split("T")[0];

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 300 } } // Revalidate every 5 minutes
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Finnhub API error:", errorData);
      return NextResponse.json(
        { error: true, message: `Failed to fetch data: ${errorData?.error || response.statusText}` },
        { status: response.status }
      );
    }

    const data: FinnhubEconomicCalendarResponse = await response.json();

    const fundamentalData: FundamentalData[] = data.data
      .filter((event) => DXY_CURRENCIES.includes(event.country))
      .map((event) => {
        const releaseDate = new Date(event.time * 1000).toISOString(); // Unix to ISO
        let currencyCode = "";
        switch (event.country) {
          case "US":
            currencyCode = "USD";
            break;
          case "EU":
            currencyCode = "EUR";
            break;
          case "GB":
            currencyCode = "GBP";
            break;
          case "JP":
            currencyCode = "JPY";
            break;
          case "CA":
            currencyCode = "CAD";
            break;
          case "CH":
            currencyCode = "CHF";
            break;
          case "AU":
            currencyCode = "AUD";
            break;
          default:
            currencyCode = event.country;
        }

        return {
          currency: currencyCode,
          indicator: event.event,
          actual: event.actual,
          forecast: event.forecast,
          previous: event.prev,
          impact: event.impact,
          unit: event.unit,
          releaseDate,
        };
      });

    return NextResponse.json(fundamentalData);
  } catch (error) {
    console.error("Error in fundamental data API route:", error);
    return NextResponse.json(
      { error: true, message: "Failed to fetch fundamental data." },
      { status: 500 }
    );
  }
}
