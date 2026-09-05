export type Trend  = "bullish" | "bearish" | "neutral";
export type Signal = "long" | "short" | "none";

export interface SignalData {
  symbol:           string;
  timestamp:        string;
  close:            number;
  ma_fast:          number;
  ma_slow:          number;
  srsi_k:           number;
  srsi_d:           number;
  trend:            Trend;
  signal:           Signal;
  stoch_cross_up:   boolean;
  stoch_cross_down: boolean;
  score:            number;
  timeframe:        string;
  ma_fast_period:   number;
  ma_slow_period:   number;
  /** Which EMA is being touched: e.g. "EMA20" or "EMA50" */
  ema_touch_type:   string;
  /** Percentage distance from the nearest touched EMA */
  ema_touch_pct:    number;
  /** Average quote volume in USDT (last 20 candles) */
  volume_usdt:      number;
}

export interface ScanStatus {
  running:        boolean;
  progress:       number;
  total:          number;
  current_symbol: string;
  last_scan:      string | null;
  signal_count:   number;
  auto_scan:      boolean;
  config?: {
    timeframe:  string;
    ma_fast:    number;
    ma_slow:    number;
    oversold:   number;
    overbought: number;
    interval:   number;
  };
}

export type WsMessage =
  | { type: "init";               status: ScanStatus; signals: SignalData[] }
  | { type: "scan_start" }
  | { type: "scan_complete";      signals: SignalData[]; count: number }
  | { type: "progress";           current: number; total: number; symbol: string; pct: number }
  | { type: "error";              message: string }
  | { type: "auto_scan_changed";  enabled: boolean }
  | { type: "pong" };
