"use client";

import { useState } from "react";

type RiskModel = "standard" | "split" | "fixed" | "cumulative";
type PairType = "forex" | "jpy" | "gold" | "silver" | "indices";
type Direction = "buy" | "sell";

type PairSettings = {
  pipSize: number;
  pipValuePerLot: number;
  label: string;
  priceDecimals: number;
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
  const [customSplitLot, setCustomSplitLot] = useState("");
  const [splitCount, setSplitCount] = useState("");
  const [targetProfit, setTargetProfit] = useState("");
  const [numberOfTrades, setNumberOfTrades] = useState("");
  const [rewardRatio, setRewardRatio] = useState("");
  const [winRate, setWinRate] = useState("");

  const minimumLotSize = 0.01;

  function toNumber(value: string | number) {
    return Number(value) || 0;
  }

  function getPairSettings(type: PairType): PairSettings {
    if (type === "forex") {
      return {
        pipSize: 0.0001,
        pipValuePerLot: 10,
        label: "pips",
        priceDecimals: 5,
      };
    }

    if (type === "jpy") {
      return {
        pipSize: 0.01,
        pipValuePerLot: 10,
        label: "pips",
        priceDecimals: 3,
      };
    }

    if (type === "gold") {
      return {
        pipSize: 1,
        pipValuePerLot: 100,
        label: "points",
        priceDecimals: 2,
      };
    }

    if (type === "silver") {
      return {
        pipSize: 0.002,
        pipValuePerLot: 10,
        label: "points / pips",
        priceDecimals: 3,
      };
    }

    if (type === "indices") {
      return {
        pipSize: 1,
        pipValuePerLot: 10,
        label: "points / pips",
        priceDecimals: 2,
      };
    }

    return {
      pipSize: 0.0001,
      pipValuePerLot: 10,
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

  function getDistance(priceOne: string, priceTwo: string) {
    return (
      Math.abs(toNumber(priceOne) - toNumber(priceTwo)) / pairSettings.pipSize
    );
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

  const standardLotToUse = riskIsNotPossible
    ? minimumLotSize
    : theoreticalLotSize;

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

  const splitValue =
    toNumber(splitCount) > 0 ? toNumber(balance) / toNumber(splitCount) : 0;

  const splitLotOptions = [
    { label: "Standard 0.10 Lot", value: 0.1 },
    { label: "Standard 1.00 Lot", value: 1 },
    {
      label: customSplitLot ? `Custom ${customSplitLot} Lot` : "Custom Lot",
      value: toNumber(customSplitLot),
    },
  ];

  function getAccountLossPrice(optionLot: number) {
    const lossDistance =
      optionLot > 0 ? splitValue / (pairSettings.pipValuePerLot * optionLot) : 0;

    const priceDistance = lossDistance * pairSettings.pipSize;

    if (direction === "buy") {
      return toNumber(entryPrice) - priceDistance;
    }

    return toNumber(entryPrice) + priceDistance;
  }

  function getTakeProfitPrice(optionLot: number) {
    const tpDistance =
      optionLot > 0
        ? toNumber(targetProfit) / (pairSettings.pipValuePerLot * optionLot)
        : 0;

    const priceDistance = tpDistance * pairSettings.pipSize;

    if (direction === "buy") {
      return toNumber(entryPrice) + priceDistance;
    }

    return toNumber(entryPrice) - priceDistance;
  }

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
            Choose your risk style, calculate lot size, estimate profit, and
            know your danger price before entering a trade.
          </p>

          <p className="mt-5 max-w-3xl rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-300">
            Note: pip and point values can differ by broker. This version
            follows the broker logic we are currently testing.
          </p>
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveModel("standard")}
          className={
            activeModel === "standard"
              ? "rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300"
              : "rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white"
          }
        >
          Standard Risk
        </button>

        <button
          type="button"
          onClick={() => setActiveModel("split")}
          className={
            activeModel === "split"
              ? "rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300"
              : "rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white"
          }
        >
          Split Account
        </button>

        <button
          type="button"
          onClick={() => setActiveModel("fixed")}
          className={
            activeModel === "fixed"
              ? "rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300"
              : "rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white"
          }
        >
          Fixed Lot
        </button>

        <button
          type="button"
          onClick={() => setActiveModel("cumulative")}
          className={
            activeModel === "cumulative"
              ? "rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300"
              : "rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white"
          }
        >
          Cumulative
        </button>
      </div>

      <Panel className="p-6">
        <h2 className="text-xl font-bold text-white">Account Setup</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel>Account Balance</FieldLabel>
            <input
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              type="number"
              placeholder="5000"
              className={inputClassName()}
            />
          </div>

          {activeModel !== "cumulative" ? (
            <>
              <div>
                <FieldLabel>Pair / Asset Type</FieldLabel>
                <select
                  value={pairType}
                  onChange={(event) =>
                    setPairType(event.target.value as PairType)
                  }
                  className={inputClassName()}
                >
                  <option value="forex">Forex Normal Pair</option>
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
                  onChange={(event) =>
                    setDirection(event.target.value as Direction)
                  }
                  className={inputClassName()}
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>

              <div>
                <FieldLabel>Entry Price</FieldLabel>
                <input
                  value={entryPrice}
                  onChange={(event) => setEntryPrice(event.target.value)}
                  type="number"
                  placeholder="1.25000 / 2350.00"
                  className={inputClassName()}
                />
              </div>
            </>
          ) : null}
        </div>
      </Panel>

      {activeModel === "standard" ? (
        <Panel className="p-6">
          <h2 className="text-xl font-bold text-white">Standard Risk Model</h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Use this when you know the percentage of your account you want to
            risk, and you want the app to calculate your lot size.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <input
              value={riskPercent}
              onChange={(event) => setRiskPercent(event.target.value)}
              type="number"
              placeholder="Risk % e.g. 2"
              className={inputClassName()}
            />
            <input
              value={stopLoss}
              onChange={(event) => setStopLoss(event.target.value)}
              type="number"
              placeholder="Stop Loss Price"
              className={inputClassName()}
            />
            <input
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
              type="number"
              placeholder="Take Profit Price"
              className={inputClassName()}
            />
          </div>

          {riskIsNotPossible ? (
            <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-relaxed text-red-300">
              Warning: This risk setting is not possible with this stop loss
              distance. The calculated lot size is below 0.01. At the minimum
              lot size of 0.01, this trade would risk {money(minimumLotLoss)},
              which is {number(minimumLotLossPercent)}% of your account.
              Reduce the stop loss distance, increase your account balance, or
              accept a higher risk.
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Lot Size
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {number(standardLotToUse)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Planned Risk
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {money(plannedRiskAmount)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Potential Profit
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {money(standardProfit)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
            <p>Stop Loss Distance: {formatDistance(standardSlDistance)}</p>
            <p>Potential Loss: {number(minimumLotLossPercent)}%</p>
            <p>Take Profit Distance: {formatDistance(standardTpDistance)}</p>
            <p>Potential Gain: {number(standardProfitPercent)}%</p>
          </div>
        </Panel>
      ) : null}

      {activeModel === "split" ? (
        <Panel className="p-6">
          <h2 className="text-xl font-bold text-white">Split Account Model</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <input
              value={splitCount}
              onChange={(event) => setSplitCount(event.target.value)}
              type="number"
              placeholder="Split into how many parts? e.g. 10"
              className={inputClassName()}
            />
            <input
              value={targetProfit}
              onChange={(event) => setTargetProfit(event.target.value)}
              type="number"
              placeholder="Target profit amount e.g. 30"
              className={inputClassName()}
            />
            <input
              value={customSplitLot}
              onChange={(event) => setCustomSplitLot(event.target.value)}
              type="number"
              placeholder="Custom lot size e.g. 0.25"
              className={inputClassName()}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Total Balance
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {money(balance)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Split Count
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {splitCount || 0}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Each Split Account
              </p>
              <p className="mt-2 text-xl font-bold text-emerald-400">
                {money(splitValue)}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lot Type</th>
                  <th className="px-4 py-3">Lot Size</th>
                  <th className="px-4 py-3">Account Loss Distance</th>
                  <th className="px-4 py-3">Account Loss Price</th>
                  <th className="px-4 py-3">TP Distance</th>
                  <th className="px-4 py-3">TP Price</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800 text-slate-300">
                {splitLotOptions.map((option) => {
                  const optionLot = option.value;

                  const lossDistance =
                    optionLot > 0
                      ? splitValue / (pairSettings.pipValuePerLot * optionLot)
                      : 0;

                  const tpDistance =
                    optionLot > 0
                      ? toNumber(targetProfit) /
                        (pairSettings.pipValuePerLot * optionLot)
                      : 0;

                  return (
                    <tr key={option.label} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3">{option.label}</td>
                      <td className="px-4 py-3">
                        {optionLot > 0 ? optionLot : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {optionLot > 0 ? formatDistance(lossDistance) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {optionLot > 0
                          ? price(getAccountLossPrice(optionLot))
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {optionLot > 0 ? formatDistance(tpDistance) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {optionLot > 0
                          ? price(getTakeProfitPrice(optionLot))
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {activeModel === "fixed" ? (
        <Panel className="p-6">
          <h2 className="text-xl font-bold text-white">
            Fixed Lot Size Model
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <input
              value={lotSize}
              onChange={(event) => setLotSize(event.target.value)}
              type="number"
              placeholder="Lot Size e.g. 0.10"
              className={inputClassName()}
            />
            <input
              value={stopLoss}
              onChange={(event) => setStopLoss(event.target.value)}
              type="number"
              placeholder="Stop Loss Price"
              className={inputClassName()}
            />
            <input
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
              type="number"
              placeholder="Take Profit Price"
              className={inputClassName()}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Potential Loss
              </p>
              <p className="mt-2 text-xl font-bold text-red-400">
                {money(fixedLoss)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Potential Profit
              </p>
              <p className="mt-2 text-xl font-bold text-emerald-400">
                {money(fixedProfit)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Risk-to-Reward
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                1:{number(fixedRiskReward)}
              </p>
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
          <h2 className="text-xl font-bold text-white">
            Cumulative / Compounding Model
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <input
              value={riskPercent}
              onChange={(event) => setRiskPercent(event.target.value)}
              type="number"
              placeholder="Risk %"
              className={inputClassName()}
            />
            <input
              value={rewardRatio}
              onChange={(event) => setRewardRatio(event.target.value)}
              type="number"
              placeholder="Reward Ratio e.g. 2"
              className={inputClassName()}
            />
            <input
              value={winRate}
              onChange={(event) => setWinRate(event.target.value)}
              type="number"
              placeholder="Win Rate % e.g. 50"
              className={inputClassName()}
            />
            <input
              value={numberOfTrades}
              onChange={(event) => setNumberOfTrades(event.target.value)}
              type="number"
              placeholder="Number of Trades"
              className={inputClassName()}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Starting Balance
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {money(balance)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Projected Balance
              </p>
              <p className="mt-2 text-xl font-bold text-emerald-400">
                {money(compoundingResult.finalBalance)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Total Return
              </p>
              <p className="mt-2 text-xl font-bold text-emerald-400">
                {number(compoundingResult.totalReturn)}%
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
            <p>Estimated Winning Trades: {compoundingResult.estimatedWins}</p>
            <p>Estimated Losing Trades: {compoundingResult.estimatedLosses}</p>
            <p>
              Estimated Profit / Loss:{" "}
              {money(compoundingResult.totalProfitLoss)}
            </p>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
