"use client";

import { Search } from "lucide-react";
import clsx from "clsx";

export type FilterType = "all" | "long" | "short";

interface Props {
  filter:    FilterType;
  onFilter:  (f: FilterType) => void;
  search:    string;
  onSearch:  (v: string) => void;
  count:     number;
}

export function FilterBar({ filter, onFilter, search, onSearch, count }: Props) {
  const tabs: { key: FilterType; label: string; color: string }[] = [
    { key: "all",   label: "All",   color: "text-neutral-300" },
    { key: "long",  label: "Long",  color: "text-bull" },
    { key: "short", label: "Short", color: "text-bear" },
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

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => onFilter(key)}
            className={clsx(
              "flex-1 rounded py-1 text-xs font-medium transition-colors",
              filter === key
                ? key === "long"
                  ? "bg-bull/20 text-bull"
                  : key === "short"
                  ? "bg-bear/20 text-bear"
                  : "bg-neutral-700 text-neutral-200"
                : `${color} bg-bg-primary hover:bg-bg-hover`
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
