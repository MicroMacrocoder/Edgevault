import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeRowData(rowData) {
  if (!rowData) {
    return {};
  }

  const normalizedData = { ...rowData };

  if (
    normalizedData["Volume"] === undefined &&
    normalizedData["Lot Size"] !== undefined
  ) {
    normalizedData["Volume"] = normalizedData["Lot Size"];
  }

  if (
    normalizedData["Entry Time"] === undefined &&
    normalizedData["Entry Date"] !== undefined
  ) {
    normalizedData["Entry Time"] = normalizedData["Entry Date"];
  }

  if (
    normalizedData["Exit Time"] === undefined &&
    normalizedData["Exit Date"] !== undefined
  ) {
    normalizedData["Exit Time"] = normalizedData["Exit Date"];
  }

  return normalizedData;
}

function getTradeKey(rowData) {
  const normalized = normalizeRowData(rowData);

  const identifier = String(normalized.mt5_identifier || "").trim();
  const ticket = String(normalized.mt5_ticket || "").trim();

  if (identifier) {
    return `identifier:${identifier}`;
  }

  if (ticket) {
    return `ticket:${ticket}`;
  }

  return "";
}

function preferExistingValueWhenImportedBlank(existingValue, importedValue) {
  const importedIsBlank =
    importedValue === "" ||
    importedValue === null ||
    importedValue === undefined;

  if (importedIsBlank) {
    return existingValue ?? "";
  }

  return importedValue;
}

function mergeRowDataPreservingImportantValues(existingRowData, importedRowData) {
  const existingNormalized = normalizeRowData(existingRowData);
  const importedNormalized = normalizeRowData(importedRowData);

  return {
    ...existingNormalized,
    ...importedNormalized,
    "Stop Loss": preferExistingValueWhenImportedBlank(
      existingNormalized["Stop Loss"],
      importedNormalized["Stop Loss"]
    ),
    "Take Profit": preferExistingValueWhenImportedBlank(
      existingNormalized["Take Profit"],
      importedNormalized["Take Profit"]
    ),
    "Entry Price": preferExistingValueWhenImportedBlank(
      existingNormalized["Entry Price"],
      importedNormalized["Entry Price"]
    ),
    "Entry Time": preferExistingValueWhenImportedBlank(
      existingNormalized["Entry Time"],
      importedNormalized["Entry Time"]
    ),
  };
}

