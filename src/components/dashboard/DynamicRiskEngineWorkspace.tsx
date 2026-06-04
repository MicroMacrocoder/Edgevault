"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  SUPPORTED_PAIRS, STYLE_PRESETS, ALL_TIMEFRAMES, PD_SETUPS,
  type PairConfig, type TradingStyle, type TradeDirection, type AutoLotMode, type Timeframe, type PDSetup,
  type CustomEntry, type PortfolioSlot, type FrameworkParams, DEFAULT_FRAMEWORK_PARAMS,
  calculateRiskAmount, generateEntries, calculateZoneLiquidation,
  calculateLivePnL, calculateHealth, smartAutoLot, buildPortfolioFramework,
  calculateAutoTP,
} from '@/lib/riskEngine';
import {
  Layers, Plus, X, Zap, Activity, TrendingUp, PieChart,
  Save, BookOpen, Bell, BellOff, Trash2, FolderOpen,
  CheckCircle, XCircle, Wifi, WifiOff, Target, Shield,
  Settings, Eye, EyeOff, RotateCcw, Edit3, Sliders,
  RefreshCw, Clock,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
interface Position {
  id: string;
  portfolioSlotId: string;
  pair: string;
  direction: TradeDirection;
  style: TradingStyle;
  entryTF: Timeframe;
  setupTF: Timeframe;
  setup: PDSetup;
  firstEntry: number;
  lastEntry: number;
  entryCount: number;
  lotPerEntry: number;
  useAutoLot: boolean;
  autoLotMode: AutoLotMode;
  targetPrice: number;
  currentPrice: number;
  customEntries: CustomEntry[];
}

interface Preset {
  id: string;
  name: string;
  capital: number;
  positions: Position[];
  frameworkParams: FrameworkParams;
  activeSlotIds?: string[];
  timestamp: number;
}

interface TradeRecord {
  id: string;
  pair: string;
  direction: TradeDirection;
  style: TradingStyle;
  portfolio: string;
  lots: number;
  rr: number;
  result: 'win' | 'loss' | 'breakeven' | 'open';
  pnl: number;
  notes: string;
  timestamp: number;
  entryPrice?: number;
  targetPrice?: number;
  currentPrice?: number;
}

interface AlertConfig {
  enabled: boolean;
  healthThreshold: number;
  pnlTargetPercent: number;
  pnlStopPercent: number;
}

// ============================================================
// HELPERS
// ============================================================
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createPositionForSlot(slot: PortfolioSlot): Position {
  return {
    id: genId(),
    portfolioSlotId: slot.id,
    pair: 'EURUSD',
    direction: 'Sell',
    style: slot.style,
    entryTF: slot.entryTimeframes[0],
    setupTF: slot.setupTimeframes[0],
    setup: 'FVG',
    firstEntry: 1.08500,
    lastEntry: 1.08600,
    entryCount: slot.suggestedEntries,
    lotPerEntry: 0.01,
    useAutoLot: true,
    autoLotMode: 'accumulated',
    targetPrice: 1.08000,
    currentPrice: 1.08450,
    customEntries: [],
  };
}

// LocalStorage helpers
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveToStorage(key: string, data: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// TradingView symbol mapping
function getTVSymbol(pair: string): string {
  const map: Record<string, string> = {
    'EURUSD': 'FX:EURUSD', 'GBPUSD': 'FX:GBPUSD', 'AUDUSD': 'FX:AUDUSD',
    'NZDUSD': 'FX:NZDUSD', 'USDJPY': 'FX:USDJPY', 'USDCAD': 'FX:USDCAD',
    'USDCHF': 'FX:USDCHF', 'EURGBP': 'FX:EURGBP', 'EURJPY': 'FX:EURJPY',
    'GBPJPY': 'FX:GBPJPY', 'DXY': 'TVC:DXY', 'US30': 'BLACKBULL:US30',
    'NAS100': 'PEPPERSTONE:NAS100', 'SPX500': 'FOREXCOM:SPXUSD', 'XAUUSD': 'OANDA:XAUUSD',
  };
  return map[pair] || 'FX:EURUSD';
}

// Default prices per pair
const DEFAULT_PRICES: Record<string, { entry: number; target: number; current: number }> = {
  'EURUSD': { entry: 1.08500, target: 1.08000, current: 1.08450 },
  'GBPUSD': { entry: 1.26500, target: 1.26000, current: 1.26450 },
  'AUDUSD': { entry: 0.65500, target: 0.65000, current: 0.65450 },
  'NZDUSD': { entry: 0.59500, target: 0.59000, current: 0.59450 },
  'USDJPY': { entry: 157.500, target: 158.000, current: 157.550 },
  'USDCAD': { entry: 1.37500, target: 1.38000, current: 1.37550 },
  'USDCHF': { entry: 0.89500, target: 0.89000, current: 0.89450 },
  'EURGBP': { entry: 0.85500, target: 0.85000, current: 0.85450 },
  'EURJPY': { entry: 163.500, target: 163.000, current: 163.450 },
  'GBPJPY': { entry: 198.500, target: 198.000, current: 198.450 },
  'DXY': { entry: 104.500, target: 104.000, current: 104.450 },
  'US30': { entry: 42500.00, target: 42300.00, current: 42480.00 },
  'NAS100': { entry: 18500.00, target: 18300.00, current: 18480.00 },
  'SPX500': { entry: 5400.00, target: 5380.00, current: 5395.00 },
  'XAUUSD': { entry: 2350.00, target: 2330.00, current: 2345.00 },
  'BTCUSD': { entry: 68000.00, target: 67000.00, current: 67800.00 },
  'ETHUSD': { entry: 3500.00, target: 3400.00, current: 3480.00 },
};

// ============================================================
// LIVE PRICE FEED — uses Next.js API route
// ============================================================
async function fetchLivePrice(pair: string): Promise<number | null> {
  try {
    const resp = await fetch(`/api/live-price?pair=${pair}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.price || null;
  } catch {
    return null;
  }
}

// ============================================================
// COMPONENT
// ============================================================
export default function DynamicRiskEngineWorkspace() {
  // Capital
  const [totalCapital, setTotalCapital] = useState(() => loadFromStorage('re_capital_v7', 500));

  // Framework parameters (user adjustable)
  const [frameworkParams, setFrameworkParams] = useState<FrameworkParams>(() => loadFromStorage('re_fwParams_v7', DEFAULT_FRAMEWORK_PARAMS));
  const [showAdjuster, setShowAdjuster] = useState(false);

  // Active slot IDs (which portfolios are visible/active)
  const [activeSlotIds, setActiveSlotIds] = useState<string[]>(() => loadFromStorage('re_activeSlotIds_v7', ['scalp', 'day', 'swing', 'position']));

  // Build the framework from capital + params
  const slots = useMemo(() => buildPortfolioFramework(totalCapital, frameworkParams), [totalCapital, frameworkParams]);

  // Only show active/selected slots
  const visibleSlots = slots.filter(s => activeSlotIds.includes(s.id));

  // Active portfolio slot
  const [activeSlotId, setActiveSlotId] = useState(() => loadFromStorage('re_activeSlot_v7', 'scalp'));

  // Positions per slot
  const [positions, setPositions] = useState<Position[]>(() => {
    const saved = loadFromStorage<Position[] | null>('re_positions_v7', null);
    if (saved && saved.length > 0) return saved;
    return buildPortfolioFramework(500).map(slot => createPositionForSlot(slot));
  });

  // Tabs
  const [activeTab, setActiveTab] = useState<'engine' | 'presets' | 'log' | 'alerts'>('engine');

  // Presets
  const [presets, setPresets] = useState<Preset[]>(() => loadFromStorage('riskPresets_v7', []));
  const [presetName, setPresetName] = useState('');

  // Trade Log
  const [tradeLog, setTradeLog] = useState<TradeRecord[]>(() => loadFromStorage('tradeLog_v7', []));
  const [showLogForm, setShowLogForm] = useState(false);
  const [logResult, setLogResult] = useState<'win' | 'loss' | 'breakeven' | 'open'>('win');
  const [logPnl, setLogPnl] = useState(0);
  const [logNotes, setLogNotes] = useState('');

  // Alerts
  const [alerts, setAlerts] = useState<AlertConfig>(() => loadFromStorage('riskAlerts_v7', { enabled: true, healthThreshold: 40, pnlTargetPercent: 100, pnlStopPercent: -80 }));

  // Chart
  const [showChart, setShowChart] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Live Price Feed
  const [livePriceEnabled, setLivePriceEnabled] = useState(true);
  const [livePriceStatus, setLivePriceStatus] = useState<'idle' | 'fetching' | 'connected' | 'error'>('idle');
  const [lastPriceUpdate, setLastPriceUpdate] = useState<number>(0);
  const livePriceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualPriceOverride = useRef(false);

  // Auto TP (target price auto-calculated from style R:R)
  const [autoTP, setAutoTP] = useState(true);

  // Trade Log — update open trade
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<'win' | 'loss' | 'breakeven'>('win');
  const [editPnl, setEditPnl] = useState(0);

  // ============================================================
  // AUTO-PERSIST
  // ============================================================
  useEffect(() => { saveToStorage('re_capital_v7', totalCapital); }, [totalCapital]);
  useEffect(() => { saveToStorage('re_fwParams_v7', frameworkParams); }, [frameworkParams]);
  useEffect(() => { saveToStorage('re_activeSlotIds_v7', activeSlotIds); }, [activeSlotIds]);
  useEffect(() => { saveToStorage('re_activeSlot_v7', activeSlotId); }, [activeSlotId]);
  useEffect(() => { saveToStorage('re_positions_v7', positions); }, [positions]);

  // Ensure positions exist for all slots
  useEffect(() => {
    const existingIds = positions.map(p => p.portfolioSlotId);
    const missing = slots.filter(s => !existingIds.includes(s.id));
    if (missing.length > 0) {
      setPositions(prev => [...prev, ...missing.map(s => createPositionForSlot(s))]);
    }
  }, [slots]);

  // ============================================================
  // DERIVED STATE
  // ============================================================
  const activeSlot = visibleSlots.find(s => s.id === activeSlotId) || visibleSlots[0] || slots[0];
  const activePos = positions.find(p => p.portfolioSlotId === (activeSlot?.id || '')) || positions[0];
  const activePair = SUPPORTED_PAIRS.find(p => p.symbol === (activePos?.pair || 'EURUSD')) || SUPPORTED_PAIRS[0];

  // Risk budget comes directly from the portfolio slot
  const riskBudget = activeSlot?.riskBucket || 0;

  const zoneWidthPips = activePos ? Math.abs(activePos.lastEntry - activePos.firstEntry) / activePair.pipSize : 0;
  const targetPips = activePos ? Math.abs(activePos.targetPrice - activePos.firstEntry) / activePair.pipSize : 0;

  const autoResult = useMemo(() => {
    if (!activePos || !activeSlot) return { totalLot: 0.01, perEntryLot: 0.01, distribution: [0.01] };
    return smartAutoLot({
      riskBudget,
      entryCount: activePos.entryCount,
      zoneWidthPips: zoneWidthPips > 0 ? zoneWidthPips : 30,
      pair: activePair,
      style: activeSlot.style,
      mode: activePos.autoLotMode,
      targetPips,
      entryTF: activePos.entryTF,
      setupTF: activePos.setupTF,
    });
  }, [riskBudget, activePos?.entryCount, zoneWidthPips, activePair, activeSlot?.style, activePos?.autoLotMode, targetPips, activePos?.entryTF, activePos?.setupTF]);

  const entryPlan = useMemo(() => {
    if (!activePos) return [];
    const hasCustom = activePos.customEntries.length === activePos.entryCount;
    return generateEntries({
      firstEntry: activePos.firstEntry,
      lastEntry: activePos.lastEntry,
      count: activePos.entryCount,
      lotPerEntry: activePos.useAutoLot ? autoResult.perEntryLot : activePos.lotPerEntry,
      targetPrice: activePos.targetPrice,
      direction: activePos.direction,
      pair: activePair,
      riskBudget,
      customEntries: hasCustom ? activePos.customEntries : undefined,
      lotDistribution: activePos.useAutoLot && !hasCustom ? autoResult.distribution : undefined,
    });
  }, [activePos, activePair, riskBudget, autoResult]);

  const liquidation = useMemo(() => {
    if (!activePos || entryPlan.length === 0) return 0;
    const last = entryPlan[entryPlan.length - 1];
    return calculateZoneLiquidation(last.avgEntry, last.cumulativeLots, riskBudget, activePos.direction, activePair);
  }, [entryPlan, riskBudget, activePos?.direction, activePair]);

  const livePnL = useMemo(() => {
    if (!activePos) return 0;
    return calculateLivePnL(entryPlan, activePos.currentPrice, activePos.direction, activePair);
  }, [entryPlan, activePos?.currentPrice, activePos?.direction, activePair]);

  const health = useMemo(() => {
    if (!activePos || entryPlan.length === 0) return { percent: 100, status: 'safe' as const };
    const last = entryPlan[entryPlan.length - 1];
    return calculateHealth(activePos.currentPrice, last.avgEntry, liquidation, activePos.direction);
  }, [entryPlan, activePos?.currentPrice, liquidation, activePos?.direction]);

  const reward = useMemo(() => {
    if (entryPlan.length === 0) return { dollarReward: 0, rr: 0 };
    const last = entryPlan[entryPlan.length - 1];
    const dollarReward = last.rewardAtTP;
    const rr = riskBudget > 0 ? dollarReward / riskBudget : 0;
    return { dollarReward, rr };
  }, [entryPlan, riskBudget]);

  const pipsFromCurrent = useMemo(() => {
    if (!activePos) return { toTp: 0, toLiq: 0 };
    return {
      toTp: Math.abs(activePos.currentPrice - activePos.targetPrice) / activePair.pipSize,
      toLiq: liquidation > 0 ? Math.abs(activePos.currentPrice - liquidation) / activePair.pipSize : 0,
    };
  }, [activePos?.currentPrice, activePos?.targetPrice, liquidation, activePair]);

  const healthColor = health.status === 'safe' ? 'text-green-400' : health.status === 'warning' ? 'text-yellow-400' : 'text-red-400';
  const healthBg = health.status === 'safe' ? 'bg-green-500' : health.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500';

  // Portfolio overview — ONLY active/visible slots
  const overview = useMemo(() => {
    let totalRisk = 0;
    let totalReward = 0;
    let totalAllocation = 0;
    const items: Array<{ slotName: string; pair: string; dir: TradeDirection; lots: number; risk: number; reward: number; rr: number; pnl: number; health: string; pipsToTp: number; pipsToLiq: number; color: string }> = [];

    for (const slot of visibleSlots) {
      const pos = positions.find(p => p.portfolioSlotId === slot.id);
      if (!pos) continue;
      const pc = SUPPORTED_PAIRS.find(p => p.symbol === pos.pair) || SUPPORTED_PAIRS[0];
      const posRisk = slot.riskBucket;
      const zone = Math.abs(pos.lastEntry - pos.firstEntry) / pc.pipSize;
      const ar = smartAutoLot({ riskBudget: posRisk, entryCount: pos.entryCount, zoneWidthPips: zone > 0 ? zone : 30, pair: pc, style: slot.style, mode: pos.autoLotMode, entryTF: pos.entryTF, setupTF: pos.setupTF });
      const hasCustom = pos.customEntries.length === pos.entryCount;
      const plan = generateEntries({
        firstEntry: pos.firstEntry, lastEntry: pos.lastEntry, count: pos.entryCount,
        lotPerEntry: pos.useAutoLot ? ar.perEntryLot : pos.lotPerEntry,
        targetPrice: pos.targetPrice, direction: pos.direction, pair: pc, riskBudget: posRisk,
        customEntries: hasCustom ? pos.customEntries : undefined,
        lotDistribution: pos.useAutoLot && !hasCustom ? ar.distribution : undefined,
      });
      const posPnL = calculateLivePnL(plan, pos.currentPrice, pos.direction, pc);
      const last = plan.length > 0 ? plan[plan.length - 1] : null;
      const liq = last ? calculateZoneLiquidation(last.avgEntry, last.cumulativeLots, posRisk, pos.direction, pc) : 0;
      const h = last ? calculateHealth(pos.currentPrice, last.avgEntry, liq, pos.direction) : { status: 'safe' as const };
      const rew = last ? last.rewardAtTP : 0;
      const rr = posRisk > 0 ? rew / posRisk : 0;
      const pToTp = Math.abs(pos.currentPrice - pos.targetPrice) / pc.pipSize;
      const pToLiq = liq > 0 ? Math.abs(pos.currentPrice - liq) / pc.pipSize : 0;

      totalRisk += posRisk;
      totalReward += rew;
      totalAllocation += slot.allocation;
      items.push({ slotName: slot.name, pair: pc.label, dir: pos.direction, lots: last ? last.cumulativeLots : 0, risk: posRisk, reward: rew, rr, pnl: posPnL, health: h.status, pipsToTp: pToTp, pipsToLiq: pToLiq, color: slot.color });
    }

    return { totalAllocation, totalRisk, totalReward, items };
  }, [positions, visibleSlots]);

  // Alert banners
  const alertBanners = useMemo(() => {
    if (!alerts.enabled || !activeSlot) return [];
    const banners: Array<{ type: 'health' | 'tp' | 'sl'; message: string }> = [];
    if (health.percent < alerts.healthThreshold) {
      banners.push({ type: 'health', message: activeSlot.name + ' health at ' + health.percent + '% — below ' + alerts.healthThreshold + '% threshold' });
    }
    if (riskBudget > 0) {
      const pnlPercent = (livePnL / riskBudget) * 100;
      if (pnlPercent >= alerts.pnlTargetPercent) {
        banners.push({ type: 'tp', message: activeSlot.name + ' P&L at ' + pnlPercent.toFixed(0) + '% of risk — Take Profit target reached' });
      }
      if (pnlPercent <= alerts.pnlStopPercent) {
        banners.push({ type: 'sl', message: activeSlot.name + ' P&L at ' + pnlPercent.toFixed(0) + '% of risk — Cut Loss threshold hit' });
      }
    }
    return banners;
  }, [alerts, health, livePnL, riskBudget, activeSlot]);

  // ============================================================
  // TRADINGVIEW WIDGET (visual chart only)
  // ============================================================
  useEffect(() => {
    if (!showChart || !chartContainerRef.current || !activePos) return;
    chartContainerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: getTVSymbol(activePos.pair),
      interval: activePos.entryTF === 'M1' ? '1' : activePos.entryTF === 'M5' ? '5' : activePos.entryTF === 'M15' ? '15' : activePos.entryTF === 'M30' ? '30' : activePos.entryTF === 'H1' ? '60' : activePos.entryTF === 'H4' ? '240' : activePos.entryTF === 'D1' ? 'D' : activePos.entryTF === 'W1' ? 'W' : 'M',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(6, 6, 9, 1)',
      gridColor: 'rgba(30, 30, 40, 0.3)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });
    chartContainerRef.current.appendChild(script);
  }, [showChart, activePos?.pair, activePos?.entryTF]);

  // ============================================================
  // LIVE PRICE FEED — via Next.js API route
  // ============================================================
  useEffect(() => {
    if (!livePriceEnabled || !activePos || manualPriceOverride.current) {
      if (livePriceIntervalRef.current) {
        clearInterval(livePriceIntervalRef.current);
        livePriceIntervalRef.current = null;
      }
      return;
    }

    const fetchAndUpdate = async () => {
      setLivePriceStatus('fetching');
      const price = await fetchLivePrice(activePos.pair);
      if (price !== null) {
        setLivePriceStatus('connected');
        setLastPriceUpdate(Date.now());
        setPositions(prev => prev.map(p => {
          if (p.portfolioSlotId === (activeSlot?.id || '')) {
            return { ...p, currentPrice: price };
          }
          return p;
        }));
      } else {
        setLivePriceStatus('error');
      }
    };

    fetchAndUpdate();
    livePriceIntervalRef.current = setInterval(fetchAndUpdate, 5000);

    return () => {
      if (livePriceIntervalRef.current) {
        clearInterval(livePriceIntervalRef.current);
        livePriceIntervalRef.current = null;
      }
    };
  }, [livePriceEnabled, activePos?.pair, activeSlot?.id]);

  // Reset manual override when pair changes
  useEffect(() => {
    manualPriceOverride.current = false;
  }, [activePos?.pair]);

  // ============================================================
  // AUTO TARGET PRICE FROM STYLE R:R
  // ============================================================
  useEffect(() => {
    if (!autoTP || !activePos || !activeSlot) return;
    const newTarget = calculateAutoTP({
      firstEntry: activePos.firstEntry,
      lastEntry: activePos.lastEntry,
      direction: activePos.direction,
      style: activeSlot.style,
      rrMin: activeSlot.rrMin,
      pair: activePair,
      currentPrice: activePos.currentPrice,
    });
    const diff = Math.abs(newTarget - activePos.targetPrice);
    if (diff > activePair.pipSize * 0.5) {
      setPositions(prev => prev.map(p => {
        if (p.portfolioSlotId === activeSlot.id) {
          return { ...p, targetPrice: newTarget };
        }
        return p;
      }));
    }
  }, [autoTP, activePos?.firstEntry, activePos?.lastEntry, activePos?.direction, activeSlot?.rrMin, activeSlot?.id, activeSlot?.style, activePair]);

  // ============================================================
  // AUTO-SWITCH STYLE BASED ON TF & TARGET MISMATCH
  // ============================================================
  const [styleSwitchNotice, setStyleSwitchNotice] = useState<string | null>(null);

  const entryTFStyleMap = useMemo(() => {
    const map: Record<string, TradingStyle[]> = {};
    for (const slot of slots) {
      for (const tf of slot.entryTimeframes) {
        if (!map[tf]) map[tf] = [];
        if (!map[tf].includes(slot.style)) map[tf].push(slot.style);
      }
    }
    return map;
  }, [slots]);

  const setupTFStyleMap = useMemo(() => {
    const map: Record<string, TradingStyle[]> = {};
    for (const slot of slots) {
      for (const tf of slot.setupTimeframes) {
        if (!map[tf]) map[tf] = [];
        if (!map[tf].includes(slot.style)) map[tf].push(slot.style);
      }
    }
    return map;
  }, [slots]);

  function findBestStyleForTFs(entryTF: Timeframe, setupTF: Timeframe): TradingStyle | null {
    const entryStyles = entryTFStyleMap[entryTF] || [];
    const setupStyles = setupTFStyleMap[setupTF] || [];
    const common = entryStyles.filter(s => setupStyles.includes(s));
    if (common.length > 0) return common[0];
    if (entryStyles.length > 0) return entryStyles[0];
    return null;
  }

  function findBestStyleForRR(rr: number): TradingStyle | null {
    for (const slot of slots) {
      if (rr >= slot.rrMin && rr <= slot.rrMax) return slot.style;
    }
    const sorted = [...slots].sort((a, b) => b.rrMax - a.rrMax);
    if (sorted.length > 0 && rr > sorted[0].rrMax) return sorted[0].style;
    return null;
  }

  function migrateToSlot(targetSlot: PortfolioSlot, sourcePos: Position) {
    if (!activeSlotIds.includes(targetSlot.id)) {
      setActiveSlotIds(prev => [...prev, targetSlot.id]);
    }
    setActiveSlotId(targetSlot.id);
    setPositions(prev => prev.map(p => {
      if (p.portfolioSlotId === targetSlot.id) {
        return {
          ...p,
          pair: sourcePos.pair,
          direction: sourcePos.direction,
          entryTF: sourcePos.entryTF,
          setupTF: sourcePos.setupTF,
          setup: sourcePos.setup,
          firstEntry: sourcePos.firstEntry,
          lastEntry: sourcePos.lastEntry,
          entryCount: sourcePos.entryCount,
          targetPrice: sourcePos.targetPrice,
          currentPrice: sourcePos.currentPrice,
          customEntries: sourcePos.customEntries,
        };
      }
      return p;
    }));
  }

  // Auto-switch when Entry TF or Setup TF doesn't match current style
  useEffect(() => {
    if (!activePos || !activeSlot) return;
    const currentStyle = activeSlot.style;
    const entryTF = activePos.entryTF;
    const setupTF = activePos.setupTF;
    const entryMatches = activeSlot.entryTimeframes.includes(entryTF);
    const setupMatches = activeSlot.setupTimeframes.includes(setupTF);

    if (!entryMatches || !setupMatches) {
      const bestStyle = findBestStyleForTFs(entryTF, setupTF);
      if (bestStyle && bestStyle !== currentStyle) {
        const targetSlot = slots.find(s => s.style === bestStyle);
        if (targetSlot) {
          migrateToSlot(targetSlot, activePos);
          setStyleSwitchNotice(`Auto-switched to ${bestStyle} (${entryTF}/${setupTF} matches ${bestStyle} parameters)`);
          setTimeout(() => setStyleSwitchNotice(null), 4000);
        }
      }
    }
  }, [activePos?.entryTF, activePos?.setupTF]);

  // Auto-switch when target price implies R:R outside current style's range
  useEffect(() => {
    if (autoTP || !activePos || !activeSlot) return;
    const avgEntry = activePos.entryCount === 1
      ? activePos.firstEntry
      : (activePos.firstEntry + activePos.lastEntry) / 2;
    const zoneWidth = Math.abs(activePos.lastEntry - activePos.firstEntry);
    const riskPips = Math.max(zoneWidth / activePair.pipSize, 5);
    const targetDist = Math.abs(activePos.targetPrice - avgEntry) / activePair.pipSize;
    const impliedRR = riskPips > 0 ? targetDist / riskPips : 0;

    if (impliedRR <= 0) return;

    const currentMax = activeSlot.rrMax;
    const currentMin = activeSlot.rrMin;

    if (impliedRR > currentMax || impliedRR < currentMin * 0.5) {
      const bestStyle = findBestStyleForRR(impliedRR);
      if (bestStyle && bestStyle !== activeSlot.style) {
        const targetSlot = slots.find(s => s.style === bestStyle);
        if (targetSlot) {
          migrateToSlot(targetSlot, activePos);
          setStyleSwitchNotice(`Auto-switched to ${bestStyle} (R:R 1:${impliedRR.toFixed(1)} fits ${bestStyle} range 1:${targetSlot.rrMin}-1:${targetSlot.rrMax})`);
          setTimeout(() => setStyleSwitchNotice(null), 4000);
        }
      }
    }
  }, [autoTP, activePos?.targetPrice, activePos?.firstEntry, activePos?.lastEntry, activeSlot?.rrMax, activeSlot?.rrMin]);

  // ============================================================
  // ACTIONS
  // ============================================================
  function updatePos(updates: Partial<Position>) {
    if (!activeSlot) return;
    setPositions(prev => prev.map(p => p.portfolioSlotId === activeSlot.id ? { ...p, ...updates } : p));
  }

  function handlePairChange(newPair: string) {
    const pairConfig = SUPPORTED_PAIRS.find(p => p.symbol === newPair);
    if (!pairConfig || !activeSlot || !activePos) return;
    const defaults = DEFAULT_PRICES[newPair] || { entry: 1.0, target: 0.99, current: 1.0 };
    const zoneOffset = pairConfig.pipSize * (activeSlot.style === 'Scalp' ? 10 : activeSlot.style === 'Day' ? 30 : 80);
    const targetDir = activePos.direction === 'Sell' ? defaults.target : defaults.entry + (defaults.entry - defaults.target);
    updatePos({
      pair: newPair,
      firstEntry: defaults.entry,
      lastEntry: defaults.entry + (activePos.direction === 'Sell' ? zoneOffset : -zoneOffset),
      targetPrice: targetDir,
      currentPrice: defaults.current,
      customEntries: [],
    });
  }

  function updateEntryField(index: number, field: 'price' | 'lot', value: number) {
    if (!activePos) return;
    const current = activePos.customEntries.length === activePos.entryCount
      ? [...activePos.customEntries]
      : entryPlan.map(e => ({ price: e.price, lot: e.lot }));
    current[index] = { ...current[index], [field]: value };
    updatePos({ customEntries: current, useAutoLot: false });
  }

  function toggleSlotActive(slotId: string) {
    setActiveSlotIds(prev => {
      if (prev.includes(slotId)) {
        const updated = prev.filter(id => id !== slotId);
        if (slotId === activeSlotId && updated.length > 0) {
          setActiveSlotId(updated[0]);
        }
        return updated;
      } else {
        return [...prev, slotId];
      }
    });
  }

  function resetPosition() {
    if (!activeSlot) return;
    const newPos = createPositionForSlot(activeSlot);
    newPos.portfolioSlotId = activeSlot.id;
    setPositions(prev => prev.map(p => p.portfolioSlotId === activeSlot.id ? newPos : p));
  }

  function updateParam(key: keyof FrameworkParams, value: number) {
    setFrameworkParams(prev => ({ ...prev, [key]: value }));
  }

  // Presets
  function savePreset() {
    const name = presetName.trim() || ('Preset ' + (presets.length + 1));
    const p: Preset = { id: genId(), name, capital: totalCapital, positions, frameworkParams, activeSlotIds, timestamp: Date.now() };
    const updated = [p, ...presets];
    setPresets(updated);
    saveToStorage('riskPresets_v7', updated);
    setPresetName('');
  }
  function quickSavePreset() {
    if (!activeSlot || !activePos) return;
    const name = activeSlot.name + ' ' + (SUPPORTED_PAIRS.find(p => p.symbol === activePos.pair)?.label || '') + ' - ' + new Date().toLocaleTimeString();
    const p: Preset = { id: genId(), name, capital: totalCapital, positions, frameworkParams, activeSlotIds, timestamp: Date.now() };
    const updated = [p, ...presets];
    setPresets(updated);
    saveToStorage('riskPresets_v7', updated);
  }
  function loadPreset(p: Preset) {
    setTotalCapital(p.capital);
    setPositions(p.positions);
    if (p.frameworkParams) setFrameworkParams(p.frameworkParams);
    if (p.activeSlotIds) setActiveSlotIds(p.activeSlotIds);
    setActiveTab('engine');
  }
  function deletePreset(id: string) {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    saveToStorage('riskPresets_v7', updated);
  }

  // Trade log
  function saveTradeRecord() {
    if (!activeSlot || !activePos) return;
    const last = entryPlan.length > 0 ? entryPlan[entryPlan.length - 1] : null;
    const record: TradeRecord = {
      id: genId(), pair: activePair.label, direction: activePos.direction, style: activeSlot.style,
      portfolio: activeSlot.name, lots: last ? last.cumulativeLots : 0, rr: reward.rr,
      result: logResult, pnl: logResult === 'open' ? 0 : logPnl, notes: logNotes, timestamp: Date.now(),
      entryPrice: last ? last.avgEntry : activePos.firstEntry,
      targetPrice: activePos.targetPrice,
      currentPrice: activePos.currentPrice,
    };
    const updated = [record, ...tradeLog];
    setTradeLog(updated);
    saveToStorage('tradeLog_v7', updated);
    setShowLogForm(false);
    setLogPnl(0);
    setLogNotes('');
    setLogResult('win');
  }
  function updateTradeRecord(id: string, result: 'win' | 'loss' | 'breakeven', pnl: number) {
    const updated = tradeLog.map(t => t.id === id ? { ...t, result, pnl } : t);
    setTradeLog(updated);
    saveToStorage('tradeLog_v7', updated);
    setEditingTradeId(null);
    setEditPnl(0);
    setEditResult('win');
  }
  function deleteTradeRecord(id: string) {
    const updated = tradeLog.filter(t => t.id !== id);
    setTradeLog(updated);
    saveToStorage('tradeLog_v7', updated);
  }

  const logStats = useMemo(() => {
    const closedTrades = tradeLog.filter(t => t.result !== 'open');
    const openTrades = tradeLog.filter(t => t.result === 'open');
    const wins = closedTrades.filter(t => t.result === 'win').length;
    const losses = closedTrades.filter(t => t.result === 'loss').length;
    const closedTotal = closedTrades.length;
    const winRate = closedTotal > 0 ? (wins / closedTotal) * 100 : 0;
    const totalPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);
    const avgRR = closedTotal > 0 ? closedTrades.reduce((s, t) => s + t.rr, 0) / closedTotal : 0;
    return { wins, losses, total: tradeLog.length, closedTotal, openCount: openTrades.length, winRate, totalPnl, avgRR };
  }, [tradeLog]);

  function saveAlertsToStorage(a: AlertConfig) { saveToStorage('riskAlerts_v7', a); }

  // ============================================================
  // RENDER
  // ============================================================
  if (!activeSlot || !activePos) {
    return (
      <div className="text-white font-mono flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-gray-500">No active portfolio. Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white font-mono space-y-4">

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-gray-800/30">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">DYNAMIC RISK ENGINE</h1>
          <p className="text-[10px] text-gray-600 mt-0.5">
            4-Style Framework | {visibleSlots.length} active | Auto-persist enabled
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={quickSavePreset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border bg-green-950/20 border-green-700/30 text-green-400 hover:bg-green-900/30 transition-all">
            <Save size={10} /> Quick Save
          </button>
          <button onClick={() => setShowChart(!showChart)} className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all " + (showChart ? "bg-cyan-950/30 border-cyan-600/40 text-cyan-400" : "bg-[#0d0d14] border-gray-800/30 text-gray-600 hover:text-gray-300")}>
            {showChart ? <Wifi size={10} /> : <WifiOff size={10} />} {showChart ? "Chart ON" : "Chart OFF"}
          </button>
          {(['engine', 'presets', 'log', 'alerts'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={"px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all " + (activeTab === tab ? "bg-cyan-950/30 border-cyan-600/40 text-cyan-400" : "bg-[#0d0d14] border-gray-800/30 text-gray-600 hover:text-gray-300")}>
              {tab === 'engine' ? 'Engine' : tab === 'presets' ? 'Presets' : tab === 'log' ? 'Trade Log' : 'Alerts'}
            </button>
          ))}
        </div>
      </header>

      {/* ALERT BANNERS */}
      {alertBanners.length > 0 && (
        <div className="space-y-2">
          {alertBanners.map((b, i) => (
            <div key={i} className={"rounded-lg p-3 text-[11px] font-bold flex items-center gap-2 animate-pulse " + (b.type === 'health' ? "bg-yellow-950/30 border border-yellow-700/40 text-yellow-400" : b.type === 'tp' ? "bg-green-950/30 border border-green-700/40 text-green-400" : "bg-red-950/30 border border-red-700/40 text-red-400")}>
              <Bell size={12} /> {b.message}
            </div>
          ))}
        </div>
      )}

      {/* STYLE SWITCH NOTICE */}
      {styleSwitchNotice && (
        <div className="rounded-lg p-3 text-[11px] font-bold flex items-center gap-2 bg-purple-950/30 border border-purple-700/40 text-purple-400 animate-pulse">
          <RefreshCw size={12} /> {styleSwitchNotice}
        </div>
      )}

      {/* LIVE CHART */}
      {showChart && (
        <section className="bg-[#080810] border border-gray-800/40 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/30">
            <div className="flex items-center gap-2">
              <Wifi size={10} className="text-green-400 animate-pulse" />
              <span className="text-[10px] text-white font-bold uppercase">{activePair.label} Live Chart</span>
              <span className="text-[9px] text-gray-600">{activePos.entryTF}</span>
            </div>
            <button onClick={() => setShowChart(false)} className="text-gray-600 hover:text-white"><X size={14} /></button>
          </div>
          <div ref={chartContainerRef} className="h-[400px] w-full" />
        </section>
      )}

      {/* ENGINE TAB */}
      {activeTab === 'engine' && (
        <>
          {/* FRAMEWORK SECTION */}
          <section className="bg-[#080810] border border-gray-800/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-2">
                <Shield size={12} /> Portfolio Framework
              </h2>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowAdjuster(!showAdjuster)} className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all " + (showAdjuster ? "bg-purple-950/30 border-purple-600/40 text-purple-400" : "bg-[#0d0d14] border-gray-800/30 text-gray-600 hover:text-gray-300")}>
                  <Sliders size={10} /> Adjust
                </button>
                <div className="flex items-center gap-2">
                  <label className="text-[9px] text-gray-600 uppercase">Capital:</label>
                  <input type="number" value={totalCapital} onChange={(e) => setTotalCapital(Number(e.target.value))} className="w-24 bg-[#0d0d14] border border-gray-700/40 rounded-lg px-2 py-1.5 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none" />
                </div>
              </div>
            </div>

            {/* PARAMETER ADJUSTER PANEL */}
            {showAdjuster && (
              <div className="mb-4 bg-[#0a0a12] border border-purple-800/30 rounded-xl p-4 space-y-3">
                <h3 className="text-[9px] text-purple-400 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Settings size={10} /> Framework Parameters
                </h3>
                <p className="text-[9px] text-gray-600">Adjust these weights to change how capital is distributed. Higher weight = more allocation to that style.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {([
                    { key: 'scalpWeight' as const, label: 'Scalp Weight', color: '#22d3ee' },
                    { key: 'dayWeight' as const, label: 'Day Weight', color: '#a78bfa' },
                    { key: 'swingWeight' as const, label: 'Swing Weight', color: '#fbbf24' },
                    { key: 'positionWeight' as const, label: 'Position Weight', color: '#34d399' },
                    { key: 'riskAppetite' as const, label: 'Risk Appetite', color: '#f87171' },
                    { key: 'rrAggression' as const, label: 'R:R Aggression', color: '#fb923c' },
                  ]).map(({ key, label, color }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[9px] uppercase" style={{ color }}>{label}</label>
                        <span className="text-[10px] text-white font-bold">{frameworkParams[key].toFixed(1)}x</span>
                      </div>
                      <input
                        type="range" min={0.1} max={3.0} step={0.1}
                        value={frameworkParams[key]}
                        onChange={(e) => updateParam(key, Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ accentColor: color }}
                      />
                    </div>
                  ))}
                </div>
                <button onClick={() => setFrameworkParams(DEFAULT_FRAMEWORK_PARAMS)} className="text-[9px] text-gray-600 hover:text-white border border-gray-800/30 rounded-lg px-3 py-1.5 transition-all">
                  Reset to Defaults
                </button>
              </div>
            )}

            {/* Style Selector */}
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <span className="text-[9px] text-gray-600 uppercase">Active:</span>
              {slots.map(slot => {
                const isActive = activeSlotIds.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    onClick={() => toggleSlotActive(slot.id)}
                    className={"flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all " + (isActive ? "border-opacity-50 bg-opacity-20" : "border-gray-800/30 text-gray-700 opacity-50")}
                    style={isActive ? { borderColor: slot.color, backgroundColor: slot.color + '15', color: slot.color } : {}}
                  >
                    {isActive ? <Eye size={9} /> : <EyeOff size={9} />}
                    {slot.name}
                  </button>
                );
              })}
            </div>

            {/* Visible Portfolio Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {visibleSlots.map(slot => {
                const isActive = slot.id === activeSlotId;
                const pos = positions.find(p => p.portfolioSlotId === slot.id);
                const pc = pos ? SUPPORTED_PAIRS.find(p => p.symbol === pos.pair) : null;
                const posLabel = pc ? pc.label : '-';
                return (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlotId(slot.id)}
                    className={"w-full rounded-xl p-3 border transition-all text-left " + (isActive ? "border-opacity-60 bg-opacity-20" : "border-gray-800/30 bg-[#0d0d14] hover:border-gray-700/50")}
                    style={isActive ? { borderColor: slot.color, backgroundColor: slot.color + '15' } : {}}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slot.color }} />
                      <span className="text-[9px] font-bold text-white uppercase">{slot.name}</span>
                    </div>
                    <div className="text-[8px] text-gray-500 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Alloc:</span>
                        <span className="text-white font-bold">{"$" + slot.allocation.toFixed(0) + " (" + slot.allocationPercent + "%)"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk:</span>
                        <span className="text-red-400 font-bold">{"$" + slot.riskBucket.toFixed(0) + " (" + slot.riskPercent + "%)"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>R:R:</span>
                        <span className="text-green-400 font-bold">{"1:" + slot.rrMin + " - 1:" + slot.rrMax}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reward:</span>
                        <span className="text-yellow-400 font-bold">{"$" + slot.rewardMin + "-$" + slot.rewardMax}</span>
                      </div>
                      {pos && <div className="text-cyan-400 font-bold pt-0.5">{posLabel} {pos.direction === 'Buy' ? 'Long' : 'Short'}</div>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Capital breakdown bar */}
            <div className="mt-3 flex gap-0.5 h-2 rounded-full overflow-hidden">
              {visibleSlots.map(slot => (
                <div key={slot.id} className="transition-all" style={{ flex: slot.allocation, backgroundColor: slot.color + '80' }} />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-gray-700">{"$" + overview.totalAllocation.toFixed(0) + " allocated (" + (overview.totalAllocation / totalCapital * 100).toFixed(0) + "%)"}</span>
              <span className="text-[8px] text-gray-700">{"$" + overview.totalRisk.toFixed(0) + " total risk"}</span>
            </div>
          </section>

          {/* ACTIVE POSITION CONFIG */}
          <section className="bg-[#080810] border border-gray-800/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeSlot.color }} />
                <h2 className="text-[10px] text-white font-bold uppercase tracking-widest">{activeSlot.name}</h2>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#0d0d14] border border-gray-800/30 text-gray-500">
                  {"Risk: $" + riskBudget.toFixed(0) + " (" + activeSlot.riskPercent + "%) | R:R 1:" + activeSlot.rrMin + "-1:" + activeSlot.rrMax}
                </span>
              </div>
              <button onClick={resetPosition} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold border border-gray-800/30 text-gray-600 hover:text-yellow-400 hover:border-yellow-700/30 transition-all">
                <RotateCcw size={9} /> Reset
              </button>
            </div>

            {/* Position config row */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-4">
              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">Pair</label>
                <select value={activePos.pair} onChange={(e) => handlePairChange(e.target.value)} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none">
                  {SUPPORTED_PAIRS.map(p => <option key={p.symbol} value={p.symbol}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">Direction</label>
                <select value={activePos.direction} onChange={(e) => updatePos({ direction: e.target.value as TradeDirection })} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none">
                  <option value="Buy">Buy (Long)</option>
                  <option value="Sell">Sell (Short)</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">Entry TF</label>
                <select value={activePos.entryTF} onChange={(e) => updatePos({ entryTF: e.target.value as Timeframe })} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none">
                  {ALL_TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">Setup TF</label>
                <select value={activePos.setupTF} onChange={(e) => updatePos({ setupTF: e.target.value as Timeframe })} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none">
                  {ALL_TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">Setup (PD)</label>
                <select value={activePos.setup} onChange={(e) => updatePos({ setup: e.target.value as PDSetup })} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none">
                  {PD_SETUPS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] text-gray-600 uppercase">Target (TP)</label>
                  <button onClick={() => setAutoTP(!autoTP)} className={"text-[8px] font-bold px-1.5 py-0.5 rounded border transition-all " + (autoTP ? "bg-green-950/30 border-green-700/40 text-green-400" : "bg-[#0d0d14] border-gray-800/30 text-gray-600")}>
                    {autoTP ? "Auto" : "Manual"}
                  </button>
                </div>
                <input type="number" step={activePair.pipSize} value={activePos.targetPrice} onChange={(e) => { setAutoTP(false); updatePos({ targetPrice: Number(e.target.value) }); }} className={"w-full bg-[#0d0d14] border rounded-lg p-2 text-sm font-bold focus:outline-none " + (autoTP ? "border-green-700/40 text-green-400 focus:border-green-500" : "border-gray-700/40 text-white focus:border-cyan-600")} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] text-gray-600 uppercase">Current Price</label>
                  <div className="flex items-center gap-1">
                    {livePriceEnabled && (
                      <span className={"w-1.5 h-1.5 rounded-full " + (livePriceStatus === 'connected' ? "bg-green-400 animate-pulse" : livePriceStatus === 'fetching' ? "bg-yellow-400 animate-pulse" : livePriceStatus === 'error' ? "bg-red-400" : "bg-gray-600")} />
                    )}
                    <button onClick={() => { setLivePriceEnabled(!livePriceEnabled); if (livePriceEnabled) manualPriceOverride.current = false; }} className={"text-[8px] font-bold px-1.5 py-0.5 rounded border transition-all " + (livePriceEnabled ? "bg-green-950/30 border-green-700/40 text-green-400" : "bg-[#0d0d14] border-gray-800/30 text-gray-600")}>
                      {livePriceEnabled ? "Live" : "Manual"}
                    </button>
                  </div>
                </div>
                <input
                  type="number" step={activePair.pipSize} value={activePos.currentPrice}
                  onChange={(e) => { manualPriceOverride.current = true; updatePos({ currentPrice: Number(e.target.value) }); }}
                  onFocus={() => { manualPriceOverride.current = true; }}
                  className={"w-full bg-[#0d0d14] border rounded-lg p-2 text-sm font-bold focus:outline-none " + (livePriceEnabled && !manualPriceOverride.current ? "border-green-700/40 text-green-400 focus:border-green-500" : "border-yellow-700/40 text-yellow-400 focus:border-yellow-500")}
                />
                {livePriceEnabled && lastPriceUpdate > 0 && (
                  <span className="text-[7px] text-gray-700 mt-0.5 block" title="Yahoo Finance mid-price. May differ 1-3 pips from broker bid/ask.">
                    {"Updated " + Math.round((Date.now() - lastPriceUpdate) / 1000) + "s ago · Mid"}
                  </span>
                )}
              </div>
            </div>

            {/* ENTRY ZONE */}
            <div className="space-y-3">
              <h3 className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-2">
                <Zap size={11} className="text-yellow-400" /> Entry Zone
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-[9px] text-gray-600 uppercase block mb-1">First Entry</label>
                  <input type="number" step={activePair.pipSize} value={activePos.firstEntry} onChange={(e) => updatePos({ firstEntry: Number(e.target.value), customEntries: [] })} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[9px] text-gray-600 uppercase block mb-1">Last Entry</label>
                  <input type="number" step={activePair.pipSize} value={activePos.lastEntry} onChange={(e) => updatePos({ lastEntry: Number(e.target.value), customEntries: [] })} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[9px] text-gray-600 uppercase block mb-1">Entries</label>
                  <input type="number" min={1} max={10} value={activePos.entryCount} onChange={(e) => updatePos({ entryCount: Math.max(1, Number(e.target.value)), customEntries: [] })} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-cyan-600 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[9px] text-gray-600 uppercase block mb-1">{"Lot " + (activePos.useAutoLot ? "(Auto)" : "(Manual)")}</label>
                  <input type="number" step={0.01} value={activePos.useAutoLot ? autoResult.totalLot : activePos.lotPerEntry} onChange={(e) => updatePos({ useAutoLot: false, lotPerEntry: Number(e.target.value), customEntries: [] })} className={"w-full bg-[#0d0d14] border rounded-lg p-2 text-sm font-bold focus:outline-none " + (activePos.useAutoLot ? "border-cyan-700/40 text-cyan-400" : "border-gray-700/40 text-white")} />
                </div>
                <div>
                  <label className="text-[9px] text-gray-600 uppercase block mb-1">Auto Lot</label>
                  <div className="flex gap-1">
                    <button onClick={() => updatePos({ useAutoLot: !activePos.useAutoLot, customEntries: [] })} className={"flex-1 rounded-lg p-2 text-[9px] font-bold border transition-all " + (activePos.useAutoLot ? "bg-cyan-950/30 border-cyan-600/40 text-cyan-400" : "bg-[#0d0d14] border-gray-700/40 text-gray-600")}>
                      {activePos.useAutoLot ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto Lot Mode */}
              {activePos.useAutoLot && (
                <div className="flex items-center gap-3 bg-[#0a0a0f] rounded-lg p-2 border border-gray-800/20">
                  <span className="text-[9px] text-gray-600 uppercase">Mode:</span>
                  <button onClick={() => updatePos({ autoLotMode: 'accumulated', customEntries: [] })} className={"px-3 py-1 rounded text-[9px] font-bold border transition-all " + (activePos.autoLotMode === 'accumulated' ? "bg-cyan-950/30 border-cyan-600/40 text-cyan-400" : "border-gray-800/30 text-gray-600")}>
                    Accumulated
                  </button>
                  <button onClick={() => updatePos({ autoLotMode: 'perEntry', customEntries: [] })} className={"px-3 py-1 rounded text-[9px] font-bold border transition-all " + (activePos.autoLotMode === 'perEntry' ? "bg-cyan-950/30 border-cyan-600/40 text-cyan-400" : "border-gray-800/30 text-gray-600")}>
                    Per Entry
                  </button>
                  <span className="text-[8px] text-gray-700 ml-2">
                    {activePos.autoLotMode === 'accumulated' ? "Total lot distributed by weight" : "Equal lot per entry"}
                  </span>
                </div>
              )}

              {/* Summary cards */}
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
                  <span className="text-[8px] text-gray-600 block">Zone</span>
                  <span className="text-xs font-bold text-white">{zoneWidthPips.toFixed(0) + "p"}</span>
                </div>
                <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
                  <span className="text-[8px] text-gray-600 block">Lots</span>
                  <span className="text-xs font-bold text-cyan-400">{(entryPlan.length > 0 ? entryPlan[entryPlan.length - 1].cumulativeLots : 0).toFixed(2)}</span>
                </div>
                <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
                  <span className="text-[8px] text-gray-600 block">Avg</span>
                  <span className="text-xs font-bold text-white">{entryPlan.length > 0 ? entryPlan[entryPlan.length - 1].avgEntry.toFixed(activePair.digits) : "-"}</span>
                </div>
                <div className="bg-red-950/20 rounded-lg p-2 text-center border border-red-900/20">
                  <span className="text-[8px] text-red-400 block">Liq.</span>
                  <span className="text-xs font-bold text-red-500">{liquidation > 0 ? liquidation.toFixed(activePair.digits) : "-"}</span>
                </div>
                <div className="bg-green-950/20 rounded-lg p-2 text-center border border-green-900/20">
                  <span className="text-[8px] text-green-400 block">Reward</span>
                  <span className="text-xs font-bold text-green-400">{"$" + reward.dollarReward.toFixed(2)}</span>
                </div>
                <div className={"rounded-lg p-2 text-center border " + (reward.rr >= 2 ? "bg-green-950/20 border-green-900/20" : reward.rr >= 1 ? "bg-yellow-950/20 border-yellow-900/20" : "bg-red-950/20 border-red-900/20")}>
                  <span className="text-[8px] text-gray-500 block">R:R</span>
                  <span className={"text-xs font-bold " + (reward.rr >= 2 ? "text-green-400" : reward.rr >= 1 ? "text-yellow-400" : "text-red-400")}>{"1:" + reward.rr.toFixed(1)}</span>
                </div>
                <div className="bg-green-950/20 rounded-lg p-2 text-center border border-green-900/20">
                  <span className="text-[8px] text-green-400 block">To TP</span>
                  <span className="text-xs font-bold text-green-400">{pipsFromCurrent.toTp.toFixed(0) + "p"}</span>
                </div>
                <div className="bg-red-950/20 rounded-lg p-2 text-center border border-red-900/20">
                  <span className="text-[8px] text-red-400 block">To Liq</span>
                  <span className="text-xs font-bold text-red-500">{pipsFromCurrent.toLiq.toFixed(0) + "p"}</span>
                </div>
              </div>

              {/* EDITABLE Entry Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-800/30">
                <table className="w-full text-[11px] text-left">
                  <thead className="text-[9px] text-gray-600 uppercase bg-[#0d0d14]">
                    <tr>
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Price</th>
                      <th className="px-2 py-2">Dist</th>
                      <th className="px-2 py-2 text-cyan-400">Lot</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2">Avg</th>
                      <th className="px-2 py-2 text-red-400">Risk</th>
                      <th className="px-2 py-2 text-green-400">Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryPlan.map((e, i) => (
                      <tr key={i} className="border-t border-gray-800/20 hover:bg-[#0d0d14]/50">
                        <td className="px-2 py-2 font-bold text-white">{e.number}</td>
                        <td className="px-2 py-1">
                          <input type="number" step={activePair.pipSize} value={e.price} onChange={(ev) => updateEntryField(i, 'price', Number(ev.target.value))} className="w-24 bg-transparent border border-gray-800/40 rounded px-1.5 py-1 text-white text-[11px] font-bold focus:border-cyan-600 focus:outline-none hover:border-gray-600" />
                        </td>
                        <td className="px-2 py-2 text-gray-500">{e.distFromFirst.toFixed(0) + "p"}</td>
                        <td className="px-2 py-1">
                          <input type="number" step={0.01} min={0.01} value={e.lot} onChange={(ev) => updateEntryField(i, 'lot', Number(ev.target.value))} className="w-16 bg-transparent border border-cyan-800/40 rounded px-1.5 py-1 text-cyan-400 text-[11px] font-bold focus:border-cyan-500 focus:outline-none hover:border-cyan-600" />
                        </td>
                        <td className="px-2 py-2">{e.cumulativeLots.toFixed(2)}</td>
                        <td className="px-2 py-2">{e.avgEntry.toFixed(activePair.digits)}</td>
                        <td className="px-2 py-2 text-red-400">{"$" + e.cumulativeRisk.toFixed(2)}</td>
                        <td className="px-2 py-2 text-green-400 font-bold">{"$" + e.rewardAtTP.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PRICE MAP */}
            <div className="mt-4">
              <h3 className="text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                <Activity size={11} className="text-cyan-400" /> Price Map
              </h3>
              <div className="bg-[#0a0a12] rounded-xl p-4 border border-gray-800/20 relative overflow-hidden">
                {(() => {
                  const prices = entryPlan.map(e => e.price);
                  const allPrices = [...prices, activePos.targetPrice, liquidation, activePos.currentPrice].filter(p => p > 0);
                  const minP = Math.min(...allPrices);
                  const maxP = Math.max(...allPrices);
                  const range = maxP - minP || 1;
                  const getPos = (price: number) => ((price - minP) / range) * 100;

                  return (
                    <div className="relative h-32">
                      <div className="absolute h-0.5 w-full bg-green-500/40" style={{ bottom: getPos(activePos.targetPrice) + '%' }}>
                        <span className="absolute -top-4 left-0 text-[8px] text-green-400 font-bold">TP {activePos.targetPrice.toFixed(activePair.digits)}</span>
                        <span className="absolute -top-4 right-0 text-[8px] text-green-400 font-bold">{pipsFromCurrent.toTp.toFixed(0) + "p away"}</span>
                      </div>
                      {entryPlan.map((e, i) => (
                        <div key={i} className="absolute w-full flex items-center" style={{ bottom: getPos(e.price) + '%' }}>
                          <div className="h-px w-full bg-cyan-500/30" />
                          <span className="absolute left-0 text-[7px] text-cyan-400">{e.price.toFixed(activePair.digits)}</span>
                          <span className="absolute right-0 text-[7px] text-cyan-400">{e.lot.toFixed(2) + " lot"}</span>
                        </div>
                      ))}
                      <div className="absolute h-0.5 w-full bg-white/60 animate-pulse" style={{ bottom: getPos(activePos.currentPrice) + '%' }}>
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-white font-bold bg-[#0a0a12] px-1 rounded">NOW {activePos.currentPrice.toFixed(activePair.digits)}</span>
                      </div>
                      {liquidation > 0 && (
                        <div className="absolute h-0.5 w-full bg-red-500/60" style={{ bottom: Math.max(0, Math.min(100, getPos(liquidation))) + '%' }}>
                          <span className="absolute top-1 left-0 text-[8px] text-red-400 font-bold">LIQ {liquidation.toFixed(activePair.digits)}</span>
                          <span className="absolute top-1 right-0 text-[8px] text-red-400 font-bold">{pipsFromCurrent.toLiq.toFixed(0) + "p away"}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* LIVE P&L */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0d0d14] rounded-lg p-3 border border-gray-800/30">
                <span className="text-[8px] text-gray-600 block mb-1">Live P&L</span>
                <span className={"text-lg font-bold " + (livePnL >= 0 ? "text-green-400" : "text-red-400")}>
                  {(livePnL >= 0 ? "+$" : "-$") + Math.abs(livePnL).toFixed(2)}
                </span>
              </div>
              <div className="bg-[#0d0d14] rounded-lg p-3 border border-gray-800/30">
                <span className="text-[8px] text-gray-600 block mb-1">Health</span>
                <div className="flex items-center gap-2">
                  <span className={"text-lg font-bold " + healthColor}>{health.percent + "%"}</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className={"h-full rounded-full transition-all " + healthBg} style={{ width: health.percent + '%' }} />
                  </div>
                </div>
              </div>
              <div className="bg-[#0d0d14] rounded-lg p-3 border border-gray-800/30">
                <span className="text-[8px] text-gray-600 block mb-1">P&L vs Risk</span>
                <span className={"text-lg font-bold " + (livePnL >= 0 ? "text-green-400" : "text-red-400")}>
                  {riskBudget > 0 ? ((livePnL / riskBudget) * 100).toFixed(0) + "%" : "0%"}
                </span>
              </div>
              <div className="bg-[#0d0d14] rounded-lg p-3 border border-gray-800/30">
                <span className="text-[8px] text-gray-600 block mb-1">Trade Log</span>
                <button onClick={() => setShowLogForm(true)} className="text-[9px] font-bold text-cyan-400 border border-cyan-800/30 rounded-lg px-3 py-1.5 hover:bg-cyan-950/20 transition-all">
                  + Log This Trade
                </button>
              </div>
            </div>

            {/* Log Form */}
            {showLogForm && (
              <div className="mt-3 bg-[#0a0a12] border border-gray-800/30 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase block mb-1">Result</label>
                    <select value={logResult} onChange={(e) => setLogResult(e.target.value as 'win' | 'loss' | 'breakeven' | 'open')} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:outline-none">
                      <option value="open">Open (Ongoing)</option>
                      <option value="win">Win</option>
                      <option value="loss">Loss</option>
                      <option value="breakeven">Breakeven</option>
                    </select>
                  </div>
                  {logResult !== 'open' && (
                    <div>
                      <label className="text-[9px] text-gray-600 uppercase block mb-1">P&L ($)</label>
                      <input type="number" step={0.01} value={logPnl} onChange={(e) => setLogPnl(Number(e.target.value))} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:outline-none" />
                    </div>
                  )}
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase block mb-1">Notes</label>
                    <input type="text" value={logNotes} onChange={(e) => setLogNotes(e.target.value)} className="w-full bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:outline-none" placeholder="Optional..." />
                  </div>
                </div>
                {logResult === 'open' && (
                  <p className="text-[9px] text-blue-400">Trade will be saved as ongoing. You can update it later from the Trade Log tab.</p>
                )}
                <div className="flex gap-2">
                  <button onClick={saveTradeRecord} className="px-4 py-2 rounded-lg bg-green-950/30 border border-green-700/30 text-green-400 text-[10px] font-bold hover:bg-green-900/30 transition-all">{logResult === 'open' ? 'Save Open Trade' : 'Save'}</button>
                  <button onClick={() => setShowLogForm(false)} className="px-4 py-2 rounded-lg bg-[#0d0d14] border border-gray-700/30 text-gray-400 text-[10px] font-bold hover:text-white transition-all">Cancel</button>
                </div>
              </div>
            )}
          </section>

          {/* PORTFOLIO OVERVIEW */}
          <section className="bg-[#080810] border border-gray-800/40 rounded-xl p-4">
            <h2 className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
              <PieChart size={12} /> Portfolio Overview
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-800/30">
              <table className="w-full text-[10px]">
                <thead className="text-[8px] text-gray-600 uppercase bg-[#0d0d14]">
                  <tr>
                    <th className="px-2 py-2 text-left">Style</th>
                    <th className="px-2 py-2">Pair</th>
                    <th className="px-2 py-2">Dir</th>
                    <th className="px-2 py-2">Lots</th>
                    <th className="px-2 py-2 text-red-400">Risk</th>
                    <th className="px-2 py-2 text-green-400">Reward</th>
                    <th className="px-2 py-2">R:R</th>
                    <th className="px-2 py-2">P&L</th>
                    <th className="px-2 py-2">To TP</th>
                    <th className="px-2 py-2">To Liq</th>
                    <th className="px-2 py-2">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-800/20 hover:bg-[#0d0d14]/50">
                      <td className="px-2 py-2 font-bold" style={{ color: item.color }}>{item.slotName}</td>
                      <td className="px-2 py-2 text-center text-white">{item.pair}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={"px-1.5 py-0.5 rounded text-[8px] font-bold " + (item.dir === 'Buy' ? "bg-green-950/30 text-green-400" : "bg-red-950/30 text-red-400")}>
                          {item.dir === 'Buy' ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center text-cyan-400 font-bold">{item.lots.toFixed(2)}</td>
                      <td className="px-2 py-2 text-center text-red-400">{"$" + item.risk.toFixed(0)}</td>
                      <td className="px-2 py-2 text-center text-green-400">{"$" + item.reward.toFixed(0)}</td>
                      <td className="px-2 py-2 text-center text-white font-bold">{"1:" + item.rr.toFixed(1)}</td>
                      <td className={"px-2 py-2 text-center font-bold " + (item.pnl >= 0 ? "text-green-400" : "text-red-400")}>
                        {(item.pnl >= 0 ? "+$" : "-$") + Math.abs(item.pnl).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-center text-green-400">{item.pipsToTp.toFixed(0) + "p"}</td>
                      <td className="px-2 py-2 text-center text-red-400">{item.pipsToLiq.toFixed(0) + "p"}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={"w-2 h-2 rounded-full inline-block " + (item.health === 'safe' ? "bg-green-500" : item.health === 'warning' ? "bg-yellow-500" : "bg-red-500")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4 mt-3 text-[9px]">
              <span className="text-gray-600">Total Risk: <span className="text-red-400 font-bold">{"$" + overview.totalRisk.toFixed(0)}</span></span>
              <span className="text-gray-600">Total Reward: <span className="text-green-400 font-bold">{"$" + overview.totalReward.toFixed(0)}</span></span>
              <span className="text-gray-600">Combined R:R: <span className="text-white font-bold">{"1:" + (overview.totalRisk > 0 ? (overview.totalReward / overview.totalRisk).toFixed(1) : "0")}</span></span>
            </div>
          </section>
        </>
      )}

      {/* PRESETS TAB */}
      {activeTab === 'presets' && (
        <section className="bg-[#080810] border border-gray-800/40 rounded-xl p-4 space-y-4">
          <h2 className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-2">
            <FolderOpen size={12} /> Saved Presets
          </h2>
          <div className="flex gap-2">
            <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name..." className="flex-1 bg-[#0d0d14] border border-gray-700/40 rounded-lg p-2 text-white text-sm focus:border-cyan-600 focus:outline-none" />
            <button onClick={savePreset} className="px-4 py-2 rounded-lg bg-cyan-950/30 border border-cyan-700/30 text-cyan-400 text-[10px] font-bold hover:bg-cyan-900/30 transition-all">
              <Save size={12} />
            </button>
          </div>
          {presets.length === 0 ? (
            <p className="text-[10px] text-gray-600 text-center py-8">No presets saved yet. Use Quick Save or save manually above.</p>
          ) : (
            <div className="space-y-2">
              {presets.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-[#0d0d14] rounded-lg p-3 border border-gray-800/30 hover:border-gray-700/50 transition-all">
                  <div>
                    <span className="text-[10px] text-white font-bold">{p.name}</span>
                    <span className="text-[8px] text-gray-600 ml-2">{"$" + p.capital + " | " + new Date(p.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => loadPreset(p)} className="px-3 py-1 rounded-lg bg-cyan-950/20 border border-cyan-800/30 text-cyan-400 text-[9px] font-bold hover:bg-cyan-900/30 transition-all">Load</button>
                    <button onClick={() => deletePreset(p.id)} className="px-2 py-1 rounded-lg text-gray-600 hover:text-red-400 transition-all"><Trash2 size={10} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TRADE LOG TAB */}
      {activeTab === 'log' && (
        <section className="bg-[#080810] border border-gray-800/40 rounded-xl p-4 space-y-4">
          <h2 className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-2">
            <BookOpen size={12} /> Trade Log
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
            <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
              <span className="text-[8px] text-gray-600 block">Total</span>
              <span className="text-sm font-bold text-white">{logStats.total}</span>
            </div>
            <div className="bg-blue-950/20 rounded-lg p-2 text-center border border-blue-900/30">
              <span className="text-[8px] text-blue-400 block">Open</span>
              <span className="text-sm font-bold text-blue-400">{logStats.openCount}</span>
            </div>
            <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
              <span className="text-[8px] text-gray-600 block">Wins</span>
              <span className="text-sm font-bold text-green-400">{logStats.wins}</span>
            </div>
            <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
              <span className="text-[8px] text-gray-600 block">Losses</span>
              <span className="text-sm font-bold text-red-400">{logStats.losses}</span>
            </div>
            <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
              <span className="text-[8px] text-gray-600 block">Win Rate</span>
              <span className="text-sm font-bold text-yellow-400">{logStats.winRate.toFixed(0) + "%"}</span>
            </div>
            <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
              <span className="text-[8px] text-gray-600 block">Total P&L</span>
              <span className={"text-sm font-bold " + (logStats.totalPnl >= 0 ? "text-green-400" : "text-red-400")}>
                {(logStats.totalPnl >= 0 ? "+$" : "-$") + Math.abs(logStats.totalPnl).toFixed(2)}
              </span>
            </div>
            <div className="bg-[#0d0d14] rounded-lg p-2 text-center border border-gray-800/30">
              <span className="text-[8px] text-gray-600 block">Avg R:R</span>
              <span className="text-sm font-bold text-white">{"1:" + logStats.avgRR.toFixed(1)}</span>
            </div>
          </div>
          {tradeLog.length === 0 ? (
            <p className="text-[10px] text-gray-600 text-center py-8">No trades logged yet. Use &quot;Log This Trade&quot; from the engine.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {tradeLog.map(t => (
                <div key={t.id} className={"rounded-lg p-3 border " + (t.result === 'open' ? "bg-blue-950/10 border-blue-800/30" : "bg-[#0d0d14] border-gray-800/30")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={"w-2 h-2 rounded-full " + (t.result === 'win' ? "bg-green-500" : t.result === 'loss' ? "bg-red-500" : t.result === 'open' ? "bg-blue-400 animate-pulse" : "bg-gray-500")} />
                      <div>
                        <span className="text-[10px] text-white font-bold">{t.pair} {t.direction}</span>
                        <span className="text-[8px] text-gray-600 ml-2">{t.portfolio} | {t.style} | {t.lots.toFixed(2)} lots | R:R 1:{t.rr.toFixed(1)}</span>
                        {t.result === 'open' && (
                          <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-blue-950/40 border border-blue-700/30 text-blue-400 font-bold">OPEN</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.result === 'open' ? (
                        <button onClick={() => { setEditingTradeId(t.id); setEditResult('win'); setEditPnl(0); }} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/20 border border-blue-700/30 text-blue-400 text-[9px] font-bold hover:bg-blue-900/30 transition-all">
                          <Edit3 size={9} /> Update
                        </button>
                      ) : (
                        <span className={"text-[10px] font-bold " + (t.pnl >= 0 ? "text-green-400" : "text-red-400")}>
                          {(t.pnl >= 0 ? "+$" : "-$") + Math.abs(t.pnl).toFixed(2)}
                        </span>
                      )}
                      <button onClick={() => deleteTradeRecord(t.id)} className="text-gray-700 hover:text-red-400"><Trash2 size={10} /></button>
                    </div>
                  </div>
                  {editingTradeId === t.id && (
                    <div className="mt-3 pt-3 border-t border-gray-800/30 grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[8px] text-gray-600 uppercase block mb-1">New Result</label>
                        <select value={editResult} onChange={(e) => setEditResult(e.target.value as 'win' | 'loss' | 'breakeven')} className="w-full bg-[#080810] border border-gray-700/40 rounded-lg p-1.5 text-white text-[10px] font-bold focus:outline-none">
                          <option value="win">Win</option>
                          <option value="loss">Loss</option>
                          <option value="breakeven">Breakeven</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] text-gray-600 uppercase block mb-1">Final P&L ($)</label>
                        <input type="number" step={0.01} value={editPnl} onChange={(e) => setEditPnl(Number(e.target.value))} className="w-full bg-[#080810] border border-gray-700/40 rounded-lg p-1.5 text-white text-[10px] font-bold focus:outline-none" />
                      </div>
                      <div className="flex items-end gap-2">
                        <button onClick={() => updateTradeRecord(t.id, editResult, editPnl)} className="px-3 py-1.5 rounded-lg bg-green-950/30 border border-green-700/30 text-green-400 text-[9px] font-bold hover:bg-green-900/30 transition-all">Confirm</button>
                        <button onClick={() => setEditingTradeId(null)} className="px-3 py-1.5 rounded-lg bg-[#0d0d14] border border-gray-700/30 text-gray-400 text-[9px] font-bold hover:text-white transition-all">Cancel</button>
                      </div>
                    </div>
                  )}
                  {t.notes && <p className="text-[8px] text-gray-600 mt-1 ml-5">{t.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ALERTS TAB */}
      {activeTab === 'alerts' && (
        <section className="bg-[#080810] border border-gray-800/40 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <Bell size={12} /> Alert Configuration
            </h2>
            <button onClick={() => { const updated = { ...alerts, enabled: !alerts.enabled }; setAlerts(updated); saveAlertsToStorage(updated); }} className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all " + (alerts.enabled ? "bg-green-950/20 border-green-700/30 text-green-400" : "bg-[#0d0d14] border-gray-800/30 text-gray-600")}>
              {alerts.enabled ? <Bell size={10} /> : <BellOff size={10} />}
              {alerts.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0d0d14] rounded-lg p-4 border border-gray-800/30">
              <label className="text-[9px] text-yellow-400 uppercase block mb-2">Health Warning (%)</label>
              <p className="text-[8px] text-gray-600 mb-2">Alert when position health drops below this level</p>
              <input type="number" min={0} max={100} value={alerts.healthThreshold} onChange={(e) => { const updated = { ...alerts, healthThreshold: Number(e.target.value) }; setAlerts(updated); saveAlertsToStorage(updated); }} className="w-full bg-[#080810] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-yellow-600 focus:outline-none" />
            </div>
            <div className="bg-[#0d0d14] rounded-lg p-4 border border-gray-800/30">
              <label className="text-[9px] text-green-400 uppercase block mb-2">Take Profit Target (%)</label>
              <p className="text-[8px] text-gray-600 mb-2">Alert when P&L reaches this % of risk budget</p>
              <input type="number" value={alerts.pnlTargetPercent} onChange={(e) => { const updated = { ...alerts, pnlTargetPercent: Number(e.target.value) }; setAlerts(updated); saveAlertsToStorage(updated); }} className="w-full bg-[#080810] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-green-600 focus:outline-none" />
            </div>
            <div className="bg-[#0d0d14] rounded-lg p-4 border border-gray-800/30">
              <label className="text-[9px] text-red-400 uppercase block mb-2">Cut Loss Threshold (%)</label>
              <p className="text-[8px] text-gray-600 mb-2">Alert when P&L drops below this % of risk budget</p>
              <input type="number" value={alerts.pnlStopPercent} onChange={(e) => { const updated = { ...alerts, pnlStopPercent: Number(e.target.value) }; setAlerts(updated); saveAlertsToStorage(updated); }} className="w-full bg-[#080810] border border-gray-700/40 rounded-lg p-2 text-white text-sm font-bold focus:border-red-600 focus:outline-none" />
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
