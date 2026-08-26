import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isAuthorizedMt5Worker } from "@/lib/mt5Hosted";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BATCH_ITEMS = 500;

class PayloadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PayloadError";
    this.status = status;
  }
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}

function optionalText(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function requiredText(value: unknown, label: string) {
  const normalized = optionalText(value);
  if (!normalized) throw new PayloadError(`${label} is required.`);
  return normalized;
}

function mt5Identifier(value: unknown, label: string, required = false) {
  if (value === null || value === undefined || value === "") {
    if (required) throw new PayloadError(`${label} is required.`);
    return null;
  }

  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new PayloadError(
      `${label} must be sent as a string so its MT5 integer precision is preserved.`,
    );
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new PayloadError(`${label} must contain only digits.`);
  }
  return normalized;
}

function optionalNumber(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    throw new PayloadError(`${label} must be a finite number.`);
  }
  return normalized;
}

function numberOrZero(value: unknown, label: string) {
  return optionalNumber(value, label) ?? 0;
}

function optionalInteger(value: unknown, label: string) {
  const normalized = optionalNumber(value, label);
  if (normalized === null) return null;
  if (!Number.isInteger(normalized)) {
    throw new PayloadError(`${label} must be an integer.`);
  }
  return normalized;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function isoTimestamp(value: unknown, label: string, required = false) {
  if (value === null || value === undefined || value === "") {
    if (required) throw new PayloadError(`${label} is required.`);
    return null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new PayloadError(`${label} must be a valid ISO timestamp.`);
  }
  return date.toISOString();
}

function boundedArray(value: unknown, label: string) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new PayloadError(`${label} must be an array.`);
  if (value.length > MAX_BATCH_ITEMS) {
    throw new PayloadError(
      `${label} exceeds the ${MAX_BATCH_ITEMS}-item batch limit.`,
      413,
    );
  }
  return value;
}

function rawObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function normalizeDirection(value: unknown) {
  const direction = String(value ?? "").trim().toLowerCase();
  if (!direction) return null;
  if (direction !== "buy" && direction !== "sell") {
    throw new PayloadError("Position direction must be buy or sell.");
  }
  return direction;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedMt5Worker(request)) {
      return jsonNoStore({ success: false, message: "Unauthorized worker." }, 401);
    }

    const body = await request.json();
    const accountId = requiredText(body?.accountId, "accountId");
    const workerId = requiredText(body?.workerId, "workerId");
    const schemaVersion = optionalInteger(body?.schemaVersion ?? 1, "schemaVersion");

    if (schemaVersion !== 1) {
      throw new PayloadError(`Unsupported MT5 sync schema version: ${schemaVersion}.`);
    }

    const deals = boundedArray(body?.deals, "deals");
    const orders = boundedArray(body?.orders, "orders");
    const positions = boundedArray(body?.positions, "positions");
    const positionsComplete = body?.positionsComplete === true;
    const snapshot = body?.snapshot ?? null;
    const sync = body?.sync ?? null;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: account, error: accountError } = await supabaseAdmin
      .from("mt5_accounts")
      .select("id,login,server,worker_id")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account) throw new PayloadError("The MT5 account was not found.", 404);
    if (account.worker_id && account.worker_id !== workerId) {
      throw new PayloadError(
        `This MT5 account is assigned to worker ${account.worker_id}.`,
        409,
      );
    }

    const suppliedLogin = optionalText(body?.login);
    const suppliedServer = optionalText(body?.server);
    if (suppliedLogin && suppliedLogin !== String(account.login)) {
      throw new PayloadError(
        "The sync payload login does not match the saved MT5 account.",
        409,
      );
    }
    if (
      suppliedServer &&
      suppliedServer.toLowerCase() !== String(account.server).toLowerCase()
    ) {
      throw new PayloadError(
        "The sync payload server does not match the saved MT5 account.",
        409,
      );
    }

    const now = new Date().toISOString();
    let snapshotCount = 0;

    if (snapshot) {
      const capturedAtUtc = isoTimestamp(
        snapshot?.capturedAtUtc ?? now,
        "snapshot.capturedAtUtc",
        true,
      );
      const snapshotRow = {
        account_id: accountId,
        captured_at_utc: capturedAtUtc,
        mt5_server_time_msc: mt5Identifier(
          snapshot?.serverTimeMsc,
          "snapshot.serverTimeMsc",
        ),
        broker_time_text: optionalText(snapshot?.brokerTimeText),
        broker_utc_offset_minutes: optionalInteger(
          snapshot?.brokerUtcOffsetMinutes,
          "snapshot.brokerUtcOffsetMinutes",
        ),
        login: optionalText(snapshot?.login) ?? String(account.login),
        server: optionalText(snapshot?.server) ?? String(account.server),
        company: optionalText(snapshot?.company),
        account_name: optionalText(snapshot?.name),
        currency: optionalText(snapshot?.currency),
        leverage: optionalInteger(snapshot?.leverage, "snapshot.leverage"),
        trade_mode_code: optionalInteger(snapshot?.tradeModeCode, "snapshot.tradeModeCode"),
        margin_mode_code: optionalInteger(snapshot?.marginModeCode, "snapshot.marginModeCode"),
        stopout_mode_code: optionalInteger(snapshot?.stopoutModeCode, "snapshot.stopoutModeCode"),
        balance: optionalNumber(snapshot?.balance, "snapshot.balance"),
        credit: optionalNumber(snapshot?.credit, "snapshot.credit"),
        equity: optionalNumber(snapshot?.equity, "snapshot.equity"),
        account_profit: optionalNumber(snapshot?.profit, "snapshot.profit"),
        margin: optionalNumber(snapshot?.margin, "snapshot.margin"),
        free_margin: optionalNumber(snapshot?.freeMargin, "snapshot.freeMargin"),
        margin_level: optionalNumber(snapshot?.marginLevel, "snapshot.marginLevel"),
        margin_so_call: optionalNumber(snapshot?.marginSoCall, "snapshot.marginSoCall"),
        margin_so_stopout: optionalNumber(
          snapshot?.marginSoStopout,
          "snapshot.marginSoStopout",
        ),
        trade_allowed: optionalBoolean(snapshot?.tradeAllowed),
        expert_trading_allowed: optionalBoolean(snapshot?.expertTradingAllowed),
        terminal_connected: optionalBoolean(snapshot?.connected),
        positions_payload: positions,
        raw_payload: rawObject(snapshot?.rawPayload ?? snapshot),
      };

      const { error: snapshotError } = await supabaseAdmin
        .from("mt5_account_snapshots")
        .upsert(snapshotRow, { onConflict: "account_id,captured_at_utc" });
      if (snapshotError) throw snapshotError;
      snapshotCount = 1;

      const { error: accountUpdateError } = await supabaseAdmin
        .from("mt5_accounts")
        .update({
          company: snapshotRow.company,
          account_name: snapshotRow.account_name,
          currency: snapshotRow.currency,
          balance: snapshotRow.balance,
          equity: snapshotRow.equity,
          trade_allowed: snapshotRow.trade_allowed,
          status: "connected",
          status_message: "MT5 account connected and synchronizing.",
          last_error: null,
          worker_id: workerId,
          last_connected_at: now,
          updated_at: now,
        })
        .eq("id", accountId);
      if (accountUpdateError) throw accountUpdateError;
    }

    const dealRows = deals.map((deal: any, index: number) => ({
      account_id: accountId,
      deal_ticket: mt5Identifier(
        deal?.dealTicket ?? deal?.ticket,
        `deals[${index}].dealTicket`,
        true,
      ),
      order_ticket: mt5Identifier(deal?.orderTicket, `deals[${index}].orderTicket`),
      position_identifier: mt5Identifier(
        deal?.positionIdentifier,
        `deals[${index}].positionIdentifier`,
      ),
      time_msc: mt5Identifier(deal?.timeMsc, `deals[${index}].timeMsc`, true),
      executed_at_utc: isoTimestamp(
        deal?.executedAtUtc,
        `deals[${index}].executedAtUtc`,
        true,
      ),
      broker_time_text: optionalText(deal?.brokerTimeText),
      broker_utc_offset_minutes: optionalInteger(
        deal?.brokerUtcOffsetMinutes,
        `deals[${index}].brokerUtcOffsetMinutes`,
      ),
      deal_type_code: optionalInteger(deal?.dealTypeCode, `deals[${index}].dealTypeCode`),
      deal_type: optionalText(deal?.dealType),
      entry_type_code: optionalInteger(deal?.entryTypeCode, `deals[${index}].entryTypeCode`),
      entry_type: optionalText(deal?.entryType),
      reason_code: optionalInteger(deal?.reasonCode, `deals[${index}].reasonCode`),
      reason: optionalText(deal?.reason),
      magic_number: mt5Identifier(deal?.magicNumber, `deals[${index}].magicNumber`),
      symbol: optionalText(deal?.symbol),
      volume: optionalNumber(deal?.volume, `deals[${index}].volume`),
      price: optionalNumber(deal?.price, `deals[${index}].price`),
      commission: numberOrZero(deal?.commission, `deals[${index}].commission`),
      swap: numberOrZero(deal?.swap, `deals[${index}].swap`),
      profit: numberOrZero(deal?.profit, `deals[${index}].profit`),
      fee: numberOrZero(deal?.fee, `deals[${index}].fee`),
      stop_loss: optionalNumber(deal?.stopLoss, `deals[${index}].stopLoss`),
      take_profit: optionalNumber(deal?.takeProfit, `deals[${index}].takeProfit`),
      account_currency: optionalText(deal?.accountCurrency),
      comment: optionalText(deal?.comment),
      external_id: optionalText(deal?.externalId),
      raw_payload: rawObject(deal?.rawPayload ?? deal),
      received_at: now,
    }));

    if (dealRows.length) {
      const { error } = await supabaseAdmin
        .from("mt5_deals")
        .upsert(dealRows, { onConflict: "account_id,deal_ticket" });
      if (error) throw error;
    }

    const orderRows = orders.map((order: any, index: number) => ({
      account_id: accountId,
      order_ticket: mt5Identifier(
        order?.orderTicket ?? order?.ticket,
        `orders[${index}].orderTicket`,
        true,
      ),
      position_identifier: mt5Identifier(
        order?.positionIdentifier,
        `orders[${index}].positionIdentifier`,
      ),
      position_by_identifier: mt5Identifier(
        order?.positionByIdentifier,
        `orders[${index}].positionByIdentifier`,
      ),
      magic_number: mt5Identifier(order?.magicNumber, `orders[${index}].magicNumber`),
      symbol: optionalText(order?.symbol),
      order_type_code: optionalInteger(order?.orderTypeCode, `orders[${index}].orderTypeCode`),
      order_type: optionalText(order?.orderType),
      order_state_code: optionalInteger(order?.orderStateCode, `orders[${index}].orderStateCode`),
      order_state: optionalText(order?.orderState),
      order_reason_code: optionalInteger(order?.reasonCode, `orders[${index}].reasonCode`),
      order_reason: optionalText(order?.reason),
      filling_type_code: optionalInteger(order?.fillingTypeCode, `orders[${index}].fillingTypeCode`),
      time_type_code: optionalInteger(order?.timeTypeCode, `orders[${index}].timeTypeCode`),
      setup_time_msc: mt5Identifier(order?.setupTimeMsc, `orders[${index}].setupTimeMsc`),
      done_time_msc: mt5Identifier(order?.doneTimeMsc, `orders[${index}].doneTimeMsc`),
      expiration_time_msc: mt5Identifier(
        order?.expirationTimeMsc,
        `orders[${index}].expirationTimeMsc`,
      ),
      setup_at_utc: isoTimestamp(order?.setupAtUtc, `orders[${index}].setupAtUtc`),
      done_at_utc: isoTimestamp(order?.doneAtUtc, `orders[${index}].doneAtUtc`),
      expiration_at_utc: isoTimestamp(
        order?.expirationAtUtc,
        `orders[${index}].expirationAtUtc`,
      ),
      setup_broker_time_text: optionalText(order?.setupBrokerTimeText),
      done_broker_time_text: optionalText(order?.doneBrokerTimeText),
      broker_utc_offset_minutes: optionalInteger(
        order?.brokerUtcOffsetMinutes,
        `orders[${index}].brokerUtcOffsetMinutes`,
      ),
      volume_initial: optionalNumber(order?.volumeInitial, `orders[${index}].volumeInitial`),
      volume_current: optionalNumber(order?.volumeCurrent, `orders[${index}].volumeCurrent`),
      price_open: optionalNumber(order?.priceOpen, `orders[${index}].priceOpen`),
      price_current: optionalNumber(order?.priceCurrent, `orders[${index}].priceCurrent`),
      stop_limit_price: optionalNumber(order?.stopLimitPrice, `orders[${index}].stopLimitPrice`),
      stop_loss: optionalNumber(order?.stopLoss, `orders[${index}].stopLoss`),
      take_profit: optionalNumber(order?.takeProfit, `orders[${index}].takeProfit`),
      comment: optionalText(order?.comment),
      external_id: optionalText(order?.externalId),
      is_history: order?.isHistory === true,
      last_seen_at: now,
      raw_payload: rawObject(order?.rawPayload ?? order),
    }));

    if (orderRows.length) {
      const { error } = await supabaseAdmin
        .from("mt5_orders")
        .upsert(orderRows, { onConflict: "account_id,order_ticket" });
      if (error) throw error;
    }

    const positionRows = positions.map((position: any, index: number) => ({
      account_id: accountId,
      position_identifier: mt5Identifier(
        position?.positionIdentifier ?? position?.identifier,
        `positions[${index}].positionIdentifier`,
        true,
      ),
      position_ticket: mt5Identifier(
        position?.positionTicket ?? position?.ticket,
        `positions[${index}].positionTicket`,
      ),
      magic_number: mt5Identifier(position?.magicNumber, `positions[${index}].magicNumber`),
      symbol: requiredText(position?.symbol, `positions[${index}].symbol`),
      position_type_code: optionalInteger(
        position?.positionTypeCode,
        `positions[${index}].positionTypeCode`,
      ),
      direction: normalizeDirection(position?.direction ?? position?.side),
      reason_code: optionalInteger(position?.reasonCode, `positions[${index}].reasonCode`),
      reason: optionalText(position?.reason),
      opened_time_msc: mt5Identifier(
        position?.openedTimeMsc,
        `positions[${index}].openedTimeMsc`,
      ),
      updated_time_msc: mt5Identifier(
        position?.updatedTimeMsc,
        `positions[${index}].updatedTimeMsc`,
      ),
      opened_at_utc: isoTimestamp(position?.openedAtUtc, `positions[${index}].openedAtUtc`),
      position_updated_at_utc: isoTimestamp(
        position?.updatedAtUtc,
        `positions[${index}].updatedAtUtc`,
      ),
      opened_broker_time_text: optionalText(position?.openedBrokerTimeText),
      updated_broker_time_text: optionalText(position?.updatedBrokerTimeText),
      broker_utc_offset_minutes: optionalInteger(
        position?.brokerUtcOffsetMinutes,
        `positions[${index}].brokerUtcOffsetMinutes`,
      ),
      volume: optionalNumber(position?.volume, `positions[${index}].volume`),
      price_open: optionalNumber(position?.priceOpen, `positions[${index}].priceOpen`),
      price_current: optionalNumber(position?.priceCurrent, `positions[${index}].priceCurrent`),
      stop_loss: optionalNumber(position?.stopLoss, `positions[${index}].stopLoss`),
      take_profit: optionalNumber(position?.takeProfit, `positions[${index}].takeProfit`),
      swap: optionalNumber(position?.swap, `positions[${index}].swap`),
      floating_profit: optionalNumber(position?.profit, `positions[${index}].profit`),
      comment: optionalText(position?.comment),
      external_id: optionalText(position?.externalId),
      is_open: position?.isOpen !== false,
      closed_at_utc: isoTimestamp(position?.closedAtUtc, `positions[${index}].closedAtUtc`),
      last_seen_at: now,
      raw_payload: rawObject(position?.rawPayload ?? position),
    }));

    if (positionRows.length) {
      const { error } = await supabaseAdmin
        .from("mt5_positions")
        .upsert(positionRows, { onConflict: "account_id,position_identifier" });
      if (error) throw error;
    }

    let closedPositionCount = 0;
    if (positionsComplete) {
      const incomingIdentifiers = new Set(
        positionRows.map((position) => position.position_identifier),
      );
      const { data: openRows, error } = await supabaseAdmin
        .from("mt5_positions")
        .select("position_identifier")
        .eq("account_id", accountId)
        .eq("is_open", true);
      if (error) throw error;

      const closedIdentifiers = (openRows ?? [])
        .map((position) => String(position.position_identifier))
        .filter((identifier) => !incomingIdentifiers.has(identifier));

      if (closedIdentifiers.length) {
        const { error: closeError } = await supabaseAdmin
          .from("mt5_positions")
          .update({ is_open: false, closed_at_utc: now, last_seen_at: now })
          .eq("account_id", accountId)
          .in("position_identifier", closedIdentifiers);
        if (closeError) throw closeError;
        closedPositionCount = closedIdentifiers.length;
      }
    }

    if (sync || snapshot) {
      const syncRow: Record<string, unknown> = {
        account_id: accountId,
        schema_version: 1,
      };

      if (sync) {
        syncRow.initial_history_complete = sync?.initialHistoryComplete === true;
        syncRow.history_start_time_msc = mt5Identifier(
          sync?.historyStartTimeMsc,
          "sync.historyStartTimeMsc",
        );
        syncRow.last_deal_time_msc = mt5Identifier(
          sync?.lastDealTimeMsc ?? 0,
          "sync.lastDealTimeMsc",
          true,
        );
        syncRow.last_deal_ticket = mt5Identifier(
          sync?.lastDealTicket,
          "sync.lastDealTicket",
        );
        syncRow.last_order_time_msc = mt5Identifier(
          sync?.lastOrderTimeMsc ?? 0,
          "sync.lastOrderTimeMsc",
          true,
        );
        syncRow.last_successful_sync_at = now;
        syncRow.sync_status = "ready";
        syncRow.last_error = null;
      }
      if (snapshot) syncRow.last_snapshot_at = now;

      const { error } = await supabaseAdmin
        .from("mt5_sync_state")
        .upsert(syncRow, { onConflict: "account_id" });
      if (error) throw error;
    }

    return jsonNoStore({
      success: true,
      accountId,
      accepted: {
        snapshots: snapshotCount,
        deals: dealRows.length,
        orders: orderRows.length,
        positions: positionRows.length,
        positionsClosed: closedPositionCount,
      },
      message: "MT5 account data synchronized successfully.",
    });
  } catch (error: any) {
    console.error("MT5 WORKER SYNC ERROR:", error);
    return jsonNoStore(
      {
        success: false,
        message: error?.message ?? "Could not synchronize MT5 account data.",
      },
      error instanceof PayloadError ? error.status : 500,
    );
  }
}
