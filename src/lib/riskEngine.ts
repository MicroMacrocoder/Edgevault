
// ============================================================
// TYPES
// ============================================================
export type TradingStyle = 'Scalp' | 'Day' | 'Swing' | 'Position';
export type TradeDirection = 'Buy' | 'Sell';
export type AutoLotMode = 'accumulated' | 'perEntry';
export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1' | 'MN';
export type PDSetup = 'FVG' | 'OB' | 'BB' | 'Breaker' | 'Mitigation' | 'Rejection' | 'Liquidity' | 'Imbalance' | 'BOS' | 'CHoCH' | 'SMS';

export interface PairConfig {
  symbol: string;
  label: string;
  pipSize: number;
  pipValue: number; // $ per pip per standard lot
  digits: number;
}

export const SUPPORTED_PAIRS: PairConfig[] = [
  { symbol: 'EURUSD', label: 'EUR/USD', pipSize: 0.0001, pipValue: 10, digits: 5 },
  { symbol: 'GBPUSD', label: 'GBP/USD', pipSize: 0.0001, pipValue: 10, digits: 5 },
  { symbol: 'AUDUSD', label: 'AUD/USD', pipSize: 0.0001, pipValue: 10, digits: 5 },
  { symbol: 'NZDUSD', label: 'NZD/USD', pipSize: 0.0001, pipValue: 10, digits: 5 },
  { symbol: 'USDJPY', label: 'USD/JPY', pipSize: 0.01, pipValue: 6.67, digits: 3 },
  { symbol: 'USDCAD', label: 'USD/CAD', pipSize: 0.0001, pipValue: 7.35, digits: 5 },
  { symbol: 'USDCHF', label: 'USD/CHF', pipSize: 0.0001, pipValue: 11.15, digits: 5 },
  { symbol: 'EURGBP', label: 'EUR/GBP', pipSize: 0.0001, pipValue: 12.50, digits: 5 },
  { symbol: 'EURJPY', label: 'EUR/JPY', pipSize: 0.01, pipValue: 6.67, digits: 3 },
  { symbol: 'GBPJPY', label: 'GBP/JPY', pipSize: 0.01, pipValue: 6.67, digits: 3 },
  { symbol: 'DXY', label: 'DXY (Index)', pipSize: 0.001, pipValue: 1, digits: 3 },
  { symbol: 'US30', label: 'US30 (DJIA)', pipSize: 1, pipValue: 1, digits: 2 },
  { symbol: 'NAS100', label: 'NAS100', pipSize: 1, pipValue: 1, digits: 2 },
  { symbol: 'SPX500', label: 'SPX500', pipSize: 0.1, pipValue: 1, digits: 2 },
  { symbol: 'XAUUSD', label: 'Gold (XAU)', pipSize: 0.01, pipValue: 1, digits: 2 },
  { symbol: 'BTCUSD', label: 'BTC/USD', pipSize: 1, pipValue: 1, digits: 2 },
  { symbol: 'ETHUSD', label: 'ETH/USD', pipSize: 0.01, pipValue: 1, digits: 2 },
];

export interface CustomEntry {
  price: number;
  lot: number;
}

// ============================================================
// PORTFOLIO FRAMEWORK — 4 styles, no direction at framework level
// ============================================================
export interface PortfolioSlot {
  id: string;
  name: string;
  style: TradingStyle;
  allocation: number;         // $ amount
  allocationPercent: number;  // % of total capital
  riskBucket: number;         // $ max risk
  riskPercent: number;        // % of allocation
  rrMin: number;
  rrMax: number;
  rewardMin: number;
  rewardMax: number;
  entryTimeframes: Timeframe[];   // TFs for entry
  setupTimeframes: Timeframe[];   // TFs for setup identification
  suggestedEntries: number;
  color: string;
}

// Framework parameters — user can adjust these to affect auto-calculation
export interface FrameworkParams {
  scalpWeight: number;    // 0.1 to 3.0 — multiplier for scalp allocation
  dayWeight: number;      // 0.1 to 3.0
  swingWeight: number;    // 0.1 to 3.0
  positionWeight: number; // 0.1 to 3.0
  riskAppetite: number;   // 0.5 to 2.0 — global risk multiplier
  rrAggression: number;   // 0.5 to 2.0 — higher = more aggressive RR targets
}

export const DEFAULT_FRAMEWORK_PARAMS: FrameworkParams = {
  scalpWeight: 1.0,
  dayWeight: 1.0,
  swingWeight: 1.0,
  positionWeight: 1.0,
  riskAppetite: 1.0,
  rrAggression: 1.0,
};

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

