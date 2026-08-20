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
  riskBucket: number;         // legacy v7 alias for riskAmount; retained for safe staged upgrades
  riskPercent: number;        // % of the allocated portfolio value allowed as trade risk
  riskAmount: number;         // $ amount actually at risk for the trade
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

  // Optional direct percentage controls. These are deliberately optional so
  // existing v7 saved presets continue to load without migration failures.
  scalpAllocationPercent?: number;
  dayAllocationPercent?: number;
  swingAllocationPercent?: number;
  positionAllocationPercent?: number;
  scalpRiskPercent?: number;
  dayRiskPercent?: number;
  swingRiskPercent?: number;
  positionRiskPercent?: number;
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

export function buildPortfolioFramework(
  totalCapital: number,
  params: FrameworkParams = DEFAULT_FRAMEWORK_PARAMS,
): PortfolioSlot[] {
  // These preserve the existing v7 framework at the default settings:
  // $500 -> Scalp $60, Day $100, Swing $90, Position $50.
  const baseAllocationPercent: Record<TradingStyle, number> = {
    Scalp: 12,
    Day: 20,
    Swing: 18,
    Position: 10,
  };

  // These preserve the existing v7 dollar risk amounts at the default settings:
  // $500 -> Scalp $20, Day $50, Swing $30, Position $20.
  // In the UI the allocated portfolio value is the Risk Bucket. The legacy
  // riskBucket property is retained as a riskAmount alias for staged upgrades.
  const baseRiskPercent: Record<TradingStyle, number> = {
    Scalp: (20 / 60) * 100,
    Day: (50 / 100) * 100,
    Swing: (30 / 90) * 100,
    Position: (20 / 50) * 100,
  };

  const baseRR = {
    Scalp: { min: 1, max: 5 },
    Day: { min: 1, max: 3 },
    Swing: { min: 1, max: 10 },
    Position: { min: 1, max: 15 },
  };

  const weightByStyle: Record<TradingStyle, number> = {
    Scalp: params.scalpWeight,
    Day: params.dayWeight,
    Swing: params.swingWeight,
    Position: params.positionWeight,
  };

  const allocationOverrideByStyle: Record<TradingStyle, number | undefined> = {
    Scalp: params.scalpAllocationPercent,
    Day: params.dayAllocationPercent,
    Swing: params.swingAllocationPercent,
    Position: params.positionAllocationPercent,
  };

  const riskOverrideByStyle: Record<TradingStyle, number | undefined> = {
    Scalp: params.scalpRiskPercent,
    Day: params.dayRiskPercent,
    Swing: params.swingRiskPercent,
    Position: params.positionRiskPercent,
  };

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

  const safeCapital = Math.max(Number.isFinite(totalCapital) ? totalCapital : 0, 0);

  return styles.map(style => {
    const weight = Math.max(weightByStyle[style] || 0, 0);
    const configuredAllocationPercent =
      allocationOverrideByStyle[style] ?? baseAllocationPercent[style];

    // Weight remains the framework adjuster; the direct % field changes the
    // underlying percentage and the two stay compatible.
    const allocationPercent = Math.max(configuredAllocationPercent * weight, 0);
    const allocation = roundTo(safeCapital * (allocationPercent / 100), 2);

    const configuredRiskPercent =
      riskOverrideByStyle[style] ?? baseRiskPercent[style];
    const riskPercent = Math.max(
      configuredRiskPercent * Math.max(params.riskAppetite || 0, 0),
      0,
    );

    const riskAmount = roundTo(allocation * (riskPercent / 100), 2);

    // Keep the old property as an alias to riskAmount so replacing riskEngine.ts
    // before the workspace does not suddenly make the old UI size trades from
    // the full portfolio allocation.
    const riskBucket = riskAmount;

    const rrMin = baseRR[style].min;
    const rrMax = roundTo(
      Math.max(rrMin, baseRR[style].max * Math.max(params.rrAggression || 0, 0)),
      1,
    );

    return {
      id: style.toLowerCase(),
      name: style,
      style,
      allocation,
      allocationPercent: roundTo(allocationPercent, 1),
      riskBucket,
      riskPercent: roundTo(riskPercent, 1),
      riskAmount,
      rrMin,
      rrMax,
      rewardMin: roundTo(riskAmount * rrMin, 2),
      rewardMax: roundTo(riskAmount * rrMax, 2),
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
  riskBudget: number; // actual $ risk amount, not the full risk bucket
  entryCount: number;
  zoneWidthPips: number;
  pair: PairConfig;
  style: TradingStyle;
  mode: AutoLotMode;
  targetPips?: number;
  rrMax?: number;
  entryTF?: Timeframe;
  setupTF?: Timeframe;
  setup?: PDSetup;
}

export interface SmartAutoLotResult {
  totalLot: number;
  perEntryLot: number;
  distribution: number[];
  riskDistancePips: number;
  supportedEntries: number;
  warning: string | null;
}

const TIMEFRAME_RANK: Record<Timeframe, number> = {
  M1: 1,
  M5: 2,
  M15: 3,
  M30: 4,
  H1: 5,
  H4: 6,
  D1: 7,
  W1: 8,
  MN: 9,
};

function floorToLotStep(value: number, step = 0.01): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor((value + 1e-10) / step) * step;
}

function distributeLotUnits(
  totalUnits: number,
  entryCount: number,
  weighted: boolean,
): number[] {
  if (entryCount <= 0 || totalUnits <= 0) {
    return Array(Math.max(entryCount, 0)).fill(0);
  }

  const units = Array(entryCount).fill(0);

  // If the approved risk cannot fund the broker minimum on every entry,
  // keep the plan inside the risk limit rather than silently oversizing it.
  if (totalUnits < entryCount) {
    for (let i = 0; i < totalUnits; i++) units[i] = 1;
    return units;
  }

  // Give each planned entry the minimum lot first.
  for (let i = 0; i < entryCount; i++) units[i] = 1;
  let remaining = totalUnits - entryCount;

  if (remaining <= 0) return units;

  const weights = Array.from(
    { length: entryCount },
    (_, i) => weighted ? 1 + i * 0.3 : 1,
  );
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const exact = weights.map(weight => (weight / totalWeight) * remaining);
  const floors = exact.map(value => Math.floor(value));

  for (let i = 0; i < entryCount; i++) {
    units[i] += floors[i];
  }

  remaining -= floors.reduce((sum, value) => sum + value, 0);

  const remainderOrder = exact
    .map((value, i) => ({ i, remainder: value - floors[i] }))
    .sort((a, b) => b.remainder - a.remainder || b.i - a.i);

  for (let i = 0; i < remaining; i++) {
    units[remainderOrder[i % remainderOrder.length].i] += 1;
  }

  return units;
}

export function smartAutoLot(params: SmartAutoLotParams): SmartAutoLotResult {
  const {
    riskBudget,
    entryCount,
    zoneWidthPips,
    pair,
    style,
    mode,
    targetPips,
    rrMax,
    entryTF,
    setupTF,
  } = params;

  const count = Math.max(1, Math.floor(entryCount || 1));
  const safeRiskBudget = Math.max(Number.isFinite(riskBudget) ? riskBudget : 0, 0);

  // Longer-duration styles keep a little more breathing room by reducing
  // approved exposure. This can only reduce size; it never increases risk.
  const styleExposureFactor: Record<TradingStyle, number> = {
    Scalp: 1.0,
    Day: 0.9,
    Swing: 0.8,
    Position: 0.7,
  };

  const zoneRiskPips = Math.max(
    Number.isFinite(zoneWidthPips) ? Math.abs(zoneWidthPips) : 0,
    5,
  );

  // Target participates conservatively: if the target is far enough that even
  // the framework's maximum R:R implies a wider risk distance than the entry
  // zone, use that wider distance. A farther target can never inflate lot size.
  const safeTargetPips =
    Number.isFinite(targetPips) && (targetPips || 0) > 0
      ? Math.abs(targetPips || 0)
      : 0;
  const safeRRMax =
    Number.isFinite(rrMax) && (rrMax || 0) > 0 ? Math.max(rrMax || 1, 1) : 1;
  const targetImpliedRiskPips =
    safeTargetPips > 0 ? safeTargetPips / safeRRMax : 0;

  // A higher setup timeframe than entry timeframe normally implies a broader
  // structural plan. Give it additional room instead of increasing leverage.
  const entryRank = entryTF ? TIMEFRAME_RANK[entryTF] : 0;
  const setupRank = setupTF ? TIMEFRAME_RANK[setupTF] : entryRank;
  const timeframeGap = Math.max(setupRank - entryRank, 0);
  const structureDistanceFactor = 1 + Math.min(timeframeGap * 0.08, 0.5);

  const riskDistancePips =
    Math.max(zoneRiskPips, targetImpliedRiskPips) * structureDistanceFactor;

  const pipValue = Math.max(pair.pipValue || 0, 0);
  if (safeRiskBudget <= 0 || pipValue <= 0 || riskDistancePips <= 0) {
    return {
      totalLot: 0,
      perEntryLot: 0,
      distribution: Array(count).fill(0),
      riskDistancePips: roundTo(riskDistancePips || 0, 1),
      supportedEntries: 0,
      warning: 'No executable lot is available from the current risk settings.',
    };
  }

  const rawTotalLot =
    (safeRiskBudget * styleExposureFactor[style]) /
    (riskDistancePips * pipValue);

  // Never round exposure upward. 0.01 is treated as the broker minimum.
  const safeTotalLot = floorToLotStep(rawTotalLot, 0.01);
  const totalUnits = Math.floor((safeTotalLot + 1e-10) / 0.01);

  if (totalUnits <= 0) {
    return {
      totalLot: 0,
      perEntryLot: 0,
      distribution: Array(count).fill(0),
      riskDistancePips: roundTo(riskDistancePips, 1),
      supportedEntries: 0,
      warning:
        'Risk amount is too small for the minimum 0.01 lot at this trade distance.',
    };
  }

  if (mode === 'perEntry') {
    const perEntryLot = floorToLotStep(safeTotalLot / count, 0.01);

    if (perEntryLot < 0.01) {
      return {
        totalLot: 0,
        perEntryLot: 0,
        distribution: Array(count).fill(0),
        riskDistancePips: roundTo(riskDistancePips, 1),
        supportedEntries: Math.min(totalUnits, count),
        warning:
          `Equal sizing cannot fund ${count} entries at 0.01 lot without exceeding the approved risk. Reduce entries or use Accumulated mode.`,
      };
    }

    const distribution = Array(count).fill(perEntryLot);
    const totalLot = roundTo(perEntryLot * count, 2);

    return {
      totalLot,
      perEntryLot,
      distribution,
      riskDistancePips: roundTo(riskDistancePips, 1),
      supportedEntries: count,
      warning: null,
    };
  }

  const units = distributeLotUnits(totalUnits, count, true);
  const distribution = units.map(unit => roundTo(unit * 0.01, 2));
  const totalLot = roundTo(
    distribution.reduce((sum, value) => sum + value, 0),
    2,
  );
  const supportedEntries = distribution.filter(value => value >= 0.01).length;

  return {
    totalLot,
    perEntryLot: supportedEntries > 0
      ? roundTo(totalLot / supportedEntries, 2)
      : 0,
    distribution,
    riskDistancePips: roundTo(riskDistancePips, 1),
    supportedEntries,
    warning:
      supportedEntries < count
        ? `Approved risk supports ${supportedEntries} of ${count} planned entries at the 0.01 minimum lot. Unfunded rows remain at 0.00 instead of increasing risk.`
        : null,
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
  const {
    firstEntry,
    lastEntry,
    count,
    lotPerEntry,
    targetPrice,
    direction,
    pair,
    riskBudget,
    customEntries,
    lotDistribution,
  } = params;

  const rows: EntryPlanRow[] = [];
  let cumulativeLots = 0;
  let cumulativeCost = 0;
  const safeCount = Math.max(1, Math.floor(count || 1));

  for (let i = 0; i < safeCount; i++) {
    const price =
      customEntries && customEntries[i]
        ? customEntries[i].price
        : safeCount === 1
          ? firstEntry
          : firstEntry + ((lastEntry - firstEntry) * i) / (safeCount - 1);

    const lot =
      customEntries && customEntries[i]
        ? Math.max(customEntries[i].lot, 0)
        : lotDistribution && lotDistribution[i] !== undefined
          ? Math.max(lotDistribution[i], 0)
          : Math.max(lotPerEntry, 0);

    cumulativeLots += lot;
    cumulativeCost += price * lot;

    const avgEntry =
      cumulativeLots > 0 ? cumulativeCost / cumulativeLots : price;
    const distFromFirst = Math.abs(price - firstEntry) / pair.pipSize;

    const pipsToTP =
      direction === 'Buy'
        ? (targetPrice - avgEntry) / pair.pipSize
        : (avgEntry - targetPrice) / pair.pipSize;
    const rewardAtTP = Math.max(
      pipsToTP * cumulativeLots * pair.pipValue,
      0,
    );

    rows.push({
      number: i + 1,
      price: roundTo(price, pair.digits),
      distFromFirst: roundTo(distFromFirst, 1),
      lot: roundTo(lot, 2),
      cumulativeLots: roundTo(cumulativeLots, 2),
      avgEntry: roundTo(avgEntry, pair.digits),
      cumulativeRisk: 0,
      rewardAtTP: roundTo(rewardAtTP, 2),
    });
  }

  const finalRow = rows[rows.length - 1];
  if (!finalRow || finalRow.cumulativeLots <= 0 || riskBudget <= 0) {
    return rows;
  }

  // Use one common full-plan liquidation/risk boundary. Each row then shows
  // the actual loss of the entries filled up to that point if that boundary is
  // reached. The final row therefore resolves to the approved risk amount.
  const fullPlanLiquidation = calculateZoneLiquidation(
    finalRow.avgEntry,
    finalRow.cumulativeLots,
    riskBudget,
    direction,
    pair,
  );

  return rows.map(row => {
    if (row.cumulativeLots <= 0 || fullPlanLiquidation <= 0) {
      return { ...row, cumulativeRisk: 0 };
    }

    const riskPips =
      direction === 'Buy'
        ? Math.max((row.avgEntry - fullPlanLiquidation) / pair.pipSize, 0)
        : Math.max((fullPlanLiquidation - row.avgEntry) / pair.pipSize, 0);

    return {
      ...row,
      cumulativeRisk: roundTo(
        riskPips * row.cumulativeLots * pair.pipValue,
        2,
      ),
    };
  });
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
  if (plan.length === 0 || currentPrice <= 0) return 0;
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
  if (currentPrice <= 0 || liquidation <= 0) {
    return { percent: 100, status: 'safe' };
  }
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
// TRADING STYLE CLASSIFICATION
// ============================================================
export interface StyleClassificationParams {
  slots: PortfolioSlot[];
  currentStyle: TradingStyle;
  entryTF: Timeframe;
  setupTF: Timeframe;
  firstEntry: number;
  lastEntry: number;
  targetPrice: number;
  pair: PairConfig;
  useTarget: boolean;
}

export interface StyleClassificationResult {
  style: TradingStyle;
  score: number;
  impliedRR: number;
  targetPips: number;
  reason: string;
}

function timeframeDistance(
  timeframe: Timeframe,
  allowed: Timeframe[],
): number {
  const rank = TIMEFRAME_RANK[timeframe];
  return Math.min(
    ...allowed.map(value => Math.abs(rank - TIMEFRAME_RANK[value])),
  );
}

export function classifyTradingStyle(
  params: StyleClassificationParams,
): StyleClassificationResult {
  const {
    slots,
    currentStyle,
    entryTF,
    setupTF,
    firstEntry,
    lastEntry,
    targetPrice,
    pair,
    useTarget,
  } = params;

  const zonePips = Math.max(
    Math.abs(lastEntry - firstEntry) / pair.pipSize,
    5,
  );
  const avgReference =
    firstEntry === lastEntry ? firstEntry : (firstEntry + lastEntry) / 2;
  const targetPips =
    targetPrice > 0
      ? Math.abs(targetPrice - avgReference) / pair.pipSize
      : 0;
  const impliedRR = zonePips > 0 ? targetPips / zonePips : 0;

  const ranked = slots.map(slot => {
    let score = 0;
    const entryDistance = timeframeDistance(entryTF, slot.entryTimeframes);
    const setupDistance = timeframeDistance(setupTF, slot.setupTimeframes);

    // Timeframes are the strongest signal because they define how the trade is
    // actually being planned and executed.
    score += entryDistance === 0 ? 8 : Math.max(0, 4 - entryDistance * 2);
    score += setupDistance === 0 ? 8 : Math.max(0, 4 - setupDistance * 2);

    if (useTarget && targetPips > 0) {
      const targetCapacity =
        AUTO_TP_MAX_ZONE_PIPS[slot.style] * Math.max(slot.rrMin, 1);

      if (targetPips <= targetCapacity) {
        score += 2;
      } else {
        const overshoot = targetPips / Math.max(targetCapacity, 1);
        score -= Math.min((overshoot - 1) * 3, 8);
      }

      if (impliedRR >= slot.rrMin && impliedRR <= slot.rrMax) {
        score += 2;
      } else if (impliedRR > slot.rrMax) {
        score -= Math.min((impliedRR - slot.rrMax) * 0.5, 5);
      } else if (impliedRR > 0 && impliedRR < slot.rrMin) {
        score -= Math.min((slot.rrMin - impliedRR) * 2, 4);
      }
    }

    // Prefer stability on exact ties so the engine does not bounce between
    // overlapping style ranges.
    if (slot.style === currentStyle) score += 0.25;

    return { slot, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];

  const reasonParts = [`${entryTF} entry`, `${setupTF} setup`];
  if (useTarget && targetPips > 0) {
    reasonParts.push(
      `${roundTo(targetPips, 1)}p target`,
      `R:R 1:${roundTo(impliedRR, 1)}`,
    );
  }

  return {
    style: best?.slot.style ?? currentStyle,
    score: best?.score ?? 0,
    impliedRR: roundTo(impliedRR, 2),
    targetPips: roundTo(targetPips, 1),
    reason: reasonParts.join(' + '),
  };
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
  rrMax: number;
  pair: PairConfig;
  currentPrice?: number;
}

/**
 * Calculate auto target price from entry zone and style R:R.
 * Caps zone width per style to prevent absurd targets from stale/corrupt data.
 * Uses firstEntry as base and applies a 10% sanity check.
 */
export function calculateAutoTP(params: AutoTPParams): number {
  const { firstEntry, lastEntry, direction, style, rrMin, rrMax, pair, currentPrice } = params;

  const maxZone = AUTO_TP_MAX_ZONE_PIPS[style] || 50;

  // Calculate zone width in pips and cap it
  const zoneWidth = Math.abs(lastEntry - firstEntry);
  const rawRiskPips = zoneWidth / pair.pipSize;

  // Cap zone to prevent absurd targets from stale/wrong data
  const cappedRiskPips = Math.min(rawRiskPips, maxZone);

  // Use at least 10 pips as minimum risk distance
  const riskPips = Math.max(cappedRiskPips, 10);

  // Pick a style-sensitive R:R from the configured range without jumping
  // straight to the maximum. sqrt(rrMax) gives a conservative progression.
  const rrToUse = Math.max(
    rrMin,
    Math.min(rrMax, Math.sqrt(Math.max(rrMax, rrMin))),
  );

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