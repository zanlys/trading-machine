"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";
import type { SignalData } from "@/types";

interface Props {
  data: SignalData;
}

function Gauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped < 20 ? "#22c55e" :
    clamped > 80 ? "#f43f5e" :
    "#6b7280";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9"
            fill="none" stroke="#2a2a2a" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9"
            fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${clamped} ${100 - clamped}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {clamped.toFixed(0)}
        </span>
      </div>
      <span className="text-[10px] text-neutral-500">{label}</span>
    </div>
  );
}

export function DetailPanel({ data }: Props) {
  const isLong  = data.signal === "long";
  // Binance symbols come as "MOVEUSDT" — strip USDT suffix for display
  const base = (data.symbol.split("/")[0] ?? data.symbol)
    .replace(/USDT$/i, "");

  const priceStr =
    data.close < 0.01 ? data.close.toFixed(6) :
    data.close < 1    ? data.close.toFixed(4) :
    data.close.toFixed(2);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            {base}<span className="text-neutral-500 font-normal">/USDT</span>
          </h2>
          <p className="text-xs text-neutral-500">{data.timeframe} · Binance Futures</p>
        </div>
        <span className={clsx(
          "flex items-center gap-1 rounded px-3 py-1 text-sm font-bold uppercase",
          isLong
            ? "bg-bull/20 text-bull border border-bull/30"
            : "bg-bear/20 text-bear border border-bear/30"
        )}>
          {isLong ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {data.signal}
        </span>
      </div>

      {/* Price */}
      <div className="rounded-lg bg-bg-card border border-bg-border p-3">
        <div className="text-xs text-neutral-500 mb-1">Current Price</div>
        <div className="text-2xl font-bold text-white">${priceStr}</div>
        <div className={clsx(
          "mt-1 text-xs font-medium",
          data.trend === "bullish" ? "text-bull" :
          data.trend === "bearish" ? "text-bear" :
          "text-neutral-500"
        )}>
          {data.trend.charAt(0).toUpperCase() + data.trend.slice(1)} trend
        </div>
      </div>

      {/* Moving Averages */}
      <div className="rounded-lg bg-bg-card border border-bg-border p-3 space-y-2">
        <div className="text-xs font-semibold text-neutral-400">Moving Averages (SMA)</div>
        {[
          { label: `SMA ${data.ma_fast_period}`, value: data.ma_fast, color: "text-neutral-400" },
          { label: `SMA ${data.ma_slow_period}`, value: data.ma_slow, color: "text-neutral-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center">
            <span className={clsx("text-xs", color)}>{label}</span>
            <span className="text-xs text-neutral-300 font-medium">
              ${value.toFixed(value < 1 ? 6 : 2)}
            </span>
            <span className={clsx(
              "text-[10px]",
              data.close > value ? "text-bull" : "text-bear"
            )}>
              Price {data.close > value ? "above ↑" : "below ↓"}
            </span>
          </div>
        ))}
      </div>

      {/* Stochastic RSI gauges */}
      <div className="rounded-lg bg-bg-card border border-bg-border p-3">
        <div className="text-xs font-semibold text-neutral-400 mb-3">Stochastic RSI</div>
        <div className="flex justify-around">
          <Gauge value={data.srsi_k} label="%K" />
          <Gauge value={data.srsi_d} label="%D" />
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-neutral-600 px-1">
          <span className="text-bull">Oversold &lt;20</span>
          <span className="text-neutral-500">Neutral 20–80</span>
          <span className="text-bear">Overbought &gt;80</span>
        </div>
        {(data.stoch_cross_up || data.stoch_cross_down) && (
          <div className={clsx(
            "mt-2 text-xs text-center font-semibold",
            data.stoch_cross_up ? "text-bull" : "text-bear"
          )}>
            ⚡ K/D Cross {data.stoch_cross_up ? "Upward" : "Downward"} detected
          </div>
        )}
      </div>

      {/* Score */}
      <div className="rounded-lg bg-bg-card border border-bg-border p-3">
        <div className="flex justify-between text-xs text-neutral-400 mb-2">
          <span>Signal Strength</span>
          <span className="font-bold text-white">{data.score}/100</span>
        </div>
        <div className="h-2 w-full rounded-full bg-bg-border overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-700",
              isLong ? "bg-bull" : "bg-bear"
            )}
            style={{ width: `${data.score}%` }}
          />
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-[10px] text-neutral-700 text-right">
        {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