export function buildPortfolioFramework(totalCapital: number, params: FrameworkParams = DEFAULT_FRAMEWORK_PARAMS): PortfolioSlot[] {
  // Base allocations at $500 capital
  const baseAllocs = {
    Scalp: 60,
    Day: 100,
    Swing: 90,
    Position: 50,
  };
  const baseRisks = {
    Scalp: 20,
    Day: 50,
    Swing: 30,
    Position: 20,
  };
  const baseRR = {
    Scalp: { min: 1, max: 5 },
    Day: { min: 1, max: 3 },
    Swing: { min: 1, max: 10 },
    Position: { min: 1, max: 15 },
  };
  const weights = {
    Scalp: params.scalpWeight,
    Day: params.dayWeight,
    Swing: params.swingWeight,
    Position: params.positionWeight,
  };

  const scale = totalCapital / 500;
  const totalWeight = weights.Scalp + weights.Day + weights.Swing + weights.Position;

  const styles: TradingStyle[] = ['Scalp', 'Day', 'Swing', 'Position'];
  const colors: Record<TradingStyle, string> = {
    Scalp: '#22d3ee',
    Day: '#a78bfa',
    Swing: '#fbbf24',
    Position: '#34d399',
  };
  const entryTFs: Record<TradingStyle, Timeframe[]> = {
    Scalp: ['M1', 'M5', 'M15'],
    Day: ['M15', 'M30', 'H1'],
    Swing: ['H1', 'H4'],
    Position: ['H4', 'D1'],
  };
  const setupTFs: Record<TradingStyle, Timeframe[]> = {
    Scalp: ['M5', 'M15', 'M30'],
    Day: ['H1', 'H4', 'D1'],
    Swing: ['H4', 'D1', 'W1'],
    Position: ['D1', 'W1', 'MN'],
  };
  const entries: Record<TradingStyle, number> = {
    Scalp: 2,
    Day: 3,
    Swing: 4,
    Position: 3,
  };

  return styles.map(style => {
    const w = weights[style];
    const normalizedWeight = w / totalWeight;
    const allocation = roundTo(baseAllocs[style] * scale * w, 2);
    const risk = roundTo(baseRisks[style] * scale * params.riskAppetite * w, 2);
    const rrMin = baseRR[style].min;
    const rrMax = roundTo(baseRR[style].max * params.rrAggression, 1);

    return {
      id: style.toLowerCase(),
      name: style,
      style,
      allocation,
      allocationPercent: roundTo((allocation / totalCapital) * 100, 1),
      riskBucket: risk,
      riskPercent: roundTo((risk / allocation) * 100, 1),
      rrMin,
      rrMax,
      rewardMin: roundTo(risk * rrMin, 2),
      rewardMax: roundTo(risk * rrMax, 2),
      entryTimeframes: entryTFs[style],
      setupTimeframes: setupTFs[style],
      suggestedEntries: entries[style],
      color: colors[style],
    };
  });
}

// ============================================================
// STYLE PRESETS (for reference/display)
// ============================================================
export const STYLE_PRESETS: { style: TradingStyle; label: string; desc: string }[] = [
  { style: 'Scalp', label: 'Scalp', desc: 'M1-M15 entries, tight zones' },
  { style: 'Day', label: 'Day', desc: 'M15-H4 entries, medium zones' },
  { style: 'Swing', label: 'Swing', desc: 'H1-D1 entries, wide zones' },
  { style: 'Position', label: 'Position', desc: 'H4-MN entries, widest zones' },
];

export const ALL_TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];

export const PD_SETUPS: { value: PDSetup; label: string }[] = [
  { value: 'FVG', label: 'Fair Value Gap' },
  { value: 'OB', label: 'Order Block' },
  { value: 'BB', label: 'Breaker Block' },
  { value: 'Breaker', label: 'Breaker' },
  { value: 'Mitigation', label: 'Mitigation Block' },
  { value: 'Rejection', label: 'Rejection Block' },
  { value: 'Liquidity', label: 'Liquidity Sweep' },
  { value: 'Imbalance', label: 'Imbalance' },
  { value: 'BOS', label: 'Break of Structure' },
  { value: 'CHoCH', label: 'Change of Character' },
  { value: 'SMS', label: 'Smart Money Shift' },
];

// ============================================================
// RISK CALCULATIONS
// ============================================================
export function calculateRiskAmount(portfolioValue: number, riskPercent: number): number {
  return roundTo(portfolioValue * (riskPercent / 100), 2);
}

// Smart Auto Lot — determines lot size based on risk budget, style, zone, and mode
export interface SmartAutoLotParams {
  riskBudget: number;
  entryCount: number;
  zoneWidthPips: number;
  pair: PairConfig;
  style: TradingStyle;
  mode: AutoLotMode;
  targetPips?: number;
  entryTF?: Timeframe;
  setupTF?: Timeframe;
}

