export type COTReport = {
  id: string;

  symbol: string;
  currency: string;
  market_name: string;

  report_date: string;

  commercial_long: number;
  commercial_short: number;
  commercial_net: number;

  noncommercial_long: number;
  noncommercial_short: number;
  noncommercial_net: number;

  nonreportable_long: number;
  nonreportable_short: number;
  nonreportable_net: number;

  open_interest: number;

  source: string;
  created_at: string;
  updated_at: string;
};

export type COTExternalReport = {
  symbol: string;
  currency: string;
  market_name: string;

  report_date: string;

  commercial_long: number;
  commercial_short: number;
  commercial_net: number;

  noncommercial_long: number;
  noncommercial_short: number;
  noncommercial_net: number;

  nonreportable_long: number;
  nonreportable_short: number;
  nonreportable_net: number;

  open_interest: number;

  source: string;
};

export type COTSymbol = {
  label: string;
  symbol: string;
  currency: string;
  market_name: string;
  cftc_code?: string;
};

