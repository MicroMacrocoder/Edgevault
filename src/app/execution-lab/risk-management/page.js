"use client";

import { useState } from "react";
import Link from "next/link";

export default function RiskManagementPage() {
  const [activeModel, setActiveModel] = useState("standard");

  const [balance, setBalance] = useState("");
  const [pairType, setPairType] = useState("forex");
  const [direction, setDirection] = useState("buy");
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

  function toNumber(value) {
    return Number(value) || 0;
  }

  function getPairSettings(type) {
    if (type === "forex") {
      return { pipSize: 0.0001, pipValuePerLot: 10, label: "pips", priceDecimals: 5 };
    }

    if (type === "jpy") {
      return { pipSize: 0.01, pipValuePerLot: 10, label: "pips", priceDecimals: 3 };
    }

    if (type === "gold") {
      return { pipSize: 1, pipValuePerLot: 100, label: "points", priceDecimals: 2 };
    }

    if (type === "silver") {
      return { pipSize: 0.002, pipValuePerLot: 10, label: "points / pips", priceDecimals: 3 };
    }

    if (type === "indices") {
      return { pipSize: 1, pipValuePerLot: 10, label: "points / pips", priceDecimals: 2 };
    }

    return { pipSize: 0.0001, pipValuePerLot: 10, label: "pips", priceDecimals: 5 };
  }

  const pairSettings = getPairSettings(pairType);

  function money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function number(value) {
    return Number(value || 0).toFixed(2);
  }

  function price(value) {
    return Number(value || 0).toFixed(pairSettings.priceDecimals);
  }

  function getDistance(priceOne, priceTwo) {
    return Math.abs(toNumber(priceOne) - toNumber(priceTwo)) / pairSettings.pipSize;
  }

  function calculateMoney(distance, lot) {
    return distance * pairSettings.pipValuePerLot * toNumber(lot);
  }

  function formatDistance(distance) {
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

  const riskIsNotPossible =
  minimumLotLoss > plannedRiskAmount;

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

  function getAccountLossPrice(optionLot) {
    const lossDistance =
      optionLot > 0 ? splitValue / (pairSettings.pipValuePerLot * optionLot) : 0;

    const priceDistance = lossDistance * pairSettings.pipSize;

    if (direction === "buy") {
      return toNumber(entryPrice) - priceDistance;
    }

    return toNumber(entryPrice) + priceDistance;
  }

  function getTakeProfitPrice(optionLot) {
    const tpDistance =
      optionLot > 0 ? toNumber(targetProfit) / (pairSettings.pipValuePerLot * optionLot) : 0;

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
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/execution-lab"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
          >
            Execution Lab
          </Link>

          <Link
            href="/"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Home
          </Link>
        </div>
      </nav>

      <section className="px-4 py-10 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-10">
            <p className="text-sm font-medium text-gray-700">Execution Lab</p>

            <h1 className="mt-3 text-3xl md:text-5xl">Risk Management</h1>

            <p className="mt-4 max-w-2xl text-sm text-gray-700 md:text-base">
              Choose your risk style, calculate your lot size, estimate your profit,
              and know your danger price before entering a trade.
            </p>

            <p className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
              Note: pip and point values can differ by broker. This version follows the
              broker logic we are currently testing.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <button onClick={() => setActiveModel("standard")} className={`rounded-lg px-4 py-3 text-sm font-medium ${activeModel === "standard" ? "bg-black text-white" : "bg-white text-gray-900"}`}>
              Standard Risk
            </button>

            <button onClick={() => setActiveModel("split")} className={`rounded-lg px-4 py-3 text-sm font-medium ${activeModel === "split" ? "bg-black text-white" : "bg-white text-gray-900"}`}>
              Split Account
            </button>

            <button onClick={() => setActiveModel("fixed")} className={`rounded-lg px-4 py-3 text-sm font-medium ${activeModel === "fixed" ? "bg-black text-white" : "bg-white text-gray-900"}`}>
              Fixed Lot
            </button>

            <button onClick={() => setActiveModel("cumulative")} className={`rounded-lg px-4 py-3 text-sm font-medium ${activeModel === "cumulative" ? "bg-black text-white" : "bg-white text-gray-900"}`}>
              Cumulative
            </button>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="app-card-title text-xl">Account Setup</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Account Balance</label>
                <input value={balance} onChange={(event) => setBalance(event.target.value)} type="number" placeholder="5000" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              {activeModel !== "cumulative" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Pair / Asset Type</label>
                    <select value={pairType} onChange={(event) => setPairType(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      <option value="forex">Forex Normal Pair</option>
                      <option value="jpy">JPY Pair</option>
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                      <option value="indices">Indices</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Direction</label>
                    <select value={direction} onChange={(event) => setDirection(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Entry Price</label>
                    <input value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} type="number" placeholder="1.25000 / 2350.00" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                </>
              )}
            </div>
          </div>

          {activeModel === "standard" && (
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="app-card-title text-xl">Standard Risk Model</h2>

              <p className="mt-2 text-sm text-gray-700">
                Use this when you know the percentage of your account you want to risk,
                and you want the app to calculate your lot size.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <input value={riskPercent} onChange={(event) => setRiskPercent(event.target.value)} type="number" placeholder="Risk % e.g. 2" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} type="number" placeholder="Stop Loss Price" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} type="number" placeholder="Take Profit Price" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              {riskIsNotPossible && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  Warning: This risk setting is not possible with this stop loss distance.
                  The calculated lot size is below 0.01. At the minimum lot size of 0.01,
                  this trade would risk {money(minimumLotLoss)}, which is{" "}
                  {number(minimumLotLossPercent)}% of your account. Reduce the stop loss
                  distance, increase your account balance, or accept a higher risk.
                </p>
              )}

              <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
                <p>Lot Size: {number(standardLotToUse)}</p>
                <br />
                <p>Planned Risk Amount: {money(plannedRiskAmount)}</p>
                <p>Stop Loss Distance: {formatDistance(standardSlDistance)}</p>
                <p>Potential Loss: {number(minimumLotLossPercent)}%</p>
                <br />
                <p>Take Profit Distance: {formatDistance(standardTpDistance)}</p>
                <p>Potential Profit: {money(standardProfit)}</p>
                <p>Potential Gain: {number(standardProfitPercent)}%</p>

              </div>
            </div>
          )}

          {activeModel === "split" && (
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="app-card-title text-xl">Split Account Model</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <input value={splitCount} onChange={(event) => setSplitCount(event.target.value)} type="number" placeholder="Split into how many parts? e.g. 10" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={targetProfit} onChange={(event) => setTargetProfit(event.target.value)} type="number" placeholder="Target profit amount e.g. 30" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={customSplitLot} onChange={(event) => setCustomSplitLot(event.target.value)} type="number" placeholder="Custom lot size e.g. 0.25" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
                <p>Total Balance: {money(balance)}</p>
                <p>Split Count: {splitCount || 0}</p>
                <p>Each Split Account: {money(splitValue)}</p>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2">Lot Type</th>
                      <th className="py-2">Lot Size</th>
                      <th className="py-2">Account Loss Distance</th>
                      <th className="py-2">Account Loss Price</th>
                      <th className="py-2">TP Distance</th>
                      <th className="py-2">TP Price</th>
                    </tr>
                  </thead>

                  <tbody>
                    {splitLotOptions.map((option) => {
                      const optionLot = option.value;

                      const lossDistance =
                        optionLot > 0
                          ? splitValue / (pairSettings.pipValuePerLot * optionLot)
                          : 0;

                      const tpDistance =
                        optionLot > 0
                          ? toNumber(targetProfit) / (pairSettings.pipValuePerLot * optionLot)
                          : 0;

                      return (
                        <tr key={option.label} className="border-b">
                          <td className="py-2">{option.label}</td>
                          <td className="py-2">{optionLot > 0 ? optionLot : "-"}</td>
                          <td className="py-2">{optionLot > 0 ? formatDistance(lossDistance) : "-"}</td>
                          <td className="py-2">{optionLot > 0 ? price(getAccountLossPrice(optionLot)) : "-"}</td>
                          <td className="py-2">{optionLot > 0 ? formatDistance(tpDistance) : "-"}</td>
                          <td className="py-2">{optionLot > 0 ? price(getTakeProfitPrice(optionLot)) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeModel === "fixed" && (
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="app-card-title text-xl">Fixed Lot Size Model</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <input value={lotSize} onChange={(event) => setLotSize(event.target.value)} type="number" placeholder="Lot Size e.g. 0.10" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} type="number" placeholder="Stop Loss Price" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} type="number" placeholder="Take Profit Price" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
                <p>Stop Loss Distance: {formatDistance(fixedSlDistance)}</p>
                <p>Take Profit Distance: {formatDistance(fixedTpDistance)}</p>
                <p>Potential Loss: {money(fixedLoss)}</p>
                <p>Potential Profit: {money(fixedProfit)}</p>
                <p>Loss Percentage: {number(fixedLossPercent)}%</p>
                <p>Profit Percentage: {number(fixedProfitPercent)}%</p>
                <p>Risk-to-Reward: 1:{number(fixedRiskReward)}</p>
              </div>
            </div>
          )}

          {activeModel === "cumulative" && (
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="app-card-title text-xl">Cumulative / Compounding Model</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <input value={riskPercent} onChange={(event) => setRiskPercent(event.target.value)} type="number" placeholder="Risk %" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={rewardRatio} onChange={(event) => setRewardRatio(event.target.value)} type="number" placeholder="Reward Ratio e.g. 2" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={winRate} onChange={(event) => setWinRate(event.target.value)} type="number" placeholder="Win Rate % e.g. 50" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={numberOfTrades} onChange={(event) => setNumberOfTrades(event.target.value)} type="number" placeholder="Number of Trades" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
                <p>Starting Balance: {money(balance)}</p>
                <p>Estimated Winning Trades: {compoundingResult.estimatedWins}</p>
                <p>Estimated Losing Trades: {compoundingResult.estimatedLosses}</p>
                <p>Final Projected Balance: {money(compoundingResult.finalBalance)}</p>
                <p>Estimated Profit / Loss: {money(compoundingResult.totalProfitLoss)}</p>
                <p>Total Return: {number(compoundingResult.totalReturn)}%</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
