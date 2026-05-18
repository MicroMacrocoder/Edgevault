"use client";

import { useMemo, useState } from "react";

type Direction = "buy" | "sell";

type PairSymbol =
  | "EURUSD"
  | "GBPUSD"
  | "AUDUSD"
  | "NZDUSD"
  | "USDCHF"
  | "USDCAD"
  | "USDJPY"
  | "XAUUSD"
  | "XAGUSD"
  | "US30";

type PairSettings = {
  label: string;
  pipValuePerLot: number;
  pipLabel: string;
  placeholder: string;
};

type ExposureEntry = {
  id: number;
  pair: PairSymbol;
  direction: Direction;
  entryPrice: string;
  lotSize: string;
};

const PAIRS: PairSymbol[] = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCHF",
  "USDCAD",
  "USDJPY",
  "XAUUSD",
  "XAGUSD",
  "US30",
];

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

function getPairSettings(pair: PairSymbol): PairSettings {
  if (pair === "USDJPY") {
    return {
      label: "JPY Pair",
      pipValuePerLot: 10,
      pipLabel: "pips",
      placeholder: "155.000",
    };
  }

  if (pair === "XAUUSD") {
    return {
      label: "Gold",
      pipValuePerLot: 100,
      pipLabel: "points",
      placeholder: "2350.00",
    };
  }

  if (pair === "XAGUSD") {
    return {
      label: "Silver",
      pipValuePerLot: 10,
      pipLabel: "points / pips",
      placeholder: "30.000",
    };
  }

  if (pair === "US30") {
    return {
      label: "Index",
      pipValuePerLot: 10,
      pipLabel: "points",
      placeholder: "39000",
    };
  }

  return {
    label: "Forex Major",
    pipValuePerLot: 10,
    pipLabel: "pips",
    placeholder: "1.08500",
  };
}

function toNumber(value: string | number) {
  return Number(value) || 0;
}

function money(value: number | string) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function number(value: number | string) {
  return Number(value || 0).toFixed(2);
}

