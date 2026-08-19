import { NextResponse } from "next/server";

const CME_VOLUME_TOTAL_URL =
  "https://www.cmegroup.com/CmeWS/mvc/Volume/Total";

const NZD_PAGE_URL =
  "https://www.cmegroup.com/markets/fx/g10/new-zealand-dollar.volume.html";

type CmeVolumeRow = Record<string, unknown> & {
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

function toNumber(value: unknown) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return 0;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function uniqueNumbers(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter(
          (value) =>
            Number.isInteger(value) &&
            value > 0
        )
    )
  ).sort((a, b) => a - b);
}

function collectProductIdCandidates(
  html: string
) {
  const candidates: string[] = [];

  const patterns = [
    /\/CmeWS\/mvc\/Volume\/Total\/(\d+)/gi,
    /["']productId["']\s*[:=]\s*["']?(\d+)/gi,
    /\bproductId\s*[:=]\s*["']?(\d+)/gi,
    /\bproduct-id\s*=\s*["'](\d+)["']/gi,
    /\bproduct-id\s*:\s*["']?(\d+)/gi,
    /\bproductId%22%3A%22?(\d+)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null =
      null;

    while (
      (match = pattern.exec(html)) !==
      null
    ) {
      if (match[1]) {
        candidates.push(match[1]);
      }
    }
  }

  return uniqueNumbers(candidates);
}

function collectNzdSnippets(html: string) {
  const lower = html.toLowerCase();

  const terms = [
    "productid",
    "new zealand",
    "nzd/usd",
    "6n",
    "/volume/total/",
  ];

  const snippets: string[] = [];

  for (const term of terms) {
    let fromIndex = 0;

    while (snippets.length < 25) {
      const index = lower.indexOf(
        term,
        fromIndex
      );

      if (index === -1) {
        break;
      }

      const start = Math.max(
        0,
        index - 180
      );

      const end = Math.min(
        html.length,
        index + 320
      );

      snippets.push(
        html
          .slice(start, end)
          .replace(/\s+/g, " ")
          .trim()
      );

      fromIndex =
        index + term.length;
    }
  }

  return Array.from(
    new Set(snippets)
  ).slice(0, 25);
}

async function inspectNzdPage() {
  const response = await fetch(
    NZD_PAGE_URL,
    {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) EdgeVault/1.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }
  );

  const html = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    htmlLength: html.length,
    productIdCandidates:
      collectProductIdCandidates(html),
    snippets:
      collectNzdSnippets(html),
  };
}

async function testCandidate(
  productId: number
) {
  const url =
    CME_VOLUME_TOTAL_URL +
    "/" +
    productId +
    "?days=10";

  try {
    const response = await fetch(
      url,
      {
        cache: "no-store",
        headers: {
          "User-Agent":
            "EdgeVault/1.0",
          Accept:
            "application/json,text/plain,*/*",
        },
      }
    );

    if (!response.ok) {
      const body =
        await response
          .text()
          .catch(() => "");

      return {
        productId,
        ok: false,
        status: response.status,
        responsePreview:
          body.slice(0, 250),
        usableRowCount: 0,
        latestTradeDate: null,
        latestRows: [],
      };
    }

    const payload =
      (await response.json()) as
        CmeVolumeResponse;

    const rows =
      Array.isArray(payload.vdate)
        ? payload.vdate
        : [];

    const normalizedRows =
      rows.map((row) => ({
        tradeDate:
          typeof row.tradeDate ===
          "string"
            ? row.tradeDate
            : null,

        formattedDate:
          typeof row.formattedDate ===
          "string"
            ? row.formattedDate
            : null,

        futureVolume:
          toNumber(
            row.futureVolume
          ),

        futureOi:
          toNumber(
            row.futureOi
          ),

        optionVolume:
          toNumber(
            row.optionVolume
          ),

        optionOi:
          toNumber(
            row.optionOi
          ),

        totalVolume:
          toNumber(
            row.volume
          ),

        totalOi:
          toNumber(
            row.oi
          ),
      }));

    const usableRows =
      normalizedRows.filter(
        (row) =>
          row.formattedDate &&
          row.futureVolume > 0 &&
          row.futureOi > 0
      );

    const latestRows =
      usableRows
        .slice(-3)
        .reverse();

    return {
      productId,
      ok: true,
      status: response.status,
      rowCount: rows.length,
      usableRowCount:
        usableRows.length,
      latestTradeDate:
        latestRows[0]
          ?.formattedDate ??
        null,
      latestRows,
    };
  } catch (error) {
    return {
      productId,
      ok: false,
      status: null,
      message:
        error instanceof Error
          ? error.message
          : "Unknown CME candidate test error.",
      usableRowCount: 0,
      latestTradeDate: null,
      latestRows: [],
    };
  }
}

export async function GET() {
  try {
    const pageInspection =
      await inspectNzdPage();

    const candidates =
      pageInspection
        .productIdCandidates
        .slice(0, 20);

    const candidateTests =
      await Promise.all(
        candidates.map(
          (productId) =>
            testCandidate(
              productId
            )
        )
      );

    const usableCandidates =
      candidateTests.filter(
        (candidate) =>
          candidate.ok &&
          candidate.usableRowCount >
            0
      );

    return NextResponse.json(
      {
        error: false,
        readOnly: true,
        message:
          "NZD CME product-ID diagnostic completed. No EdgeVault data was changed.",
        pageUrl:
          NZD_PAGE_URL,
        endpoint:
          CME_VOLUME_TOTAL_URL +
          "/{productId}?days=10",
        pageInspection,
        candidateTests,
        usableCandidates,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        readOnly: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to inspect the NZD CME product page.",
      },
      { status: 500 }
    );
  }
}