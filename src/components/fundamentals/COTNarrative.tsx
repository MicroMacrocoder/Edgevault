"use client";

import { useMemo } from "react";
import type { COTReport } from "@/types/cot";
import type { VolumeOIReport } from "@/types/volumeOi";

type NarrativeProps = {
  cotReports: COTReport[];
  volumeReports: VolumeOIReport[];
  symbol: string;
};

type NarrativeInsight = {
  title: string;
  description: string;
  signal: "bullish" | "bearish" | "neutral" | "warning";
  confidence: "high" | "medium" | "low";
};

function getSignalColor(signal: string) {
  if (signal === "bullish") return "text-emerald-400";
  if (signal === "bearish") return "text-red-400";
  if (signal === "warning") return "text-yellow-400";
  return "text-gray-400";
}

function getSignalBg(signal: string) {
  if (signal === "bullish") return "bg-emerald-500/10 border-emerald-500/30";
  if (signal === "bearish") return "bg-red-500/10 border-red-500/30";
  if (signal === "warning") return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-gray-800/50 border-gray-700";
}

function getConfidenceDots(confidence: string) {
  if (confidence === "high") return "●●●";
  if (confidence === "medium") return "●●○";
  return "●○○";
}

function formatNum(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function COTNarrative({
  cotReports,
  volumeReports,
  symbol,
}: NarrativeProps) {
  const narrative = useMemo<{
    summary: string;
    insights: NarrativeInsight[];
    hedgingProgram: string;
    marketBias: "bullish" | "bearish" | "neutral";
  }>(() => {
    if (cotReports.length < 3) {
      return {
        summary: "Insufficient data to generate narrative. Need at least 3 COT reports.",
        insights: [],
        hedgingProgram: "Unable to determine — not enough historical data.",
        marketBias: "neutral",
      };
    }

    const latest = cotReports[cotReports.length - 1];
    const prev = cotReports[cotReports.length - 2];
    const prev2 = cotReports[cotReports.length - 3];

    // COT Changes
    const commercialNetChange = latest.commercial_net - prev.commercial_net;
    const commercialNetChange2 = prev.commercial_net - prev2.commercial_net;
    const noncommercialNetChange = latest.noncommercial_net - prev.noncommercial_net;
    const oiChange = latest.open_interest - prev.open_interest;
    const oiChangePercent = prev.open_interest === 0 ? 0 : (oiChange / prev.open_interest) * 100;

    // Volume/OI data (if available)
    const latestVolume = volumeReports.length > 0 ? volumeReports[volumeReports.length - 1] : null;
    const prevVolume = volumeReports.length > 1 ? volumeReports[volumeReports.length - 2] : null;

    const volumeChange = latestVolume && prevVolume
      ? latestVolume.volume - prevVolume.volume
      : 0;
    const volumeOiChange = latestVolume && prevVolume
      ? latestVolume.open_interest - prevVolume.open_interest
      : 0;

    const insights: NarrativeInsight[] = [];

    // === INSIGHT 1: Commercial Hedging Program ===
    const commercialTrend = commercialNetChange > 0 && commercialNetChange2 > 0
      ? "accumulating"
      : commercialNetChange < 0 && commercialNetChange2 < 0
      ? "distributing"
      : "mixed";

    if (commercialTrend === "accumulating") {
      insights.push({
        title: "Commercials Accumulating Long Positions",
        description: `Commercials have increased net longs for 2 consecutive weeks (+${formatNum(commercialNetChange)} this week, +${formatNum(commercialNetChange2)} prior). This hedging pattern typically indicates commercials are protecting against upside risk — they expect the underlying to strengthen.`,
        signal: "bullish",
        confidence: Math.abs(commercialNetChange) > 5000 ? "high" : "medium",
      });
    } else if (commercialTrend === "distributing") {
      insights.push({
        title: "Commercials Reducing Long Exposure",
        description: `Commercials have decreased net positions for 2 consecutive weeks (${formatNum(commercialNetChange)} this week, ${formatNum(commercialNetChange2)} prior). This suggests commercials are unwinding hedges — they may expect the underlying to weaken.`,
        signal: "bearish",
        confidence: Math.abs(commercialNetChange) > 5000 ? "high" : "medium",
      });
    } else {
      insights.push({
        title: "Commercial Positioning Mixed",
        description: `Commercials show no clear directional trend in their hedging program. Net change this week: ${commercialNetChange > 0 ? "+" : ""}${formatNum(commercialNetChange)}. Previous week: ${commercialNetChange2 > 0 ? "+" : ""}${formatNum(commercialNetChange2)}.`,
        signal: "neutral",
        confidence: "low",
      });
    }

    // === INSIGHT 2: Volume + OI Interpretation ===
    if (latestVolume && prevVolume) {
      const volUp = volumeChange > 0;
      const oiUp = volumeOiChange > 0;

      if (volUp && oiUp) {
        insights.push({
          title: "New Money Entering Market",
          description: `Volume increasing (+${formatNum(volumeChange)}) combined with rising open interest (+${formatNum(volumeOiChange)}) indicates new positions being established. This confirms directional conviction — the current trend is being supported by fresh capital.`,
          signal: noncommercialNetChange > 0 ? "bullish" : "bearish",
          confidence: "high",
        });
      } else if (volUp && !oiUp) {
        insights.push({
          title: "Liquidation / Position Closing",
          description: `Volume is increasing (+${formatNum(volumeChange)}) but open interest is declining (${formatNum(volumeOiChange)}). This indicates existing positions are being closed — traders are taking profits or cutting losses. The current move may be exhausting.`,
          signal: "warning",
          confidence: "medium",
        });
      } else if (!volUp && oiUp) {
        insights.push({
          title: "Quiet Accumulation",
          description: `Volume is declining (${formatNum(volumeChange)}) while open interest rises (+${formatNum(volumeOiChange)}). New positions are being built quietly without aggressive participation. Watch for a breakout as these positions will need to be resolved.`,
          signal: "neutral",
          confidence: "medium",
        });
      } else {
        insights.push({
          title: "Market Contraction",
          description: `Both volume (${formatNum(volumeChange)}) and open interest (${formatNum(volumeOiChange)}) are declining. The market is contracting — participants are leaving. Expect reduced volatility and potential range-bound conditions until new catalysts emerge.`,
          signal: "neutral",
          confidence: "medium",
        });
      }
    }

    // === INSIGHT 3: Non-Commercial (Speculator) Positioning ===
    const specBias = latest.noncommercial_net > 0 ? "net long" : "net short";
    const specExtreme = Math.abs(latest.noncommercial_net) > 50000;

    if (specExtreme) {
      insights.push({
        title: `Speculator Positioning at Extreme (${specBias})`,
        description: `Non-commercials hold ${formatNum(latest.noncommercial_net)} contracts net. Extreme speculator positioning often precedes reversals — when the crowd is heavily one-sided, the market tends to move against them. Consider contrarian signals.`,
        signal: latest.noncommercial_net > 0 ? "warning" : "warning",
        confidence: "medium",
      });
    } else {
      insights.push({
        title: `Speculators ${specBias.toUpperCase()} (${formatNum(latest.noncommercial_net)})`,
        description: `Non-commercial traders changed by ${noncommercialNetChange > 0 ? "+" : ""}${formatNum(noncommercialNetChange)} contracts this week. ${noncommercialNetChange > 0 ? "Speculators are adding longs — bullish sentiment growing." : noncommercialNetChange < 0 ? "Speculators are adding shorts — bearish sentiment growing." : "No significant change in speculator sentiment."}`,
        signal: noncommercialNetChange > 0 ? "bullish" : noncommercialNetChange < 0 ? "bearish" : "neutral",
        confidence: Math.abs(noncommercialNetChange) > 3000 ? "medium" : "low",
      });
    }

    // === INSIGHT 4: Open Interest Trend ===
    if (Math.abs(oiChangePercent) > 3) {
      insights.push({
        title: `Open Interest ${oiChange > 0 ? "Expanding" : "Contracting"} (${oiChangePercent.toFixed(1)}%)`,
        description: `Total open interest moved from ${formatNum(prev.open_interest)} to ${formatNum(latest.open_interest)} (${oiChange > 0 ? "+" : ""}${formatNum(oiChange)}). ${oiChange > 0 ? "Expanding OI with price movement confirms trend strength." : "Contracting OI suggests the current trend is losing participation and may reverse."}`,
        signal: oiChange > 0 ? (noncommercialNetChange > 0 ? "bullish" : "bearish") : "warning",
        confidence: Math.abs(oiChangePercent) > 5 ? "high" : "medium",
      });
    }

    // === Generate Summary ===
    const bullishCount = insights.filter((i) => i.signal === "bullish").length;
    const bearishCount = insights.filter((i) => i.signal === "bearish").length;
    const marketBias: "bullish" | "bearish" | "neutral" =
      bullishCount > bearishCount ? "bullish" : bearishCount > bullishCount ? "bearish" : "neutral";

    // === Hedging Program Narrative ===
    let hedgingProgram: string;
    if (latest.commercial_net > 0) {
      hedgingProgram = `Commercials are NET LONG ${formatNum(latest.commercial_net)} contracts. They are hedging against upside risk — their physical/business exposure is short the underlying, so they buy futures to protect. This is typically a bullish signal for the currency.`;
    } else {
      hedgingProgram = `Commercials are NET SHORT ${formatNum(Math.abs(latest.commercial_net))} contracts. They are hedging against downside risk — their physical/business exposure is long the underlying, so they sell futures to protect. This is typically a bearish signal for the currency.`;
    }

    const summary = `${symbol} COT Analysis (Report: ${latest.report_date}): The market shows ${marketBias} bias based on ${insights.length} signals. Commercials are ${commercialTrend} (${latest.commercial_net > 0 ? "net long" : "net short"} ${formatNum(Math.abs(latest.commercial_net))}), speculators are ${specBias} (${formatNum(latest.noncommercial_net)}), and open interest ${oiChange > 0 ? "expanded" : "contracted"} by ${oiChangePercent.toFixed(1)}%.`;

    return { summary, insights, hedgingProgram, marketBias };
  }, [cotReports, volumeReports, symbol]);

  if (cotReports.length < 3) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
        <p className="font-mono text-sm text-gray-400">
          Need at least 3 COT reports to generate narrative analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overall Bias Badge */}
      <div className="rounded-2xl border border-gray-800 bg-[#050505] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-yellow-400">
              COT Narrative Engine
            </p>
            <h3 className="font-mono text-2xl font-bold text-white">
              Market Intelligence Summary
            </h3>
            <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-gray-400">
              {narrative.summary}
            </p>
          </div>

          <div
            className={`shrink-0 rounded-xl border px-5 py-3 text-center ${
              narrative.marketBias === "bullish"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : narrative.marketBias === "bearish"
                ? "border-red-500/40 bg-red-500/10"
                : "border-gray-700 bg-gray-800/50"
            }`}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Overall Bias
            </p>
            <p
              className={`mt-1 font-mono text-lg font-bold uppercase ${
                narrative.marketBias === "bullish"
                  ? "text-emerald-400"
                  : narrative.marketBias === "bearish"
                  ? "text-red-400"
                  : "text-gray-300"
              }`}
            >
              {narrative.marketBias}
            </p>
          </div>
        </div>
      </div>

      {/* Commercial Hedging Program */}
      <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
        <h4 className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-yellow-400">
          Commercial Hedging Program
        </h4>
        <p className="font-mono text-sm leading-relaxed text-gray-300">
          {narrative.hedgingProgram}
        </p>
      </div>

      {/* Insights Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {narrative.insights.map((insight, index) => (
          <div
            key={index}
            className={`rounded-2xl border p-5 ${getSignalBg(insight.signal)}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span
                className={`font-mono text-xs font-bold uppercase ${getSignalColor(
                  insight.signal
                )}`}
              >
                {insight.signal}
              </span>
              <span className="font-mono text-xs text-gray-500">
                Confidence: {getConfidenceDots(insight.confidence)}
              </span>
            </div>

            <h4 className="mb-2 font-mono text-sm font-bold text-white">
              {insight.title}
            </h4>

            <p className="font-mono text-xs leading-relaxed text-gray-400">
              {insight.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
