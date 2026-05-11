export type VolumeOIReport = {
  id: string;

  symbol: string;
  currency: string;
  market_name: string;
  exchange: string;

  trade_date: string;

  volume: number;
  open_interest: number;

  source: string;
  created_at: string;
  updated_at: string;
};

export type VolumeOIExternalReport = {
  symbol: string;
  currency: string;
  market_name: string;
  exchange: string;

  trade_date: string;

  volume: number;
  open_interest: number;

  source: string;
};

export type VolumeOISymbol = {
  label: string;
  symbol: string;
  currency: string;
  market_name: string;
  exchange: string;
  cme_product_code: string;
};