function parseDateSafe(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function sortTradeRowsForDisplay(rows) {
  return [...rows].sort((a, b) => {
    const aData = normalizeRowData(a.rowData);
    const bData = normalizeRowData(b.rowData);

    const aIsOpen = String(aData.sync_status || "").toLowerCase() === "open";
    const bIsOpen = String(bData.sync_status || "").toLowerCase() === "open";

    if (aIsOpen && !bIsOpen) {
      return -1;
    }

    if (!aIsOpen && bIsOpen) {
      return 1;
    }

    const aDate =
      parseDateSafe(aData["Exit Time"]) || parseDateSafe(aData["Entry Time"]);
    const bDate =
      parseDateSafe(bData["Exit Time"]) || parseDateSafe(bData["Entry Time"]);

    const aTime = aDate ? aDate.getTime() : 0;
    const bTime = bDate ? bDate.getTime() : 0;

    return bTime - aTime;
  });
}

function renumberRows(rows) {
  return rows.map((row, index) => ({
    ...row,
    rowData: {
      ...normalizeRowData(row.rowData),
      "S/N": index + 1,
    },
  }));
}

export async function POST(request) {
  try {
    const body = await request.json();

    const connectorToken = String(body?.connectorToken || "").trim();
    const incomingRows = Array.isArray(body?.rows) ? body.rows : [];

    if (!connectorToken) {
      return NextResponse.json(
        {
          success: false,
          message: "connectorToken is required.",
        },
        { status: 400 }
      );
    }

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("mt5_connector_tokens")
      .select("user_id, trade_log_id, is_active")
      .eq("token", connectorToken)
      .maybeSingle();

    if (tokenError) {
      return NextResponse.json(
        {
          success: false,
          message: tokenError.message,
        },
        { status: 500 }
      );
    }

    if (!tokenRow || !tokenRow.is_active) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or inactive connector token.",
        },
        { status: 401 }
      );
    }

    const userId = String(tokenRow.user_id || "").trim();
    const tradeLogId = String(tokenRow.trade_log_id || "").trim();

    if (!userId || !tradeLogId) {
      return NextResponse.json(
        {
          success: false,
          message: "Connector token is missing user or trade log details.",
        },
        { status: 400 }
      );
    }

    const { data: matchedTemplate, error: templateError } = await supabaseAdmin
      .from("trade_log_templates")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", tradeLogId)
      .maybeSingle();

    if (templateError) {
      return NextResponse.json(
        {
          success: false,
          message: templateError.message,
        },
        { status: 500 }
      );
    }

    if (!matchedTemplate) {
      return NextResponse.json(
        {
          success: false,
          message: "Trade log template not found.",
        },
        { status: 404 }
      );
    }

    const { data: existingRows, error: existingRowsError } = await supabaseAdmin
      .from("trade_log_rows")
      .select("*")
      .eq("user_id", userId)
      .eq("template_id", matchedTemplate.id);

    if (existingRowsError) {
      return NextResponse.json(
        {
          success: false,
          message: existingRowsError.message,
        },
        { status: 500 }
      );
    }

    const mergedRows = (existingRows || []).map((row) => ({
      id: row.client_row_id || row.id,
      databaseRowId: row.id,
      rowData: row.row_data_json || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    let inserted = 0;
    let updated = 0;

    for (const incomingTrade of incomingRows) {
      const incomingRowData = normalizeRowData(incomingTrade);
      const incomingKey = getTradeKey(incomingRowData);

      if (!incomingKey) {
        continue;
      }

      const existingIndex = mergedRows.findIndex((row) => {
        return getTradeKey(row.rowData) === incomingKey;
      });

      if (existingIndex >= 0) {
        mergedRows[existingIndex] = {
          ...mergedRows[existingIndex],
          rowData: mergeRowDataPreservingImportantValues(
            mergedRows[existingIndex].rowData,
            incomingRowData
          ),
        };
        updated += 1;
      } else {
        mergedRows.push({
          id: `row-mt5-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          rowData: incomingRowData,
        });
        inserted += 1;
      }
    }

    const finalRows = renumberRows(sortTradeRowsForDisplay(mergedRows));

    for (const row of finalRows) {
      const payload = {
        user_id: userId,
        template_id: matchedTemplate.id,
        client_row_id: String(row.id),
        row_data_json: row.rowData || {},
        updated_at: new Date().toISOString(),
      };

      const { data: existingRow, error: rowLookupError } = await supabaseAdmin
        .from("trade_log_rows")
        .select("id")
        .eq("template_id", matchedTemplate.id)
        .eq("client_row_id", String(row.id))
        .maybeSingle();

      if (rowLookupError) {
        return NextResponse.json(
          {
            success: false,
            message: rowLookupError.message,
          },
          { status: 500 }
        );
      }

      if (existingRow) {
        const { error: updateError } = await supabaseAdmin
          .from("trade_log_rows")
          .update(payload)
          .eq("id", existingRow.id);

        if (updateError) {
          return NextResponse.json(
            {
              success: false,
              message: updateError.message,
            },
            { status: 500 }
          );
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from("trade_log_rows")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          return NextResponse.json(
            {
              success: false,
              message: insertError.message,
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `MT5 sync complete. ${inserted} inserted, ${updated} updated.`,
      inserted,
      updated,
      totalRows: finalRows.length,
    });
  } catch (error) {
    console.log("MT5 SYNC ROUTE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Unexpected MT5 sync error.",
      },
      { status: 500 }
    );
  }
}
