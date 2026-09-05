"use client";

import { RefreshCw, Wifi, WifiOff, Activity, Play, Pause } from "lucide-react";
import clsx from "clsx";
import type { ScanStatus } from "@/types";

interface Props {
  status:         ScanStatus;
  connected:      boolean;
  onTrigger:      () => void;
  onToggleAuto:   () => void;
}

export function Header({ status, connected, onTrigger, onToggleAuto }: Props) {
  const autoOn = status.auto_scan ?? true;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-bg-border bg-bg-secondary">
      {/* Left – branding */}
      <div className="flex items-center gap-2.5">
        <Activity className="w-5 h-5 text-neutral-400" />
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">
            Crypto Futures Scanner
          </h1>
          <p className="text-[10px] text-neutral-600">
            SMA {status.config?.ma_fast ?? 20}/{status.config?.ma_slow ?? 50} · StochRSI · {status.config?.timeframe ?? "1h"}
          </p>
        </div>
      </div>

      {/* Right – controls */}
      <div className="flex items-center gap-3">
        {/* Signal count badge */}
        {status.signal_count > 0 && (
          <span className="rounded-full bg-neutral-800 text-neutral-300 text-xs font-bold px-2.5 py-0.5 border border-neutral-700">
            {status.signal_count} signals
          </span>
        )}

        {/* Connection indicator */}
        <span
          className={clsx(
            "flex items-center gap-1 text-xs rounded px-2 py-1",
            connected
              ? "text-bull bg-bull/10"
              : "text-bear bg-bear/10"
          )}
        >
          {connected
            ? <Wifi className="w-3.5 h-3.5" />
            : <WifiOff className="w-3.5 h-3.5" />}
          {connected ? "Live" : "Offline"}
        </span>

        {/* Auto scan toggle */}
        <button
          onClick={onToggleAuto}
          title={autoOn ? "Stop Auto Scan" : "Start Auto Scan"}
          className={clsx(
            "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
            autoOn
              ? "text-white bg-bull/80 hover:bg-bull"
              : "text-neutral-400 bg-neutral-800 hover:bg-neutral-700"
          )}
        >
          {autoOn
            ? <><Pause className="w-3.5 h-3.5" /> Auto: ON</>
            : <><Play  className="w-3.5 h-3.5" /> Auto: OFF</>}
        </button>

        {/* Trigger scan button */}
        <button
          onClick={onTrigger}
          disabled={status.running}
          className={clsx(
            "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all",
            status.running
              ? "text-neutral-500 bg-bg-card cursor-not-allowed"
              : "text-white bg-neutral-700 hover:bg-neutral-600 active:scale-95"
          )}
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", status.running && "animate-spin")} />
          {status.running ? "Scanning…" : "Scan Now"}
        </button>
      </div>
    </header>
  );
}
