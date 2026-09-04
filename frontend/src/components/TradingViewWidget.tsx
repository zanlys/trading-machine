"use client";

import { useEffect, useRef, memo } from "react";

interface Props {
  symbol:    string;   // e.g. "BTCUSDT"
  interval?: string;   // e.g. "60"
}

// Map our timeframe strings to TradingView interval codes
const TF_MAP: Record<string, string> = {
  "1m":  "1",
  "3m":  "3",
  "5m":  "5",
  "15m": "15",
  "30m": "30",
  "1h":  "60",
  "2h":  "120",
  "4h":  "240",
  "6h":  "360",
  "12h": "720",
  "1d":  "D",
  "1w":  "W",
};

function toTVSymbol(raw: string) {
  // Binance scanner returns plain symbols like "BTCUSDT", "MOVEUSDT"
  // (no slash, already includes USDT suffix)
  // TradingView perpetual format: BINANCE:BTCUSDT.P
  //
  // Guard against legacy "BTC/USDT:USDT" format just in case:
  let base = raw.split("/")[0] ?? raw;   // "BTCUSDT" or "BTC"
  // If base does NOT already end with USDT, append it
  if (!base.toUpperCase().endsWith("USDT")) {
    base = `${base}USDT`;
  }
  return `BINANCE:${base}.P`;
}

export const TradingViewWidget = memo(function TradingViewWidget({
  symbol,
  interval = "60",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvInterval   = TF_MAP[interval] ?? interval;
  const tvSymbol     = toTVSymbol(symbol);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src  = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize:          true,
      symbol:            tvSymbol,
      interval:          tvInterval,
      timezone:          "Etc/UTC",
      theme:             "dark",
      style:             "1",
      locale:            "en",
      backgroundColor:   "#0d0d0d",
      gridColor:         "#2a2a2a",
      hide_top_toolbar:  false,
      hide_legend:       false,
      save_image:        false,
      hide_volume:       false,
      support_host:      "https://www.tradingview.com",
      studies: [
        "MASimple@tv-basicstudies",   // MA20
        "MASimple@tv-basicstudies",   // MA50
        "StochasticRSI@tv-basicstudies",
      ],
    });

    containerRef.current.appendChild(script);
  }, [tvSymbol, tvInterval]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: "100%", height: "100%" }}
    />
  );
});
