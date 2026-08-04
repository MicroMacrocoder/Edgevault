"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, ShieldCheck } from "lucide-react";

type EconomicCalendarProps = {
  compact?: boolean;
};

export default function EconomicCalendar({
  compact = false,
}: EconomicCalendarProps) {
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  const widgetHeight = compact ? 360 : 650;

  useEffect(() => {
    const container = widgetContainerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    const widgetArea = document.createElement("div");
    widgetArea.className =
      "tradingview-widget-container__widget w-full";
    widgetArea.style.minHeight = `${widgetHeight}px`;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;

    script.innerHTML = JSON.stringify({
      colorTheme: "dark",
      isTransparent: true,
      width: "100%",
      height: widgetHeight,
      locale: "en",
      countryFilter: "us,eu,gb,jp,ca,ch,au,nz",
      importanceFilter: "-1,0,1",
    });

    container.appendChild(widgetArea);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [widgetHeight]);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact ? (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-800 bg-[#111111] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-mono text-sm font-bold text-white">
                Global Economic Calendar
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Track upcoming economic events, forecasts, previous values,
                actual releases, affected markets, and event importance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-green-400">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-mono">Live calendar active</span>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0a0a0a]">
        <div
          ref={widgetContainerRef}
          className="tradingview-widget-container w-full"
          style={{ minHeight: widgetHeight }}
        />

        <div className="border-t border-gray-800 bg-black px-4 py-2 text-center">
          <a
            href="https://www.tradingview.com/economic-calendar/"
            rel="noopener nofollow"
            target="_blank"
            className="font-mono text-[10px] text-gray-500 transition hover:text-cyan-400"
          >
            Economic Calendar powered by TradingView
          </a>
        </div>
      </div>
    </div>
  );
}