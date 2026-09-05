"use client";

import { TrendingUp, TrendingDown, Zap, BarChart2 } from "lucide-react";
import clsx from "clsx";
import type { SignalData } from "@/types";

interface Props {
  data:      SignalData;
  active:    boolean;
  onClick:   () => void;
}

/** Format volume USDT: 1.23B, 456.7M, 12.3K */
function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000)         return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
}

export function SignalCard({ data, active, onClick }: Props) {
  const isLong  = data.signal === "long";
  const isShort = data.signal === "short";

  // Binance symbols come as "MOVEUSDT" — strip the USDT suffix for display
  const baseName = (data.symbol.split("/")[0] ?? data.symbol)
    .replace(/USDT$/i, "");

  return (
    <button
      onClick={onClick}
      className={clsx(
        "slide-in w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-accent-blue/40",
        active
          ? isLong
            ? "border-bull/60 bg-bull/10 glow-bull"
            : "border-bear/60 bg-bear/10 glow-bear"
          : "border-bg-border bg-bg-card hover:border-bg-hover hover:bg-bg-hover"
      )}
    >
      {/* Row 1 – symbol + signal badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-white tracking-wide">
          {baseName}
          <span className="text-neutral-500 font-normal">/USDT</span>
        </span>

        <span
          className={clsx(
            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
            isLong  ? "bg-bull/20 text-bull"   :
            isShort ? "bg-bear/20 text-bear"   :
                      "bg-neutral-700/40 text-neutral-400"
          )}
        >
          {isLong  ? <TrendingUp  className="w-3 h-3" /> : null}
          {isShort ? <TrendingDown className="w-3 h-3" /> : null}
          {data.signal}
        </span>
      </div>

      {/* Row 2 – price + volume */}
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
        <span>
          Price{" "}
          <span className="text-neutral-200 font-medium">
            ${data.close < 0.01
              ? data.close.toFixed(6)
              : data.close < 1
              ? data.close.toFixed(4)
              : data.close.toFixed(2)}
          </span>
        </span>
        {data.volume_usdt != null && (
          <span className="flex items-center gap-1 text-neutral-500">
            <BarChart2 className="w-3 h-3" />
            <span className="text-neutral-300 font-medium">
              ${fmtVol(data.volume_usdt)}
            </span>
          </span>
        )}
      </div>

      {/* Row 3 – EMA info + touch badge */}
      <div className="mt-1 flex items-center gap-3 text-xs flex-wrap">
        <span className="text-neutral-500">
          EMA{data.ma_fast_period}{" "}
          <span className="text-neutral-300">{data.ma_fast.toFixed(2)}</span>
        </span>
        <span className="text-neutral-600">
          EMA{data.ma_slow_period}{" "}
          <span className="text-neutral-300">{data.ma_slow.toFixed(2)}</span>
        </span>
        {data.ema_touch_type && (
          <span className={clsx(
            "ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            isLong  ? "bg-bull/20 text-bull" : "bg-bear/20 text-bear"
          )}>
            ⟳ {data.ema_touch_type}
          </span>
        )}
      </div>

      {/* Row 4 – Stoch RSI */}
      <div className="mt-1 flex gap-3 text-xs">
        <span className="text-neutral-500">
          StochRSI K{" "}
          <span className={clsx(
            "font-medium",
            data.srsi_k < 20 ? "text-bull" :
            data.srsi_k > 80 ? "text-bear" : "text-neutral-300"
          )}>
            {data.srsi_k.toFixed(1)}
          </span>
        </span>
        <span className="text-neutral-500">
          D{" "}
          <span className={clsx(
            "font-medium",
            data.srsi_d < 20 ? "text-bull" :
            data.srsi_d > 80 ? "text-bear" : "text-neutral-300"
          )}>
            {data.srsi_d.toFixed(1)}
          </span>
        </span>
        {data.stoch_cross_up   && <span className="text-bull flex items-center gap-0.5"><Zap className="w-3 h-3" />Cross ↑</span>}
        {data.stoch_cross_down && <span className="text-bear flex items-center gap-0.5"><Zap className="w-3 h-3" />Cross ↓</span>}
      </div>

      {/* Row 5 – score bar */}
      <div className="mt-2">
        <div className="h-1 w-full rounded-full bg-bg-border overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-500",
              isLong ? "bg-bull" : "bg-bear"
            )}
            style={{ width: `${data.score}%` }}
          />
        </div>
        <div className="mt-0.5 text-right text-[10px] text-neutral-600">
          score {data.score}
        </div>
      </div>
    </button>
  );
}
