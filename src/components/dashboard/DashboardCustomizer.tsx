"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  X,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";

export type DashboardWidgetId =
  | "performance"
  | "cot"
  | "news"
  | "currency-strength"
  | "journal"
  | "trade-log"
  | "quick-actions"
  | "watchlist"
  | "performance-calendar";

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  label: string;
  description: string;
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: "performance",
    label: "Performance Overview",
    description: "Equity curve, total return, and net profit",
    visible: true,
    order: 0,
  },
  {
    id: "cot",
    label: "COT Analysis",
    description: "Commitment of Traders chart with market selector",
    visible: true,
    order: 1,
  },
  {
    id: "news",
    label: "Economic Calendar",
    description: "Upcoming and recent economic events",
    visible: true,
    order: 2,
  },
  {
    id: "currency-strength",
    label: "Currency Strength",
    description: "Relative strength of major currencies from futures",
    visible: true,
    order: 3,
  },
  {
    id: "journal",
    label: "Journal Preview",
    description: "Recent journal entries and analysis",
    visible: true,
    order: 4,
  },
  {
    id: "trade-log",
    label: "Trade Log Preview",
    description: "Recent trade logs and templates",
    visible: true,
    order: 5,
  },
  {
    id: "watchlist",
    label: "Watchlist",
    description: "Fundamental data summary for watched pairs",
    visible: true,
    order: 6,
  },
  {
    id: "performance-calendar",
    label: "Performance Calendar",
    description: "Calendar view of winning/losing trade days",
    visible: true,
    order: 7,
  },
  {
    id: "quick-actions",
    label: "Quick Actions",
    description: "Shortcut cards to key features",
    visible: true,
    order: 8,
  },
];

const STORAGE_KEY = "edgevault_dashboard_widgets";

export function loadWidgetPreferences(): DashboardWidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const saved: DashboardWidgetConfig[] = JSON.parse(raw);
    // Merge with defaults to handle new widgets added in updates
    const merged = DEFAULT_WIDGETS.map((defaultWidget) => {
      const savedWidget = saved.find((s) => s.id === defaultWidget.id);
      if (savedWidget) return { ...defaultWidget, visible: savedWidget.visible, order: savedWidget.order };
      return defaultWidget;
    });
    return merged.sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_WIDGETS;
  }
}

export function saveWidgetPreferences(widgets: DashboardWidgetConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch {}
}

export function getVisibleWidgets(widgets: DashboardWidgetConfig[]): DashboardWidgetId[] {
  return widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order)
    .map((w) => w.id);
}

interface DashboardCustomizerProps {
  widgets: DashboardWidgetConfig[];
  onUpdate: (widgets: DashboardWidgetConfig[]) => void;
}

export default function DashboardCustomizer({
  widgets,
  onUpdate,
}: DashboardCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);

  function toggleVisibility(id: DashboardWidgetId) {
    const updated = widgets.map((w) =>
      w.id === id ? { ...w, visible: !w.visible } : w
    );
    onUpdate(updated);
    saveWidgetPreferences(updated);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const updated = [...widgets];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    const reordered = updated.map((w, i) => ({ ...w, order: i }));
    onUpdate(reordered);
    saveWidgetPreferences(reordered);
  }

  function moveDown(index: number) {
    if (index === widgets.length - 1) return;
    const updated = [...widgets];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    const reordered = updated.map((w, i) => ({ ...w, order: i }));
    onUpdate(reordered);
    saveWidgetPreferences(reordered);
  }

  function resetToDefaults() {
    onUpdate(DEFAULT_WIDGETS);
    saveWidgetPreferences(DEFAULT_WIDGETS);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#111111] px-4 py-2 font-mono text-xs uppercase tracking-wider text-gray-400 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        <Settings className="h-3.5 w-3.5" />
        Customize Dashboard
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
            Customize Dashboard
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Toggle widgets and reorder them to suit your workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1.5 rounded border border-gray-700 px-3 py-1.5 font-mono text-[10px] uppercase text-gray-400 transition hover:border-yellow-400 hover:text-yellow-400"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-700 text-gray-400 transition hover:border-yellow-400 hover:text-yellow-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {widgets.map((widget, index) => (
          <div
            key={widget.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition ${
              widget.visible
                ? "border-gray-700 bg-black"
                : "border-gray-800/50 bg-black/50 opacity-60"
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => moveUp(index)}
                className="text-gray-600 hover:text-yellow-400 transition"
                disabled={index === 0}
              >
                <GripVertical className="h-3 w-3 rotate-90" />
              </button>
              <button
                onClick={() => moveDown(index)}
                className="text-gray-600 hover:text-yellow-400 transition"
                disabled={index === widgets.length - 1}
              >
                <GripVertical className="h-3 w-3 -rotate-90" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-semibold text-white">
                {widget.label}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {widget.description}
              </p>
            </div>

            <button
              onClick={() => toggleVisibility(widget.id)}
              className={`flex h-8 w-8 items-center justify-center rounded transition ${
                widget.visible
                  ? "text-green-400 hover:text-red-400"
                  : "text-gray-600 hover:text-green-400"
              }`}
            >
              {widget.visible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
