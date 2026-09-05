"use client";

import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import clsx from "clsx";
import type { SignalData } from "@/types";

interface Props {
  data: SignalData;
}

/** Format volume USDT: 1.23B, 456.7M, 12.3K */
function fmtVol(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000)         return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
}

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
        <div className="mt-2 flex items-center justify-between">
          <div className={clsx(
            "text-xs font-medium",
            data.trend === "bullish" ? "text-bull" :
            data.trend === "bearish" ? "text-bear" :
            "text-neutral-500"
          )}>
            {data.trend.charAt(0).toUpperCase() + data.trend.slice(1)} trend
          </div>
          {data.volume_usdt != null && (
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="text-neutral-400">Vol</span>
              <span className="text-neutral-200 font-medium">${fmtVol(data.volume_usdt)}</span>
              <span className="text-neutral-600 text-[10px]">24h</span>
            </div>
          )}
        </div>
      </div>

      {/* Moving Averages + EMA Touch */}
      <div className="rounded-lg bg-bg-card border border-bg-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-400">Moving Averages (EMA)</div>
          {data.ema_touch_type && (
            <span className={clsx(
              "text-[10px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wide",
              isLong ? "bg-bull/20 text-bull" : "bg-bear/20 text-bear"
            )}>
              ⟳ Touching {data.ema_touch_type}
            </span>
          )}
        </div>
        {[
          { label: `EMA ${data.ma_fast_period}`, value: data.ma_fast, color: "text-neutral-400" },
          { label: `EMA ${data.ma_slow_period}`, value: data.ma_slow, color: "text-neutral-500" },
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
        {data.ema_touch_pct !== undefined && (
          <div className="text-[10px] text-neutral-600 pt-1 border-t border-bg-border">
            Jarak ke EMA terdekat:{" "}
            <span className="text-neutral-400 font-medium">{data.ema_touch_pct.toFixed(3)}%</span>
          </div>
        )}
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
