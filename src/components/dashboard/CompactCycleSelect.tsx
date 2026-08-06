"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CompactCycleOption<T extends string> = {
  value: T;
  label: string;
  shortLabel?: string;
  description?: string;
  icon?: ReactNode;
};

type CompactCycleSelectProps<T extends string> = {
  label: string;
  value: T;
  options: CompactCycleOption<T>[];
  onChange: (value: T) => void;
  accent?: "yellow" | "cyan" | "violet" | "green";
  className?: string;
  disabled?: boolean;
  compact?: boolean;
  hideLabel?: boolean;
};

const accentClasses = {
  yellow: {
    hover: "hover:border-yellow-400 hover:text-yellow-300",
    focus: "focus-within:border-yellow-400",
    value: "text-yellow-300",
  },
  cyan: {
    hover: "hover:border-cyan-400 hover:text-cyan-300",
    focus: "focus-within:border-cyan-400",
    value: "text-cyan-300",
  },
  violet: {
    hover: "hover:border-violet-400 hover:text-violet-300",
    focus: "focus-within:border-violet-400",
    value: "text-violet-300",
  },
  green: {
    hover: "hover:border-green-400 hover:text-green-300",
    focus: "focus-within:border-green-400",
    value: "text-green-300",
  },
} as const;

export default function CompactCycleSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  accent = "yellow",
  className = "",
  disabled = false,
  compact = false,
  hideLabel = false,
}: CompactCycleSelectProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[selectedIndex] ?? options[0];

  const changeBy = (direction: -1 | 1) => {
    if (disabled || options.length === 0) {
      return;
    }

    const nextIndex =
      (selectedIndex + direction + options.length) % options.length;
    const nextOption = options[nextIndex];

    if (nextOption) {
      onChange(nextOption.value);
    }
  };

  const classes = accentClasses[accent];
  const description =
    selectedOption?.description ??
    `${label}: ${selectedOption?.label ?? value}`;

  return (
    <div
      className={`group relative min-w-0 ${className}`}
      title={description}
    >
      {!hideLabel ? (
        <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
          {label}
        </span>
      ) : null}

      <span
        className={`grid overflow-hidden border border-gray-800 bg-black transition ${classes.focus} ${
          compact
            ? "grid-cols-[26px_minmax(34px,1fr)_26px]"
            : "grid-cols-[36px_minmax(0,1fr)_36px]"
        }`}
      >
        <button
          type="button"
          onClick={() => changeBy(-1)}
          disabled={disabled || options.length < 2}
          aria-label={`Previous ${label}`}
          className={`flex items-center justify-center border-r border-gray-800 text-gray-500 transition ${classes.hover} disabled:cursor-not-allowed disabled:text-gray-800 ${
            compact ? "min-h-8" : "min-h-9"
          }`}
        >
          <ChevronLeft className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>

        <span
          className={`relative flex min-w-0 items-center justify-center gap-1 bg-black font-mono font-black ${classes.value} ${
            compact ? "min-h-8 px-1 text-[11px]" : "min-h-9 px-2 text-xs"
          }`}
        >
          {selectedOption?.icon ? (
            <span className="flex shrink-0 items-center justify-center" aria-hidden="true">
              {selectedOption.icon}
            </span>
          ) : null}
          {selectedOption?.shortLabel !== "" ? (
            <span className="truncate">
              {selectedOption?.shortLabel ?? selectedOption?.label ?? value}
            </span>
          ) : null}

          <select
            value={value}
            onChange={(event) => onChange(event.target.value as T)}
            disabled={disabled}
            aria-label={label}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </span>

        <button
          type="button"
          onClick={() => changeBy(1)}
          disabled={disabled || options.length < 2}
          aria-label={`Next ${label}`}
          className={`flex items-center justify-center border-l border-gray-800 text-gray-500 transition ${classes.hover} disabled:cursor-not-allowed disabled:text-gray-800 ${
            compact ? "min-h-8" : "min-h-9"
          }`}
        >
          <ChevronRight className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
      </span>

      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-56 -translate-x-1/2 border border-gray-700 bg-[#050505] px-2 py-1.5 text-center text-[10px] leading-snug text-gray-300 shadow-xl group-hover:block group-focus-within:block">
        {description}
      </span>
    </div>
  );
}