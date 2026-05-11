import { NextResponse } from "next/server";

const CME_VOI_XSLT_URL =
  "https://www.cmegroup.com/CmeWS/mvc/xsltTransformer.do";

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function toNumber(value: string | undefined) {
  if (!value) return null;

  const cleanedValue = value
    .replace(/,/g, "")
    .replace(/\+/g, "")
    .replace(/−/g, "-")
    .trim();

  const parsedValue = Number(cleanedValue);

  if (Number.isNaN(parsedValue)) {
    return null;
  }

  return parsedValue;
}

function parseHtmlRows(html: string) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  return rows
    .map((rowHtml) => {
      const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];

      const cells = cellMatches
        .map((cellHtml) => stripHtml(cellHtml))
        .filter(Boolean);

      const numericCells = cells
        .map((cell) => toNumber(cell))
        .filter((value): value is number => value !== null);

      return {
        cells,
        numericCells,
        text: cells.join(" ").toUpperCase(),
      };
    })
    .filter((row) => row.cells.length > 1);
}

export async function GET() {
  try {
    const cmeDate = "20260507";

    const sourcePath =
      "/da/VOI/V2/Totals/TradeDate/" +
      cmeDate +
      "/AssetClassId/3/ReportType/F?excluded=CEE,CEU,KCB";

    const params = new URLSearchParams({
      xlstDoc: "/XSLT/md/voi/voi_asset_class_final.xsl",
      url: sourcePath,
      hidelinks: "false",
      html: "",
    });

    const response = await fetch(CME_VOI_XSLT_URL + "?" + params.toString(), {
      cache: "no-store",
      headers: {
        "User-Agent": "EdgeVault/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml",
      },
    });

    const html = await response.text();
    const rows = parseHtmlRows(html);

    const targets = [
      "EURO FX",
      "BRITISH POUND",
      "JAPANESE YEN",
      "CANADIAN DOLLAR",
      "SWISS FRANC",
      "AUSTRALIAN DOLLAR",
    ];

    const matches = targets.map((target) => {
      const targetRows = rows
        .filter((row) => row.text.includes(target))
        .slice(0, 8);

      return {
        target,
        rows: targetRows,
      };
    });

    return NextResponse.json(
      {
        error: false,
        date: cmeDate,
        matches,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to debug Volume/OI rows.",
      },
      { status: 500 }
    );
  }
}
