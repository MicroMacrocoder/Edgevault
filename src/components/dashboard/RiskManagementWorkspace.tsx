"use client";

import { useMemo, useState } from "react";

type RiskModel = "standard" | "exposure" | "fixed" | "cumulative";
type PairType = "forex" | "jpy" | "gold" | "silver" | "indices";
type Direction = "buy" | "sell";
type VolatilityMode = "low" | "normal" | "high" | "extreme";

type PairSettings = {
  pipSize: number;
  pipValuePerLot: number;
  contractSize: number;
  label: string;
  priceDecimals: number;
};

type ExposureEntry = {
  id: number;
  entryPrice: string;
  lotSize: string;
};

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-slate-800/90 bg-slate-950/80 shadow-[0_0_35px_rgba(15,23,42,0.55)] " +
        className
      }
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
      {children}
    </label>
  );
}

function inputClassName() {
  return "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";
}

function selectClassName() {
  return inputClassName();
}

export default function RiskManagementWorkspace() {
  const [activeModel, setActiveModel] = useState<RiskModel>("standard");

  const [balance, setBalance] = useState("");
  const [pairType, setPairType] = useState<PairType>("forex");
  const [direction, setDirection] = useState<Direction>("buy");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [riskPercent, setRiskPercent] = useState("");
  const [lotSize, setLotSize] = useState("");
  const [targetProfit, setTargetProfit] = useState("");
  const [numberOfTrades, setNumberOfTrades] = useState("");
  const [rewardRatio, setRewardRatio] = useState("");
  const [winRate, setWinRate] = useState("");

  const [portfolioPercent, setPortfolioPercent] = useState("20");
  const [leverage, setLeverage] = useState("100");
  const [volatilityMode, setVolatilityMode] = useState<VolatilityMode>("normal");
  const [maxEntries, setMaxEntries] = useState("20");
  const [exposureEntries, setExposureEntries] = useState<ExposureEntry[]>([
    { id: 1, entryPrice: "", lotSize: "" },
  ]);

  const minimumLotSize = 0.01;

  function toNumber(value: string | number) {
    return Number(value) || 0;
  }

  function getPairSettings(type: PairType): PairSettings {
    if (type === "forex") {
      return {
        pipSize: 0.0001,
        pipValuePerLot: 10,
        contractSize: 100000,
        label: "pips",
        priceDecimals: 5,
      };
    }

    if (type === "jpy") {
      return {
        pipSize: 0.01,
        pipValuePerLot: 10,
        contractSize: 100000,
        label: "pips",
        priceDecimals: 3,
      };
    }

    if (type === "gold") {
      return {
        pipSize: 1,
        pipValuePerLot: 100,
        contractSize: 100,
        label: "points",
        priceDecimals: 2,
      };
    }

    if (type === "silver") {
      return {
        pipSize: 0.002,
        pipValuePerLot: 10,
        contractSize: 5000,
        label: "points / pips",
        priceDecimals: 3,
      };
    }

    if (type === "indices") {
      return {
        pipSize: 1,
        pipValuePerLot: 10,
        contractSize: 1,
        label: "points / pips",
        priceDecimals: 2,
      };
    }

    return {
      pipSize: 0.0001,
      pipValuePerLot: 10,
      contractSize: 100000,
      label: "pips",
      priceDecimals: 5,
    };
  }

  const pairSettings = getPairSettings(pairType);

  function money(value: number | string) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function number(value: number | string) {
    return Number(value || 0).toFixed(2);
  }

  function price(value: number | string) {
    return Number(value || 0).toFixed(pairSettings.priceDecimals);
  }

  function getDistance(priceOne: string | number, priceTwo: string | number) {
    return Math.abs(toNumber(priceOne) - toNumber(priceTwo)) / pairSettings.pipSize;
  }

  function calculateMoney(distance: number, lot: number | string) {
    return distance * pairSettings.pipValuePerLot * toNumber(lot);
  }

  function formatDistance(distance: number) {
    if (pairType === "silver") {
      const points = distance * 2;
      return `${number(points)} points / ${number(distance)} pips`;
    }

    return `${number(distance)} ${pairSettings.label}`;
  }

  function updateExposureEntry(
    id: number,
    field: keyof Omit<ExposureEntry, "id">,
    value: string
  ) {
    setExposureEntries((entries) =>
      entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [field]: value,
            }
          : entry
      )
    );
  }

  function addExposureEntry() {
    setExposureEntries((entries) => {
      if (entries.length >= Math.max(1, Math.floor(toNumber(maxEntries)))) {
        return entries;
      }

      const nextId = entries.length > 0 ? Math.max(...entries.map((item) => item.id)) + 1 : 1;

      return [
        ...entries,
        {
          id: nextId,
          entryPrice: "",
          lotSize: "",
        },
      ];
    });
  }

  function removeExposureEntry(id: number) {
    setExposureEntries((entries) => {
      if (entries.length === 1) {
        return entries;
      }

      return entries.filter((entry) => entry.id !== id);
    });
  }

  const plannedRiskAmount = toNumber(balance) * (toNumber(riskPercent) / 100);
  const standardSlDistance = getDistance(entryPrice, stopLoss);
  const standardTpDistance = getDistance(entryPrice, takeProfit);

  const theoreticalLotSize =
    standardSlDistance > 0
      ? plannedRiskAmount / (standardSlDistance * pairSettings.pipValuePerLot)
      : 0;

  const minimumLotLoss = calculateMoney(standardSlDistance, minimumLotSize);

  const minimumLotLossPercent =
    toNumber(balance) > 0 ? (minimumLotLoss / toNumber(balance)) * 100 : 0;

  const riskIsNotPossible = minimumLotLoss > plannedRiskAmount;

  const standardLotToUse = riskIsNotPossible ? minimumLotSize : theoreticalLotSize;

  const standardProfit = calculateMoney(standardTpDistance, standardLotToUse);

  const standardProfitPercent =
    toNumber(balance) > 0 ? (standardProfit / toNumber(balance)) * 100 : 0;

  const fixedSlDistance = getDistance(entryPrice, stopLoss);
  const fixedTpDistance = getDistance(entryPrice, takeProfit);
  const fixedLoss = calculateMoney(fixedSlDistance, lotSize);
  const fixedProfit = calculateMoney(fixedTpDistance, lotSize);

  const fixedLossPercent =
    toNumber(balance) > 0 ? (fixedLoss / toNumber(balance)) * 100 : 0;

  const fixedProfitPercent =
    toNumber(balance) > 0 ? (fixedProfit / toNumber(balance)) * 100 : 0;

  const fixedRiskReward = fixedLoss > 0 ? fixedProfit / fixedLoss : 0;

  const exposureResult = useMemo(() => {
    const validEntries = exposureEntries
      .map((entry) => ({
        id: entry.id,
        entryPrice: toNumber(entry.entryPrice),
        lotSize: toNumber(entry.lotSize),
      }))
      .filter((entry) => entry.entryPrice > 0 && entry.lotSize > 0);

    const totalLots = validEntries.reduce((sum, entry) => sum + entry.lotSize, 0);

    const weightedAverageEntry =
      totalLots > 0
        ? validEntries.reduce(
            (sum, entry) => sum + entry.entryPrice * entry.lotSize,
            0
          ) / totalLots
        : 0;

    const totalPipValue = totalLots * pairSettings.pipValuePerLot;
    const portfolioSize = toNumber(balance) * (toNumber(portfolioPercent) / 100);
    const riskBudget = portfolioSize * (toNumber(riskPercent) / 100);
    const dangerDistance = totalPipValue > 0 ? riskBudget / totalPipValue : 0;
    const priceDistance = dangerDistance * pairSettings.pipSize;

    const dangerPrice =
      weightedAverageEntry > 0
        ? direction === "buy"
          ? weightedAverageEntry - priceDistance
          : weightedAverageEntry + priceDistance
        : 0;

    const targetPrice = toNumber(takeProfit);
    const rewardDistance =
      weightedAverageEntry > 0 && targetPrice > 0
        ? direction === "buy"
          ? Math.max(0, (targetPrice - weightedAverageEntry) / pairSettings.pipSize)
          : Math.max(0, (weightedAverageEntry - targetPrice) / pairSettings.pipSize)
        : 0;

    const rewardAmount = rewardDistance * totalPipValue;
    const riskReward = riskBudget > 0 ? rewardAmount / riskBudget : 0;
    const notionalExposure = weightedAverageEntry * pairSettings.contractSize * totalLots;
    const marginUsed = toNumber(leverage) > 0 ? notionalExposure / toNumber(leverage) : 0;
    const freePortfolioMargin = Math.max(0, portfolioSize - marginUsed);
    const marginPressure = portfolioSize > 0 ? (marginUsed / portfolioSize) * 100 : 0;
    const effectiveLeverage = portfolioSize > 0 ? notionalExposure / portfolioSize : 0;

    const volatilityMultiplier =
      volatilityMode === "low"
        ? 1.2
        : volatilityMode === "normal"
          ? 1
          : volatilityMode === "high"
            ? 0.65
            : 0.4;

    const suggestedLotSize = totalLots > 0 ? totalLots * volatilityMultiplier : 0;
    const entriesPressure =
      Math.max(1, Math.floor(toNumber(maxEntries))) > 0
        ? (validEntries.length / Math.max(1, Math.floor(toNumber(maxEntries)))) * 100
        : 0;

    const safetyScore = Math.max(
      0,
      Math.min(
        100,
        100 - marginPressure * 0.35 - entriesPressure * 0.2 - (riskReward < 1 && rewardAmount > 0 ? 15 : 0)
      )
    );

    const status =
      safetyScore >= 75
        ? "Controlled"
        : safetyScore >= 55
          ? "Watch Closely"
          : safetyScore >= 35
            ? "High Pressure"
            : "Danger Zone";

    return {
      validEntries,
      totalLots,
      weightedAverageEntry,
      totalPipValue,
      portfolioSize,
      riskBudget,
      dangerDistance,
      dangerPrice,
      rewardDistance,
      rewardAmount,
      riskReward,
      notionalExposure,
      marginUsed,
      freePortfolioMargin,
      marginPressure,
      effectiveLeverage,
      suggestedLotSize,
      safetyScore,
      status,
    };
  }, [
    balance,
    direction,
    exposureEntries,
    leverage,
    maxEntries,
    pairSettings.contractSize,
    pairSettings.pipSize,
    pairSettings.pipValuePerLot,
    portfolioPercent,
    riskPercent,
    takeProfit,
    volatilityMode,
  ]);

  function calculateCompoundingPlan() {
    let currentBalance = toNumber(balance);
    const trades = Math.max(0, Math.floor(toNumber(numberOfTrades)));
    const riskDecimal = toNumber(riskPercent) / 100;
    const reward = toNumber(rewardRatio);
    const winRateDecimal = toNumber(winRate) / 100;

    const estimatedWins = Math.round(trades * winRateDecimal);
    const estimatedLosses = trades - estimatedWins;

    let winsUsed = 0;
    let lossesUsed = 0;

    for (let tradeNumber = 1; tradeNumber <= trades; tradeNumber++) {
      const riskAmount = currentBalance * riskDecimal;

      const shouldWin =
        winsUsed < estimatedWins &&
        (tradeNumber % 2 === 1 || lossesUsed >= estimatedLosses);

      if (shouldWin) {
        currentBalance = currentBalance + riskAmount * reward;
        winsUsed = winsUsed + 1;
      } else if (lossesUsed < estimatedLosses) {
        currentBalance = currentBalance - riskAmount;
        lossesUsed = lossesUsed + 1;
      } else {
        currentBalance = currentBalance + riskAmount * reward;
        winsUsed = winsUsed + 1;
      }
    }

    return {
      finalBalance: currentBalance,
      totalProfitLoss: currentBalance - toNumber(balance),
      totalReturn:
        toNumber(balance) > 0
          ? ((currentBalance - toNumber(balance)) / toNumber(balance)) * 100
          : 0,
      estimatedWins,
      estimatedLosses,
    };
  }

  const compoundingResult = calculateCompoundingPlan();

  const tabClassName = (model: RiskModel) =>
    activeModel === model
      ? "rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300"
      : "rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white";

  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-400">
            Execution Lab
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-white lg:text-5xl">
            Risk Management
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Build risk plans, simulate multi-entry exposure, calculate weighted
            average entry, and know your danger price before adding size.
          </p>

          <p className="mt-5 max-w-3xl rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-300">
            Note: pip and point values can differ by broker. This version uses
            the current EdgeVault testing logic and should be validated against
            your broker before live execution.
          </p>
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-4">
        <button type="button" onClick={() => setActiveModel("standard")} className={tabClassName("standard")}>
          Standard Risk
        </button>

        <button type="button" onClick={() => setActiveModel("exposure")} className={tabClassName("exposure")}>
          Exposure Map
        </button>

        <button type="button" onClick={() => setActiveModel("fixed")} className={tabClassName("fixed")}>
          Fixed Lot Size
        </button>

        <button type="button" onClick={() => setActiveModel("cumulative")} className={tabClassName("cumulative")}>
          Cumulative Plan
        </button>
      </div>

      <Panel className="p-6">
        <h2 className="text-xl font-bold text-white">Core Trade Settings</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <div>
            <FieldLabel>Account Balance</FieldLabel>
            <input
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              type="number"
              placeholder="500"
              className={inputClassName()}
            />
          </div>

          <div>
            <FieldLabel>Market Type</FieldLabel>
            <select
              value={pairType}
              onChange={(event) => setPairType(event.target.value as PairType)}
              className={selectClassName()}
            >
              <option value="forex">Forex Major</option>
              <option value="jpy">JPY Pair</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="indices">Indices</option>
            </select>
          </div>

          <div>
            <FieldLabel>Direction</FieldLabel>
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as Direction)}
              className={selectClassName()}
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          <div>
            <FieldLabel>Risk %</FieldLabel>
            <input
              value={riskPercent}
              onChange={(event) => setRiskPercent(event.target.value)}
              type="number"
              placeholder="3"
              className={inputClassName()}
            />
          </div>

          <div>
            <FieldLabel>Target Price</FieldLabel>
            <input
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
              type="number"
              placeholder="Take profit price"
              className={inputClassName()}
            />
          </div>
        </div>
      </Panel>

      {activeModel === "standard" ? (
        <Panel className="p-6">
          <h2 className="text-xl font-bold text-white">Standard Risk Model</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <FieldLabel>Entry Price</FieldLabel>
              <input
                value={entryPrice}
                onChange={(event) => setEntryPrice(event.target.value)}
                type="number"
                placeholder="Entry Price"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Stop Loss Price</FieldLabel>
              <input
                value={stopLoss}
                onChange={(event) => setStopLoss(event.target.value)}
                type="number"
                placeholder="Stop Loss Price"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Take Profit Price</FieldLabel>
              <input
                value={takeProfit}
                onChange={(event) => setTakeProfit(event.target.value)}
                type="number"
                placeholder="Take Profit Price"
                className={inputClassName()}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Suggested Lot Size</p>
              <p className="mt-2 text-xl font-bold text-emerald-400">{number(standardLotToUse)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Planned Risk</p>
              <p className="mt-2 text-xl font-bold text-red-400">{money(plannedRiskAmount)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Projected Profit</p>
              <p className="mt-2 text-xl font-bold text-emerald-400">{money(standardProfit)}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
            <p>Stop Loss Distance: {formatDistance(standardSlDistance)}</p>
            <p>Take Profit Distance: {formatDistance(standardTpDistance)}</p>
            <p>Minimum 0.01 Lot Loss: {money(minimumLotLoss)}</p>
            <p>Minimum 0.01 Lot Loss %: {number(minimumLotLossPercent)}%</p>
            <p>Projected Profit %: {number(standardProfitPercent)}%</p>
            {riskIsNotPossible ? (
              <p className="text-yellow-300">Warning: your planned risk is smaller than the minimum lot loss.</p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {activeModel === "exposure" ? (
        <Panel className="p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Multi-entry engine</p>
              <h2 className="mt-2 text-xl font-bold text-white">Exposure Map</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                Replace the old split account model with a live exposure map.
                Add up to 20 entries, calculate weighted average entry,
                portfolio risk bucket, danger price, RR, margin pressure, and
                safety score.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              Status: {exposureResult.status}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <div>
              <FieldLabel>Portfolio Allocation %</FieldLabel>
              <input
                value={portfolioPercent}
                onChange={(event) => setPortfolioPercent(event.target.value)}
                type="number"
                placeholder="20"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Risk Bucket %</FieldLabel>
              <input
                value={riskPercent}
                onChange={(event) => setRiskPercent(event.target.value)}
                type="number"
                placeholder="3"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Leverage</FieldLabel>
              <input
                value={leverage}
                onChange={(event) => setLeverage(event.target.value)}
                type="number"
                placeholder="100"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Volatility</FieldLabel>
              <select
                value={volatilityMode}
                onChange={(event) => setVolatilityMode(event.target.value as VolatilityMode)}
                className={selectClassName()}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>

            <div>
              <FieldLabel>Max Entries</FieldLabel>
              <input
                value={maxEntries}
                onChange={(event) => setMaxEntries(event.target.value)}
                type="number"
                placeholder="20"
                className={inputClassName()}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Portfolio Size</p>
              <p className="mt-2 text-xl font-bold text-white">{money(exposureResult.portfolioSize)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Risk Bucket</p>
              <p className="mt-2 text-xl font-bold text-red-400">{money(exposureResult.riskBudget)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Safety Score</p>
              <p className="mt-2 text-xl font-bold text-emerald-400">{number(exposureResult.safetyScore)}/100</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Entries Used</p>
              <p className="mt-2 text-xl font-bold text-white">
                {exposureResult.validEntries.length}/{Math.max(1, Math.floor(toNumber(maxEntries)))}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Weighted Average Entry</p>
              <p className="mt-2 text-xl font-bold text-white">{price(exposureResult.weightedAverageEntry)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total Lots</p>
              <p className="mt-2 text-xl font-bold text-white">{number(exposureResult.totalLots)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Combined Pip Value</p>
              <p className="mt-2 text-xl font-bold text-white">{money(exposureResult.totalPipValue)} / pip</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Suggested Volatility Lot</p>
              <p className="mt-2 text-xl font-bold text-cyan-300">{number(exposureResult.suggestedLotSize)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-red-300">Danger Price</p>
              <p className="mt-2 text-xl font-bold text-red-300">{price(exposureResult.dangerPrice)}</p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-red-300">Distance to Danger</p>
              <p className="mt-2 text-xl font-bold text-red-300">{formatDistance(exposureResult.dangerDistance)}</p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Reward</p>
              <p className="mt-2 text-xl font-bold text-emerald-300">{money(exposureResult.rewardAmount)}</p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Risk to Reward</p>
              <p className="mt-2 text-xl font-bold text-emerald-300">1:{number(exposureResult.riskReward)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-bold text-white">Entry Builder</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Add every scale-in here. The engine recalculates the full position as one combined exposure.
                </p>
              </div>

              <button
                type="button"
                onClick={addExposureEntry}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                + Add Entry
              </button>
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Entry Price</th>
                    <th className="px-4 py-3">Lot Size</th>
                    <th className="px-4 py-3">Pip Value</th>
                    <th className="px-4 py-3">Weight</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {exposureEntries.map((entry, index) => {
                    const rowLot = toNumber(entry.lotSize);
                    const rowPipValue = rowLot * pairSettings.pipValuePerLot;
                    const rowWeight =
                      exposureResult.totalLots > 0 ? (rowLot / exposureResult.totalLots) * 100 : 0;

                    return (
                      <tr key={entry.id} className="hover:bg-slate-900/60">
                        <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          <input
                            value={entry.entryPrice}
                            onChange={(event) => updateExposureEntry(entry.id, "entryPrice", event.target.value)}
                            type="number"
                            placeholder="1.08500"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={entry.lotSize}
                            onChange={(event) => updateExposureEntry(entry.id, "lotSize", event.target.value)}
                            type="number"
                            placeholder="0.01"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                          />
                        </td>
                        <td className="px-4 py-3">{money(rowPipValue)} / pip</td>
                        <td className="px-4 py-3">{number(rowWeight)}%</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeExposureEntry(entry.id)}
                            className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
              <p className="font-bold text-white">Margin / Leverage Pressure</p>
              <p>Notional Exposure: {money(exposureResult.notionalExposure)}</p>
              <p>Margin Used: {money(exposureResult.marginUsed)}</p>
              <p>Free Portfolio Margin: {money(exposureResult.freePortfolioMargin)}</p>
              <p>Margin Pressure: {number(exposureResult.marginPressure)}%</p>
              <p>Effective Leverage: {number(exposureResult.effectiveLeverage)}x</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
              <p className="font-bold text-white">Reward Projection</p>
              <p>Target Price: {price(takeProfit)}</p>
              <p>Reward Distance: {formatDistance(exposureResult.rewardDistance)}</p>
              <p>Reward Amount: {money(exposureResult.rewardAmount)}</p>
              <p>Risk Bucket: {money(exposureResult.riskBudget)}</p>
              <p>RR: 1:{number(exposureResult.riskReward)}</p>
            </div>

            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-7 text-yellow-200">
              <p className="font-bold text-yellow-100">Exposure Rule</p>
              <p>Before adding another entry, compare what improves and what gets worse.</p>
              <p>More entries may improve average entry, but they also increase pip value and compress danger distance.</p>
              <p>Do not use this as unlimited martingale scaling.</p>
            </div>
          </div>
        </Panel>
      ) : null}

      {activeModel === "fixed" ? (
        <Panel className="p-6">
          <h2 className="text-xl font-bold text-white">Fixed Lot Size Model</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <FieldLabel>Entry Price</FieldLabel>
              <input
                value={entryPrice}
                onChange={(event) => setEntryPrice(event.target.value)}
                type="number"
                placeholder="Entry Price"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Lot Size</FieldLabel>
              <input
                value={lotSize}
                onChange={(event) => setLotSize(event.target.value)}
                type="number"
                placeholder="0.10"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Stop Loss Price</FieldLabel>
              <input
                value={stopLoss}
                onChange={(event) => setStopLoss(event.target.value)}
                type="number"
                placeholder="Stop Loss Price"
                className={inputClassName()}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <FieldLabel>Take Profit Price</FieldLabel>
              <input
                value={takeProfit}
                onChange={(event) => setTakeProfit(event.target.value)}
                type="number"
                placeholder="Take Profit Price"
                className={inputClassName()}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Potential Loss</p>
              <p className="mt-2 text-xl font-bold text-red-400">{money(fixedLoss)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Potential Profit</p>
              <p className="mt-2 text-xl font-bold text-emerald-400">{money(fixedProfit)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Risk-to-Reward</p>
              <p className="mt-2 text-xl font-bold text-white">1:{number(fixedRiskReward)}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
            <p>Stop Loss Distance: {formatDistance(fixedSlDistance)}</p>
            <p>Take Profit Distance: {formatDistance(fixedTpDistance)}</p>
            <p>Loss Percentage: {number(fixedLossPercent)}%</p>
            <p>Profit Percentage: {number(fixedProfitPercent)}%</p>
          </div>
        </Panel>
      ) : null}

      {activeModel === "cumulative" ? (
        <Panel className="p-6">
          <h2 className="text-xl font-bold text-white">Cumulative / Compounding Model</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div>
              <FieldLabel>Risk %</FieldLabel>
              <input
                value={riskPercent}
                onChange={(event) => setRiskPercent(event.target.value)}
                type="number"
                placeholder="Risk %"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Reward Ratio</FieldLabel>
              <input
                value={rewardRatio}
                onChange={(event) => setRewardRatio(event.target.value)}
                type="number"
                placeholder="2"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Win Rate %</FieldLabel>
              <input
                value={winRate}
                onChange={(event) => setWinRate(event.target.value)}
                type="number"
                placeholder="50"
                className={inputClassName()}
              />
            </div>

            <div>
              <FieldLabel>Number of Trades</FieldLabel>
              <input
                value={numberOfTrades}
                onChange={(event) => setNumberOfTrades(event.target.value)}
                type="number"
                placeholder="20"
                className={inputClassName()}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Starting Balance</p>
              <p className="mt-2 text-xl font-bold text-white">{money(balance)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Projected Balance</p>
              <p className="mt-2 text-xl font-bold text-emerald-400">{money(compoundingResult.finalBalance)}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total Return</p>
              <p className="mt-2 text-xl font-bold text-emerald-400">{number(compoundingResult.totalReturn)}%</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
            <p>Estimated Winning Trades: {compoundingResult.estimatedWins}</p>
            <p>Estimated Losing Trades: {compoundingResult.estimatedLosses}</p>
            <p>Estimated Profit / Loss: {money(compoundingResult.totalProfitLoss)}</p>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
