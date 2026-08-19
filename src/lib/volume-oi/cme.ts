import type {
  VolumeOIExternalReport,
  VolumeOISymbol,
} from "@/types/volumeOi";

const CME_VOLUME_TOTAL_URL =
  "https://www.cmegroup.com/CmeWS/mvc/Volume/Total";

export const VOLUME_OI_SYMBOLS: VolumeOISymbol[] = [
  {
    label: "Euro FX",
    symbol: "EUR",
    currency: "EUR",
    market_name: "EURO FX",
    exchange: "CME",
    cme_product_code: "EC",
  },
  {
    label: "British Pound",
    symbol: "GBP",
    currency: "GBP",
    market_name: "BRITISH POUND",
    exchange: "CME",
    cme_product_code: "BP",
  },
  {
    label: "Japanese Yen",
    symbol: "JPY",
    currency: "JPY",
    market_name: "JAPANESE YEN",
    exchange: "CME",
    cme_product_code: "JY",
  },
  {
    label: "Canadian Dollar",
    symbol: "CAD",
    currency: "CAD",
    market_name: "CANADIAN DOLLAR",
    exchange: "CME",
    cme_product_code: "CD",
  },
  {
    label: "Swiss Franc",
    symbol: "CHF",
    currency: "CHF",
    market_name: "SWISS FRANC",
    exchange: "CME",
    cme_product_code: "SF",
  },
  {
    label: "Australian Dollar",
    symbol: "AUD",
    currency: "AUD",
    market_name: "AUSTRALIAN DOLLAR",
    exchange: "CME",
    cme_product_code: "AD",
  },
  {
    label: "New Zealand Dollar",
    symbol: "NZD",
    currency: "NZD",
    market_name: "NEW ZEALAND DOLLAR",
    exchange: "CME",
    cme_product_code: "6N",
  },
];

const CME_PRODUCT_IDS: Record<string, number> = {
  EUR: 58,
  GBP: 42,
  JPY: 69,
  CAD: 48,
  CHF: 86,
  AUD: 37,
  NZD: 78,
};

type CmeVolumeRow = {
  errors?: string;
  tradeDate?: string;
  formattedDate?: string;
  volume?: string;
  futureVolume?: string;
  optionVolume?: string;
  oi?: string;
  futureOi?: string;
  optionOi?: string;
  isDataMineLink?: string;
};

type CmeVolumeResponse = {
  vdate?: CmeVolumeRow[];
};

function toNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/,/g, "")
    .replace(/\+/g, "")
    .replace(/−/g, "-")
    .trim();

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatCmeDateForSupabase(
  formattedDate: string | undefined
) {
  if (!formattedDate) {
    return null;
  }

  const value = formattedDate.trim();

  if (!/^\d{8}$/.test(value)) {
    return null;
  }

  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);

  return `${year}-${month}-${day}`;
}

function normalizeCmeRowToReport(
  row: CmeVolumeRow,
  symbolConfig: VolumeOISymbol
): VolumeOIExternalReport | null {
  const tradeDate = formatCmeDateForSupabase(
    row.formattedDate
  );

  const volume = toNumber(row.futureVolume);
  const openInterest = toNumber(row.futureOi);

  if (
    !tradeDate ||
    volume === null ||
    openInterest === null ||
    volume <= 0 ||
    openInterest <= 0
  ) {
    return null;
  }

  return {
    symbol: symbolConfig.symbol,
    currency: symbolConfig.currency,
    market_name: symbolConfig.market_name,
    exchange: symbolConfig.exchange,

    trade_date: tradeDate,

    volume,
    open_interest: openInterest,

    source: "CME FX Volume and Open Interest",
  };
}

async function fetchVolumeOIForSymbol(
  symbolConfig: VolumeOISymbol,
  daysToCollect: number
) {
  const productId =
    CME_PRODUCT_IDS[symbolConfig.symbol];

  if (!productId) {
    console.error(
      "CME VOLUME/OI PRODUCT ID MISSING:",
      symbolConfig.symbol
    );

    return [] as VolumeOIExternalReport[];
  }

  const url =
    CME_VOLUME_TOTAL_URL +
    "/" +
    productId +
    "?days=" +
    daysToCollect;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "EdgeVault/1.0",
        Accept: "application/json,text/plain,*/*",
      },
    });

    if (!response.ok) {
      console.error(
        "CME VOLUME/OI REQUEST FAILED:",
        symbolConfig.symbol,
        response.status
      );

      return [] as VolumeOIExternalReport[];
    }

    const payload =
      (await response.json()) as CmeVolumeResponse;

    const rows = Array.isArray(payload.vdate)
      ? payload.vdate
      : [];

    return rows
      .map((row) =>
        normalizeCmeRowToReport(row, symbolConfig)
      )
      .filter(
        (
          report
        ): report is VolumeOIExternalReport =>
          report !== null
      );
  } catch (error) {
    console.error(
      "CME VOLUME/OI FETCH ERROR:",
      symbolConfig.symbol,
      error
    );

    return [] as VolumeOIExternalReport[];
  }
}

export async function fetchVolumeOIReportsFromCME(
  daysToCollect = 30
) {
  const safeDaysToCollect = Math.max(
    1,
    Math.min(Math.floor(daysToCollect), 30)
  );

  const results = await Promise.all(
    VOLUME_OI_SYMBOLS.map((symbolConfig) =>
      fetchVolumeOIForSymbol(
        symbolConfig,
        safeDaysToCollect
      )
    )
  );

  return results.flat().sort((a, b) => {
    if (a.symbol === b.symbol) {
      return a.trade_date.localeCompare(
        b.trade_date
      );
    }

    return a.symbol.localeCompare(b.symbol);
  });
}