export function smartAutoLot(params: SmartAutoLotParams): { totalLot: number; perEntryLot: number; distribution: number[] } {
  const { riskBudget, entryCount, zoneWidthPips, pair, style, mode, targetPips, entryTF, setupTF } = params;

  // Style multiplier — more aggressive styles get slightly smaller lots for safety
  const styleMultiplier: Record<TradingStyle, number> = {
    Scalp: 1.0,
    Day: 0.9,
    Swing: 0.8,
    Position: 0.7,
  };

  // TF multiplier — lower TFs are noisier, reduce lot slightly
  const tfMultiplier = (tf?: Timeframe): number => {
    if (!tf) return 1.0;
    const map: Record<Timeframe, number> = { M1: 0.85, M5: 0.9, M15: 0.95, M30: 1.0, H1: 1.0, H4: 1.05, D1: 1.1, W1: 1.1, MN: 1.1 };
    return map[tf] || 1.0;
  };

  const sm = styleMultiplier[style];
  const tm = tfMultiplier(entryTF);
  const effectiveRisk = riskBudget * sm * tm;

  // The maximum total lot is determined by: if all entries fill and price moves the full zone against you
  // Loss = totalLots * zoneWidthPips * pipValue (worst case: avg entry is at zone midpoint)
  // For safety, assume worst case = full zone width from last entry
  const effectiveZone = Math.max(zoneWidthPips, 5); // minimum 5 pips zone
  const maxTotalLot = effectiveRisk / (effectiveZone * pair.pipValue);
  const safeTotalLot = roundTo(Math.max(maxTotalLot, 0.01), 2);

  if (mode === 'perEntry') {
    const perEntry = roundTo(safeTotalLot / entryCount, 2);
    const distribution = Array(entryCount).fill(perEntry);
    return { totalLot: roundTo(perEntry * entryCount, 2), perEntryLot: perEntry, distribution };
  }

  // Accumulated mode — weight later entries more heavily (they're at better prices)
  const weights: number[] = [];
  for (let i = 0; i < entryCount; i++) {
    weights.push(1 + (i * 0.3)); // each subsequent entry gets 30% more weight
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const distribution = weights.map(w => roundTo((w / totalWeight) * safeTotalLot, 2));

  // Ensure minimum 0.01 per entry
  const adjusted = distribution.map(d => Math.max(d, 0.01));
  const actualTotal = adjusted.reduce((a, b) => a + b, 0);

  return {
    totalLot: roundTo(actualTotal, 2),
    perEntryLot: roundTo(actualTotal / entryCount, 2),
    distribution: adjusted,
  };
}

// ============================================================
// ENTRY PLAN GENERATION
// ============================================================
export interface EntryPlanRow {
  number: number;
  price: number;
  distFromFirst: number; // pips from first entry
  lot: number;
  cumulativeLots: number;
  avgEntry: number;
  cumulativeRisk: number; // $ at risk if liq hits
  rewardAtTP: number;     // $ reward if TP hits
}

export interface GenerateEntriesParams {
  firstEntry: number;
  lastEntry: number;
  count: number;
  lotPerEntry: number;
  targetPrice: number;
  direction: TradeDirection;
  pair: PairConfig;
  riskBudget: number;
  customEntries?: CustomEntry[];
  lotDistribution?: number[];
}

export function generateEntries(params: GenerateEntriesParams): EntryPlanRow[] {
  const { firstEntry, lastEntry, count, lotPerEntry, targetPrice, direction, pair, riskBudget, customEntries, lotDistribution } = params;
  const rows: EntryPlanRow[] = [];
  let cumLots = 0;
  let cumCost = 0;

  for (let i = 0; i < count; i++) {
    const price = customEntries && customEntries[i]
      ? customEntries[i].price
      : count === 1 ? firstEntry : firstEntry + ((lastEntry - firstEntry) * i / (count - 1));

    const lot = customEntries && customEntries[i]
      ? customEntries[i].lot
      : lotDistribution && lotDistribution[i]
        ? lotDistribution[i]
        : lotPerEntry;

    cumLots += lot;
    cumCost += price * lot;
    const avgEntry = cumCost / cumLots;
    const distFromFirst = Math.abs(price - firstEntry) / pair.pipSize;

    // Cumulative risk: distance from avg entry to liquidation * lots * pipValue
    const cumulativeRisk = Math.min(cumLots * Math.abs(price - firstEntry) / pair.pipSize * pair.pipValue * 0.5, riskBudget);

    // Reward at TP
    const pipsToTP = direction === 'Buy'
      ? (targetPrice - avgEntry) / pair.pipSize
      : (avgEntry - targetPrice) / pair.pipSize;
    const rewardAtTP = Math.max(pipsToTP * cumLots * pair.pipValue, 0);

    rows.push({
      number: i + 1,
      price: roundTo(price, pair.digits),
      distFromFirst: roundTo(distFromFirst, 1),
      lot: roundTo(lot, 2),
      cumulativeLots: roundTo(cumLots, 2),
      avgEntry: roundTo(avgEntry, pair.digits),
      cumulativeRisk: roundTo(cumulativeRisk, 2),
      rewardAtTP: roundTo(rewardAtTP, 2),
    });
  }

  return rows;
}

// ============================================================
// LIQUIDATION
// ============================================================
export function calculateZoneLiquidation(
  avgEntry: number, totalLots: number, riskBudget: number,
  direction: TradeDirection, pair: PairConfig
): number {
  if (totalLots <= 0) return 0;
  const pipsToLiq = riskBudget / (totalLots * pair.pipValue);
  if (direction === 'Buy') {
    return roundTo(avgEntry - (pipsToLiq * pair.pipSize), pair.digits);
  } else {
    return roundTo(avgEntry + (pipsToLiq * pair.pipSize), pair.digits);
  }
}

// ============================================================
// LIVE P&L
// ============================================================
export function calculateLivePnL(
  plan: EntryPlanRow[], currentPrice: number,
  direction: TradeDirection, pair: PairConfig
): number {
  if (plan.length === 0) return 0;
  let totalPnL = 0;
  for (const entry of plan) {
    const pips = direction === 'Buy'
      ? (currentPrice - entry.price) / pair.pipSize
      : (entry.price - currentPrice) / pair.pipSize;
    totalPnL += pips * entry.lot * pair.pipValue;
  }
  return roundTo(totalPnL, 2);
}

// ============================================================
// HEALTH
// ============================================================
export function calculateHealth(
  currentPrice: number, avgEntry: number,
  liquidation: number, direction: TradeDirection
): { percent: number; status: 'safe' | 'warning' | 'danger' } {
  if (liquidation <= 0) return { percent: 100, status: 'safe' };
  const totalRange = Math.abs(avgEntry - liquidation);
  if (totalRange === 0) return { percent: 100, status: 'safe' };

  const distFromLiq = direction === 'Buy'
    ? currentPrice - liquidation
    : liquidation - currentPrice;

  const percent = Math.max(0, Math.min(100, (distFromLiq / totalRange) * 100));
  const status = percent > 60 ? 'safe' : percent > 30 ? 'warning' : 'danger';
  return { percent: roundTo(percent, 0), status };
}

// ============================================================
// AUTO TARGET PRICE CALCULATION
// ============================================================
/** Maximum reasonable zone widths per style (in pips) */
export const AUTO_TP_MAX_ZONE_PIPS: Record<TradingStyle, number> = {
  'Scalp': 30, 'Day': 80, 'Swing': 300, 'Position': 800,
};

export interface AutoTPParams {
  firstEntry: number;
  lastEntry: number;
  direction: TradeDirection;
  style: TradingStyle;
  rrMin: number;
  pair: PairConfig;
  currentPrice?: number;
}

/**
 * Calculate auto target price from entry zone and style R:R.
 * Caps zone width per style to prevent absurd targets from stale/corrupt data.
 * Uses firstEntry as base and applies a 10% sanity check.
 */
export function calculateAutoTP(params: AutoTPParams): number {
  const { firstEntry, lastEntry, direction, style, rrMin, pair, currentPrice } = params;

  const maxZone = AUTO_TP_MAX_ZONE_PIPS[style] || 50;

  // Calculate zone width in pips and cap it
  const zoneWidth = Math.abs(lastEntry - firstEntry);
  const rawRiskPips = zoneWidth / pair.pipSize;

  // Cap zone to prevent absurd targets from stale/wrong data
  const cappedRiskPips = Math.min(rawRiskPips, maxZone);

  // Use at least 10 pips as minimum risk distance
  const riskPips = Math.max(cappedRiskPips, 10);

  // Use rrMin as the default R:R for auto target
  const rrToUse = rrMin;

  // Target distance = capped risk pips * R:R
  const targetPips = riskPips * rrToUse;
  const targetDistance = targetPips * pair.pipSize;

  // Use firstEntry as base (more intuitive: target is X pips from your first entry)
  let newTarget: number;
  if (direction === 'Buy') {
    newTarget = firstEntry + targetDistance;
  } else {
    newTarget = firstEntry - targetDistance;
  }

  // Sanity check: target should be within 10% of current price
  const refPrice = currentPrice || firstEntry;
  const maxReasonableDistance = refPrice * 0.1;
  if (Math.abs(newTarget - refPrice) > maxReasonableDistance) {
    // Fallback: use sensible default with capped values
    const fallbackPips = Math.max(10, Math.min(rawRiskPips, maxZone)) * rrToUse;
    const fallbackDist = fallbackPips * pair.pipSize;
    newTarget = direction === 'Buy'
      ? firstEntry + fallbackDist
      : firstEntry - fallbackDist;
  }

  return parseFloat(newTarget.toFixed(pair.digits));
}
