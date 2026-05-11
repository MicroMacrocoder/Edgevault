export type StooqDxyVolumeOiRow = {
  symbol: "DXY";
  currency: "USD";
  market_name: string;
  exchange: string;
  trade_date: string;
  volume: number;
  open_interest: number;
  source: string;
};

function cleanCell(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string): number {
  const cleaned = value
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/\+/g, "")
    .trim();

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function parseStooqDate(value: string): string | null {
  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);

  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, "0");
  const month = months[match[2]];
  const year = match[3];

  if (!month) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function formatStooqDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function getDateDaysAgo(daysAgo: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);

  return date;
}

function parseStooqDxyRows(html: string): StooqDxyVolumeOiRow[] {
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  const rows = rowMatches
    .map((rowHtml) => {
      const cellMatches =
        rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];

      return cellMatches.map(cleanCell);
    })
    .filter((cells) => cells.length >= 10)
    .map((cells) => {
      const tradeDate = parseStooqDate(cells[1]);

      if (!tradeDate) {
        return null;
      }

      return {
        symbol: "DXY" as const,
        currency: "USD" as const,
        market_name: "US DOLLAR INDEX",
        exchange: "ICE",
        trade_date: tradeDate,
        volume: parseNumber(cells[8]),
        open_interest: parseNumber(cells[9]),
        source: "Stooq DX.F Daily Futures",
      };
    })
    .filter((row): row is StooqDxyVolumeOiRow => row !== null)
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date));

  return rows;
}

export async function fetchStooqDxyVolumeOiRows(daysBack = 70) {
  const startDate = formatStooqDate(getDateDaysAgo(daysBack));
  const endDate = formatStooqDate(new Date());

  const url = `https://stooq.com/q/d/?s=dx.f&c=0&i=d&d1=${startDate}&d2=${endDate}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "text/html,text/plain,*/*",
      "User-Agent": "Mozilla/5.0 Edgevault/1.0 MarketDataFetcher",
    },
  });

  if (!response.ok) {
    throw new Error(`Stooq DXY request failed with status ${response.status}`);
  }

  const html = await response.text();
  const rows = parseStooqDxyRows(html);

  if (rows.length === 0) {
    throw new Error("No DXY Volume/OI rows were found in the Stooq response.");
  }

  return rows;
}

export async function fetchLatestCompleteStooqDxyVolumeOiRow() {
  const rows = await fetchStooqDxyVolumeOiRows();

  const latestComplete = [...rows]
    .reverse()
    .find((row) => row.volume > 0 && row.open_interest > 0);

  if (!latestComplete) {
    throw new Error("No complete DXY Volume/OI row was found.");
  }

  return latestComplete;
}
