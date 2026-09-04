"use client";

import clsx from "clsx";
import type { ScanStatus } from "@/types";

interface Props {
  status: ScanStatus;
}

export function ScanProgress({ status }: Props) {
  const pct = status.total > 0
    ? Math.round((status.progress / status.total) * 100)
    : 0;

  if (!status.running && !status.last_scan) return null;

  return (
    <div className="px-3 py-2 border-b border-bg-border">
      {status.running ? (
        <>
          <div className="flex justify-between text-xs text-neutral-500 mb-1">
            <span className="scan-pulse text-amber-400">Scanning…</span>
            <span className="text-amber-400">{pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          {status.current_symbol && (
            <div className="mt-1 text-[10px] text-neutral-500 truncate">
              {status.current_symbol}
            </div>
          )}
        </>
      ) : (
        <div className="flex justify-between text-[10px] text-neutral-600">
          <span>Last scan</span>
          <span>
            {status.last_scan
              ? new Date(status.last_scan).toLocaleTimeString()
              : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
