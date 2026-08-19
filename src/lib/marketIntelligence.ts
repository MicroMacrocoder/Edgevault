export type MarketTrendDirection =
  | "rising"
  | "sideways"
  | "falling";

export type MarketCondition = {
  id: number;
  key: string;
  label: string;
  price: MarketTrendDirection;
  openInterest: MarketTrendDirection;
  volume: MarketTrendDirection;

  /**
   * Short beginner-friendly explanation shown under the technical label.
   * This explains what the condition means without replacing the trading term.
   */
  meaning: string;
};

export const MARKET_CONDITIONS: readonly MarketCondition[] = [
  {
    id: 1,
    key: "active_bullish_expansion",
    label: "Active Bullish Expansion",
    price: "rising",
    openInterest: "rising",
    volume: "rising",
    meaning:
      "Price is rising while Open Interest and trading activity are also increasing, showing expanding outstanding participation alongside an active bullish move.",
  },
  {
    id: 2,
    key: "bullish_expansion",
    label: "Bullish Expansion",
    price: "rising",
    openInterest: "rising",
    volume: "sideways",
    meaning:
      "Price is rising while Open Interest is growing, showing expanding outstanding participation during the advance even though trading activity is not increasing strongly.",
  },
  {
    id: 3,
    key: "quiet_bullish_expansion",
    label: "Quiet Bullish Expansion",
    price: "rising",
    openInterest: "rising",
    volume: "falling",
    meaning:
      "Price is rising while Open Interest is growing, showing expanding outstanding participation during the advance. Volume is falling, however, indicating weaker trading intensity behind that expansion.",
  },
  {
    id: 4,
    key: "active_bullish_continuation",
    label: "Active Bullish Continuation",
    price: "rising",
    openInterest: "sideways",
    volume: "rising",
    meaning:
      "Price is rising with stronger trading activity, but Open Interest is not expanding much, so the move is active without a large increase in outstanding positions.",
  },
  {
    id: 5,
    key: "bullish_continuation",
    label: "Bullish Continuation",
    price: "rising",
    openInterest: "sideways",
    volume: "sideways",
    meaning:
      "Price is trending higher while Open Interest and Volume remain broadly stable, showing continuation without strong new participation.",
  },
  {
    id: 6,
    key: "weak_bullish_drift",
    label: "Weak Bullish Drift",
    price: "rising",
    openInterest: "sideways",
    volume: "falling",
    meaning:
      "Price is still rising, but trading activity is fading and Open Interest is not expanding, so the bullish move is continuing with weaker support.",
  },
  {
    id: 7,
    key: "active_short_covering_rally",
    label: "Active Short-Covering Rally",
    price: "rising",
    openInterest: "falling",
    volume: "rising",
    meaning:
      "Price is rising while Open Interest falls and activity is strong, suggesting positions are being closed aggressively and short covering may be helping drive the rally.",
  },
  {
    id: 8,
    key: "short_covering_rally",
    label: "Short-Covering Rally",
    price: "rising",
    openInterest: "falling",
    volume: "sideways",
    meaning:
      "Price is rising while Open Interest falls, suggesting the rally is being helped by existing positions being closed rather than strong fresh position building.",
  },
  {
    id: 9,
    key: "weak_short_covering_rally",
    label: "Weak Short-Covering Rally",
    price: "rising",
    openInterest: "falling",
    volume: "falling",
    meaning:
      "Price is rising while both Open Interest and trading activity are falling, so the rally has little evidence of strong fresh participation.",
  },

  {
    id: 10,
    key: "active_position_buildup_compression",
    label: "Active Position Buildup / Compression",
    price: "sideways",
    openInterest: "rising",
    volume: "rising",
    meaning:
      "Price is moving sideways while Open Interest and trading activity increase, showing expanding outstanding participation inside the range even though direction is not yet clear.",
  },
  {
    id: 11,
    key: "position_buildup_compression",
    label: "Position Buildup / Compression",
    price: "sideways",
    openInterest: "rising",
    volume: "sideways",
    meaning:
      "Price is consolidating while Open Interest grows, showing expanding outstanding participation even though the market has not chosen a clear direction.",
  },
  {
    id: 12,
    key: "quiet_position_buildup",
    label: "Quiet Position Buildup",
    price: "sideways",
    openInterest: "rising",
    volume: "falling",
    meaning:
      "Price is consolidating while Open Interest grows and trading activity cools, showing outstanding participation is expanding quietly without strong directional urgency.",
  },
  {
    id: 13,
    key: "active_two_way_trade_range",
    label: "Active Two-Way Trade / Range",
    price: "sideways",
    openInterest: "sideways",
    volume: "rising",
    meaning:
      "Price is moving sideways with strong trading activity but little change in Open Interest, showing active two-way trading without a clear directional buildup.",
  },
  {
    id: 14,
    key: "balanced_range",
    label: "Balanced Range",
    price: "sideways",
    openInterest: "sideways",
    volume: "sideways",
    meaning:
      "Price, Open Interest and trading activity are all broadly stable, showing a balanced market with no strong directional pressure.",
  },
  {
    id: 15,
    key: "quiet_consolidation",
    label: "Quiet Consolidation",
    price: "sideways",
    openInterest: "sideways",
    volume: "falling",
    meaning:
      "Price is consolidating while trading activity fades and Open Interest stays stable, showing a quiet market waiting for stronger participation.",
  },
  {
    id: 16,
    key: "active_position_unwinding",
    label: "Active Position Unwinding",
    price: "sideways",
    openInterest: "falling",
    volume: "rising",
    meaning:
      "Price is staying sideways while Open Interest falls and activity is strong, showing traders are actively closing positions without producing a clear directional move.",
  },
  {
    id: 17,
    key: "position_unwinding",
    label: "Position Unwinding",
    price: "sideways",
    openInterest: "falling",
    volume: "sideways",
    meaning:
      "Price is consolidating while Open Interest declines, suggesting existing positions are being reduced and participation is leaving the market.",
  },
  {
    id: 18,
    key: "quiet_participation_decay",
    label: "Quiet Participation Decay",
    price: "sideways",
    openInterest: "falling",
    volume: "falling",
    meaning:
      "Price is moving sideways while both Open Interest and trading activity decline, showing that fewer positions remain open and market participation is fading.",
  },

  {
    id: 19,
    key: "active_bearish_expansion",
    label: "Active Bearish Expansion",
    price: "falling",
    openInterest: "rising",
    volume: "rising",
    meaning:
      "Price is falling while Open Interest and trading activity are also increasing, showing expanding outstanding participation alongside an active bearish move.",
  },
  {
    id: 20,
    key: "bearish_expansion",
    label: "Bearish Expansion",
    price: "falling",
    openInterest: "rising",
    volume: "sideways",
    meaning:
      "Price is falling while Open Interest is growing, showing expanding outstanding participation during the decline even though trading activity is not increasing strongly.",
  },
  {
    id: 21,
    key: "quiet_bearish_expansion",
    label: "Quiet Bearish Expansion",
    price: "falling",
    openInterest: "rising",
    volume: "falling",
    meaning:
      "Price is falling while Open Interest is rising, showing expanding outstanding participation during the decline. Volume is falling, however, indicating weaker trading intensity behind that expansion.",
  },
  {
    id: 22,
    key: "active_bearish_continuation",
    label: "Active Bearish Continuation",
    price: "falling",
    openInterest: "sideways",
    volume: "rising",
    meaning:
      "Price is trending lower with stronger trading activity, while Open Interest stays broadly stable, showing active selling without a large increase in outstanding positions.",
  },
  {
    id: 23,
    key: "bearish_continuation",
    label: "Bearish Continuation",
    price: "falling",
    openInterest: "sideways",
    volume: "sideways",
    meaning:
      "Price is trending lower while Open Interest and Volume remain broadly stable, showing continuation without strong evidence of fresh position building.",
  },
  {
    id: 24,
    key: "weak_bearish_drift",
    label: "Weak Bearish Drift",
    price: "falling",
    openInterest: "sideways",
    volume: "falling",
    meaning:
      "Price is still falling, but trading activity is fading and Open Interest is not expanding, so the bearish move is continuing with weaker support.",
  },
  {
    id: 25,
    key: "active_long_liquidation",
    label: "Active Long Liquidation",
    price: "falling",
    openInterest: "falling",
    volume: "rising",
    meaning:
      "Price is falling while Open Interest declines and activity is strong, suggesting positions are being closed aggressively and long liquidation may be helping drive the decline.",
  },
  {
    id: 26,
    key: "long_liquidation",
    label: "Long Liquidation",
    price: "falling",
    openInterest: "falling",
    volume: "sideways",
    meaning:
      "Price is falling while Open Interest declines, suggesting the move is being driven partly by existing positions being closed rather than strong fresh bearish position building.",
  },
  {
    id: 27,
    key: "weak_liquidation_participation_decay",
    label: "Weak Liquidation / Participation Decay",
    price: "falling",
    openInterest: "falling",
    volume: "falling",
    meaning:
      "Price is falling while Open Interest and trading activity are also declining, meaning positions are being closed and participation is fading rather than strong fresh bearish positions aggressively entering.",
  },
] as const;

export function getMarketCondition(
  price: MarketTrendDirection,
  openInterest: MarketTrendDirection,
  volume: MarketTrendDirection
): MarketCondition {
  const condition = MARKET_CONDITIONS.find(
    (item) =>
      item.price === price &&
      item.openInterest === openInterest &&
      item.volume === volume
  );

  if (!condition) {
    throw new Error(
      `No Market Intelligence condition found for Price=${price}, OI=${openInterest}, Volume=${volume}`
    );
  }

  return condition;
}

export function getMarketConditionById(
  id: number
): MarketCondition | null {
  return (
    MARKET_CONDITIONS.find(
      (item) => item.id === id
    ) ?? null
  );
}