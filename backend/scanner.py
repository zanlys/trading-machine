"""
Core scanner module.
Fetches OHLCV data directly from Binance Futures REST API via httpx
(avoids aiohttp/aiodns DNS issues on Windows).

Computes EMA20/EMA50 + Stochastic RSI and returns structured signal objects.
Filter: coins that are touching or approaching EMA20 or EMA50 on the 15m timeframe.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
import pandas as pd
from ta.trend import EMAIndicator
from ta.momentum import StochRSIIndicator
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
TIMEFRAME      = os.getenv("TIMEFRAME", "15m")
EMA_FAST       = int(os.getenv("MA_FAST", 20))
EMA_SLOW       = int(os.getenv("MA_SLOW", 50))
SRSI_PERIOD    = int(os.getenv("STOCH_RSI_PERIOD", 14))
SRSI_K         = int(os.getenv("STOCH_RSI_K", 3))
SRSI_D         = int(os.getenv("STOCH_RSI_D", 3))
OVERSOLD       = float(os.getenv("STOCH_OVERSOLD", 20))
OVERBOUGHT     = float(os.getenv("STOCH_OVERBOUGHT", 80))
QUOTE_CURRENCY = os.getenv("QUOTE_CURRENCY", "USDT")
CANDLES_LIMIT  = 150

# Distance threshold: harga dianggap "mendekati" EMA jika dalam X% dari EMA
EMA_TOUCH_PCT  = float(os.getenv("EMA_TOUCH_PCT", 0.5))   # default 0.5%

# Binance Futures base URL
BASE_URL = "https://fapi.binance.com"

# Map our timeframe strings to Binance interval strings
TF_MAP = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "12h": "12h",
    "1d": "1d", "1w": "1w",
}


def get_binance_interval() -> str:
    return TF_MAP.get(TIMEFRAME, "15m")


async def get_futures_symbols(client: httpx.AsyncClient) -> list[str]:
    """Fetch all active USDT perpetual futures symbols from Binance fapi."""
    resp = await client.get(f"{BASE_URL}/fapi/v1/exchangeInfo", timeout=15)
    resp.raise_for_status()
    data = resp.json()
    symbols = [
        s["symbol"]
        for s in data.get("symbols", [])
        if s.get("quoteAsset") == QUOTE_CURRENCY
        and s.get("contractType") == "PERPETUAL"
        and s.get("status") == "TRADING"
    ]
    return symbols


async def fetch_ohlcv(client: httpx.AsyncClient, symbol: str) -> list | None:
    """Fetch klines for one symbol. Returns list of rows or None on error."""
    try:
        resp = await client.get(
            f"{BASE_URL}/fapi/v1/klines",
            params={
                "symbol":   symbol,
                "interval": get_binance_interval(),
                "limit":    CANDLES_LIMIT,
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception as e:
        logger.debug("fetch_ohlcv error %s: %s", symbol, e)
        return None


def _pct_distance(price: float, ema: float) -> float:
    """Persentase jarak harga dari EMA (absolut)."""
    if ema == 0:
        return 999.0
    return abs(price - ema) / ema * 100


def compute_indicators(raw: list) -> dict | None:
    """
    Compute EMA fast/slow + Stochastic RSI from raw klines.
    Returns indicator dict or None if not enough data / no EMA touch signal.

    Signal logic:
    - Harga mendekati atau menyentuh EMA20 → "ema20_touch"
    - Harga mendekati atau menyentuh EMA50 → "ema50_touch"
    - "Mendekati" = jarak harga ke EMA ≤ EMA_TOUCH_PCT%
    - Arah (long/short) ditentukan dari posisi harga relatif terhadap kedua EMA
      dan konfirmasi StochRSI.
    """
    if not raw or len(raw) < CANDLES_LIMIT:
        return None

    # Binance kline: [open_time, open, high, low, close, volume, ...]
    df = pd.DataFrame(raw, columns=[
        "ts", "open", "high", "low", "close", "volume",
        "close_time", "qav", "num_trades", "taker_base", "taker_quote", "ignore"
    ])
    df["close"] = df["close"].astype(float)
    df["high"]  = df["high"].astype(float)
    df["low"]   = df["low"].astype(float)
    df["volume"] = df["volume"].astype(float)
    df["qav"]    = df["qav"].astype(float)   # quote asset volume (USDT)

    # EMAs
    df["ema_fast"] = EMAIndicator(close=df["close"], window=EMA_FAST).ema_indicator()
    df["ema_slow"] = EMAIndicator(close=df["close"], window=EMA_SLOW).ema_indicator()

    # Stochastic RSI (values 0–100)
    stoch = StochRSIIndicator(
        close=df["close"],
        window=SRSI_PERIOD,
        smooth1=SRSI_K,
        smooth2=SRSI_D,
        fillna=False,
    )
    df["srsi_k"] = stoch.stochrsi_k() * 100
    df["srsi_d"] = stoch.stochrsi_d() * 100

    df.dropna(inplace=True)
    if len(df) < 2:
        return None

    row  = df.iloc[-1]
    prev = df.iloc[-2]

    close    = float(row["close"])
    high     = float(row["high"])
    low      = float(row["low"])
    ema_fast = float(row["ema_fast"])
    ema_slow = float(row["ema_slow"])
    srsi_k   = float(row["srsi_k"])
    srsi_d   = float(row["srsi_d"])
    # Volume: total quote volume (USDT) over the last 24 hours
    # 1 day = 1440 min; candles_per_day = 1440 / timeframe_in_minutes
    _tf_minutes = {
        "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30,
        "1h": 60, "2h": 120, "4h": 240, "6h": 360, "12h": 720, "1d": 1440,
    }
    _candles_per_day = int(1440 / _tf_minutes.get(TIMEFRAME, 15))
    volume_usdt = float(df["qav"].tail(_candles_per_day).sum())

    prev_k = float(prev["srsi_k"])
    prev_d = float(prev["srsi_d"])
    stoch_cross_up   = prev_k < prev_d and srsi_k > srsi_d
    stoch_cross_down = prev_k > prev_d and srsi_k < srsi_d

    # ── EMA Touch Detection ──────────────────────────────────────────────────
    # Cek apakah candle menyentuh EMA (low ≤ EMA ≤ high atau close dalam X% dari EMA)
    def is_touching(ema_val: float) -> bool:
        candle_touch = low <= ema_val <= high
        price_close  = _pct_distance(close, ema_val) <= EMA_TOUCH_PCT
        return candle_touch or price_close

    touch_fast = is_touching(ema_fast)
    touch_slow = is_touching(ema_slow)

    # Tidak ada EMA yang disentuh → skip
    if not touch_fast and not touch_slow:
        return None

    # Tentukan EMA mana yang disentuh (prioritas EMA20 jika keduanya)
    if touch_fast:
        ema_touch_type = f"EMA{EMA_FAST}"
    else:
        ema_touch_type = f"EMA{EMA_SLOW}"

    # ── Trend (untuk menentukan arah sinyal) ─────────────────────────────────
    if close > ema_fast and close > ema_slow and ema_fast > ema_slow:
        trend = "bullish"
    elif close < ema_fast and close < ema_slow and ema_fast < ema_slow:
        trend = "bearish"
    else:
        trend = "neutral"

    # ── Signal direction ─────────────────────────────────────────────────────
    # LONG:  harga menyentuh EMA dari atas (bouncing di support EMA)
    #        + StochRSI tidak overbought
    # SHORT: harga menyentuh EMA dari bawah (rejected di resistance EMA)
    #        + StochRSI tidak oversold
    signal = "none"

    if touch_fast or touch_slow:
        # Bouncing dari EMA sebagai support → long setup
        if close >= ema_fast and srsi_k <= 60:
            signal = "long"
        elif close >= ema_slow and srsi_k <= 60:
            signal = "long"
        # Rejected dari EMA sebagai resistance → short setup
        elif close <= ema_fast and srsi_k >= 40:
            signal = "short"
        elif close <= ema_slow and srsi_k >= 40:
            signal = "short"
        else:
            # Di zona EMA tapi arah tidak jelas
            if trend == "bullish":
                signal = "long"
            elif trend == "bearish":
                signal = "short"

    if signal == "none":
        return None

    # ── Strength score 0–100 ─────────────────────────────────────────────────
    # - proximity_component: semakin dekat ke EMA semakin tinggi (max 50 poin)
    # - srsi_component: seberapa ekstrem StochRSI dari mid (50), max 30 poin
    # - cross_bonus: bonus 20 poin jika ada K/D cross sesuai arah
    best_pct = min(
        _pct_distance(close, ema_fast),
        _pct_distance(close, ema_slow)
    )
    # Jarak 0% → 50 poin, jarak EMA_TOUCH_PCT% → ~0 poin (linear)
    proximity_component = max(0.0, (EMA_TOUCH_PCT - best_pct) / EMA_TOUCH_PCT * 50)
    srsi_component      = min(abs(srsi_k - 50) * 0.6, 30)
    cross_bonus         = 20 if (
        (signal == "long"  and stoch_cross_up) or
        (signal == "short" and stoch_cross_down)
    ) else 0
    score = min(round(proximity_component + srsi_component + cross_bonus), 100)

    return {
        "close":            close,
        "ma_fast":          round(ema_fast, 6),
        "ma_slow":          round(ema_slow, 6),
        "srsi_k":           round(srsi_k, 2),
        "srsi_d":           round(srsi_d, 2),
        "trend":            trend,
        "signal":           signal,
        "stoch_cross_up":   stoch_cross_up,
        "stoch_cross_down": stoch_cross_down,
        "score":            score,
        "timeframe":        TIMEFRAME,
        "ma_fast_period":   EMA_FAST,
        "ma_slow_period":   EMA_SLOW,
        "ema_touch_type":   ema_touch_type,
        "ema_touch_pct":    round(best_pct, 3),
        "volume_usdt":      round(volume_usdt, 2),
    }


async def process_symbol(
    client: httpx.AsyncClient,
    symbol: str,
    sem: asyncio.Semaphore,
) -> dict | None:
    async with sem:
        raw = await fetch_ohlcv(client, symbol)
        if raw is None:
            return None
        result = compute_indicators(raw)
        if result is None:
            return None
        return {
            "symbol":    symbol,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **result,
        }


async def run_scan(
    progress_cb=None,
    concurrency: int = 10,
) -> list[dict]:
    """
    Full market scan using httpx directly against Binance fapi.
    progress_cb(current, total, symbol) is awaited after each symbol.
    Returns list of signal dicts sorted by score descending.
    """
    sem     = asyncio.Semaphore(concurrency)
    results: list[dict] = []

    async with httpx.AsyncClient() as client:
        symbols = await get_futures_symbols(client)
        total   = len(symbols)
        logger.info("Scanning %d symbols [%s] – EMA touch filter (%.1f%%)",
                    total, TIMEFRAME, EMA_TOUCH_PCT)

        done = 0

        async def guarded(sym: str) -> dict | None:
            nonlocal done
            result = await process_symbol(client, sym, sem)
            done += 1
            if progress_cb:
                await progress_cb(done, total, sym)
            return result

        tasks = [guarded(s) for s in symbols]
        raw   = await asyncio.gather(*tasks)

    results = [r for r in raw if r is not None]
    results.sort(key=lambda x: x["score"], reverse=True)

    logger.info("Scan complete – %d EMA-touch signals found", len(results))
    return results
