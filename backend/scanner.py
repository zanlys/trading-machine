"""
Core scanner module.
Fetches OHLCV data directly from Binance Futures REST API via httpx
(avoids aiohttp/aiodns DNS issues on Windows).

Computes MA20/MA50 + Stochastic RSI and returns structured signal objects.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
import pandas as pd
from ta.trend import SMAIndicator
from ta.momentum import StochRSIIndicator
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
TIMEFRAME      = os.getenv("TIMEFRAME", "1h")
MA_FAST        = int(os.getenv("MA_FAST", 20))
MA_SLOW        = int(os.getenv("MA_SLOW", 50))
SRSI_PERIOD    = int(os.getenv("STOCH_RSI_PERIOD", 14))
SRSI_K         = int(os.getenv("STOCH_RSI_K", 3))
SRSI_D         = int(os.getenv("STOCH_RSI_D", 3))
OVERSOLD       = float(os.getenv("STOCH_OVERSOLD", 20))
OVERBOUGHT     = float(os.getenv("STOCH_OVERBOUGHT", 80))
QUOTE_CURRENCY = os.getenv("QUOTE_CURRENCY", "USDT")
CANDLES_LIMIT  = 150

# Binance Futures base URL
BASE_URL = "https://fapi.binance.com"

# Map our timeframe strings to Binance interval strings
TF_MAP = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "12h": "12h",
    "1d": "1d", "1w": "1w",
}


def get_binance_interval() -> str:
    return TF_MAP.get(TIMEFRAME, "1h")


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


def compute_indicators(raw: list) -> dict | None:
    """
    Compute MA fast/slow + Stochastic RSI from raw klines.
    Returns indicator dict or None if not enough data.
    """
    if not raw or len(raw) < CANDLES_LIMIT:
        return None

    # Binance kline: [open_time, open, high, low, close, volume, ...]
    df = pd.DataFrame(raw, columns=[
        "ts", "open", "high", "low", "close", "volume",
        "close_time", "qav", "num_trades", "taker_base", "taker_quote", "ignore"
    ])
    df["close"] = df["close"].astype(float)

    # Moving averages
    df["ma_fast"] = SMAIndicator(close=df["close"], window=MA_FAST).sma_indicator()
    df["ma_slow"] = SMAIndicator(close=df["close"], window=MA_SLOW).sma_indicator()

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

    close   = float(row["close"])
    ma_fast = float(row["ma_fast"])
    ma_slow = float(row["ma_slow"])
    srsi_k  = float(row["srsi_k"])
    srsi_d  = float(row["srsi_d"])

    # K/D cross (hitung dulu sebelum dipakai di logika sinyal)
    prev_k = float(prev["srsi_k"])
    prev_d = float(prev["srsi_d"])
    stoch_cross_up   = prev_k < prev_d and srsi_k > srsi_d
    stoch_cross_down = prev_k > prev_d and srsi_k < srsi_d

    # Trend
    if close > ma_fast and close > ma_slow and ma_fast > ma_slow:
        trend = "bullish"
    elif close < ma_fast and close < ma_slow and ma_fast < ma_slow:
        trend = "bearish"
    else:
        trend = "neutral"

    # Signal logic:
    # LONG  – trend bullish + StochRSI pullback ke oversold (momentum dip beli)
    #       ATAU trend bullish + K cross up dari bawah 50 (momentum baru mulai)
    # SHORT – trend bearish + StochRSI overbought (momentum jenuh jual)
    #       ATAU trend bearish + K cross down dari atas 50
    signal = "none"
    if trend == "bullish":
        if (srsi_k < OVERSOLD and srsi_d < OVERSOLD) or \
           (stoch_cross_up and srsi_k < 50):
            signal = "long"
    elif trend == "bearish":
        if (srsi_k > OVERBOUGHT and srsi_d > OVERBOUGHT) or \
           (stoch_cross_down and srsi_k > 50):
            signal = "short"

    # Strength score 0–100 (balanced):
    # - ma_gap_pct: seberapa jauh MA fast dari MA slow (trend strength), dikap 40 poin
    # - srsi_component: seberapa ekstrem StochRSI dari mid-point (50), max 40 poin
    # - cross_bonus: bonus 20 poin kalau ada K/D cross sesuai arah sinyal
    ma_gap_pct       = abs(ma_fast - ma_slow) / ma_slow * 100 if ma_slow else 0
    ma_component     = min(ma_gap_pct * 8, 40)
    srsi_component   = min(abs(srsi_k - 50) * 0.8, 40)
    cross_bonus      = 20 if (
        (signal == "long"  and stoch_cross_up) or
        (signal == "short" and stoch_cross_down)
    ) else 0
    score = min(round(ma_component + srsi_component + cross_bonus), 100)

    return {
        "close":            close,
        "ma_fast":          round(ma_fast, 6),
        "ma_slow":          round(ma_slow, 6),
        "srsi_k":           round(srsi_k, 2),
        "srsi_d":           round(srsi_d, 2),
        "trend":            trend,
        "signal":           signal,
        "stoch_cross_up":   stoch_cross_up,
        "stoch_cross_down": stoch_cross_down,
        "score":            score,
        "timeframe":        TIMEFRAME,
        "ma_fast_period":   MA_FAST,
        "ma_slow_period":   MA_SLOW,
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
        logger.info("Scanning %d symbols [%s]", total, TIMEFRAME)

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

    results = [r for r in raw if r and r["signal"] != "none"]
    results.sort(key=lambda x: x["score"], reverse=True)

    logger.info("Scan complete – %d signals found", len(results))
    return results
