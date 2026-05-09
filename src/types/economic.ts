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