export default function RiskManagementWorkspace() {
  const [balance, setBalance] = useState("");
  const [riskPercent, setRiskPercent] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [maxEntries, setMaxEntries] = useState("20");

  const [entries, setEntries] = useState<ExposureEntry[]>([
    {
      id: 1,
      pair: "EURUSD",
      direction: "buy",
      entryPrice: "",
      lotSize: "",
    },
  ]);

  function updateEntry(
    id: number,
    field: keyof Omit<ExposureEntry, "id">,
    value: string
  ) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [field]: value,
            }
          : entry
      )
    );
  }

  function addEntry() {
    setEntries((currentEntries) => {
      const maxAllowed = Math.max(1, Math.floor(toNumber(maxEntries)));

      if (currentEntries.length >= maxAllowed) {
        return currentEntries;
      }

      const nextId =
        currentEntries.length > 0
          ? Math.max(...currentEntries.map((entry) => entry.id)) + 1
          : 1;

      return [
        ...currentEntries,
        {
          id: nextId,
          pair: "EURUSD",
          direction: "buy",
          entryPrice: "",
          lotSize: "",
        },
      ];
    });
  }

  function removeEntry(id: number) {
    setEntries((currentEntries) => {
      if (currentEntries.length === 1) {
        return currentEntries;
      }

      return currentEntries.filter((entry) => entry.id !== id);
    });
  }

  const exposureResult = useMemo(() => {
    const accountBalance = toNumber(balance);
    const riskBucket = accountBalance * (toNumber(riskPercent) / 100);
    const targetProfit = toNumber(targetAmount);
    const targetEquity = accountBalance + targetProfit;

    const validEntries = entries
      .map((entry) => {
        const pairSettings = getPairSettings(entry.pair);
        const lotSize = toNumber(entry.lotSize);
        const entryPrice = toNumber(entry.entryPrice);
        const pipValue = lotSize * pairSettings.pipValuePerLot;

        return {
          ...entry,
          lotSize,
          entryPrice,
          pairLabel: pairSettings.label,
          pipLabel: pairSettings.pipLabel,
          pipValue,
        };
      })
      .filter((entry) => entry.lotSize > 0);

    const totalLotSize = validEntries.reduce(
      (sum, entry) => sum + entry.lotSize,
      0
    );

    const combinedPipValue = validEntries.reduce(
      (sum, entry) => sum + entry.pipValue,
      0
    );

    const distanceToDanger =
      combinedPipValue > 0 ? riskBucket / combinedPipValue : 0;

    const distanceToTarget =
      combinedPipValue > 0 ? targetProfit / combinedPipValue : 0;

    const riskUsedPercent =
      accountBalance > 0 ? (riskBucket / accountBalance) * 100 : 0;

    const targetReturnPercent =
      accountBalance > 0 ? (targetProfit / accountBalance) * 100 : 0;

    const maxAllowedEntries = Math.max(1, Math.floor(toNumber(maxEntries)));

    const entryUsagePercent =
      maxAllowedEntries > 0
        ? (validEntries.length / maxAllowedEntries) * 100
        : 0;

    const pairBreakdown = PAIRS.map((pair) => {
      const pairEntries = validEntries.filter((entry) => entry.pair === pair);
      const settings = getPairSettings(pair);

      const pairLots = pairEntries.reduce(
        (sum, entry) => sum + entry.lotSize,
        0
      );

      const pairPipValue = pairEntries.reduce(
        (sum, entry) => sum + entry.pipValue,
        0
      );

      return {
        pair,
        label: settings.label,
        pipLabel: settings.pipLabel,
        entries: pairEntries.length,
        totalLots: pairLots,
        pipValue: pairPipValue,
        buyEntries: pairEntries.filter((entry) => entry.direction === "buy")
          .length,
        sellEntries: pairEntries.filter((entry) => entry.direction === "sell")
          .length,
      };
    }).filter((item) => item.entries > 0);

    return {
      accountBalance,
      riskBucket,
      targetProfit,
      targetEquity,
      validEntries,
      totalLotSize,
      combinedPipValue,
      distanceToDanger,
      distanceToTarget,
      riskUsedPercent,
      targetReturnPercent,
      maxAllowedEntries,
      entryUsagePercent,
      pairBreakdown,
    };
  }, [balance, entries, maxEntries, riskPercent, targetAmount]);

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
            Exposure Map
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            Plan risk from an already allocated account balance. Add multiple
            pairs, multiple directions, and multiple entries while EdgeVault
            calculates total exposure, combined pip value, distance to danger,
            and distance to target amount.
          </p>

          <p className="mt-5 max-w-3xl rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-relaxed text-yellow-300">
            Note: pip and point values can differ by broker. This version uses
            default testing values and should be validated against your broker
            before live execution.
          </p>
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="text-xl font-bold text-white">Core Trade Settings</h2>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Account Balance is your already allocated portfolio amount. Risk %
          controls how much of that balance you are willing to lose. Target
          Amount is the profit you want to make.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div>
            <FieldLabel>Account Balance</FieldLabel>
            <input
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              type="number"
              placeholder="25"
              className={inputClassName()}
            />
          </div>

          <div>
            <FieldLabel>Risk %</FieldLabel>
            <input
              value={riskPercent}
              onChange={(event) => setRiskPercent(event.target.value)}
              type="number"
              placeholder="50"
              className={inputClassName()}
            />
          </div>

          <div>
            <FieldLabel>Target Amount</FieldLabel>
            <input
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
              type="number"
              placeholder="100"
              className={inputClassName()}
            />
          </div>

          <div>
            <FieldLabel>Target Equity</FieldLabel>
            <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-bold text-emerald-300">
              {money(exposureResult.targetEquity)}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Portfolio Exposure Engine
            </p>

            <h2 className="mt-2 text-xl font-bold text-white">Exposure Map</h2>

            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              This section no longer uses portfolio allocation, leverage,
              volatility, weighted average entry, target price, or danger price.
              It focuses on account survival and profit distance using total lot
              size and combined pip value.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Entries: {exposureResult.validEntries.length}/
            {exposureResult.maxAllowedEntries}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
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

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Portfolio Size
            </p>
            <p className="mt-2 text-xl font-bold text-white">
              {money(exposureResult.accountBalance)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Risk Bucket
            </p>
            <p className="mt-2 text-xl font-bold text-red-400">
              {money(exposureResult.riskBucket)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Entries Used
            </p>
            <p className="mt-2 text-xl font-bold text-white">
              {exposureResult.validEntries.length}/
              {exposureResult.maxAllowedEntries}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Lot Size
            </p>
            <p className="mt-2 text-xl font-bold text-white">
              {number(exposureResult.totalLotSize)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Combined Pip Value
            </p>
            <p className="mt-2 text-xl font-bold text-white">
              {money(exposureResult.combinedPipValue)} / pip
            </p>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-red-300">
              Distance to Danger
            </p>
            <p className="mt-2 text-xl font-bold text-red-300">
              {number(exposureResult.distanceToDanger)} pips
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">
              Distance to Target Amount
            </p>
            <p className="mt-2 text-xl font-bold text-emerald-300">
              {number(exposureResult.distanceToTarget)} pips
            </p>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
              Target Equity
            </p>
            <p className="mt-2 text-xl font-bold text-cyan-300">
              {money(exposureResult.targetEquity)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
            <p className="font-bold text-white">Risk Meaning</p>
            <p>Account Balance: {money(exposureResult.accountBalance)}</p>
            <p>Risk Selected: {number(exposureResult.riskUsedPercent)}%</p>
            <p>Risk Bucket: {money(exposureResult.riskBucket)}</p>
            <p>
              Price needs to move about{" "}
              <span className="font-bold text-red-300">
                {number(exposureResult.distanceToDanger)} pips
              </span>{" "}
              against the combined exposure to consume the selected risk.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-7 text-slate-300">
            <p className="font-bold text-white">Target Meaning</p>
            <p>Target Amount: {money(exposureResult.targetProfit)}</p>
            <p>Target Equity: {money(exposureResult.targetEquity)}</p>
            <p>Target Return: {number(exposureResult.targetReturnPercent)}%</p>
            <p>
              Price needs to move about{" "}
              <span className="font-bold text-emerald-300">
                {number(exposureResult.distanceToTarget)} pips
              </span>{" "}
              in favor of the combined exposure to hit the target amount.
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Entry Builder</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Add entries across multiple pairs. Each entry has its own pair,
              direction, entry price, and lot size. Pip value is calculated per
              pair and added into the combined portfolio pip value.
            </p>
          </div>

          <button
            type="button"
            onClick={addEntry}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            + Add Entry
          </button>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Pair</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Entry Price</th>
                <th className="px-4 py-3">Lot Size</th>
                <th className="px-4 py-3">Pip Value</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800 text-slate-300">
              {entries.map((entry, index) => {
                const settings = getPairSettings(entry.pair);
                const rowLotSize = toNumber(entry.lotSize);
                const rowPipValue = rowLotSize * settings.pipValuePerLot;

                return (
                  <tr key={entry.id} className="hover:bg-slate-900/60">
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>

                    <td className="px-4 py-3">
                      <select
                        value={entry.pair}
                        onChange={(event) =>
                          updateEntry(
                            entry.id,
                            "pair",
                            event.target.value as PairSymbol
                          )
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                      >
                        {PAIRS.map((pair) => (
                          <option key={pair} value={pair}>
                            {pair}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3">{settings.label}</td>

                    <td className="px-4 py-3">
                      <select
                        value={entry.direction}
                        onChange={(event) =>
                          updateEntry(
                            entry.id,
                            "direction",
                            event.target.value as Direction
                          )
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                      >
                        <option value="buy">Buy</option>
                        <option value="sell">Sell</option>
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <input
                        value={entry.entryPrice}
                        onChange={(event) =>
                          updateEntry(entry.id, "entryPrice", event.target.value)
                        }
                        type="number"
                        placeholder={settings.placeholder}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        value={entry.lotSize}
                        onChange={(event) =>
                          updateEntry(entry.id, "lotSize", event.target.value)
                        }
                        type="number"
                        placeholder="0.01"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                      />
                    </td>

                    <td className="px-4 py-3">
                      {money(rowPipValue)} / {settings.pipLabel}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
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
      </Panel>

      <Panel className="p-6">
        <h3 className="text-xl font-bold text-white">Pair Breakdown</h3>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Each pair keeps its own pip value contribution, but the Exposure Map
          combines all entries into one portfolio-level pressure reading.
        </p>

        {exposureResult.pairBreakdown.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {exposureResult.pairBreakdown.map((item) => (
              <div
                key={item.pair}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </p>
                    <h4 className="mt-1 text-lg font-bold text-white">
                      {item.pair}
                    </h4>
                  </div>

                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {item.entries} entries
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <p>Total Lots: {number(item.totalLots)}</p>
                  <p>
                    Pip Value: {money(item.pipValue)} / {item.pipLabel}
                  </p>
                  <p>Buy Entries: {item.buyEntries}</p>
                  <p>Sell Entries: {item.sellEntries}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
            Add a lot size to at least one entry to see pair breakdown.
          </div>
        )}
      </Panel>
    </div>
  );
}
