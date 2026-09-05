"use client";

import { Search } from "lucide-react";
import clsx from "clsx";

export type FilterType = "all" | "long" | "short" | "ema20" | "ema50";

interface Props {
  filter:    FilterType;
  onFilter:  (f: FilterType) => void;
  search:    string;
  onSearch:  (v: string) => void;
  count:     number;
}

export function FilterBar({ filter, onFilter, search, onSearch, count }: Props) {
  const rows: { key: FilterType; label: string; activeClass: string; idleClass: string }[][] = [
    [
      {
        key: "all",
        label: "All",
        activeClass: "bg-neutral-700 text-neutral-200",
        idleClass:   "text-neutral-300 bg-bg-primary hover:bg-bg-hover",
      },
      {
        key: "long",
        label: "Long",
        activeClass: "bg-bull/20 text-bull",
        idleClass:   "text-bull bg-bg-primary hover:bg-bg-hover",
      },
      {
        key: "short",
        label: "Short",
        activeClass: "bg-bear/20 text-bear",
        idleClass:   "text-bear bg-bg-primary hover:bg-bg-hover",
      },
    ],
    [
      {
        key: "ema20",
        label: "⟳ EMA 20",
        activeClass: "bg-accent-blue/20 text-accent-blue",
        idleClass:   "text-neutral-400 bg-bg-primary hover:bg-bg-hover",
      },
      {
        key: "ema50",
        label: "⟳ EMA 50",
        activeClass: "bg-purple-500/20 text-purple-400",
        idleClass:   "text-neutral-400 bg-bg-primary hover:bg-bg-hover",
      },
    ],
  ];

  return (
    <div className="px-3 py-2 border-b border-bg-border space-y-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
        <input
          type="text"
          placeholder="Search symbol…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded bg-bg-primary border border-bg-border
                     text-xs text-neutral-300 placeholder-neutral-600
                     focus:outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      {/* Row 1: All / Long / Short */}
      <div className="flex gap-1">
        {rows[0].map(({ key, label, activeClass, idleClass }) => (
          <button
            key={key}
            onClick={() => onFilter(key)}
            className={clsx(
              "flex-1 rounded py-1 text-xs font-medium transition-colors",
              filter === key ? activeClass : idleClass
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Row 2: EMA20 / EMA50 */}
      <div className="flex gap-1">
        {rows[1].map(({ key, label, activeClass, idleClass }) => (
          <button
            key={key}
            onClick={() => onFilter(filter === key ? "all" : key)}
            className={clsx(
              "flex-1 rounded py-1 text-xs font-medium transition-colors",
              filter === key ? activeClass : idleClass
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="text-[10px] text-neutral-600">
        {count} result{count !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
